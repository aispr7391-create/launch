// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title CurveMath
/// @notice Constant-product bonding curve on virtual reserves (x = token reserve, v = ETH reserve).
/// @dev Every rounding direction favours the curve, so x·v never decreases.
library CurveMath {
    /// @return out Tokens received for `ethIn` (fee already removed). Rounds down.
    function tokensOut(uint256 x, uint256 v, uint256 ethIn) internal pure returns (uint256 out) {
        out = Math.mulDiv(x, ethIn, v + ethIn);
    }

    /// @return ethIn ETH (excluding fee) required to buy exactly `amount` tokens. Rounds up.
    function ethInForTokens(uint256 x, uint256 v, uint256 amount) internal pure returns (uint256 ethIn) {
        ethIn = Math.mulDiv(v, amount, x - amount, Math.Rounding.Ceil);
    }

    /// @return out Gross ETH (before fee) received for selling `amountIn` tokens. Rounds down.
    function ethOut(uint256 x, uint256 v, uint256 amountIn) internal pure returns (uint256 out) {
        out = Math.mulDiv(v, amountIn, x + amountIn);
    }

    /// @notice Splits `supply` so that the curve's final price equals the DEX opening price.
    /// @param supply Total token supply.
    /// @param v0 Virtual ETH reserve at launch.
    /// @param target Real ETH raised when every curve token is sold.
    /// @param ethToLp ETH that goes into the DEX pool at graduation (target − graduation fee).
    /// @return curveTokens Tokens sold on the curve.
    /// @return lpTokens Tokens paired with `ethToLp` at graduation.
    /// @return x0 Initial virtual token reserve.
    function split(uint256 supply, uint256 v0, uint256 target, uint256 ethToLp)
        internal
        pure
        returns (uint256 curveTokens, uint256 lpTokens, uint256 x0)
    {
        // End state: x_end = v0·C/target, v_end = v0 + target  ⇒  p_end = target(v0+target)/(v0·C)
        // LP price:  ethToLp / L.  Setting them equal with S = C + L gives
        //   C = S·target(v0+target) / (target(v0+target) + ethToLp·v0)
        uint256 a = target * (v0 + target);
        curveTokens = Math.mulDiv(supply, a, a + ethToLp * v0);
        lpTokens = supply - curveTokens;
        x0 = Math.mulDiv(v0 + target, curveTokens, target);
    }
}
