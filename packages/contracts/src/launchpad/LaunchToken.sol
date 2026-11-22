// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title LaunchToken
/// @notice Fixed-supply ERC-20 created by the PROJECT X launchpad. No owner, no mint, no tax.
/// @dev Before graduation, tokens may only move to or from the launchpad (curve buys and sells).
///      This stops anyone from seeding a DEX pool with token-side liquidity before the
///      official graduation pool exists. `openTrading` is one-way and only the launchpad
///      can call it.
contract LaunchToken is ERC20, ERC20Permit {
    address public immutable launchpad;
    bool public tradingOpen;

    error TransfersLocked();
    error OnlyLaunchpad();

    event TradingOpened();

    constructor(string memory name_, string memory symbol_, uint256 supply_, address launchpad_)
        ERC20(name_, symbol_)
        ERC20Permit(name_)
    {
        launchpad = launchpad_;
        _mint(launchpad_, supply_);
    }

    function openTrading() external {
        if (msg.sender != launchpad) revert OnlyLaunchpad();
        tradingOpen = true;
        emit TradingOpened();
    }

    function _update(address from, address to, uint256 value) internal override {
        if (!tradingOpen && from != address(0) && from != launchpad && to != launchpad) {
            revert TransfersLocked();
        }
        super._update(from, to, value);
    }
}
