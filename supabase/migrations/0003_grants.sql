-- PROJECT X — explicit API privileges, so the schema works even when the Supabase project
-- was created without "Grant API access to new tables automatically".
-- Reads are public (RLS "public read" policies still apply); writes are service role only.
grant usage on schema public to anon, authenticated, service_role;
grant select on public.tokens, public.pools, public.pool_swaps, public.pool_liquidity_events,
  public.indexer_state, public.pool_stats to anon, authenticated;
grant all on public.tokens, public.pools, public.pool_swaps, public.pool_liquidity_events,
  public.indexer_state, public.pool_stats to service_role;
