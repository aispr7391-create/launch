import { formatGwei, formatUnits } from "viem";

export function shortAddress(addr?: string, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, 2 + chars)}…${addr.slice(-chars)}`;
}

export function formatToken(value: bigint, decimals: number, maxFraction = 4): string {
  const n = Number(formatUnits(value, decimals));
  if (n === 0) return "0";
  if (n < 10 ** -maxFraction) return `<${(10 ** -maxFraction).toFixed(maxFraction)}`;
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFraction });
}

export function formatGasGwei(wei: bigint): string {
  const g = Number(formatGwei(wei));
  if (g === 0) return "0";
  if (g < 0.001) return g.toExponential(2);
  return g.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function formatInt(n: bigint | number): string {
  return Number(n).toLocaleString("en-US");
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
