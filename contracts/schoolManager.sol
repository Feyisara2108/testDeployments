// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// CONTRACT 1: SchoolToken ERC20 Token
contract SchoolToken {
    // BASIC TOKEN INFO
    string public constant name = "SchoolToken";
    string public constant symbol = "SCH";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf; //Who owns how many tokens?

    mapping(address => mapping(address => uint256)) public allowance; //Who can spend whose tokens

    address public owner;

    //EVENTS (For tracking)
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    //ERRORS
    error NotOwner(address caller);
    error ZeroAddress();
    error InsufficientBalance(uint256 available, uint256 required);
    error InsufficientAllowance(uint256 available, uint256 required);
    error NoETHToSend();
    error ETHTransferFailed();

    //MODIFIER:Only owner can call
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner(msg.sender);
        _;
    }

    constructor(uint256 _initialSupply) {
        owner = msg.sender;
        _mint(msg.sender, _initialSupply);
    }

    //TRANSFER: Send tokens to someone
    function transfer(address recipient, uint256 amount) external returns (bool) {
        if (recipient == address(0)) revert ZeroAddress();
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance(balanceOf[msg.sender], amount);

        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;

        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    // APPROVE: Allow someone to spend your tokens
    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // TRANSFER FROM: Spend tokens on behalf of someone
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        if (recipient == address(0)) revert ZeroAddress();
        if (allowance[sender][msg.sender] < amount) {
            revert InsufficientAllowance(allowance[sender][msg.sender], amount);
        }
        if (balanceOf[sender] < amount) revert InsufficientBalance(balanceOf[sender], amount);

        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;

        emit Transfer(sender, recipient, amount);
        return true;
    }

    // BUY TOKENS: Send ETH, get SchoolTokens (1:1 ratio) ---
    function buyTokens() public payable {
        if (msg.value == 0) revert NoETHToSend();

        // Give tokens equal to ETH sent (1 ETH = 1 Token)
        balanceOf[msg.sender] += msg.value;
        totalSupply += msg.value;

        emit Transfer(address(0), msg.sender, msg.value);
    }

    //SELL TOKENS: Send tokens back, get ETH (for staff to cash out)
    function sellTokens(uint256 amount) public {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance(balanceOf[msg.sender], amount);

        // Reduce balance first (security - prevent reentrancy)
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert ETHTransferFailed();

        emit Transfer(msg.sender, address(0), amount);
    }

    // MINT: Create new tokens (owner only)
    function mint(uint256 amount) external onlyOwner {
        _mint(msg.sender, amount);
    }

    //BURN: Destroy tokens
    function burn(uint256 amount) external {
        if (balanceOf[msg.sender] < amount) revert InsufficientBalance(balanceOf[msg.sender], amount);
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    // Internal mint function
    function _mint(address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
}

// CONTRACT 2: SchoolManager
contract SchoolManager {
    //State Variable
    SchoolToken public token;
    address public principal;

    // Struct
    struct Student {
        string name;
        uint256 level;
        bool hasPaid;
        uint256 paymentTimestamp;
    }

    struct Staff {
        string name;
        uint256 salary;
        bool isRegistered;
    }

    // Mapping & Array
    mapping(address => Student) public students;
    mapping(address => Staff) public staffRecords;
    address[] public studentList;
    address[] public staffList;

    // Errors: used custom Solidity errors used with revert to stop execution
    //something goes wrong (like insufficient balance or unauthorized access)
    //in a more gas-efficient way than traditional require strings.
    error NotPrincipal(address caller);
    error InvalidLevel(uint256 level);
    error AlreadyRegistered();
    error PaymentFailed();
    error StaffNotRegistered();

    //Modifier
    modifier onlyPrincipal() {
        if (msg.sender != principal) revert NotPrincipal(msg.sender);
        _;
    }

    // Constructor
    constructor(address _tokenAddress) {
        token = SchoolToken(_tokenAddress);
        principal = msg.sender;
    }

    // HELPER: Calculate Fee
    function _getFeeForLevel(uint256 level) internal pure returns (uint256) {
        // Level 100 = 10 tokens, Level 400 = 40 tokens
        // Multiply by 10**18 because tokens have 18 decimals
        if (level == 100) return 10 * 10 ** 18;
        if (level == 200) return 20 * 10 ** 18;
        if (level == 300) return 30 * 10 ** 18;
        if (level == 400) return 40 * 10 ** 18;
        revert InvalidLevel(level);
    }

    // Register student
    function registerStudent(string memory _name, uint256 _level) external {
        if (students[msg.sender].hasPaid) revert AlreadyRegistered();

        uint256 fee = _getFeeForLevel(_level);

        bool success = token.transferFrom(msg.sender, address(this), fee);
        if (!success) revert PaymentFailed();

        students[msg.sender] = Student({name: _name, level: _level, hasPaid: true, paymentTimestamp: block.timestamp});

        studentList.push(msg.sender);
    }

    // Get students
    function getStudent(address _student)
        external
        view
        returns (string memory name, uint256 level, bool hasPaid, uint256 paymentTimestamp)
    {
        Student memory s = students[_student];
        return (s.name, s.level, s.hasPaid, s.paymentTimestamp);
    }

    // Get all students
    function getAllStudents() external view returns (address[] memory) {
        return studentList;
    }

    // Register staff
    function registerStaff(address _staff, string memory _name, uint256 _salary) external onlyPrincipal {
        if (staffRecords[_staff].isRegistered) revert AlreadyRegistered();

        staffRecords[_staff] = Staff({name: _name, salary: _salary, isRegistered: true});

        staffList.push(_staff);
    }

    // Pay one staff
    function payStaff(address _staff) external onlyPrincipal {
        Staff memory s = staffRecords[_staff];
        if (!s.isRegistered) revert StaffNotRegistered();

        token.transfer(_staff, s.salary);
    }

    // Pay all staff
    function payAllStaff() external onlyPrincipal {
        for (uint256 i = 0; i < staffList.length; i++) {
            address staffAddr = staffList[i];
            Staff memory s = staffRecords[staffAddr];

            if (s.isRegistered && s.salary > 0) {
                token.transfer(staffAddr, s.salary);
            }
        }
    }

    // Get all staff
    function getAllStaff() external view returns (address[] memory) {
        return staffList;
    }

    // Get school balance
    function getSchoolBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
