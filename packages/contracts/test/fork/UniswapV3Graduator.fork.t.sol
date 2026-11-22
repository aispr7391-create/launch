// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BondingCurveLaunchpad} from "../../src/launchpad/BondingCurveLaunchpad.sol";
import {UniswapV3Graduator} from "../../src/launchpad/UniswapV3Graduator.sol";
import {LaunchToken} from "../../src/launchpad/LaunchToken.sol";
import {IGraduator} from "../../src/interfaces/IGraduator.sol";
import {INonfungiblePositionManager, IUniswapV3Pool} from "../../src/interfaces/IUniswapV3.sol";

/// @notice Runs against real Robinhood Chain Mainnet state on a local fork. Nothing is broadcast.
///   ROBINHOOD_RPC_URL=... forge test --match-path test/fork/* -vvv
contract UniswapV3GraduatorForkTest is Test {
    /// Official Uniswap v3 NonfungiblePositionManager on Robinhood Chain (chain 4663).
    INonfungiblePositionManager internal constant NPM =
        INonfungiblePositionManager(0x73991a25C818bf1F1128deAaB1492D45638de0d3);
    uint24 internal constant FEE = 10_000;

    BondingCurveLaunchpad internal pad;
    UniswapV3Graduator internal grad;
    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");

    function setUp() public {
        vm.createSelectFork(vm.envString("ROBINHOOD_RPC_URL"));
        assertEq(block.chainid, 4663, "not Robinhood Chain Mainnet");
        assertGt(address(NPM).code.length, 0, "NPM not deployed");

        // Predict the launchpad address so the graduator can be bound to it.
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        grad = new UniswapV3Graduator(NPM, predicted, FEE, treasury, owner);
        pad = new BondingCurveLaunchpad(
            owner,
            BondingCurveLaunchpad.Config({
                virtualEth: 1.5 ether,
                targetEth: 4 ether,
                graduationFee: 0.2 ether,
                creationFee: 0,
                tradeFeeBps: 100,
                creatorShareBps: 3_000,
                graduationGasReserve: 3_000_000
            }),
            IGraduator(address(grad))
        );
        assertEq(address(pad), predicted);
        vm.deal(alice, 100 ether);
    }

    function _launchAndComplete() internal returns (address token) {
        token = pad.createToken("Fork", "FORK", 1_000_000_000e18, "", 0, block.timestamp);
        vm.prank(alice);
        pad.buy{value: 10 ether}(token, 0, block.timestamp);
    }

    function _assertPoolAtCurvePrice(address token) internal view {
        BondingCurveLaunchpad.Launch memory l = pad.getLaunch(token);
        assertEq(uint8(l.status), uint8(BondingCurveLaunchpad.Status.Graduated), "not graduated");
        IUniswapV3Pool pool = IUniswapV3Pool(l.pool);
        assertGt(pool.liquidity(), 0, "no liquidity");
        assertGt(grad.positionOf(token), 0, "no position");
        assertTrue(LaunchToken(token).tradingOpen());
    }

    function test_Fork_GraduatesIntoUniswapV3() public {
        address token = _launchAndComplete();
        _assertPoolAtCurvePrice(token);
    }

    /// Attacker initialises the pool at a silly price before graduation.
    function test_Fork_PreInitialisedPool_IsCorrected() public {
        address token = pad.createToken("Grief", "GRF", 1_000_000_000e18, "", 0, block.timestamp);
        address weth = NPM.WETH9();
        (address t0, address t1) = token < weth ? (token, weth) : (weth, token);
        NPM.createAndInitializePoolIfNecessary(t0, t1, FEE, uint160(1) << 120); // arbitrary bad price

        vm.prank(alice);
        pad.buy{value: 10 ether}(token, 0, block.timestamp);
        _assertPoolAtCurvePrice(token);
    }
}
