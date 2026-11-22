// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title StakingHub
/// @notice Permissionless staking pools. Anyone can create a pool for any stake/reward token
///         pair and fund it; rewards stream linearly to stakers (Synthetix model).
///         `lockDuration == 0` is flexible staking; otherwise each deposit locks the whole
///         position until `now + lockDuration`.
/// @dev No owner and no admin functions. Pools keep their own accounting and never rely on
///      `balanceOf(this)`, so one token can be used by many pools, and as both stake and
///      reward token, without mixing funds. Reward rate is stored scaled by 1e18 to avoid
///      losing dust to integer division.
contract StakingHub is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 internal constant PRECISION = 1e18;
    uint256 public constant MIN_DURATION = 1 days;
    uint256 public constant MAX_DURATION = 730 days;
    uint256 public constant MAX_LOCK = 730 days;

    struct Pool {
        IERC20 stakingToken;
        IERC20 rewardToken;
        address creator;
        uint64 lockDuration;
        uint64 periodFinish;
        uint64 lastUpdateTime;
        uint256 rewardRateX18; // reward tokens per second × 1e18
        uint256 rewardPerTokenX18; // accumulated reward per staked unit × 1e18
        uint256 totalStaked;
        uint256 idleRewardsX18; // emitted while nothing was staked; recoverable by creator
    }

    struct Position {
        uint256 amount;
        uint256 rewardPerTokenPaidX18;
        uint256 rewards;
        uint64 unlockAt;
    }

    Pool[] internal _pools;
    mapping(uint256 poolId => mapping(address user => Position)) internal _positions;

    event PoolCreated(
        uint256 indexed poolId,
        address indexed creator,
        address indexed stakingToken,
        address rewardToken,
        uint64 lockDuration
    );
    event RewardsAdded(uint256 indexed poolId, uint256 amount, uint256 duration, uint256 rewardRateX18, uint64 periodFinish);
    event Staked(uint256 indexed poolId, address indexed user, uint256 amount, uint64 unlockAt);
    event Withdrawn(uint256 indexed poolId, address indexed user, uint256 amount);
    event RewardPaid(uint256 indexed poolId, address indexed user, uint256 amount);
    event IdleRewardsRecovered(uint256 indexed poolId, address indexed to, uint256 amount);

    error InvalidPool();
    error InvalidDuration();
    error ZeroAmount();
    error OnlyCreator();
    error Locked(uint64 unlockAt);
    error InsufficientStake();
    error RateTooLow();

    // ─────────────────────────────── Pools ───────────────────────────────────

    function createPool(
        IERC20 stakingToken,
        IERC20 rewardToken,
        uint64 lockDuration,
        uint256 rewardAmount,
        uint256 duration
    ) external nonReentrant returns (uint256 poolId) {
        if (address(stakingToken) == address(0) || address(rewardToken) == address(0)) revert InvalidPool();
        if (lockDuration > MAX_LOCK) revert InvalidDuration();

        poolId = _pools.length;
        _pools.push();
        Pool storage p = _pools[poolId];
        p.stakingToken = stakingToken;
        p.rewardToken = rewardToken;
        p.creator = msg.sender;
        p.lockDuration = lockDuration;
        p.lastUpdateTime = uint64(block.timestamp);

        emit PoolCreated(poolId, msg.sender, address(stakingToken), address(rewardToken), lockDuration);
        _addRewards(poolId, rewardAmount, duration);
    }

    /// @notice Top up rewards. Remaining undistributed rewards are rolled into the new period.
    function addRewards(uint256 poolId, uint256 amount, uint256 duration) external nonReentrant {
        if (_pool(poolId).creator != msg.sender) revert OnlyCreator();
        _addRewards(poolId, amount, duration);
    }

    function _addRewards(uint256 poolId, uint256 amount, uint256 duration) internal {
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();
        if (amount == 0) revert ZeroAmount();
        _updateReward(poolId, address(0));
        Pool storage p = _pools[poolId];

        uint256 received = _pull(p.rewardToken, amount);
        uint256 leftoverX18 =
            block.timestamp < p.periodFinish ? (p.periodFinish - block.timestamp) * p.rewardRateX18 : 0;
        uint256 newRate = (received * PRECISION + leftoverX18) / duration;
        if (newRate == 0) revert RateTooLow();

        p.rewardRateX18 = newRate;
        p.lastUpdateTime = uint64(block.timestamp);
        p.periodFinish = uint64(block.timestamp + duration);
        emit RewardsAdded(poolId, received, duration, newRate, p.periodFinish);
    }

    /// @notice Send rewards that were emitted while nobody was staked back to the creator.
    function recoverIdleRewards(uint256 poolId, address to) external nonReentrant {
        Pool storage p = _pool(poolId);
        if (p.creator != msg.sender) revert OnlyCreator();
        _updateReward(poolId, address(0));
        uint256 amount = p.idleRewardsX18 / PRECISION;
        if (amount == 0) revert ZeroAmount();
        p.idleRewardsX18 -= amount * PRECISION;
        emit IdleRewardsRecovered(poolId, to, amount);
        p.rewardToken.safeTransfer(to, amount);
    }

    // ─────────────────────────────── Staking ─────────────────────────────────

    function stake(uint256 poolId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _updateReward(poolId, msg.sender);
        Pool storage p = _pools[poolId];
        Position storage pos = _positions[poolId][msg.sender];

        uint256 received = _pull(p.stakingToken, amount);
        pos.amount += received;
        p.totalStaked += received;
        if (p.lockDuration > 0) {
            uint64 unlockAt = uint64(block.timestamp) + p.lockDuration;
            if (unlockAt > pos.unlockAt) pos.unlockAt = unlockAt;
        }
        emit Staked(poolId, msg.sender, received, pos.unlockAt);
    }

    function withdraw(uint256 poolId, uint256 amount) public nonReentrant {
        _withdraw(poolId, amount);
    }

    function claim(uint256 poolId) public nonReentrant {
        _claim(poolId);
    }

    /// @notice Withdraw the whole stake and claim rewards.
    function exit(uint256 poolId) external nonReentrant {
        _withdraw(poolId, _positions[poolId][msg.sender].amount);
        _claim(poolId);
    }

    function _withdraw(uint256 poolId, uint256 amount) internal {
        if (amount == 0) revert ZeroAmount();
        _updateReward(poolId, msg.sender);
        Pool storage p = _pools[poolId];
        Position storage pos = _positions[poolId][msg.sender];
        if (block.timestamp < pos.unlockAt) revert Locked(pos.unlockAt);
        if (amount > pos.amount) revert InsufficientStake();

        pos.amount -= amount;
        p.totalStaked -= amount;
        emit Withdrawn(poolId, msg.sender, amount);
        p.stakingToken.safeTransfer(msg.sender, amount);
    }

    function _claim(uint256 poolId) internal {
        _updateReward(poolId, msg.sender);
        Position storage pos = _positions[poolId][msg.sender];
        uint256 reward = pos.rewards;
        if (reward == 0) return;
        pos.rewards = 0;
        emit RewardPaid(poolId, msg.sender, reward);
        _pools[poolId].rewardToken.safeTransfer(msg.sender, reward);
    }

    // ─────────────────────────────── Accounting ──────────────────────────────

    function _updateReward(uint256 poolId, address user) internal {
        Pool storage p = _pool(poolId);
        uint256 t = _lastApplicable(p);
        if (t > p.lastUpdateTime) {
            uint256 emittedX18 = (t - p.lastUpdateTime) * p.rewardRateX18;
            if (p.totalStaked == 0) p.idleRewardsX18 += emittedX18;
            else p.rewardPerTokenX18 += emittedX18 / p.totalStaked;
            p.lastUpdateTime = uint64(t);
        }
        if (user != address(0)) {
            Position storage pos = _positions[poolId][user];
            pos.rewards = _earned(p, pos, p.rewardPerTokenX18);
            pos.rewardPerTokenPaidX18 = p.rewardPerTokenX18;
        }
    }

    function _lastApplicable(Pool storage p) internal view returns (uint256) {
        return Math.min(block.timestamp, p.periodFinish);
    }

    function _rewardPerToken(Pool storage p) internal view returns (uint256) {
        uint256 t = _lastApplicable(p);
        if (p.totalStaked == 0 || t <= p.lastUpdateTime) return p.rewardPerTokenX18;
        return p.rewardPerTokenX18 + ((t - p.lastUpdateTime) * p.rewardRateX18) / p.totalStaked;
    }

    function _earned(Pool storage, Position storage pos, uint256 rptX18) internal view returns (uint256) {
        return pos.rewards + Math.mulDiv(pos.amount, rptX18 - pos.rewardPerTokenPaidX18, PRECISION);
    }

    function _pull(IERC20 token, uint256 amount) internal returns (uint256 received) {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        received = token.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
    }

    function _pool(uint256 poolId) internal view returns (Pool storage) {
        if (poolId >= _pools.length) revert InvalidPool();
        return _pools[poolId];
    }

    // ─────────────────────────────── Views ───────────────────────────────────

    function poolCount() external view returns (uint256) {
        return _pools.length;
    }

    function getPool(uint256 poolId) external view returns (Pool memory) {
        return _pool(poolId);
    }

    function getPosition(uint256 poolId, address user) external view returns (Position memory) {
        return _positions[poolId][user];
    }

    function earned(uint256 poolId, address user) external view returns (uint256) {
        Pool storage p = _pool(poolId);
        return _earned(p, _positions[poolId][user], _rewardPerToken(p));
    }

    /// @notice Reward tokens emitted per second (rounded down), for display.
    function rewardRate(uint256 poolId) external view returns (uint256) {
        Pool storage p = _pool(poolId);
        return block.timestamp >= p.periodFinish ? 0 : p.rewardRateX18 / PRECISION;
    }
}
