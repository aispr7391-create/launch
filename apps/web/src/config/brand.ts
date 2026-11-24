/**
 * Brand configuration — the single place to rename the product.
 *
 * To rebrand: change these values, swap `public/icon.svg`, and (optionally)
 * adjust the accent colour tokens at the top of `src/app/globals.css`.
 * No component hard-codes the product name.
 */
export const BRAND = {
  name: "SYNORA",
  shortName: "SN",
  tagline: "Launch, trade and earn on Robinhood Chain.",
  description:
    "A DeFi platform built exclusively for Robinhood Chain: token launches, trading and liquidity in one place.",
  /**
   * Official channels, shown on /contact. Leave a value empty until the channel exists:
   * empty links are displayed as "Not published yet", never as a guessed URL.
   */
  links: {
    x: "",
    telegram: "",
    discord: "",
    github: "",
    email: "",
  } as Record<"x" | "telegram" | "discord" | "github" | "email", string>,
} as const;
