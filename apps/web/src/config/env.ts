/**
 * Public runtime configuration. Only NEXT_PUBLIC_* values are readable in the browser.
 * Never put private keys, mnemonics or server secrets in NEXT_PUBLIC_* variables.
 */

/** Optional but recommended. Restrict this key to your domains in the Alchemy dashboard. */
export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";

/** Optional. Enables the WalletConnect (mobile wallets / QR) connector. */
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
