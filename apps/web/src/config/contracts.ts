import type { Address } from "viem";

/**
 * Contract registry for Robinhood Chain Mainnet (4663).
 *
 * Rules:
 *  - An address is only added when it appears in an official source (recorded in `source`).
 *  - Every address is re-checked on-chain at runtime on /network (bytecode present and
 *    cross-references match, e.g. NonfungiblePositionManager.WETH9() == WETH).
 *  - PROJECT X's own contracts stay `null` until they are audited, deployed and verified.
 *    Code must use `requireContract()`, which throws instead of guessing.
 */

export type ContractKey =
  | "weth"
  | "usdg"
  | "permit2"
  | "uniswapV3Factory"
  | "uniswapV3QuoterV2"
  | "uniswapV3PositionManager"
  | "uniswapV3SwapRouter02"
  | "uniswapInterfaceMulticall"
  | "uniswapUniversalRouter"
  | "uniswapV4PoolManager"
  | "uniswapV4PositionManager"
  | "uniswapV4StateView"
  | "uniswapV4Quoter"
  | "pxLaunchpad"
  | "pxGraduator";

export interface ContractEntry {
  label: string;
  address: Address | null;
  source: string;
  /** Extra caveat shown in the UI. */
  note?: string;
}

const UNI_V3 = "https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments";
const UNI_V4 = "https://developers.uniswap.org/docs/protocols/v4/deployments";
const OURS = "packages/contracts — written and unit-tested; not deployed (audit required first)";

export const CONTRACTS: Record<ContractKey, ContractEntry> = {
  weth: {
    label: "WETH",
    address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    source: "https://docs.robinhood.com/chain/contracts",
    note: "Official page has no network column — confirmed at runtime against Uniswap's WETH9().",
  },
  usdg: {
    label: "USDG",
    address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    source: "https://docs.robinhood.com/chain/contracts",
    note: "Listed beside WETH on Robinhood's token page (no network column). Symbol/decimals verified on-chain at runtime.",
  },
  permit2: { label: "Permit2", address: "0x000000000022D473030F116dDEE9F6B43aC78BA3", source: UNI_V3 },
  uniswapV3Factory: { label: "Uniswap v3 Factory", address: "0x1f7d7550b1b028f7571e69a784071f0205fd2efa", source: UNI_V3 },
  uniswapV3QuoterV2: { label: "Uniswap v3 QuoterV2", address: "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7", source: UNI_V3 },
  uniswapV3PositionManager: {
    label: "Uniswap v3 NonfungiblePositionManager",
    address: "0x73991a25c818bf1f1128deaab1492d45638de0d3",
    source: UNI_V3,
  },
  uniswapV3SwapRouter02: { label: "Uniswap SwapRouter02", address: "0xcaf681a66d020601342297493863e78c959e5cb2", source: UNI_V3 },
  uniswapInterfaceMulticall: {
    label: "UniswapInterfaceMulticall",
    address: "0x282a3c4d320cc7f0d5eaf56b8029e4b88338f0a3",
    source: UNI_V3,
  },
  uniswapUniversalRouter: { label: "Uniswap UniversalRouter", address: "0x8876789976decbfcbbbe364623c63652db8c0904", source: UNI_V3 },
  uniswapV4PoolManager: { label: "Uniswap v4 PoolManager", address: "0x8366a39cc670b4001a1121b8f6a443a643e40951", source: UNI_V4 },
  uniswapV4PositionManager: {
    label: "Uniswap v4 PositionManager",
    address: "0x58daec3116aae6d93017baaea7749052e8a04fa7",
    source: UNI_V4,
  },
  uniswapV4StateView: { label: "Uniswap v4 StateView", address: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b", source: UNI_V4 },
  uniswapV4Quoter: { label: "Uniswap v4 Quoter", address: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94", source: UNI_V4 },
  pxLaunchpad: { label: "PROJECT X BondingCurveLaunchpad", address: null, source: OURS },
  pxGraduator: { label: "PROJECT X UniswapV3Graduator", address: null, source: OURS },
};

export class IntegrationMissingError extends Error {
  constructor(public readonly key: ContractKey) {
    super(`Contract "${key}" is not configured on Robinhood Chain Mainnet. Source of truth: ${CONTRACTS[key].source}.`);
    this.name = "IntegrationMissingError";
  }
}

export function getContract(key: ContractKey): Address | null {
  return CONTRACTS[key].address;
}

export function requireContract(key: ContractKey): Address {
  const a = CONTRACTS[key].address;
  if (!a) throw new IntegrationMissingError(key);
  return a;
}
