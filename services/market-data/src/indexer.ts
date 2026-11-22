/**
 * PROJECT X market-data indexer — Uniswap v3 on Robinhood Chain Mainnet (4663).
 *
 * Reads ONLY on-chain data:
 *  - PoolCreated from the official v3 factory → public.pools
 *  - Swap / Mint / Burn from those pools        → public.pool_swaps, public.pool_liquidity_events
 *  - slot0 / liquidity / token balances         → pool snapshot columns
 * Progress is checkpointed in public.indexer_state and every write is idempotent, so it can be
 * stopped and restarted at any time. Runs a few blocks behind head to avoid reorgs.
 *
 * Env: RPC_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, [START_BLOCK], [CHUNK=2000], [CONFIRMATIONS=20]
 */
import { createPublicClient, getAddress, http, parseAbi, parseEventLogs, type Address, type Log } from "viem";
import { binarySearchDeployBlock, chunkRanges } from "./ranges.js";

// Official addresses (Uniswap v3 Robinhood Chain deployments page). Keep in sync with apps/web/src/config/contracts.ts.
const FACTORY = getAddress("0x1f7d7550b1b028f7571e69a784071f0205fd2efa");
const NPM = getAddress("0x73991a25c818bf1f1128deaab1492d45638de0d3");

const factoryAbi = parseAbi(["event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)"]);
const poolAbi = parseAbi([
  "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
  "event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  "event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)",
  "function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)",
  "function liquidity() view returns (uint128)",
]);
const erc20 = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)"]);
const npmAbi = parseAbi(["function WETH9() view returns (address)"]);

const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d;
  if (v === undefined) throw new Error(`Missing env ${k}`);
  return v;
};
const CHUNK = BigInt(env("CHUNK", "2000"));
const CONFIRMATIONS = BigInt(env("CONFIRMATIONS", "20"));
const ONCE = process.argv.includes("--once");

const client = createPublicClient({ transport: http(env("RPC_URL"), { batch: true, retryCount: 5 }) });
const SB_URL = env("SUPABASE_URL").replace(/\/$/, "");
const SB_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

async function sb(path: string, init?: RequestInit) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 || init?.method === "POST" ? null : res.json();
}
const upsert = (table: string, rows: object[], onConflict: string, ignore = false) =>
  rows.length
    ? sb(`${table}?on_conflict=${onConflict}`, {
        method: "POST",
        headers: { Prefer: `resolution=${ignore ? "ignore" : "merge"}-duplicates,return=minimal` },
        body: JSON.stringify(rows),
      })
    : Promise.resolve(null);

async function getState(key: string): Promise<string | null> {
  const rows = (await sb(`indexer_state?key=eq.${key}&select=value`)) as { value: string }[];
  return rows[0]?.value ?? null;
}
const setState = (key: string, value: string) => upsert("indexer_state", [{ key, value }], "key");

const blockTimeCache = new Map<bigint, string>();
async function blockTimes(blocks: bigint[]) {
  const missing = [...new Set(blocks)].filter((b) => !blockTimeCache.has(b));
  await Promise.all(
    missing.map(async (b) => blockTimeCache.set(b, new Date(Number((await client.getBlock({ blockNumber: b })).timestamp) * 1000).toISOString())),
  );
  if (blockTimeCache.size > 50_000) blockTimeCache.clear();
  return (b: bigint) => blockTimeCache.get(b)!;
}

async function main() {
  const chainId = await client.getChainId();
  if (chainId !== 4663) throw new Error(`RPC is chain ${chainId}, expected Robinhood Chain Mainnet (4663).`);
  const weth = getAddress(await client.readContract({ address: NPM, abi: npmAbi, functionName: "WETH9" })).toLowerCase();

  let last = await getState("last_block");
  if (!last) {
    const start = process.env.START_BLOCK
      ? BigInt(process.env.START_BLOCK)
      : await binarySearchDeployBlock(async (b) => {
          const code = await client.getCode({ address: FACTORY, blockNumber: b });
          return Boolean(code && code !== "0x");
        }, await client.getBlockNumber());
    console.log(`Starting from factory deployment block ${start}`);
    last = (start - 1n).toString();
    await setState("last_block", last);
  }

  const pools = new Set<string>(((await sb("pools?select=address")) as { address: string }[]).map((r) => r.address));
  console.log(`Known pools: ${pools.size}`);

  for (;;) {
    const head = (await client.getBlockNumber()) - CONFIRMATIONS;
    const from = BigInt(last!) + 1n;
    if (from > head) {
      if (ONCE) break;
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    for (const [a, b] of chunkRanges(from, head, CHUNK)) {
      const touched = new Set<string>();

      // 1. new pools
      const created = parseEventLogs({ abi: factoryAbi, logs: await client.getLogs({ address: FACTORY, fromBlock: a, toBlock: b }) });
      if (created.length) {
        const t = await blockTimes(created.map((l) => l.blockNumber));
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
              address: pool, token0: t0.toLowerCase(), token1: t1.toLowerCase(), symbol0: String(s0).slice(0, 32), symbol1: String(s1).slice(0, 32),
              decimals0: Number(d0), decimals1: Number(d1), fee: Number(l.args.fee), tick_spacing: Number(l.args.tickSpacing),
              created_block: Number(l.blockNumber), created_at: t(l.blockNumber),
              weth_side: t0.toLowerCase() === weth ? 0 : t1.toLowerCase() === weth ? 1 : null,
            };
          }),
        );
        await upsert("pools", rows, "address");
      }

      // 2. swaps / mints / burns from known pools (one chain-wide query per event type, filtered locally)
      const all = (await client.getLogs({ fromBlock: a, toBlock: b, events: poolAbi.filter((x) => x.type === "event") })) as Log[];
      const ours = all.filter((l) => pools.has(l.address.toLowerCase()));
      const parsed = parseEventLogs({ abi: poolAbi, logs: ours });
      if (parsed.length) {
        const t = await blockTimes(parsed.map((l) => l.blockNumber!));
        const swaps: object[] = [];
        const liq: object[] = [];
        for (const l of parsed) {
          const pool = l.address.toLowerCase();
          touched.add(pool);
          const base = { pool, block_number: Number(l.blockNumber), block_time: t(l.blockNumber!), tx_hash: l.transactionHash, log_index: l.logIndex };
          if (l.eventName === "Swap") {
            swaps.push({ ...base, sender: l.args.sender.toLowerCase(), recipient: l.args.recipient.toLowerCase(), amount0: l.args.amount0.toString(), amount1: l.args.amount1.toString(), sqrt_price_x96: l.args.sqrtPriceX96.toString(), liquidity: l.args.liquidity.toString(), tick: Number(l.args.tick) });
          } else if (l.eventName === "Mint" || l.eventName === "Burn") {
            liq.push({ ...base, kind: l.eventName, owner: l.args.owner.toLowerCase(), tick_lower: Number(l.args.tickLower), tick_upper: Number(l.args.tickUpper), liquidity: l.args.amount.toString(), amount0: l.args.amount0.toString(), amount1: l.args.amount1.toString() });
          }
        }
        await upsert("pool_swaps", swaps, "tx_hash,log_index", true);
        await upsert("pool_liquidity_events", liq, "tx_hash,log_index", true);
      }

      // 3. snapshots of touched pools at block b
      await snapshot([...touched], b);
      last = b.toString();
      await setState("last_block", last);
      console.log(`Indexed ${a}–${b}: +${created.length} pools, ${parsed.length} events`);
    }
  }
}

async function snapshot(addresses: string[], blockNumber: bigint) {
  if (!addresses.length) return;
  const rows = (await sb(`pools?address=in.(${addresses.join(",")})&select=address,token0,token1`)) as { address: Address; token0: Address; token1: Address }[];
  const updates = await Promise.all(
    rows.map(async (p) => {
      const [s0, liquidity, r0, r1] = await Promise.all([
        client.readContract({ address: p.address, abi: poolAbi, functionName: "slot0", blockNumber }),
        client.readContract({ address: p.address, abi: poolAbi, functionName: "liquidity", blockNumber }),
        client.readContract({ address: p.token0, abi: erc20, functionName: "balanceOf", args: [p.address], blockNumber }).catch(() => null),
        client.readContract({ address: p.token1, abi: erc20, functionName: "balanceOf", args: [p.address], blockNumber }).catch(() => null),
      ]);
      return { address: p.address, sqrt_price_x96: s0[0].toString(), liquidity: liquidity.toString(), reserve0: r0?.toString() ?? null, reserve1: r1?.toString() ?? null, snapshot_block: Number(blockNumber) };
    }),
  );
  for (const u of updates) {
    await sb(`pools?address=eq.${u.address}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(u) });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
