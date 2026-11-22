# services/api

Thin backend for things that do not belong on-chain:

- Token metadata (description, logo) submitted at launch — stored in Supabase Storage,
  keyed by token address, written only after the deployment receipt is confirmed.
- Read API over the market-data tables for the web app.

No user funds, keys or signing ever pass through this service. Planned for Phase 2
(metadata) and Phase 6 (market data API).
