// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

contract SaveStore {
    mapping(address => uint256) public etherBalance; // Ether saved by users

    // ERC20 saved by users
    // user => tokenAddress => amount
    mapping(address => mapping(address => uint256)) public tokenBalance;

    event EtherDeposited(address indexed user, uint256 amount);
    event EtherWithdrawn(address indexed user, uint256 amount);

    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event TokenWithdrawn(address indexed user, address indexed token, uint256 amount);

    // ETHER FUNCTIONS
    function depositEther() external payable {
        require(msg.value > 0, "Send Ether");

        etherBalance[msg.sender] += msg.value;

        emit EtherDeposited(msg.sender, msg.value);
    }

    function withdrawEther(uint256 amount) external {
        require(etherBalance[msg.sender] >= amount, "Insufficient balance");

        etherBalance[msg.sender] -= amount;

        payable(msg.sender).transfer(amount);

        emit EtherWithdrawn(msg.sender, amount);
    }

    function checkEtherBalance() external view returns (uint256) {
        return etherBalance[msg.sender];
    }

    // ERC20 FUNCTIONS
    function depositToken(address token, uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        // User must approve this contract first
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        tokenBalance[msg.sender][token] += amount;

        emit TokenDeposited(msg.sender, token, amount);
    }

    function withdrawToken(address token, uint256 amount) external {
        require(tokenBalance[msg.sender][token] >= amount, "Insufficient token balance");

        tokenBalance[msg.sender][token] -= amount;

        IERC20(token).transfer(msg.sender, amount);

        emit TokenWithdrawn(msg.sender, token, amount);
    }

    function checkTokenBalance(address token) external view returns (uint256) {
        return tokenBalance[msg.sender][token];
    }
}
