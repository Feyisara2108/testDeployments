// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PropertyManager is Ownable {
    struct Property {
        uint256 id;
        string name;
        string location;
        string description;
        uint256 price;
        address owner;
        bool isListed;
        bool isSold;
    }

    mapping(uint256 => Property) public properties;
    uint256 public propertyCount;
    IERC20 public paymentToken;

    event PropertyCreated(uint256 id, string name, address owner, uint256 price);
    event PropertyRemoved(uint256 id);
    event PropertySold(uint256 id, address buyer, uint256 price);

    modifier validProperty(uint256 id) {
        require(id > 0 && id <= propertyCount, "Property does not exist");
        _;
    }

    modifier isActive(uint256 id) {
        require(properties[id].isListed, "Property not for sale");
        require(!properties[id].isSold, "Property already sold");
        _;
    }

    constructor(address _token) Ownable(msg.sender) {
        paymentToken = IERC20(_token);
    }

    function createProperty(string memory name, string memory location, string memory description, uint256 price)
        public
        onlyOwner
    {
        require(price > 0, "Price must be greater than zero");

        propertyCount++;

        properties[propertyCount] = Property({
            id: propertyCount,
            name: name,
            location: location,
            description: description,
            price: price,
            owner: msg.sender,
            isListed: true,
            isSold: false
        });

        emit PropertyCreated(propertyCount, name, msg.sender, price);
    }

    function removeProperty(uint256 id) public onlyOwner validProperty(id) {
        properties[id].isListed = false;
        emit PropertyRemoved(id);
    }

    function buyProperty(uint256 id) public validProperty(id) isActive(id) {
        Property storage prop = properties[id];

        require(msg.sender != prop.owner, "You already own this");

        bool success = paymentToken.transferFrom(msg.sender, prop.owner, prop.price);
        require(success, "Token transfer failed");

        prop.owner = msg.sender;
        prop.isSold = true;
        prop.isListed = false;

        emit PropertySold(id, msg.sender, prop.price);
    }

    function getAllProperties() public view returns (Property[] memory) {
        Property[] memory all = new Property[](propertyCount);

        for (uint256 i = 1; i <= propertyCount; i++) {
            all[i - 1] = properties[i];
        }
        return all;
    }

    function getProperty(uint256 id) public view validProperty(id) returns (Property memory) {
        return properties[id];
    }
}
