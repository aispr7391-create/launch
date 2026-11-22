"use client";

import { useCallback, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Abi, Address, Hash, TransactionReceipt } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { requireContract } from "@/config/contracts";
import { useTxTracker } from "@/features/tx/TxProvider";
import { readableError } from "@/lib/errors";
import { erc20Abi } from "./abi";
import { fetchPool, fetchPosition, fetchPositions, findPairPools } from "./onchain";

export function useClient() {
  return usePublicClient({ chainId: ACTIVE_CHAIN.id });
}

export function usePool(address: string | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["v3-pool", address],
    enabled: Boolean(client && address),
    refetchInterval: 20_000,
    retry: false,
    queryFn: () => fetchPool(client!, address!),
  });
}

export function usePairPools(a: Address | undefined, b: Address | undefined) {
  const client = useClient();
  return useQuery({
    queryKey: ["v3-pair", a, b],
    enabled: Boolean(client && a && b),
    refetchInterval: 30_000,
    queryFn: () => findPairPools(client!, a!, b!),
  });
}

export function usePositions() {
  const client = useClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["v3-positions", address],
    enabled: Boolean(client && address),
    refetchInterval: 30_000,
    queryFn: () => fetchPositions(client!, address!),
  });
}

export function usePosition(tokenId: bigint | undefined) {
  const client = useClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["v3-position", tokenId?.toString(), address],
    enabled: Boolean(client && tokenId !== undefined),
    refetchInterval: 20_000,
    retry: false,
    queryFn: () => fetchPosition(client!, tokenId!, undefined),
  });
}

export function useAllowance(token: Address | undefined, spender: Address | undefined) {
  const client = useClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["allowance", token, address, spender],
    enabled: Boolean(client && token && address && spender),
    queryFn: () => client!.readContract({ address: token!, abi: erc20Abi, functionName: "allowance", args: [address!, spender!] }),
  });
}

export function useTokenBalance(token: Address | "ETH" | undefined) {
  const client = useClient();
  const { address } = useAccount();
  return useQuery({
    queryKey: ["balance", token, address],
    enabled: Boolean(client && token && address),
    refetchInterval: 20_000,
    queryFn: () =>
      token === "ETH"
        ? client!.getBalance({ address: address! })
        : client!.readContract({ address: token as Address, abi: erc20Abi, functionName: "balanceOf", args: [address!] }),
  });
}

export const positionManager = () => requireContract("uniswapV3PositionManager");

export type TxPhase = "idle" | "network" | "simulating" | "signing" | "pending" | "success" | "error";
export interface TxState {
  phase: TxPhase;
  label?: string;
  hash?: Hash;
  error?: string;
  receipt?: TransactionReceipt;
}

export interface WriteRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/**
 * One guarded write: wallet check → chain 4663 → simulate → gas estimate → sign → tracked receipt.
 * A synchronous lock blocks duplicate submissions. Success only after a successful receipt.
 */
export function useTxAction() {
  const client = useClient();
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { track } = useTxTracker();
  const busy = useRef(false);
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const run = useCallback(
    async (label: string, req: WriteRequest): Promise<TransactionReceipt | null> => {
      if (busy.current) return null;
      busy.current = true;
      setState({ phase: "network", label });
      try {
        if (!isConnected || !address) throw new Error("Connect a wallet first.");
        if (!client) throw new Error("No RPC client available.");
        if (chainId !== ACTIVE_CHAIN.id) await switchChainAsync({ chainId: ACTIVE_CHAIN.id });

        setState({ phase: "simulating", label });
        const call = { ...req, account: address } as Parameters<typeof client.simulateContract>[0];
        await client.simulateContract(call);
        const gas = await client.estimateContractGas(call as Parameters<typeof client.estimateContractGas>[0]);

        setState({ phase: "signing", label });
        const hash = await writeContractAsync({
          ...(req as Parameters<typeof writeContractAsync>[0]),
          chainId: ACTIVE_CHAIN.id,
          gas: (gas * 12n) / 10n,
        });
        track(hash, label);
        setState({ phase: "pending", label, hash });

        const receipt = await client.waitForTransactionReceipt({ hash, timeout: 5 * 60_000 });
        if (receipt.status !== "success") throw Object.assign(new Error("Transaction reverted on-chain."), { hash });
        setState({ phase: "success", label, hash, receipt });
        return receipt;
      } catch (err) {
        const hash = (err as { hash?: Hash }).hash;
        setState((s) => ({ phase: "error", label, hash: hash ?? s.hash, error: readableError(err) }));
        return null;
      } finally {
        busy.current = false;
      }
    },
    [address, chainId, client, isConnected, switchChainAsync, track, writeContractAsync],
  );

  const reset = useCallback(() => !busy.current && setState({ phase: "idle" }), []);
  return { state, run, reset, busy: state.phase !== "idle" && state.phase !== "success" && state.phase !== "error" };
}

export async function estimateGasCost(
  client: NonNullable<ReturnType<typeof useClient>>,
  account: Address,
  req: WriteRequest,
): Promise<{ units: bigint; wei: bigint } | null> {
  try {
    const call = { ...req, account } as Parameters<typeof client.estimateContractGas>[0];
    const [units, fees] = await Promise.all([client.estimateContractGas(call), client.estimateFeesPerGas()]);
    return { units, wei: units * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n) };
  } catch {
    return null;
  }
}
