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
