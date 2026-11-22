-- PROJECT X — Uniswap v3 pool index for Robinhood Chain Mainnet (4663).
-- Written only by services/market-data (service role). Every row comes from on-chain logs or calls.

create table if not exists public.pools (
  address         text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  token0          text not null,
  token1          text not null,
  symbol0         text not null,
  symbol1         text not null,
  decimals0       smallint not null,
  decimals1       smallint not null,
  fee             integer not null,
  tick_spacing    integer not null,
  created_block   bigint not null,
  created_at      timestamptz,
  weth_side       smallint check (weth_side in (0, 1)),
  -- latest snapshot (slot0, liquidity, token balances of the pool)
  sqrt_price_x96  numeric(78, 0),
  liquidity       numeric(78, 0),
  reserve0        numeric(78, 0),
  reserve1        numeric(78, 0),
  snapshot_block  bigint
);
create index if not exists pools_token0_idx on public.pools (token0);
create index if not exists pools_token1_idx on public.pools (token1);

create table if not exists public.pool_swaps (
  pool            text not null references public.pools (address),
  block_number    bigint not null,
  block_time      timestamptz not null,
  tx_hash         text not null,
  log_index       integer not null,
  sender          text not null,
  recipient       text not null,
  amount0         numeric(78, 0) not null,
  amount1         numeric(78, 0) not null,
  sqrt_price_x96  numeric(78, 0) not null,
  liquidity       numeric(78, 0) not null,
  tick            integer not null,
  primary key (tx_hash, log_index)
);
create index if not exists pool_swaps_pool_time_idx on public.pool_swaps (pool, block_time desc);

create table if not exists public.pool_liquidity_events (
  pool            text not null references public.pools (address),
  kind            text not null check (kind in ('Mint', 'Burn')),
  block_number    bigint not null,
  block_time      timestamptz not null,
  tx_hash         text not null,
  log_index       integer not null,
  owner           text not null,
  tick_lower      integer not null,
  tick_upper      integer not null,
  liquidity       numeric(78, 0) not null,
  amount0         numeric(78, 0) not null,
  amount1         numeric(78, 0) not null,
  primary key (tx_hash, log_index)
);
create index if not exists pool_liq_pool_time_idx on public.pool_liquidity_events (pool, block_time desc);

create table if not exists public.indexer_state (
  key   text primary key,
  value text not null
);

-- 24h stats from indexed swaps. ETH-denominated figures exist only for WETH pairs (no price oracle needed).
create or replace view public.pool_stats as
select
  p.*,
  case p.weth_side when 0 then p.reserve0 / 1e18 when 1 then p.reserve1 / 1e18 end::double precision as weth_reserve,
  coalesce(s.swaps_24h, 0)                    as swaps_24h,
  coalesce(s.volume0_24h, 0)::text            as volume0_24h,
  coalesce(s.volume1_24h, 0)::text            as volume1_24h,
  case p.weth_side when 0 then coalesce(s.volume0_24h, 0) / 1e18
                   when 1 then coalesce(s.volume1_24h, 0) / 1e18 end::double precision as volume_eth_24h
from public.pools p
left join lateral (
  select count(*)::int as swaps_24h, sum(abs(w.amount0)) as volume0_24h, sum(abs(w.amount1)) as volume1_24h
  from public.pool_swaps w
  where w.pool = p.address and w.block_time > now() - interval '24 hours'
) s on true;

alter table public.pools enable row level security;
alter table public.pool_swaps enable row level security;
alter table public.pool_liquidity_events enable row level security;
alter table public.indexer_state enable row level security;
drop policy if exists "public read" on public.pools;
create policy "public read" on public.pools for select using (true);
drop policy if exists "public read" on public.pool_swaps;
create policy "public read" on public.pool_swaps for select using (true);
drop policy if exists "public read" on public.pool_liquidity_events;
create policy "public read" on public.pool_liquidity_events for select using (true);
drop policy if exists "public read" on public.indexer_state;
create policy "public read" on public.indexer_state for select using (true);
