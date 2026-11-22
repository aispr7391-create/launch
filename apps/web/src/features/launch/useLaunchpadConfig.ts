"use client";

import { zeroAddress } from "viem";
import { useReadContracts } from "wagmi";
import { getContract } from "@/config/contracts";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { launchpadAbi } from "./abi";
import type { OnchainConfig } from "./curve";

export type LaunchpadState =
  | { kind: "not-deployed" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; address: `0x${string}`; config: OnchainConfig; minSupply: bigint; maxSupply: bigint; paused: boolean };

/** Reads protocol parameters from the deployed launchpad. Never falls back to assumed values. */
export function useLaunchpadConfig(): LaunchpadState {
  const address = getContract("pxLaunchpad");
  // Always the same 4-call shape (zero address while not deployed, query disabled) so the
  // contracts tuple keeps one static type.
  const target = address ?? zeroAddress;
  const q = useReadContracts({
    allowFailure: false,
    contracts: [
      { address: target, abi: launchpadAbi, functionName: "config", chainId: ACTIVE_CHAIN.id },
      { address: target, abi: launchpadAbi, functionName: "MIN_SUPPLY", chainId: ACTIVE_CHAIN.id },
      { address: target, abi: launchpadAbi, functionName: "MAX_SUPPLY", chainId: ACTIVE_CHAIN.id },
      { address: target, abi: launchpadAbi, functionName: "paused", chainId: ACTIVE_CHAIN.id },
    ],
    query: { enabled: Boolean(address), refetchInterval: 60_000 },
  });


  if (!address) return { kind: "not-deployed" };
  if (q.isLoading) return { kind: "loading" };
  if (q.isError || !q.data) return { kind: "error", message: "Could not read launchpad parameters from the chain." };

  const [cfg, min, max, paused] = q.data as unknown as [
    readonly [bigint, bigint, bigint, bigint, number, number, number],
    bigint,
    bigint,
    boolean,
  ];
  return {
    kind: "ready",
    address,
    config: {
      virtualEth: cfg[0],
      targetEth: cfg[1],
      graduationFee: cfg[2],
      creationFee: cfg[3],
      tradeFeeBps: cfg[4],
      creatorShareBps: cfg[5],
    },
    minSupply: min / 10n ** 18n,
    maxSupply: max / 10n ** 18n,
    paused,
  };
}
