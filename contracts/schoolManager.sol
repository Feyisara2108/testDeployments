// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ============================================================
// CONTRACT 1: SchoolToken
// This is the ERC20 token used as currency in the school system.
// Students buy tokens with ETH, use them to pay fees.
// Staff receive tokens as salary and can sell them back for ETH.
// ============================================================
contract SchoolToken {

    // ── TOKEN METADATA ──────────────────────────────────────
    // These are constant — they never change after deployment.
    string public constant name = "SchoolToken";
    string public constant symbol = "SCH";
    uint8 public constant decimals = 18;  // Like ETH, 1 token = 10^18 smallest units

    uint256 public totalSupply; // Tracks total tokens in existence

    // ── BALANCES & ALLOWANCES ───────────────────────────────
    // balanceOf: tracks how many tokens each address owns
    // allowance: tracks how many tokens address A allows address B to spend
    // This is the standard ERC20 approval mechanism
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner; // The deployer — has special mint privileges

    // ── EVENTS ──────────────────────────────────────────────
    // Events are logs stored on the blockchain.
    // Off-chain apps (like frontends) listen to these to track activity.
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    // ── CUSTOM ERRORS ───────────────────────────────────────
    // Custom errors are more gas-efficient than require() strings.
    // They also carry data (like the caller address) for debugging.
    error NotOwner(address caller);
    error ZeroAddress();
    error InsufficientBalance(uint256 available, uint256 required);
    error InsufficientAllowance(uint256 available, uint256 required);
    error InsufficientContractFunds();
    error NoETHToSend();
    error ETHTransferFailed();

    // ── MODIFIER ────────────────────────────────────────────
    // Modifiers are reusable guards placed on functions.
    // onlyOwner: reverts if caller is not the owner
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;  // ← continues executing the function body after this check
    }

    // ── CONSTRUCTOR ─────────────────────────────────────────
    // Runs ONCE when the contract is deployed.
    // Sets the owner and mints the initial token supply to the deployer.
    constructor(uint256 _initialSupply) {
        owner = msg.sender;
        _mint(msg.sender, _initialSupply);
    }

    // ── TRANSFER ────────────────────────────────────────────
    // Sends tokens directly from caller to recipient.
    // Logic:
    //   1. Validate recipient is not zero address
    //   2. Check caller has enough tokens
    //   3. Deduct from sender, add to recipient
    //   4. Emit event for tracking
    function transfer(address recipient, uint256 amount) external returns (bool) {
        if (recipient == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < amount) {
            revert InsufficientBalance(balanceOf[msg.sender], amount);
        }

        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;

        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    // ── APPROVE ─────────────────────────────────────────────
    // Grants another address permission to spend your tokens.
    // This is REQUIRED before SchoolManager can call transferFrom()
    // on a student's behalf.
    // Logic:
    //   1. Validate spender is not zero address
    //   2. Set allowance for spender
    //   3. Emit approval event
    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // ── TRANSFER FROM ───────────────────────────────────────
    // Lets an approved address spend tokens on behalf of sender.
    // Used by SchoolManager to collect fees from students.
    // Logic:
    //   1. Check recipient is valid
    //   2. Check caller has enough allowance from sender
    //   3. Check sender has enough balance
    //   4. Deduct allowance, deduct balance, add to recipient
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        if (recipient == address(0)) revert ZeroAddress();
        if (allowance[sender][msg.sender] < amount) {
            revert InsufficientAllowance(allowance[sender][msg.sender], amount);
        }
        if (balanceOf[sender] < amount) {
            revert InsufficientBalance(balanceOf[sender], amount);
        }

        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;

        emit Transfer(sender, recipient, amount);
        return true;
    }

    // ── BUY TOKENS ──────────────────────────────────────────
    // Students send ETH to this function to receive tokens.
    // Ratio: 1 ETH = 1 Token (both have 18 decimals so msg.value maps directly)
    // Logic:
    //   1. Reject zero ETH
    //   2. Mint tokens equal to ETH sent directly to buyer
    //   3. Contract holds the ETH for future sellTokens() calls
    function buyTokens() public payable {
        if (msg.value == 0) revert NoETHToSend();
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;
        emit Transfer(address(0), msg.sender, msg.value);
    }

    // ── SELL TOKENS ─────────────────────────────────────────
    // Staff sell tokens back to the contract in exchange for ETH.
    // Logic:
    //   1. Check caller has enough tokens
    //   2. Check contract has enough ETH to pay out
    //   3. Burn tokens FIRST (prevents reentrancy attack)
    //   4. Send ETH to caller
    // NOTE: Balance is reduced BEFORE the ETH transfer.
    // This is the Checks-Effects-Interactions pattern — a key security practice.
    function sellTokens(uint256 amount) public {
        if (balanceOf[msg.sender] < amount) {
            revert InsufficientBalance(balanceOf[msg.sender], amount);
        }

        // Check contract has enough ETH
        if (address(this).balance < amount) revert InsufficientContractFunds();

        // Effects: update state before external call
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        // Interactions: external call last
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert ETHTransferFailed();

        emit Transfer(msg.sender, address(0), amount);
    }

    // ── MINT (PUBLIC) ────────────────────────────────────────
    // UPDATED: now accepts a recipient address instead of always
    // minting to msg.sender. Owner can mint tokens to any address.
    // Useful for: distributing tokens to students, staff, or the school.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    // ── BURN ────────────────────────────────────────────────
    // Permanently destroys tokens from caller's balance.
    // Reduces total supply. Useful for deflationary mechanisms.
    function burn(uint256 amount) external {
        if (balanceOf[msg.sender] < amount) {
            revert InsufficientBalance(balanceOf[msg.sender], amount);
        }
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    // ── INTERNAL MINT ───────────────────────────────────────
    // Internal helper — only callable from within this contract.
    // Used by constructor, buyTokens(), and public mint().
    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    // Allows contract to receive ETH directly
    receive() external payable {}
}


// ============================================================
// CONTRACT 2: SchoolManager
// Manages students, staff, fees, and salaries using SchoolToken.
// The principal (deployer) is the admin of this contract.
// ============================================================
contract SchoolManager {

    // ── STATE VARIABLES ─────────────────────────────────────
    SchoolToken public token;   // Reference to the deployed SchoolToken
    address public principal;   // Admin of the school system

    // ── STRUCTS ─────────────────────────────────────────────
    // Structs group related data together under one type.
    // Student: stores all info about a registered student
    struct Student {
        string name;
        uint256 level;              // 100, 200, 300, or 400
        bool hasPaid;               // true once they've registered and paid
        uint256 paymentTimestamp;   // when they paid (block.timestamp)
    }

    // Staff: stores all info about a registered staff member
    struct Staff {
        string name;
        uint256 salary;         // monthly salary in tokens
        bool isRegistered;      // false if removed
    }

    // ── MAPPINGS & ARRAYS ───────────────────────────────────
    // Mappings give O(1) lookup by address.
    // Arrays let us iterate over all students/staff.
    mapping(address => Student) public students;
    mapping(address => Staff) public staffRecords;
    address[] public studentList;
    address[] public staffList;

    // ── CUSTOM ERRORS ───────────────────────────────────────
    error NotPrincipal(address caller);
    error InvalidLevel(uint256 level);
    error AlreadyRegistered();
    error PaymentFailed();
    error StaffNotRegistered();
    error InsufficientSchoolFunds(uint256 available, uint256 required);
    error NothingToWithdraw();

    // ── EVENTS ──────────────────────────────────────────────
    event StudentRegistered(address indexed student, string name, uint256 level);
    event StaffRegistered(address indexed staff, string name, uint256 salary);
    event StaffPaid(address indexed staff, uint256 amount);
    event StaffRemoved(address indexed staff);
    event SalaryUpdated(address indexed staff, uint256 newSalary);
    event FeesWithdrawn(address indexed principal, uint256 amount);

    // ── MODIFIER ────────────────────────────────────────────
    modifier onlyPrincipal() {
        if (msg.sender != principal) revert NotPrincipal(msg.sender);
        _;
    }

    // ── CONSTRUCTOR ─────────────────────────────────────────
    // Links SchoolManager to an already-deployed SchoolToken.
    // Sets the deployer as the principal (admin).
    constructor(address _tokenAddress) {
    token = SchoolToken(payable(_tokenAddress)); // ← add payable
    principal = msg.sender;
}
    // ── FEE CALCULATOR ──────────────────────────────────────
    // Internal pure function — doesn't read or write state.
    // Returns the token fee based on the student's level.
    // Pure functions are the cheapest to call (no state access).
    function _getFeeForLevel(uint256 level) internal pure returns (uint256) {
        if (level == 100) return 10 * 10 ** 18;
        if (level == 200) return 20 * 10 ** 18;
        if (level == 300) return 30 * 10 ** 18;
        if (level == 400) return 40 * 10 ** 18;
        revert InvalidLevel(level);
    }

    // ── REGISTER STUDENT ────────────────────────────────────
    // Students call this to register and pay their fee.
    // BEFORE calling this, student must call:
    //     token.approve(SchoolManagerAddress, fee)
    // Logic:
    //   1. Check not already registered
    //   2. Calculate fee based on level
    //   3. Pull tokens from student via transferFrom
    //   4. Store student data and add to list
    //   5. Emit event
    function registerStudent(string memory _name, uint256 _level) external {
        if (students[msg.sender].hasPaid) revert AlreadyRegistered();

        uint256 fee = _getFeeForLevel(_level);

        bool success = token.transferFrom(msg.sender, address(this), fee);
        if (!success) revert PaymentFailed();

        students[msg.sender] = Student({
            name: _name,
            level: _level,
            hasPaid: true,
            paymentTimestamp: block.timestamp
        });

        studentList.push(msg.sender);

        emit StudentRegistered(msg.sender, _name, _level);
    }

    // ── GET STUDENT ─────────────────────────────────────────
    // Returns all info about a specific student.
    // Anyone can query this — it's a view function (free to call).
    function getStudent(address _student)
        external
        view
        returns (string memory name, uint256 level, bool hasPaid, uint256 paymentTimestamp)
    {
        Student memory s = students[_student];
        return (s.name, s.level, s.hasPaid, s.paymentTimestamp);
    }

    // ── GET ALL STUDENTS ────────────────────────────────────
    // Returns the full list of student addresses.
    // Combine with getStudent() to get details for each.
    function getAllStudents() external view returns (address[] memory) {
        return studentList;
    }

    // NEW: Get total student count
    function getStudentCount() external view returns (uint256) {
        return studentList.length;
    }

    // ── REGISTER STAFF ──────────────────────────────────────
    // Only the principal can register staff.
    // Logic:
    //   1. Check caller is principal
    //   2. Check staff not already registered
    //   3. Store staff data and add to list
    //   4. Emit event
    function registerStaff(
        address _staff,
        string memory _name,
        uint256 _salary
    ) external onlyPrincipal {
        if (staffRecords[_staff].isRegistered) revert AlreadyRegistered();

        staffRecords[_staff] = Staff({
            name: _name,
            salary: _salary,
            isRegistered: true
        });

        staffList.push(_staff);

        emit StaffRegistered(_staff, _name, _salary);
    }

    // ── PAY ONE STAFF ───────────────────────────────────────
    // UPDATED: Now checks the school has enough tokens before paying.
    // Logic:
    //   1. Verify staff is registered
    //   2. Check school balance is sufficient
    //   3. Transfer salary tokens to staff
    //   4. Emit event
    function payStaff(address _staff) external onlyPrincipal {
        Staff memory s = staffRecords[_staff];
        if (!s.isRegistered) revert StaffNotRegistered();

        uint256 schoolBalance = token.balanceOf(address(this));
        if (schoolBalance < s.salary) {
            revert InsufficientSchoolFunds(schoolBalance, s.salary);
        }

        token.transfer(_staff, s.salary);

        emit StaffPaid(_staff, s.salary);
    }

    // ── PAY ALL STAFF ───────────────────────────────────────
    // UPDATED: Checks total salary needed vs available balance upfront.
    // Logic:
    //   1. Calculate total salary needed for all active staff
    //   2. Check school has enough tokens for everyone
    //   3. Loop and pay each registered staff member
    function payAllStaff() external onlyPrincipal {
        // Calculate total needed first
        uint256 totalNeeded = 0;
        for (uint256 i = 0; i < staffList.length; i++) {
            Staff memory s = staffRecords[staffList[i]];
            if (s.isRegistered && s.salary > 0) {
                totalNeeded += s.salary;
            }
        }

        uint256 schoolBalance = token.balanceOf(address(this));
        if (schoolBalance < totalNeeded) {
            revert InsufficientSchoolFunds(schoolBalance, totalNeeded);
        }

        // Now pay everyone
        for (uint256 i = 0; i < staffList.length; i++) {
            address staffAddr = staffList[i];
            Staff memory s = staffRecords[staffAddr];

            if (s.isRegistered && s.salary > 0) {
                token.transfer(staffAddr, s.salary);
                emit StaffPaid(staffAddr, s.salary);
            }
        }
    }

    // NEW: UPDATE STAFF SALARY ────────────────────────────────
    // Principal can update a staff member's salary.
    // Logic:
    //   1. Verify staff is registered
    //   2. Update salary in the mapping
    //   3. Emit event
    function updateStaffSalary(address _staff, uint256 _newSalary) external onlyPrincipal {
        if (!staffRecords[_staff].isRegistered) revert StaffNotRegistered();
        staffRecords[_staff].salary = _newSalary;
        emit SalaryUpdated(_staff, _newSalary);
    }

    // NEW: REMOVE STAFF ──────────────────────────────────────
    // Marks a staff member as inactive without deleting their record.
    // We set isRegistered = false instead of deleting because:
    //   - Deletion from arrays is expensive in Solidity
    //   - We preserve history of who was ever registered
    // Logic:
    //   1. Verify staff is currently registered
    //   2. Set isRegistered to false
    //   3. Emit event
    function removeStaff(address _staff) external onlyPrincipal {
        if (!staffRecords[_staff].isRegistered) revert StaffNotRegistered();
        staffRecords[_staff].isRegistered = false;
        emit StaffRemoved(_staff);
    }

    // NEW: WITHDRAW FEES ─────────────────────────────────────
    // Principal withdraws collected student fees from the contract.
    // Logic:
    //   1. Check contract has tokens to withdraw
    //   2. Transfer all tokens to principal
    //   3. Emit event
    // NOTE: Withdraws full balance — you could also accept an
    // _amount parameter if partial withdrawals are needed.
    function withdrawFees(uint256 _amount) external onlyPrincipal {
        uint256 schoolBalance = token.balanceOf(address(this));
        if (schoolBalance == 0) revert NothingToWithdraw();
        if (_amount > schoolBalance) {
            revert InsufficientSchoolFunds(schoolBalance, _amount);
        }

        token.transfer(principal, _amount);

        emit FeesWithdrawn(principal, _amount);
    }

    // ── GET ALL STAFF ───────────────────────────────────────
    function getAllStaff() external view returns (address[] memory) {
        return staffList;
    }

    // NEW: Get total staff count
    function getStaffCount() external view returns (uint256) {
        return staffList.length;
    }

    // ── GET SCHOOL BALANCE ──────────────────────────────────
    // Returns how many tokens the school currently holds.
    // Used to check if school can pay staff or needs more fees collected.
    function getSchoolBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}