/**
 * Read-only Uniswap v3 data straight from Robinhood Chain Mainnet. Every function takes a viem
 * PublicClient so it runs both in the browser (wagmi) and on the server.
 *
 * Note: Multicall3 is not configured for this chain (no official address), so reads are sent as
 * parallel eth_calls; the HTTP transport batches them into JSON-RPC batches.
 */
import { getAddress, isAddress, isAddressEqual, zeroAddress, type Address, type PublicClient } from "viem";
import { requireContract } from "@/config/contracts";
import { erc20Abi, FEE_TIERS, MAX_UINT128, positionManagerAbi, v3FactoryAbi, v3PoolAbi } from "./abi";
import { getAmountsForLiquidity } from "./math/liquidityAmounts";
import { getSqrtRatioAtTick } from "./math/tickMath";

export interface TokenMeta {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export interface PoolState {
  address: Address;
  token0: TokenMeta;
  token1: TokenMeta;
  fee: number;
  tickSpacing: number;
  sqrtPriceX96: bigint;
  tick: number;
  liquidity: bigint;
  /** Actual token balances held by the pool contract. */
  reserve0: bigint;
  reserve1: bigint;
  /** factory.getPool(token0, token1, fee) == address */
  verified: boolean;
}

export interface Position {
  tokenId: bigint;
  owner: Address;
  pool: PoolState;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  inRange: boolean;
  /** Uncollected fees, from a static call to collect() as the owner. null if the call failed. */
  fees: { amount0: bigint; amount1: bigint } | null;
}

const factory = () => requireContract("uniswapV3Factory");
const npm = () => requireContract("uniswapV3PositionManager");

const metaCache = new Map<string, TokenMeta>();

export class InvalidTokenError extends Error {}
export class InvalidPoolError extends Error {}

/** Reads ERC-20 metadata, failing if the address has no code or does not behave like an ERC-20. */
export async function fetchTokenMeta(client: PublicClient, address: string): Promise<TokenMeta> {
  if (!isAddress(address)) throw new InvalidTokenError("Not a valid address.");
  const a = getAddress(address);
  const cached = metaCache.get(a);
  if (cached) return cached;
  const code = await client.getCode({ address: a });
  if (!code || code === "0x") throw new InvalidTokenError("No contract at this address on Robinhood Chain.");
  try {
    const [symbol, name, decimals] = await Promise.all([
      client.readContract({ address: a, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: a, abi: erc20Abi, functionName: "name" }).catch(() => ""),
      client.readContract({ address: a, abi: erc20Abi, functionName: "decimals" }),
    ]);
    if (decimals > 36) throw new Error("decimals");
    const meta = { address: a, symbol, name: name || symbol, decimals };
    metaCache.set(a, meta);
    return meta;
  } catch {
    throw new InvalidTokenError("This contract is not a standard ERC-20 token.");
  }
}

export async function fetchTickSpacings(client: PublicClient): Promise<Record<number, number>> {
  const res = await Promise.all(
    FEE_TIERS.map((fee) => client.readContract({ address: factory(), abi: v3FactoryAbi, functionName: "feeAmountTickSpacing", args: [fee] })),
  );
  return Object.fromEntries(FEE_TIERS.map((f, i) => [f, Number(res[i])]).filter(([, s]) => s > 0));
}

/** Full pool state. Throws InvalidPoolError unless the address is a pool of the official factory. */
export async function fetchPool(client: PublicClient, address: string): Promise<PoolState> {
  if (!isAddress(address)) throw new InvalidPoolError("Not a valid address.");
  const pool = getAddress(address);
  let t0: Address, t1: Address, fee: number;
  try {
    [t0, t1, fee] = await Promise.all([
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "token0" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "token1" }),
      client.readContract({ address: pool, abi: v3PoolAbi, functionName: "fee" }),
    ]);
  } catch {
    throw new InvalidPoolError("This address is not a Uniswap v3 pool.");
  }
  const official = await client.readContract({ address: factory(), abi: v3FactoryAbi, functionName: "getPool", args: [t0, t1, fee] });
  const verified = isAddressEqual(official, pool);
  if (!verified) throw new InvalidPoolError("Not a pool of the official Uniswap v3 factory on Robinhood Chain.");

  const [token0, token1, spacing, slot0, liquidity, reserve0, reserve1] = await Promise.all([
    fetchTokenMeta(client, t0),
    fetchTokenMeta(client, t1),
    client.readContract({ address: pool, abi: v3PoolAbi, functionName: "tickSpacing" }),
    client.readContract({ address: pool, abi: v3PoolAbi, functionName: "slot0" }),
    client.readContract({ address: pool, abi: v3PoolAbi, functionName: "liquidity" }),
    client.readContract({ address: t0, abi: erc20Abi, functionName: "balanceOf", args: [pool] }),
    client.readContract({ address: t1, abi: erc20Abi, functionName: "balanceOf", args: [pool] }),
  ]);
  return {
    address: pool,
    token0,
    token1,
    fee,
    tickSpacing: Number(spacing),
    sqrtPriceX96: slot0[0],
    tick: Number(slot0[1]),
    liquidity,
    reserve0,
    reserve1,
    verified,
  };
}

export interface PairPool {
  fee: number;
  tickSpacing: number;
  address: Address | null;
  state: PoolState | null;
}

/** Every fee tier for a pair: the existing official pool (if any) and its state. */
export async function findPairPools(client: PublicClient, tokenA: Address, tokenB: Address): Promise<PairPool[]> {
  if (isAddressEqual(tokenA, tokenB)) return [];
  const spacings = await fetchTickSpacings(client);
  const fees = Object.keys(spacings).map(Number);
  const addrs = await Promise.all(
    fees.map((fee) => client.readContract({ address: factory(), abi: v3FactoryAbi, functionName: "getPool", args: [tokenA, tokenB, fee] })),
  );
  return Promise.all(
    fees.map(async (fee, i) => {
      const address = isAddressEqual(addrs[i], zeroAddress) ? null : addrs[i];
      const state = address ? await fetchPool(client, address).catch(() => null) : null;
      // A created-but-uninitialised pool has sqrtPrice 0 and cannot accept liquidity at a price yet.
      return { fee, tickSpacing: spacings[fee], address, state: state && state.sqrtPriceX96 > 0n ? state : null };
    }),
  );
}

/** Uncollected fees: static call to collect() as the owner (exactly what Uniswap's interface does). */
export async function fetchUncollectedFees(client: PublicClient, owner: Address, tokenId: bigint) {
  try {
    const { result } = await client.simulateContract({
      address: npm(),
      abi: positionManagerAbi,
      functionName: "collect",
      args: [{ tokenId, recipient: owner, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
      account: owner,
    });
    return { amount0: result[0], amount1: result[1] };
  } catch {
    return null;
  }
}

export async function fetchPosition(client: PublicClient, tokenId: bigint, owner?: Address): Promise<Position> {
  const p = await client.readContract({ address: npm(), abi: positionManagerAbi, functionName: "positions", args: [tokenId] });
  const [, , t0, t1, fee, tickLower, tickUpper, liquidity] = p;
  const poolAddr = await client.readContract({ address: factory(), abi: v3FactoryAbi, functionName: "getPool", args: [t0, t1, fee] });
  const pool = await fetchPool(client, poolAddr);
  const [amount0, amount1] = getAmountsForLiquidity(
    pool.sqrtPriceX96,
    getSqrtRatioAtTick(Number(tickLower)),
    getSqrtRatioAtTick(Number(tickUpper)),
    liquidity,
  );
  const holder = owner ?? (await client.readContract({ address: npm(), abi: positionManagerAbi, functionName: "ownerOf", args: [tokenId] }));
  return {
    tokenId,
    owner: getAddress(holder),
    pool,
    tickLower: Number(tickLower),
    tickUpper: Number(tickUpper),
    liquidity,
    amount0,
    amount1,
    inRange: pool.tick >= Number(tickLower) && pool.tick < Number(tickUpper),
    fees: await fetchUncollectedFees(client, holder, tokenId),
  };
}

/** All Uniswap v3 position NFTs owned by `owner` (enumerable, capped at 200). */
export async function fetchPositions(client: PublicClient, owner: Address): Promise<Position[]> {
  const count = await client.readContract({ address: npm(), abi: positionManagerAbi, functionName: "balanceOf", args: [owner] });
  const n = Number(count > 200n ? 200n : count);
  const ids = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      client.readContract({ address: npm(), abi: positionManagerAbi, functionName: "tokenOfOwnerByIndex", args: [owner, BigInt(i)] }),
    ),
  );
  const positions = await Promise.all(ids.map((id) => fetchPosition(client, id, owner).catch(() => null)));
  return positions.filter((p): p is Position => p !== null).sort((a, b) => Number(b.tokenId - a.tokenId));
}
