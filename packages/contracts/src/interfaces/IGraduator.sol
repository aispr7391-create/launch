// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Moves a completed bonding curve into permanent DEX liquidity.
/// @dev Called only by the launchpad, with the LP ETH as msg.value. The graduator pulls
///      `tokenAmount` of `token` from the launchpad (which approves it first).
interface IGraduator {
    function graduate(address token, uint256 tokenAmount) external payable returns (address pool, uint256 positionId);
}
