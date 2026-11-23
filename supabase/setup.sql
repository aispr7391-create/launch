-- PROJECT X — complete database setup for Supabase SQL Editor.
-- Paste everything, press Run once. Safe to run again.

-- PROJECT X — launched tokens and their off-chain metadata.
-- Rows are written only by the server (service role) after the launch transaction has been
-- verified on Robinhood Chain Mainnet (see apps/web/src/app/api/launches/route.ts).

create table if not exists public.tokens (
  address       text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  chain_id      integer not null default 4663 check (chain_id = 4663),
  creator       text not null check (creator ~ '^0x[0-9a-f]{40}$'),
  name          text not null check (char_length(name) between 1 and 32),
  symbol        text not null check (char_length(symbol) between 1 and 10),
  total_supply  numeric(78, 0) not null,
  decimals      smallint not null default 18,
  description   text not null default '' check (char_length(description) <= 500),
  image_url     text not null,
  website       text,
  x_url         text,
  telegram      text,
  discord       text,
  metadata_uri  text not null,
  tx_hash       text not null unique check (tx_hash ~ '^0x[0-9a-f]{64}$'),
  block_number  bigint not null,
  created_at    timestamptz not null,
  indexed_at    timestamptz not null default now()
);

create index if not exists tokens_creator_idx on public.tokens (creator);
create index if not exists tokens_created_at_idx on public.tokens (created_at desc);

alter table public.tokens enable row level security;

-- Anyone may read; nobody but the service role may write (no insert/update policies).
drop policy if exists "tokens are public" on public.tokens;
create policy "tokens are public" on public.tokens for select using (true);

-- Public bucket for logos (logos/<sha256>.<ext>) and metadata (metadata/<sha256>.json).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('token-assets', 'token-assets', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'application/json'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

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

-- PROJECT X — explicit API privileges, so the schema works even when the Supabase project
-- was created without "Grant API access to new tables automatically".
-- Reads are public (RLS "public read" policies still apply); writes are service role only.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.tokens, public.pools, public.pool_swaps, public.pool_liquidity_events,
  public.indexer_state, public.pool_stats to anon, authenticated;
grant all on public.tokens, public.pools, public.pool_swaps, public.pool_liquidity_events,
  public.indexer_state, public.pool_stats to service_role;
