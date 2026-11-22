import { parseAbi } from "viem";

/**
 * ABI of packages/contracts/src/launchpad/BondingCurveLaunchpad.sol (only what the app uses).
 * Regenerate from `forge build` output (out/BondingCurveLaunchpad.sol/*.json) if the contract changes.
 */
export const launchpadAbi = parseAbi([
  "function config() view returns (uint128 virtualEth, uint128 targetEth, uint128 graduationFee, uint128 creationFee, uint16 tradeFeeBps, uint16 creatorShareBps, uint32 graduationGasReserve)",
  "function MIN_SUPPLY() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function paused() view returns (bool)",
  "function createToken(string name, string symbol, uint256 supply, string metadataURI, uint256 minTokensOut, uint256 deadline) payable returns (address token)",
  "function getLaunch(address token) view returns ((address creator, uint8 status, uint16 tradeFeeBps, uint16 creatorShareBps, uint40 createdAt, uint256 x, uint256 v, uint256 realEth, uint256 curveSupply, uint256 curveLeft, uint256 lpTokens, uint256 graduationFee, address pool))",
  "function progressBps(address token) view returns (uint256)",
  "function spotPrice(address token) view returns (uint256)",
  "event TokenCreated(address indexed token, address indexed creator, string name, string symbol, uint256 supply, string metadataURI)",
  "event CurveInitialized(address indexed token, uint256 curveSupply, uint256 lpTokens, uint256 x0, uint256 virtualEth, uint256 targetEth)",
  "error InvalidConfig()",
  "error InvalidSupply()",
  "error InvalidName()",
  "error InsufficientCreationFee()",
  "error NotTrading()",
  "error ZeroAmount()",
  "error Slippage()",
  "error Expired()",
  "error InsufficientGas()",
  "error EnforcedPause()",
]);

export const erc20MetaAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function tradingOpen() view returns (bool)",
]);

/** Mirrors BondingCurveLaunchpad.Status */
export const LAUNCH_STATUS = ["None", "Bonding curve", "Graduation pending", "Graduated"] as const;

/** LaunchToken is OpenZeppelin ERC20 with the default 18 decimals; not configurable. */
export const TOKEN_DECIMALS = 18;
