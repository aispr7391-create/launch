// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGraduator} from "../../src/interfaces/IGraduator.sol";

contract MockERC20 is ERC20 {
    constructor(string memory n, string memory s) ERC20(n, s) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Takes 1 % on every transfer, to test balance-delta accounting.
contract FeeOnTransferERC20 is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xFEE), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

/// @dev Records what it receives; stands in for a real DEX in unit tests.
contract MockGraduator is IGraduator {
    address public lastToken;
    uint256 public lastTokenAmount;
    uint256 public lastEth;
    uint256 public calls;

    function graduate(address token, uint256 tokenAmount) external payable returns (address, uint256) {
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        lastToken = token;
        lastTokenAmount = tokenAmount;
        lastEth = msg.value;
        calls++;
        return (address(0xB001), calls);
    }

    /// @dev Graduated tokens must be freely transferable.
    function moveTokens(address token, address to, uint256 amount) external {
        IERC20(token).transfer(to, amount);
    }
}

contract RevertingGraduator is IGraduator {
    function graduate(address, uint256) external payable returns (address, uint256) {
        revert("pool unavailable");
    }
}
