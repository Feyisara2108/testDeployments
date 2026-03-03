// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

//Mapping is a key value pair like using the same nin and bvn to open different account
contract SaveEther {
    mapping(address => uint256) public balances;

    uint256 age;
    //events are way to
    event DepositSuccessful(address indexed sender, uint256 indexed amount);

    event WithdrawalSuccessful(address indexed receiver, uint256 indexed amount);

    //a function to deposit: require is used to check if its true or not
    function deposit() external payable {
        //require(msg.sender != address(0), "Address zero detected");  this is a sanity check
        require(msg.value > 0, "Can't deposit zero value");

        balances[msg.sender] = balances[msg.sender] + msg.value;

        // balances[msg.sender] += msg.value;

        emit DepositSuccessful(msg.sender, msg.value);
    }

    function withdraw(uint256 _amount) external {
        require(msg.sender != address(0), "Address zero detected");

        require(_amount > 0, "Can't withdraw zero value");

        uint256 userSavings_ = balances[msg.sender];

        require(userSavings_ > 0, "Insufficient funds");

        balances[msg.sender] = userSavings_ - _amount;

        // (bool result,) = msg.sender.call{value: msg.value}("");
        (bool result,) = payable(msg.sender).call{value: _amount}("");

        require(result, "transfer failed");

        emit WithdrawalSuccessful(msg.sender, _amount);
    }

    function getUserSavings() external view returns (uint256) {
        return balances[msg.sender];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    //when writing a native function that has to receive an eth, we need receive and fallback
    receive() external payable {}
    fallback() external {}
}
