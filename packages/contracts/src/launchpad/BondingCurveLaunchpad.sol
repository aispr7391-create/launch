// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {LaunchToken} from "./LaunchToken.sol";
import {CurveMath} from "./CurveMath.sol";
import {IGraduator} from "../interfaces/IGraduator.sol";

/// @title BondingCurveLaunchpad
/// @notice Creates fixed-supply tokens that trade on a virtual-reserve bonding curve and
///         graduate automatically into permanent DEX liquidity once every curve token is sold.
/// @dev Trust model:
///      - Curve parameters are snapshotted per token at creation; later config changes only
///        affect new launches.
///      - The trade fee is hard-capped at MAX_FEE_BPS. The owner cannot touch user ETH held
///        in a curve; only accrued protocol fees are withdrawable.
///      - Pausing stops new launches and buys. Sells are never blocked.
contract BondingCurveLaunchpad is Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────── Constants ───────────────────────────────
    uint256 public constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 200; // 2 %
    uint256 public constant MIN_SUPPLY = 1_000_000e18;
    uint256 public constant MAX_SUPPLY = 1_000_000_000_000e18;
    uint256 public constant MAX_NAME_LENGTH = 32;
    uint256 public constant MAX_SYMBOL_LENGTH = 10;

    // ─────────────────────────────── Types ───────────────────────────────────
    enum Status {
        None,
        Trading,
        GraduationPending,
        Graduated
    }

    struct Config {
        uint128 virtualEth; // initial virtual ETH reserve
        uint128 targetEth; // real ETH raised when the curve completes
        uint128 graduationFee; // protocol fee taken from targetEth at graduation
        uint128 creationFee; // flat fee to create a token
        uint16 tradeFeeBps; // fee on every curve buy/sell (ETH side)
        uint16 creatorShareBps; // share of the trade fee paid to the token creator
        uint32 graduationGasReserve; // min gas that must remain to attempt graduation
    }

    struct Launch {
        address creator;
        Status status;
        uint16 tradeFeeBps;
        uint16 creatorShareBps;
        uint40 createdAt;
        uint256 x; // virtual token reserve
        uint256 v; // virtual ETH reserve (= virtualEth + realEth)
        uint256 realEth; // ETH actually held for this curve
        uint256 curveSupply; // tokens sellable on the curve
        uint256 curveLeft; // curve tokens not yet sold
        uint256 lpTokens; // tokens reserved for graduation liquidity
        uint256 graduationFee;
        address pool; // set at graduation
    }

    // ─────────────────────────────── Storage ─────────────────────────────────
    Config public config;
    IGraduator public graduator;

    mapping(address token => Launch) internal _launches;
    address[] public allTokens;

    mapping(address creator => uint256) public creatorFees;
    uint256 public protocolFees;

    // ─────────────────────────────── Events ──────────────────────────────────
    event TokenCreated(
        address indexed token, address indexed creator, string name, string symbol, uint256 supply, string metadataURI
    );
    event CurveInitialized(
        address indexed token, uint256 curveSupply, uint256 lpTokens, uint256 x0, uint256 virtualEth, uint256 targetEth
    );
    event Trade(
        address indexed token,
        address indexed trader,
        bool indexed isBuy,
        uint256 ethAmount, // ETH into / out of the curve, excluding fee
        uint256 tokenAmount,
        uint256 fee,
        uint256 x,
        uint256 v
    );
    event Graduated(address indexed token, address indexed pool, uint256 positionId, uint256 ethToLp, uint256 tokensToLp);
    event GraduationFailed(address indexed token, bytes reason);
    event ConfigUpdated(Config config);
    event GraduatorUpdated(address graduator);
    event CreatorFeesClaimed(address indexed creator, uint256 amount);
    event ProtocolFeesWithdrawn(address indexed to, uint256 amount);

    // ─────────────────────────────── Errors ──────────────────────────────────
    error InvalidConfig();
    error InvalidSupply();
    error InvalidName();
    error InsufficientCreationFee();
    error NotTrading();
    error NotSellable();
    error ZeroAmount();
    error Slippage();
    error Expired();
    error InsufficientReserve();
    error InsufficientGas();
    error OnlySelf();
    error NotPending();
    error NoGraduator();

    constructor(address owner_, Config memory config_, IGraduator graduator_) Ownable(owner_) {
        _setConfig(config_);
        graduator = graduator_;
        emit GraduatorUpdated(address(graduator_));
    }

    modifier checkDeadline(uint256 deadline) {
        if (block.timestamp > deadline) revert Expired();
        _;
    }

    // ─────────────────────────────── Create ──────────────────────────────────

    /// @notice Create a token. Any ETH above the creation fee is used as the creator's first buy.
    function createToken(
        string calldata name,
        string calldata symbol,
        uint256 supply,
        string calldata metadataURI,
        uint256 minTokensOut,
        uint256 deadline
    ) external payable nonReentrant whenNotPaused checkDeadline(deadline) returns (address token) {
        if (supply < MIN_SUPPLY || supply > MAX_SUPPLY) revert InvalidSupply();
        {
            uint256 nl = bytes(name).length;
            uint256 sl = bytes(symbol).length;
            if (nl == 0 || nl > MAX_NAME_LENGTH || sl == 0 || sl > MAX_SYMBOL_LENGTH) revert InvalidName();
        }
        uint256 creationFee = config.creationFee;
        if (msg.value < creationFee) revert InsufficientCreationFee();

        token = address(new LaunchToken(name, symbol, supply, address(this)));
        _initLaunch(token, supply);
        protocolFees += creationFee;
        emit TokenCreated(token, msg.sender, name, symbol, supply, metadataURI);

        uint256 initialBuy = msg.value - creationFee;
        if (initialBuy > 0) _buy(token, initialBuy, minTokensOut, msg.sender);
    }

    function _initLaunch(address token, uint256 supply) internal {
        Config memory c = config;
        (uint256 curveSupply, uint256 lpTokens, uint256 x0) =
            CurveMath.split(supply, c.virtualEth, c.targetEth, c.targetEth - c.graduationFee);

        _launches[token] = Launch({
            creator: msg.sender,
            status: Status.Trading,
            tradeFeeBps: c.tradeFeeBps,
            creatorShareBps: c.creatorShareBps,
            createdAt: uint40(block.timestamp),
            x: x0,
            v: c.virtualEth,
            realEth: 0,
            curveSupply: curveSupply,
            curveLeft: curveSupply,
            lpTokens: lpTokens,
            graduationFee: c.graduationFee,
            pool: address(0)
        });
        allTokens.push(token);
        emit CurveInitialized(token, curveSupply, lpTokens, x0, c.virtualEth, c.targetEth);
    }

    // ─────────────────────────────── Trade ───────────────────────────────────

    function buy(address token, uint256 minTokensOut, uint256 deadline)
        external
        payable
        nonReentrant
        whenNotPaused
        checkDeadline(deadline)
        returns (uint256 tokensOut)
    {
        tokensOut = _buy(token, msg.value, minTokensOut, msg.sender);
    }

    function sell(address token, uint256 amountIn, uint256 minEthOut, uint256 deadline)
        external
        nonReentrant
        checkDeadline(deadline)
        returns (uint256 ethToUser)
    {
        ethToUser = _sell(token, amountIn, minEthOut);
    }

    /// @notice Sell using an EIP-2612 signature instead of a separate approval transaction.
    /// @dev The permit call is wrapped in try/catch so a front-run permit cannot block the sell.
    function sellWithPermit(
        address token,
        uint256 amountIn,
        uint256 minEthOut,
        uint256 deadline,
        uint256 permitDeadline,
        uint8 pv,
        bytes32 pr,
        bytes32 ps
    ) external nonReentrant checkDeadline(deadline) returns (uint256 ethToUser) {
        try IERC20Permit(token).permit(msg.sender, address(this), amountIn, permitDeadline, pv, pr, ps) {} catch {}
        ethToUser = _sell(token, amountIn, minEthOut);
    }

    function _buy(address token, uint256 value, uint256 minTokensOut, address buyer)
        internal
        returns (uint256 tokensOut)
    {
        Launch storage l = _launches[token];
        if (l.status != Status.Trading) revert NotTrading();
        if (value == 0) revert ZeroAmount();

        uint256 fee = (value * l.tradeFeeBps) / BPS;
        uint256 ethIn = value - fee;
        tokensOut = CurveMath.tokensOut(l.x, l.v, ethIn);
        uint256 refund;

        if (tokensOut >= l.curveLeft) {
            // Final buy: take only what is left and refund the rest.
            tokensOut = l.curveLeft;
            ethIn = CurveMath.ethInForTokens(l.x, l.v, tokensOut);
            fee = Math.mulDiv(ethIn, l.tradeFeeBps, BPS - l.tradeFeeBps, Math.Rounding.Ceil);
            if (ethIn + fee > value) fee = value - ethIn; // ≤1 wei rounding guard
            refund = value - ethIn - fee;
        }
        if (tokensOut == 0) revert ZeroAmount();
        if (tokensOut < minTokensOut) revert Slippage();

        l.x -= tokensOut;
        l.v += ethIn;
        l.realEth += ethIn;
        l.curveLeft -= tokensOut;
        _accrueFee(l, fee);

        IERC20(token).safeTransfer(buyer, tokensOut);
        emit Trade(token, buyer, true, ethIn, tokensOut, fee, l.x, l.v);

        if (l.curveLeft == 0) _tryGraduate(token);
        if (refund > 0) Address.sendValue(payable(buyer), refund);
    }

    function _sell(address token, uint256 amountIn, uint256 minEthOut) internal returns (uint256 ethToUser) {
        Launch storage l = _launches[token];
        // Selling is allowed while a failed graduation is pending: it reopens the curve.
        if (l.status != Status.Trading && l.status != Status.GraduationPending) revert NotSellable();
        if (amountIn == 0) revert ZeroAmount();

        uint256 gross = CurveMath.ethOut(l.x, l.v, amountIn);
        if (gross > l.realEth) revert InsufficientReserve();
        uint256 fee = (gross * l.tradeFeeBps) / BPS;
        ethToUser = gross - fee;
        if (ethToUser < minEthOut) revert Slippage();

        l.x += amountIn;
        l.v -= gross;
        l.realEth -= gross;
        l.curveLeft += amountIn;
        l.status = Status.Trading;
        _accrueFee(l, fee);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amountIn);
        emit Trade(token, msg.sender, false, gross, amountIn, fee, l.x, l.v);
        Address.sendValue(payable(msg.sender), ethToUser);
    }

    function _accrueFee(Launch storage l, uint256 fee) internal {
        if (fee == 0) return;
        uint256 creatorPart = (fee * l.creatorShareBps) / BPS;
        creatorFees[l.creator] += creatorPart;
        protocolFees += fee - creatorPart;
    }

    // ─────────────────────────────── Graduation ──────────────────────────────

    function _tryGraduate(address token) internal {
        // Prevents a caller from forcing the "pending" path by under-supplying gas.
        if (gasleft() < config.graduationGasReserve) revert InsufficientGas();
        try this.executeGraduation(token) {}
        catch (bytes memory reason) {
            _launches[token].status = Status.GraduationPending;
            emit GraduationFailed(token, reason);
        }
    }

    /// @dev External only so it can run inside try/catch; callable solely by this contract.
    function executeGraduation(address token) external {
        if (msg.sender != address(this)) revert OnlySelf();
        _graduate(token);
    }

    /// @notice Retry a graduation that failed (e.g. after the owner installs a new graduator).
    function retryGraduation(address token) external nonReentrant {
        Launch storage l = _launches[token];
        if (l.status != Status.GraduationPending || l.curveLeft != 0) revert NotPending();
        _graduate(token);
    }

    function _graduate(address token) internal {
        Launch storage l = _launches[token];
        IGraduator g = graduator;
        if (address(g) == address(0)) revert NoGraduator();

        uint256 gradFee = Math.min(l.graduationFee, l.realEth);
        uint256 ethToLp = l.realEth - gradFee;
        uint256 lpTokens = l.lpTokens;

        l.status = Status.Graduated;
        l.realEth = 0;
        l.lpTokens = 0;
        protocolFees += gradFee;

        LaunchToken(token).openTrading();
        IERC20(token).forceApprove(address(g), lpTokens);
        (address pool, uint256 positionId) = g.graduate{value: ethToLp}(token, lpTokens);
        IERC20(token).forceApprove(address(g), 0);
        l.pool = pool;

        emit Graduated(token, pool, positionId, ethToLp, lpTokens);
    }

    // ─────────────────────────────── Fees ────────────────────────────────────

    function claimCreatorFees() external nonReentrant {
        uint256 amount = creatorFees[msg.sender];
        if (amount == 0) revert ZeroAmount();
        creatorFees[msg.sender] = 0;
        emit CreatorFeesClaimed(msg.sender, amount);
        Address.sendValue(payable(msg.sender), amount);
    }

    function withdrawProtocolFees(address payable to) external onlyOwner nonReentrant {
        uint256 amount = protocolFees;
        if (amount == 0) revert ZeroAmount();
        protocolFees = 0;
        emit ProtocolFeesWithdrawn(to, amount);
        Address.sendValue(to, amount);
    }

    // ─────────────────────────────── Admin ───────────────────────────────────

    function setConfig(Config calldata c) external onlyOwner {
        _setConfig(c);
    }

    function setGraduator(IGraduator g) external onlyOwner {
        graduator = g;
        emit GraduatorUpdated(address(g));
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _setConfig(Config memory c) internal {
        if (
            c.virtualEth == 0 || c.targetEth == 0 || c.graduationFee > c.targetEth / 10
                || c.tradeFeeBps > MAX_FEE_BPS || c.creatorShareBps > BPS || c.graduationGasReserve < 300_000
        ) revert InvalidConfig();
        config = c;
        emit ConfigUpdated(c);
    }

    // ─────────────────────────────── Views ───────────────────────────────────

    function getLaunch(address token) external view returns (Launch memory) {
        return _launches[token];
    }

    function tokenCount() external view returns (uint256) {
        return allTokens.length;
    }

    /// @return tokensOut Tokens the buyer would receive.
    /// @return fee Fee charged.
    /// @return refund ETH returned when the buy would complete the curve.
    function quoteBuy(address token, uint256 value)
        external
        view
        returns (uint256 tokensOut, uint256 fee, uint256 refund)
    {
        Launch storage l = _launches[token];
        if (l.status != Status.Trading || value == 0) return (0, 0, 0);
        fee = (value * l.tradeFeeBps) / BPS;
        uint256 ethIn = value - fee;
        tokensOut = CurveMath.tokensOut(l.x, l.v, ethIn);
        if (tokensOut >= l.curveLeft) {
            tokensOut = l.curveLeft;
            ethIn = CurveMath.ethInForTokens(l.x, l.v, tokensOut);
            fee = Math.mulDiv(ethIn, l.tradeFeeBps, BPS - l.tradeFeeBps, Math.Rounding.Ceil);
            if (ethIn + fee > value) fee = value - ethIn;
            refund = value - ethIn - fee;
        }
    }

    function quoteSell(address token, uint256 amountIn) external view returns (uint256 ethOut, uint256 fee) {
        Launch storage l = _launches[token];
        if ((l.status != Status.Trading && l.status != Status.GraduationPending) || amountIn == 0) return (0, 0);
        uint256 gross = CurveMath.ethOut(l.x, l.v, amountIn);
        if (gross > l.realEth) return (0, 0);
        fee = (gross * l.tradeFeeBps) / BPS;
        ethOut = gross - fee;
    }

    /// @notice Spot price in wei per 1e18 token units.
    function spotPrice(address token) external view returns (uint256) {
        Launch storage l = _launches[token];
        if (l.x == 0) return 0;
        return Math.mulDiv(l.v, 1e18, l.x);
    }

    /// @notice Curve completion in basis points (10 000 = ready to graduate).
    function progressBps(address token) external view returns (uint256) {
        Launch storage l = _launches[token];
        if (l.curveSupply == 0) return 0;
        if (l.status == Status.Graduated) return BPS;
        return ((l.curveSupply - l.curveLeft) * BPS) / l.curveSupply;
    }
}
