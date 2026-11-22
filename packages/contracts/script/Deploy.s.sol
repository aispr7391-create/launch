// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {BondingCurveLaunchpad} from "../src/launchpad/BondingCurveLaunchpad.sol";
import {UniswapV3Graduator} from "../src/launchpad/UniswapV3Graduator.sol";
import {StakingHub} from "../src/staking/StakingHub.sol";
import {IGraduator} from "../src/interfaces/IGraduator.sol";
import {INonfungiblePositionManager} from "../src/interfaces/IUniswapV3.sol";

/// @notice Mainnet deployment. Refuses to run unless the audit sign-off flag is set.
///   PX_AUDIT_SIGNED_OFF=true forge script script/Deploy.s.sol --rpc-url robinhood \
///     --account deployer --broadcast --verify --verifier blockscout \
///     --verifier-url https://robinhoodchain.blockscout.com/api/
/// Without --broadcast this only simulates (safe to run any time).
contract Deploy is Script {
    INonfungiblePositionManager internal constant NPM =
        INonfungiblePositionManager(0x73991a25C818bf1F1128deAaB1492D45638de0d3);

    function run() external {
        require(block.chainid == 4663, "Robinhood Chain Mainnet only");
        require(vm.envOr("PX_AUDIT_SIGNED_OFF", false), "Contracts not audited: deployment blocked");

        address owner = vm.envAddress("PX_OWNER"); // multisig
        address treasury = vm.envAddress("PX_TREASURY");

        vm.startBroadcast();
        address deployer = msg.sender;
        address predicted = vm.computeCreateAddress(deployer, vm.getNonce(deployer) + 1);
        UniswapV3Graduator grad = new UniswapV3Graduator(NPM, predicted, 10_000, treasury, owner);
        BondingCurveLaunchpad pad = new BondingCurveLaunchpad(
            owner,
            BondingCurveLaunchpad.Config({
                virtualEth: uint128(vm.envUint("PX_VIRTUAL_ETH")),
                targetEth: uint128(vm.envUint("PX_TARGET_ETH")),
                graduationFee: uint128(vm.envUint("PX_GRADUATION_FEE")),
                creationFee: uint128(vm.envUint("PX_CREATION_FEE")),
                tradeFeeBps: uint16(vm.envUint("PX_TRADE_FEE_BPS")),
                creatorShareBps: uint16(vm.envUint("PX_CREATOR_SHARE_BPS")),
                graduationGasReserve: 3_000_000
            }),
            IGraduator(address(grad))
        );
        require(address(pad) == predicted, "launchpad address mismatch");
        StakingHub hub = new StakingHub();
        vm.stopBroadcast();

        console2.log("UniswapV3Graduator", address(grad));
        console2.log("BondingCurveLaunchpad", address(pad));
        console2.log("StakingHub", address(hub));
    }
}
