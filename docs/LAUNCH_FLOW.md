# Launch Token — how it works

Page: `/launch` → `features/launch/components/LaunchForm.tsx`. Token page: `/token/[address]`.

## Five steps
1. **Token details** — logo (PNG/JPG/JPEG/WEBP, ≤5 MB, ≥128 px, near-square), name (2–32 chars and ≤32 UTF-8 bytes, the contract limit), ticker (2–10, A–Z/0–9, auto-uppercase), description (≤500).
2. **Social links** — website / X / Telegram / Discord, all optional, https only, host-checked.
3. **Configuration** — total supply (whole tokens, bounds read from `MIN_SUPPLY`/`MAX_SUPPLY`), optional initial buy + slippage. Decimals (18), buy/sell fee, creation fee, graduation threshold/fee, virtual ETH are **read-only** — read live from `launchpad.config()`. Derived economics (curve/LP split, start price, market cap at graduation) use `curve.ts`, an exact BigInt mirror of `CurveMath.sol`.
4. **Preview** — everything entered, with Edit links. A live preview card is visible on every step.
5. **Launch** — review (fees, ETH sent, gas estimate, wallet, network), confirmation checkbox, then the deploy flow.

## Deploy flow (`useLaunchFlow.ts`)
validate → wallet → switch/verify chain 4663 → upload logo (real progress) → upload metadata JSON →
prepare args → `simulateContract` → `estimateContractGas` + fee → wallet signature → receipt-tracked →
`waitForTransactionReceipt` → verify `status`, `TokenCreated` from the launchpad, contract code at the
token address → server records the launch → redirect to `/token/<address>`.

- Success is shown only after the receipt is confirmed and the event is verified.
- Duplicate protection: synchronous in-flight lock; submitted tx hashes are kept in localStorage, so a
  reload offers **Resume** instead of a second launch. Reverted txs are cleared; timeouts stay resumable.
- If recording metadata fails after a confirmed deploy, the UI says so and offers **Retry saving**.

## Storage & linking
- `POST /api/uploads/logo` — re-validates bytes server-side (magic numbers + real dimensions), stores
  `logos/<sha256>.<ext>` in Supabase Storage bucket `token-assets`.
- `POST /api/metadata` — validates again, stores canonical `metadata/<sha256>.json`; its URL is passed to
  `createToken(..., metadataURI, ...)` and emitted on-chain in `TokenCreated` → permanent link.
- `POST /api/launches` — server fetches the receipt itself, checks it went to the launchpad, decodes
  `TokenCreated`, checks code at the token, checks the metadata URI is ours and name/symbol match, then
  upserts `public.tokens`. Browser claims are never trusted.
- `GET /api/tokens/[address]` — the verified record.

## What is missing before it can deploy
| Requirement | Status |
|---|---|
| `pxLaunchpad` address in `apps/web/src/config/contracts.ts` | **Missing** — contract is written and tested but not deployed (audit gate). Until set, Step 5 shows the blocker and the button stays disabled. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` + migration `supabase/migrations/0001_tokens.sql` | **Missing** — the form detects this (`GET /api/uploads/logo`) and blocks launching. |

## Production notes
- Request-body limits: some hosts cap function bodies below 5 MB (Vercel: 4.5 MB). There, switch the
  logo upload to Supabase signed upload URLs and verify the object server-side afterwards.
- Add rate limiting to the upload endpoints (e.g. per IP) before going public.
