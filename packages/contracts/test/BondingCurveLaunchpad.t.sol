// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BondingCurveLaunchpad} from "../src/launchpad/BondingCurveLaunchpad.sol";
import {LaunchToken} from "../src/launchpad/LaunchToken.sol";
import {IGraduator} from "../src/interfaces/IGraduator.sol";
import {MockGraduator, RevertingGraduator} from "./mocks/Mocks.sol";

contract BondingCurveLaunchpadTest is Test {
    BondingCurveLaunchpad internal pad;
    MockGraduator internal grad;

    address internal owner = makeAddr("owner");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant SUPPLY = 1_000_000_000e18;
    uint128 internal constant V0 = 1.5 ether;
    uint128 internal constant TARGET = 4 ether;
    uint128 internal constant GRAD_FEE = 0.2 ether;
    uint128 internal constant CREATE_FEE = 0.001 ether;

    function setUp() public {
        grad = new MockGraduator();
        pad = new BondingCurveLaunchpad(owner, _config(), IGraduator(address(grad)));
        vm.deal(creator, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _config() internal pure returns (BondingCurveLaunchpad.Config memory) {
        return BondingCurveLaunchpad.Config({
            virtualEth: V0,
            targetEth: TARGET,
            graduationFee: GRAD_FEE,
            creationFee: CREATE_FEE,
            tradeFeeBps: 100,
            creatorShareBps: 3_000,
            graduationGasReserve: 1_000_000
        });
    }

    function _create() internal returns (address token) {
        vm.prank(creator);
        token = pad.createToken{value: CREATE_FEE}("Test", "TST", SUPPLY, "ipfs://meta", 0, block.timestamp);
    }

    function _buy(address who, address token, uint256 value) internal returns (uint256) {
        vm.prank(who);
        return pad.buy{value: value}(token, 0, block.timestamp);
    }

    function _sell(address who, address token, uint256 amount) internal returns (uint256) {
        vm.startPrank(who);
        LaunchToken(token).approve(address(pad), amount);
        uint256 out = pad.sell(token, amount, 0, block.timestamp);
        vm.stopPrank();
        return out;
    }

    // ───────────────────────── creation ─────────────────────────

    function test_Create_SplitsSupplyAndSnapshotsParams() public {
        address token = _create();
        BondingCurveLaunchpad.Launch memory l = pad.getLaunch(token);
        assertEq(uint8(l.status), uint8(BondingCurveLaunchpad.Status.Trading));
        assertEq(l.curveSupply + l.lpTokens, SUPPLY);
        assertEq(l.curveLeft, l.curveSupply);
        assertEq(l.v, V0);
        assertEq(LaunchToken(token).balanceOf(address(pad)), SUPPLY);
        assertEq(pad.protocolFees(), CREATE_FEE);
        assertEq(l.creator, creator);
    }

    function test_Create_RevertsOnBadInput() public {
        vm.startPrank(creator);
        vm.expectRevert(BondingCurveLaunchpad.InvalidSupply.selector);
        pad.createToken{value: CREATE_FEE}("A", "A", 1, "", 0, block.timestamp);
        vm.expectRevert(BondingCurveLaunchpad.InvalidName.selector);
        pad.createToken{value: CREATE_FEE}("", "A", SUPPLY, "", 0, block.timestamp);
        vm.expectRevert(BondingCurveLaunchpad.InsufficientCreationFee.selector);
        pad.createToken{value: 0}("A", "A", SUPPLY, "", 0, block.timestamp);
        vm.stopPrank();
    }

    function test_Create_WithInitialBuy() public {
        vm.prank(creator);
        address token = pad.createToken{value: CREATE_FEE + 0.1 ether}("T", "T", SUPPLY, "", 1, block.timestamp);
        assertGt(LaunchToken(token).balanceOf(creator), 0);
    }

    // ───────────────────────── trading ─────────────────────────

    function test_Buy_MatchesQuote_AndSplitsFee() public {
        address token = _create();
        (uint256 quoted, uint256 fee,) = pad.quoteBuy(token, 1 ether);
        uint256 got = _buy(alice, token, 1 ether);
        assertEq(got, quoted);
        assertEq(fee, 0.01 ether);
        assertEq(pad.creatorFees(creator), 0.003 ether);
        assertEq(pad.protocolFees(), CREATE_FEE + 0.007 ether);
        assertEq(LaunchToken(token).balanceOf(alice), got);
    }

    function test_Buy_SlippageReverts() public {
        address token = _create();
        (uint256 quoted,,) = pad.quoteBuy(token, 1 ether);
        vm.prank(alice);
        vm.expectRevert(BondingCurveLaunchpad.Slippage.selector);
        pad.buy{value: 1 ether}(token, quoted + 1, block.timestamp);
    }

    function test_Buy_DeadlineReverts() public {
        address token = _create();
        vm.prank(alice);
        vm.expectRevert(BondingCurveLaunchpad.Expired.selector);
        pad.buy{value: 1 ether}(token, 0, block.timestamp - 1);
    }

    function test_Sell_MatchesQuote() public {
        address token = _create();
        uint256 bought = _buy(alice, token, 1 ether);
        (uint256 quoted,) = pad.quoteSell(token, bought / 2);
        uint256 before = alice.balance;
        uint256 out = _sell(alice, token, bought / 2);
        assertEq(out, quoted);
        assertEq(alice.balance - before, out);
    }

    function test_RoundTrip_LosesOnlyFees() public {
        address token = _create();
        uint256 start = alice.balance;
        uint256 bought = _buy(alice, token, 1 ether);
        _sell(alice, token, bought);
        uint256 lost = start - alice.balance;
        // ~1 % in + ~1 % out, never a gain.
        assertGt(lost, 0.019 ether);
        assertLt(lost, 0.0201 ether);
        BondingCurveLaunchpad.Launch memory l = pad.getLaunch(token);
        assertEq(l.curveLeft, l.curveSupply);
    }

    function test_TransfersLockedBeforeGraduation() public {
        address token = _create();
        uint256 bought = _buy(alice, token, 0.5 ether);
        vm.prank(alice);
        vm.expectRevert(LaunchToken.TransfersLocked.selector);
        LaunchToken(token).transfer(bob, bought);
    }

    function test_Pause_BlocksBuyButNotSell() public {
        address token = _create();
        uint256 bought = _buy(alice, token, 0.5 ether);
        vm.prank(owner);
        pad.pause();
        vm.prank(alice);
        vm.expectRevert();
        pad.buy{value: 0.1 ether}(token, 0, block.timestamp);
        assertGt(_sell(alice, token, bought), 0);
    }

    // ───────────────────────── graduation ─────────────────────────

    function test_Graduation_OnFinalBuy_RefundsExcess() public {
        address token = _create();
        uint256 before = alice.balance;
        _buy(alice, token, 10 ether);
        uint256 spent = before - alice.balance;

        BondingCurveLaunchpad.Launch memory l = pad.getLaunch(token);
        assertEq(uint8(l.status), uint8(BondingCurveLaunchpad.Status.Graduated));
        assertEq(l.curveLeft, 0);
        assertEq(l.pool, address(0xB001));

        // Spent ≈ target + 1 % fee; the rest was refunded.
        assertApproxEqRel(spent, uint256(TARGET) * 10_100 / 10_000, 1e15);
        assertEq(grad.lastTokenAmount(), SUPPLY - l.curveSupply);
        assertApproxEqRel(grad.lastEth(), TARGET - GRAD_FEE, 1e9);
        assertTrue(LaunchToken(token).tradingOpen());

        // Free transfers after graduation.
        vm.prank(alice);
        LaunchToken(token).transfer(bob, 1e18);
    }

    function test_Graduation_LpPriceMatchesFinalCurvePrice() public {
        address token = _create();
        _buy(alice, token, 10 ether);
        BondingCurveLaunchpad.Launch memory l = pad.getLaunch(token);
        // final curve price v/x vs LP price eth/tokens, both in wei per token unit (×1e18)
        uint256 curvePrice = l.v * 1e18 / l.x;
        uint256 lpPrice = grad.lastEth() * 1e18 / grad.lastTokenAmount();
        assertApproxEqRel(lpPrice, curvePrice, 1e12); // 0.0001 %
    }

    function test_Graduation_Failure_IsPending_ThenRetry() public {
        RevertingGraduator bad = new RevertingGraduator();
        vm.prank(owner);
        pad.setGraduator(IGraduator(address(bad)));

        address token = _create();
        _buy(alice, token, 10 ether);
        assertEq(uint8(pad.getLaunch(token).status), uint8(BondingCurveLaunchpad.Status.GraduationPending));
        assertFalse(LaunchToken(token).tradingOpen()); // rolled back with the failed attempt

        vm.prank(bob);
        vm.expectRevert(BondingCurveLaunchpad.NotTrading.selector);
        pad.buy{value: 0.1 ether}(token, 0, block.timestamp);

        vm.prank(owner);
        pad.setGraduator(IGraduator(address(grad)));
        pad.retryGraduation(token);
        assertEq(uint8(pad.getLaunch(token).status), uint8(BondingCurveLaunchpad.Status.Graduated));
    }

    function test_Graduation_Pending_SellReopensCurve() public {
        RevertingGraduator bad = new RevertingGraduator();
        vm.prank(owner);
        pad.setGraduator(IGraduator(address(bad)));
        address token = _create();
        uint256 bought = _buy(alice, token, 10 ether);
        _sell(alice, token, bought / 10);
        assertEq(uint8(pad.getLaunch(token).status), uint8(BondingCurveLaunchpad.Status.Trading));
    }

    // ───────────────────────── fees & admin ─────────────────────────

    function test_CreatorFees_Claim() public {
        address token = _create();
        _buy(alice, token, 1 ether);
        uint256 before = creator.balance;
        vm.prank(creator);
        pad.claimCreatorFees();
        assertEq(creator.balance - before, 0.003 ether);
    }

    function test_ProtocolFees_OnlyOwner() public {
        _create();
        vm.prank(alice);
        vm.expectRevert();
        pad.withdrawProtocolFees(payable(alice));
        vm.prank(owner);
        pad.withdrawProtocolFees(payable(owner));
        assertEq(pad.protocolFees(), 0);
    }

    function test_Config_FeeCap() public {
        BondingCurveLaunchpad.Config memory c = _config();
        c.tradeFeeBps = 201;
        vm.prank(owner);
        vm.expectRevert(BondingCurveLaunchpad.InvalidConfig.selector);
        pad.setConfig(c);
    }

    // ───────────────────────── fuzz ─────────────────────────

    /// Random buys/sells never let the curve owe more ETH than it holds.
    function testFuzz_SolvencyUnderRandomTrading(uint256 seed) public {
        address token = _create();
        address[2] memory traders = [alice, bob];
        for (uint256 i; i < 24; i++) {
            seed = uint256(keccak256(abi.encode(seed, i)));
            address who = traders[seed % 2];
            BondingCurveLaunchpad.Launch memory l = pad.getLaunch(token);
            if (l.status != BondingCurveLaunchpad.Status.Trading) break;
            uint256 bal = LaunchToken(token).balanceOf(who);
            if (seed % 3 == 0 && bal > 0) {
                _sell(who, token, (bal * ((seed >> 8) % 100 + 1)) / 100);
            } else {
                _buy(who, token, ((seed >> 16) % 2 ether) + 1e12);
            }
            l = pad.getLaunch(token);
            if (l.status != BondingCurveLaunchpad.Status.Trading) break;
            assertEq(l.v - V0, l.realEth, "v - V0 == realEth");
            assertGe(
                address(pad).balance,
                l.realEth + pad.protocolFees() + pad.creatorFees(creator),
                "contract holds every liability"
            );
        }
    }
}
