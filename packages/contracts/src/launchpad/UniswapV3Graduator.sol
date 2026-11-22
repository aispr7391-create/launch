// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IGraduator} from "../interfaces/IGraduator.sol";
import {
    INonfungiblePositionManager,
    IUniswapV3Factory,
    IUniswapV3Pool,
    IWETH9
} from "../interfaces/IUniswapV3.sol";

/// @title UniswapV3Graduator
/// @notice Turns a completed curve into a full-range Uniswap v3 position that is held by this
///         contract forever. Liquidity can never be removed; only swap fees can be collected,
///         and only to `feeRecipient`.
/// @dev Uses the official Robinhood Chain NonfungiblePositionManager. WETH and the factory are
///      read from it on-chain instead of being hard-coded.
contract UniswapV3Graduator is IGraduator, Ownable2Step {
    using SafeERC20 for IERC20;

    /// @dev Uniswap v3 TickMath bounds.
    int24 internal constant MAX_TICK = 887_272;
    uint160 internal constant MIN_SQRT_RATIO = 4_295_128_739;
    uint160 internal constant MAX_SQRT_RATIO = 1_461_446_703_485_210_103_287_273_052_203_988_822_378_723_970_342;
    /// @dev Max allowed gap between target and final sqrt price (50 bps of sqrt ≈ 1 % in price).
    uint256 public constant MAX_SQRT_DEVIATION_BPS = 50;
    address internal constant DEAD = 0x000000000000000000000000000000000000dEaD;

    INonfungiblePositionManager public immutable positionManager;
    IUniswapV3Factory public immutable factory;
    address public immutable weth;
    address public immutable launchpad;
    uint24 public immutable fee;
    int24 public immutable tickLower;
    int24 public immutable tickUpper;

    address public feeRecipient;
    mapping(address token => uint256 positionId) public positionOf;

    address private _activePool;

    event PositionCreated(address indexed token, address indexed pool, uint256 positionId, uint128 liquidity);
    event PriceCorrected(address indexed pool, uint160 fromSqrtPrice, uint160 toSqrtPrice);
    event FeesCollected(address indexed token, uint256 amount0, uint256 amount1);
    event FeeRecipientUpdated(address recipient);

    error OnlyLaunchpad();
    error InvalidCallback();
    error PriceOutOfRange();
    error PriceDeviation();
    error UnsupportedFee();
    error ZeroAddress();

    constructor(
        INonfungiblePositionManager positionManager_,
        address launchpad_,
        uint24 fee_,
        address feeRecipient_,
        address owner_
    ) Ownable(owner_) {
        if (launchpad_ == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        positionManager = positionManager_;
        factory = IUniswapV3Factory(positionManager_.factory());
        weth = positionManager_.WETH9();
        launchpad = launchpad_;
        fee = fee_;
        int24 spacing = factory.feeAmountTickSpacing(fee_);
        if (spacing == 0) revert UnsupportedFee();
        tickUpper = (MAX_TICK / spacing) * spacing;
        tickLower = -tickUpper;
        feeRecipient = feeRecipient_;
    }

    /// @inheritdoc IGraduator
    function graduate(address token, uint256 tokenAmount)
        external
        payable
        returns (address pool, uint256 positionId)
    {
        if (msg.sender != launchpad) revert OnlyLaunchpad();

        IERC20(token).safeTransferFrom(launchpad, address(this), tokenAmount);
        IWETH9(weth).deposit{value: msg.value}();

        bool tokenIs0 = token < weth;
        (address t0, address t1) = tokenIs0 ? (token, weth) : (weth, token);
        pool = _initPool(t0, t1, tokenIs0 ? tokenAmount : msg.value, tokenIs0 ? msg.value : tokenAmount);

        uint128 liquidity;
        (positionId, liquidity) = _mintFullRange(t0, t1);
        positionOf[token] = positionId;
        _sweep(token);

        emit PositionCreated(token, pool, positionId, liquidity);
    }

    /// @dev Creates/initialises the pool at the curve's final price. If someone initialised it
    ///      earlier at another price, moves it back. Token-side liquidity cannot exist yet
    ///      (transfers were locked), so this costs little or nothing.
    function _initPool(address t0, address t1, uint256 a0, uint256 a1) internal returns (address pool) {
        uint160 target = _sqrtPriceX96(a0, a1);
        pool = positionManager.createAndInitializePoolIfNecessary(t0, t1, fee, target);
        (uint160 current,,,,,,) = IUniswapV3Pool(pool).slot0();
        if (current != target) {
            _movePrice(pool, t0, t1, current, target);
            (current,,,,,,) = IUniswapV3Pool(pool).slot0();
            uint256 diff = current > target ? current - target : target - current;
            if (diff * 10_000 > uint256(target) * MAX_SQRT_DEVIATION_BPS) revert PriceDeviation();
        }
    }

    function _mintFullRange(address t0, address t1) internal returns (uint256 positionId, uint128 liquidity) {
        uint256 b0 = IERC20(t0).balanceOf(address(this));
        uint256 b1 = IERC20(t1).balanceOf(address(this));
        IERC20(t0).forceApprove(address(positionManager), b0);
        IERC20(t1).forceApprove(address(positionManager), b1);
        (positionId, liquidity,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: t0,
                token1: t1,
                fee: fee,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: b0,
                amount1Desired: b1,
                amount0Min: 0, // price was checked in this same transaction
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp
            })
        );
        IERC20(t0).forceApprove(address(positionManager), 0);
        IERC20(t1).forceApprove(address(positionManager), 0);
    }

    /// @dev Rounding dust: leftover launch tokens are burned, leftover WETH goes to the treasury.
    function _sweep(address token) internal {
        uint256 leftToken = IERC20(token).balanceOf(address(this));
        if (leftToken > 0) IERC20(token).safeTransfer(DEAD, leftToken);
        uint256 leftWeth = IERC20(weth).balanceOf(address(this));
        if (leftWeth > 0) IERC20(weth).safeTransfer(feeRecipient, leftWeth);
    }

    /// @notice Collect swap fees of a graduated token's position to `feeRecipient`. Callable by anyone.
    function collectFees(address token) external returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: positionOf[token],
                recipient: feeRecipient,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        emit FeesCollected(token, amount0, amount1);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        emit FeeRecipientUpdated(recipient);
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        if (msg.sender != _activePool || msg.sender == address(0)) revert InvalidCallback();
        (address t0, address t1) = abi.decode(data, (address, address));
        if (amount0Delta > 0) IERC20(t0).safeTransfer(msg.sender, uint256(amount0Delta));
        if (amount1Delta > 0) IERC20(t1).safeTransfer(msg.sender, uint256(amount1Delta));
    }

    function _movePrice(address pool, address t0, address t1, uint160 current, uint160 target) internal {
        bool zeroForOne = current > target; // token0 is overpriced → sell token0
        uint256 budget = IERC20(zeroForOne ? t0 : t1).balanceOf(address(this));
        _activePool = pool;
        IUniswapV3Pool(pool).swap(address(this), zeroForOne, int256(budget), target, abi.encode(t0, t1));
        _activePool = address(0);
        emit PriceCorrected(pool, current, target);
    }

    /// @dev sqrt(amount1 / amount0) · 2^96
    function _sqrtPriceX96(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        uint256 priceX192 = Math.mulDiv(amount1, 1 << 192, amount0);
        uint256 s = Math.sqrt(priceX192);
        if (s < MIN_SQRT_RATIO || s >= MAX_SQRT_RATIO) revert PriceOutOfRange();
        return uint160(s);
    }
}
