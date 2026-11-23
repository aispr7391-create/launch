/**
 * Brand configuration — the single place to rename the product.
 *
 * To rebrand: change these values, swap `public/icon.svg`, and (optionally)
 * adjust the accent colour tokens at the top of `src/app/globals.css`.
 * No component hard-codes the product name.
 */
export const BRAND = {
  name: "PROJECT X",
  shortName: "PX",
  tagline: "Launch, trade and earn on Robinhood Chain.",
  description:
    "A DeFi platform built exclusively for Robinhood Chain: token launches, trading and liquidity in one place.",
  links: {
    docs: "",
    x: "",
    discord: "",
  },
} as const;
