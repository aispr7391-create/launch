// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {StakingHub} from "../src/staking/StakingHub.sol";
import {MockERC20, FeeOnTransferERC20} from "./mocks/Mocks.sol";

contract StakingHubTest is Test {
    StakingHub internal hub;
    MockERC20 internal stakeTok;
    MockERC20 internal rewardTok;

    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant REWARD = 1_000e18;
    uint256 internal constant DURATION = 10 days;

    function setUp() public {
        hub = new StakingHub();
        stakeTok = new MockERC20("Stake", "STK");
        rewardTok = new MockERC20("Reward", "RWD");
        rewardTok.mint(creator, 1_000_000e18);
        stakeTok.mint(creator, 1_000_000e18);
        stakeTok.mint(alice, 1_000e18);
        stakeTok.mint(bob, 1_000e18);
        vm.prank(creator);
        rewardTok.approve(address(hub), type(uint256).max);
        vm.prank(creator);
        stakeTok.approve(address(hub), type(uint256).max);
        vm.prank(alice);
        stakeTok.approve(address(hub), type(uint256).max);
        vm.prank(bob);
        stakeTok.approve(address(hub), type(uint256).max);
    }

    function _pool(uint64 lock) internal returns (uint256 id) {
        vm.prank(creator);
        id = hub.createPool(IERC20(address(stakeTok)), IERC20(address(rewardTok)), lock, REWARD, DURATION);
    }

    function _stake(address who, uint256 id, uint256 amount) internal {
        vm.prank(who);
        hub.stake(id, amount);
    }

    function test_SingleStaker_EarnsFullEmission() public {
        uint256 id = _pool(0);
        _stake(alice, id, 100e18);
        vm.warp(block.timestamp + DURATION);
        assertApproxEqRel(hub.earned(id, alice), REWARD, 1e12);
        vm.prank(alice);
        hub.claim(id);
        assertApproxEqRel(rewardTok.balanceOf(alice), REWARD, 1e12);
    }

    function test_TwoStakers_SplitProRata() public {
        uint256 id = _pool(0);
        _stake(alice, id, 100e18);
        _stake(bob, id, 300e18);
        vm.warp(block.timestamp + DURATION);
        assertApproxEqRel(hub.earned(id, alice), REWARD / 4, 1e12);
        assertApproxEqRel(hub.earned(id, bob), (REWARD * 3) / 4, 1e12);
    }

    function test_LateJoiner_OnlyEarnsAfterJoining() public {
        uint256 id = _pool(0);
        _stake(alice, id, 100e18);
        vm.warp(block.timestamp + DURATION / 2);
        _stake(bob, id, 100e18);
        vm.warp(block.timestamp + DURATION / 2);
        assertApproxEqRel(hub.earned(id, alice), (REWARD * 3) / 4, 1e12);
        assertApproxEqRel(hub.earned(id, bob), REWARD / 4, 1e12);
    }

    function test_FixedTerm_LocksWithdraw() public {
        uint256 id = _pool(30 days);
        _stake(alice, id, 100e18);
        vm.warp(block.timestamp + 29 days);
        vm.prank(alice);
        vm.expectRevert();
        hub.withdraw(id, 100e18);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        hub.withdraw(id, 100e18);
        assertEq(stakeTok.balanceOf(alice), 1_000e18);
    }

    function test_FixedTerm_RestakeExtendsLock() public {
        uint256 id = _pool(30 days);
        _stake(alice, id, 50e18);
        vm.warp(block.timestamp + 20 days);
        _stake(alice, id, 50e18);
        assertEq(hub.getPosition(id, alice).unlockAt, uint64(block.timestamp + 30 days));
    }

    function test_Flexible_WithdrawAnytime() public {
        uint256 id = _pool(0);
        _stake(alice, id, 100e18);
        vm.prank(alice);
        hub.withdraw(id, 40e18);
        assertEq(hub.getPosition(id, alice).amount, 60e18);
    }

    function test_IdleRewards_Recoverable() public {
        uint256 id = _pool(0);
        vm.warp(block.timestamp + DURATION / 2); // nobody staked
        _stake(alice, id, 100e18);
        vm.warp(block.timestamp + DURATION);
        uint256 before = rewardTok.balanceOf(creator);
        vm.prank(creator);
        hub.recoverIdleRewards(id, creator);
        assertApproxEqRel(rewardTok.balanceOf(creator) - before, REWARD / 2, 1e12);
        assertApproxEqRel(hub.earned(id, alice), REWARD / 2, 1e12);
    }

    function test_AddRewards_RollsOverRemaining() public {
        uint256 id = _pool(0);
        _stake(alice, id, 100e18);
        vm.warp(block.timestamp + DURATION / 2);
        vm.prank(creator);
        hub.addRewards(id, REWARD, DURATION);
        vm.warp(block.timestamp + DURATION);
        assertApproxEqRel(hub.earned(id, alice), REWARD * 2, 1e12);
    }

    function test_AddRewards_OnlyCreator() public {
        uint256 id = _pool(0);
        vm.prank(alice);
        vm.expectRevert(StakingHub.OnlyCreator.selector);
        hub.addRewards(id, 1, DURATION);
    }

    function test_SameTokenForStakeAndReward_KeepsStakeSafe() public {
        vm.prank(creator);
        uint256 id = hub.createPool(IERC20(address(stakeTok)), IERC20(address(stakeTok)), 0, REWARD, DURATION);
        _stake(alice, id, 100e18);
        vm.warp(block.timestamp + DURATION);
        vm.prank(alice);
        hub.exit(id);
        assertApproxEqRel(stakeTok.balanceOf(alice), 1_000e18 + REWARD, 1e12);
        assertLe(stakeTok.balanceOf(address(hub)), 1e6); // only rounding dust left
    }

    function test_FeeOnTransferStakeToken_CreditsReceived() public {
        FeeOnTransferERC20 fot = new FeeOnTransferERC20();
        fot.mint(alice, 100e18);
        vm.prank(creator);
        uint256 id = hub.createPool(IERC20(address(fot)), IERC20(address(rewardTok)), 0, REWARD, DURATION);
        vm.startPrank(alice);
        fot.approve(address(hub), type(uint256).max);
        hub.stake(id, 100e18);
        vm.stopPrank();
        assertEq(hub.getPosition(id, alice).amount, 99e18);
        assertEq(hub.getPool(id).totalStaked, 99e18);
    }

    /// Total paid out never exceeds what was funded.
    function testFuzz_NeverPaysMoreThanFunded(uint96 a, uint96 b, uint32 t1, uint32 t2) public {
        uint256 amtA = bound(uint256(a), 1, 1_000e18);
        uint256 amtB = bound(uint256(b), 1, 1_000e18);
        uint256 dt1 = bound(uint256(t1), 0, DURATION * 2);
        uint256 dt2 = bound(uint256(t2), 0, DURATION * 2);

        uint256 id = _pool(0);
        _stake(alice, id, amtA);
        vm.warp(block.timestamp + dt1);
        _stake(bob, id, amtB);
        vm.warp(block.timestamp + dt2);

        vm.prank(alice);
        hub.claim(id);
        vm.prank(bob);
        hub.claim(id);
        uint256 paid = rewardTok.balanceOf(alice) + rewardTok.balanceOf(bob);
        assertLe(paid, REWARD);
    }
}
