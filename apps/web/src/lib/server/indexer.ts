import "server-only";
import { getAddress, parseAbi, parseEventLogs, type Address, type Log } from "viem";
import { serverClient as client } from "./chain";
import { authHeaders } from "./supabase";

/**
 * Uniswap v3 market-data indexer for Robinhood Chain Mainnet (4663), run in short steps
 * from /api/indexer/run (serverless) instead of as a long-lived process.
 *
 * Reads ONLY on-chain data:
 *  - PoolCreated from the official v3 factory → public.pools
 *  - Swap / Mint / Burn from those pools        → public.pool_swaps, public.pool_liquidity_events
 *  - slot0 / liquidity / token balances         → pool snapshot columns
 * Progress lives in public.indexer_state; every write is idempotent, so a step can be cut off
 * at any point and the next one resumes. Stays CONFIRMATIONS blocks behind head to avoid reorgs.
 */

// Official addresses (Uniswap v3 Robinhood Chain deployments). Keep in sync with config/contracts.ts.
const FACTORY = getAddress("0x1f7d7550b1b028f7571e69a784071f0205fd2efa");
const NPM = getAddress("0x73991a25c818bf1f1128deaab1492d45638de0d3");

const factoryAbi = parseAbi(["event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)"]);
const poolEventsAbi = parseAbi([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
]);
const poolAbi = parseAbi([
  "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
  "function liquidity() view returns (uint128)",
]);
const poolIdAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
  "function tickSpacing() view returns (int24)",
]);
const factoryReadAbi = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);
const erc20 = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)"]);
const npmAbi = parseAbi(["function WETH9() view returns (address)"]);

const CONFIRMATIONS = 20n;
const MIN_CHUNK = 10n;
const MAX_CHUNK = 200_000n;
const LOCK_MS = 90_000;

// ---------- Supabase (service role, server only) ----------
function sbEnv() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url, key };
}
async function sb(path: string, init?: RequestInit): Promise<unknown> {
  const { url, key } = sbEnv();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...authHeaders(key), "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
  if (res.status === 204 || res.status === 201 || init?.method === "POST" || init?.method === "PATCH") return null;
  return res.json();
}
function upsert(table: string, rows: object[], onConflict: string, ignore = false) {
  if (!rows.length) return Promise.resolve(null);
  return sb(`${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: `resolution=${ignore ? "ignore" : "merge"}-duplicates,return=minimal` },
    body: JSON.stringify(rows),
  });
}
async function getState(key: string): Promise<string | null> {
  const rows = (await sb(`indexer_state?key=eq.${key}&select=value`)) as { value: string }[];
  return rows[0]?.value ?? null;
}
const setState = (key: string, value: string) => upsert("indexer_state", [{ key, value }], "key");

// ---------- helpers ----------
/**
 * Where a fresh index starts. Full history would need an archive RPC (the public one serves no
 * historical state and limits log ranges), so start a few days back: enough for 24h stats.
 * Pools older than that are picked up the first time they emit an event (see verifyPools).
 */
const LOOKBACK_SECONDS = 3n * 24n * 3600n;
async function startBlock(head: bigint): Promise<bigint> {
  if (process.env.START_BLOCK) return BigInt(process.env.START_BLOCK);
  const sample = 100_000n < head ? 100_000n : head / 2n;
  const [h, p] = await Promise.all([client.getBlock({ blockNumber: head }), client.getBlock({ blockNumber: head - sample })]);
  const secs = h.timestamp - p.timestamp || 1n;
  const back = (LOOKBACK_SECONDS * sample) / secs;
  return head > back ? head - back : 0n;
}

/** Addresses that emitted v3-shaped events but are not pools of the official factory. */
const notPools = new Set<string>();

/**
 * Accept an address as a pool only if the official factory returns it for its own
 * (token0, token1, fee). Reads current state only. Returns rows for newly found pools.
 */
async function verifyPools(addresses: string[], weth: string) {
  const rows: object[] = [];
  for (let i = 0; i < addresses.length; i += 20) {
    await Promise.all(
      addresses.slice(i, i + 20).map(async (addr) => {
        try {
          const a = addr as Address;
          const [t0, t1, fee, spacing] = await Promise.all([
            client.readContract({ address: a, abi: poolIdAbi, functionName: "token0" }),
            client.readContract({ address: a, abi: poolIdAbi, functionName: "token1" }),
            client.readContract({ address: a, abi: poolIdAbi, functionName: "fee" }),
            client.readContract({ address: a, abi: poolIdAbi, functionName: "tickSpacing" }),
          ]);
          const real = await client.readContract({ address: FACTORY, abi: factoryReadAbi, functionName: "getPool", args: [t0, t1, fee] });
          if (real.toLowerCase() !== addr) {
            notPools.add(addr);
            return;
          }
          const [s0, s1, d0, d1] = await Promise.all([
            client.readContract({ address: t0, abi: erc20, functionName: "symbol" }).catch(() => "?"),
            client.readContract({ address: t1, abi: erc20, functionName: "symbol" }).catch(() => "?"),
            client.readContract({ address: t0, abi: erc20, functionName: "decimals" }).catch(() => 18),
            client.readContract({ address: t1, abi: erc20, functionName: "decimals" }).catch(() => 18),
          ]);
          rows.push({
            address: addr,
            token0: t0.toLowerCase(),
            token1: t1.toLowerCase(),
            symbol0: String(s0).slice(0, 32),
            symbol1: String(s1).slice(0, 32),
            decimals0: Number(d0),
            decimals1: Number(d1),
            fee: Number(fee),
            tick_spacing: Number(spacing),
            // Created before the indexed window: creation block/time unknown (0 / null), not guessed.
            created_block: 0,
            created_at: null,
            weth_side: t0.toLowerCase() === weth ? 0 : t1.toLowerCase() === weth ? 1 : null,
          });
        } catch {
          notPools.add(addr);
        }
      }),
    );
  }
  return rows;
}

async function blockTimes(blocks: bigint[]) {
  const map = new Map<bigint, string>();
  const unique = [...new Set(blocks)];
  for (let i = 0; i < unique.length; i += 25) {
    await Promise.all(
      unique.slice(i, i + 25).map(async (b) => {
        const blk = await client.getBlock({ blockNumber: b });
        map.set(b, new Date(Number(blk.timestamp) * 1000).toISOString());
      }),
    );
  }
  return (b: bigint) => map.get(b)!;
}

async function snapshot(addresses: string[], blockNumber: bigint) {
  // Current state, not historical: the public RPC does not serve state at past blocks.
  if (!addresses.length) return;
  for (let i = 0; i < addresses.length; i += 50) {
    const batch = addresses.slice(i, i + 50);
    const rows = (await sb(`pools?address=in.(${batch.join(",")})&select=address,token0,token1`)) as { address: Address; token0: Address; token1: Address }[];
    const updates = await Promise.all(
      rows.map(async (p) => {
        const [s0, liquidity, r0, r1] = await Promise.all([
          client.readContract({ address: p.address, abi: poolAbi, functionName: "slot0" }).catch(() => null),
          client.readContract({ address: p.address, abi: poolAbi, functionName: "liquidity" }).catch(() => null),
          client.readContract({ address: p.token0, abi: erc20, functionName: "balanceOf", args: [p.address] }).catch(() => null),
          client.readContract({ address: p.token1, abi: erc20, functionName: "balanceOf", args: [p.address] }).catch(() => null),
        ]);
        return {
          address: p.address,
          sqrt_price_x96: s0 ? s0[0].toString() : null,
          liquidity: liquidity?.toString() ?? null,
          reserve0: r0?.toString() ?? null,
          reserve1: r1?.toString() ?? null,
          snapshot_block: Number(blockNumber),
        };
      }),
    );
    await Promise.all(
      updates.map((u) => sb(`pools?address=eq.${u.address}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(u) })),
    );
  }
}

export interface IndexStepResult {
  status: "ok" | "busy";
  fromBlock?: string;
  toBlock?: string;
  head?: string;
  blocksBehind?: string;
  newPools?: number;
  events?: number;
  chunk?: string;
  ms: number;
}

/** Index as many blocks as fit in `budgetMs`, then stop. Safe to call concurrently (soft lock). */
export async function runIndexStep(budgetMs = 45_000): Promise<IndexStepResult> {
  const started = Date.now();
  const lock = await getState("lock_until");
  if (lock && Number(lock) > started) return { status: "busy", ms: 0 };
  await setState("lock_until", String(started + LOCK_MS));

  try {
    const chainId = await client.getChainId();
    if (chainId !== 4663) throw new Error(`RPC is chain ${chainId}, expected Robinhood Chain Mainnet (4663).`);
    const head = (await client.getBlockNumber()) - CONFIRMATIONS;

    let weth = await getState("weth");
    if (!weth) {
      weth = getAddress(await client.readContract({ address: NPM, abi: npmAbi, functionName: "WETH9" })).toLowerCase();
      await setState("weth", weth);
    }

    let last = await getState("last_block");
    if (!last) {
      const start = await startBlock(head);
      last = (start - 1n).toString();
      await setState("last_block", last);
    }
    const startFrom = BigInt(last) + 1n;
    let chunk = BigInt((await getState("chunk")) ?? "5000");

    const pools = new Set(((await sb("pools?select=address")) as { address: string }[]).map((r) => r.address));
    const touched = new Set<string>();
    let newPools = 0;
    let events = 0;
    let cursor = startFrom;

    while (cursor <= head && Date.now() - started < budgetMs) {
      const to = cursor + chunk - 1n > head ? head : cursor + chunk - 1n;
      let createdLogs: Log[];
      let poolLogs: Log[];
      try {
        [createdLogs, poolLogs] = await Promise.all([
          client.getLogs({ address: FACTORY, fromBlock: cursor, toBlock: to }).then((x) => x as unknown as Log[]),
          client.getLogs({ fromBlock: cursor, toBlock: to, events: poolEventsAbi }).then((x) => x as unknown as Log[]),
        ]);
      } catch (err) {
        // Range too large / too many results for the RPC: shrink and retry.
        if (chunk > MIN_CHUNK) {
          chunk = chunk / 2n < MIN_CHUNK ? MIN_CHUNK : chunk / 2n;
          continue;
        }
        throw err;
      }

      // 1. new pools
      const created = parseEventLogs({ abi: factoryAbi, logs: createdLogs });
      if (created.length) {
        const t = await blockTimes(created.map((l) => l.blockNumber!));
        const rows = await Promise.all(
          created.map(async (l) => {
            const [t0, t1] = [l.args.token0, l.args.token1];
            const [s0, s1, d0, d1] = await Promise.all([
              client.readContract({ address: t0, abi: erc20, functionName: "symbol" }).catch(() => "?"),
              client.readContract({ address: t1, abi: erc20, functionName: "symbol" }).catch(() => "?"),
              client.readContract({ address: t0, abi: erc20, functionName: "decimals" }).catch(() => 18),
              client.readContract({ address: t1, abi: erc20, functionName: "decimals" }).catch(() => 18),
            ]);
            const pool = l.args.pool.toLowerCase();
            pools.add(pool);
            touched.add(pool);
            return {
              address: pool,
              token0: t0.toLowerCase(),
              token1: t1.toLowerCase(),
              symbol0: String(s0).slice(0, 32),
              symbol1: String(s1).slice(0, 32),
              decimals0: Number(d0),
              decimals1: Number(d1),
              fee: Number(l.args.fee),
              tick_spacing: Number(l.args.tickSpacing),
              created_block: Number(l.blockNumber),
              created_at: t(l.blockNumber!),
              weth_side: t0.toLowerCase() === weth ? 0 : t1.toLowerCase() === weth ? 1 : null,
            };
          }),
        );
        await upsert("pools", rows, "address");
        newPools += rows.length;
      }

      // 2. swaps / mints / burns, only from pools created by the official factory
      const unknown = [...new Set(poolLogs.map((l) => l.address.toLowerCase()))].filter((a) => !pools.has(a) && !notPools.has(a));
      if (unknown.length) {
        const found = (await verifyPools(unknown, weth)) as { address: string }[];
        if (found.length) {
          await upsert("pools", found, "address", true);
          for (const f of found) pools.add(f.address);
          newPools += found.length;
        }
      }
      const parsed = parseEventLogs({ abi: poolEventsAbi, logs: poolLogs.filter((l) => pools.has(l.address.toLowerCase())) });
      if (parsed.length) {
        const t = await blockTimes(parsed.map((l) => l.blockNumber!));
        const swaps: object[] = [];
        const liq: object[] = [];
        for (const l of parsed) {
          const pool = l.address.toLowerCase();
          touched.add(pool);
          const base = { pool, block_number: Number(l.blockNumber), block_time: t(l.blockNumber!), tx_hash: l.transactionHash, log_index: l.logIndex };
          if (l.eventName === "Swap") {
            swaps.push({
              ...base,
              sender: l.args.sender.toLowerCase(),
              recipient: l.args.recipient.toLowerCase(),
              amount0: l.args.amount0.toString(),
              amount1: l.args.amount1.toString(),
              sqrt_price_x96: l.args.sqrtPriceX96.toString(),
              liquidity: l.args.liquidity.toString(),
              tick: Number(l.args.tick),
            });
          } else if (l.eventName === "Mint" || l.eventName === "Burn") {
            liq.push({
              ...base,
              kind: l.eventName,
              owner: l.args.owner.toLowerCase(),
              tick_lower: Number(l.args.tickLower),
              tick_upper: Number(l.args.tickUpper),
              liquidity: l.args.amount.toString(),
              amount0: l.args.amount0.toString(),
              amount1: l.args.amount1.toString(),
            });
          }
        }
        await upsert("pool_swaps", swaps, "tx_hash,log_index", true);
        await upsert("pool_liquidity_events", liq, "tx_hash,log_index", true);
        events += parsed.length;
      }

      await setState("last_block", to.toString());
      cursor = to + 1n;
      // Quiet ranges: grow the window so backfill catches up quickly.
      if (createdLogs.length + poolLogs.length < 2_000 && chunk < MAX_CHUNK) chunk = chunk * 2n > MAX_CHUNK ? MAX_CHUNK : chunk * 2n;
    }

    await setState("chunk", chunk.toString());
    await snapshot([...touched], head);

    return {
      status: "ok",
      fromBlock: startFrom.toString(),
      toBlock: (cursor - 1n).toString(),
      head: head.toString(),
      blocksBehind: (head - (cursor - 1n)).toString(),
      newPools,
      events,
      chunk: chunk.toString(),
      ms: Date.now() - started,
    };
  } finally {
    await setState("lock_until", "0").catch(() => undefined);
  }
}
