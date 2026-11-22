/** Row of the pool_stats view (supabase/migrations/0002_pools.sql). Amounts are raw integers as strings. */
export interface IndexedPool {
  address: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
  fee: number;
  tick_spacing: number;
  created_block: number;
  created_at: string | null;
  sqrt_price_x96: string | null;
  liquidity: string | null;
  reserve0: string | null;
  reserve1: string | null;
  weth_side: 0 | 1 | null;
  /** WETH held by the pool, in ETH. Only for WETH pairs. */
  weth_reserve: number | null;
  swaps_24h: number;
  volume0_24h: string;
  volume1_24h: string;
  /** WETH-side volume over 24h, in ETH. Only for WETH pairs. */
  volume_eth_24h: number | null;
  snapshot_block: number | null;
}
