"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BaseError,
  ContractFunctionRevertedError,
  getAddress,
  isAddressEqual,
  parseEventLogs,
  type Address,
  type Hash,
} from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { useTxTracker } from "@/features/tx/TxProvider";
import { readableError } from "@/lib/errors";
import { launchpadAbi, TOKEN_DECIMALS } from "./abi";
import { recordLaunch, uploadLogo, uploadMetadata, UploadError } from "./upload";
import { validateDetails, validateSocials, type SocialLinks, type TokenDetails } from "./validation";

export type FlowStep =
  | "validate"
  | "wallet"
  | "network"
  | "upload"
  | "prepare"
  | "simulate"
  | "gas"
  | "sign"
  | "confirm"
  | "verify"
  | "save"
  | "redirect";

export const FLOW_STEPS: { key: FlowStep; label: string }[] = [
  { key: "validate", label: "Validate details" },
  { key: "wallet", label: "Check wallet" },
  { key: "network", label: "Verify Robinhood Chain Mainnet" },
  { key: "upload", label: "Upload logo and metadata" },
  { key: "prepare", label: "Prepare parameters" },
  { key: "simulate", label: "Simulate transaction" },
  { key: "gas", label: "Estimate gas" },
  { key: "sign", label: "Confirm in wallet" },
  { key: "confirm", label: "Wait for confirmation" },
  { key: "verify", label: "Verify deployment" },
  { key: "save", label: "Save token metadata" },
  { key: "redirect", label: "Open token page" },
];

export interface LaunchInput {
  launchpad: Address;
  details: TokenDetails;
  links: SocialLinks;
  supplyTokens: bigint;
  logo: File;
  creationFee: bigint;
  initialBuyWei: bigint;
  minTokensOut: bigint;
}

export interface FlowState {
  status: "idle" | "running" | "success" | "error";
  step: FlowStep | null;
  done: FlowStep[];
  uploadPct: number;
  error?: string;
  txHash?: Hash;
  token?: Address;
  gas?: { units: bigint; maxFeeWei: bigint };
  /** Deployment confirmed on-chain, but recording metadata failed. */
  saveFailed?: boolean;
}

class TxRevertedError extends Error {}

const IDLE: FlowState = { status: "idle", step: null, done: [], uploadPct: 0 };
const PENDING_KEY = "px:pending-launch:v1";
const FRIENDLY: Record<string, string> = {
  InvalidSupply: "Total supply is outside the launchpad's allowed range.",
  InvalidName: "Name or ticker is not accepted by the launchpad.",
  InsufficientCreationFee: "Not enough ETH for the creation fee.",
  EnforcedPause: "Launches are temporarily paused by the protocol.",
  Slippage: "Price moved: your initial buy would receive less than the minimum. Increase slippage or retry.",
  Expired: "The transaction deadline passed. Please try again.",
  InsufficientGas: "Not enough gas to complete graduation in this transaction.",
};

function explain(err: unknown): string {
  if (err instanceof UploadError) return err.message;
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && FRIENDLY[name]) return FRIENDLY[name];
    }
  }
  return readableError(err);
}

export function readPendingLaunch(): { hash: Hash; launchpad: Address; symbol: string } | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writePending(v: { hash: Hash; launchpad: Address; symbol: string } | null) {
  try {
    if (v) localStorage.setItem(PENDING_KEY, JSON.stringify(v));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function useLaunchFlow() {
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  const { writeContractAsync } = useWriteContract();
  const { track } = useTxTracker();

  const [state, setState] = useState<FlowState>(IDLE);
  const busy = useRef(false); // duplicate-submission guard (sync, unlike state)
  const logoCache = useRef<{ file: File; url: string } | null>(null);
  const [pending, setPending] = useState<ReturnType<typeof readPendingLaunch>>(null);

  useEffect(() => {
    setPending(readPendingLaunch());
  }, []);

  const go = useCallback((step: FlowStep) => {
    setState((s) => ({ ...s, status: "running", step, done: s.step && s.step !== step ? [...s.done, s.step] : s.done }));
  }, []);

  /** Steps 10–15, shared by a fresh launch and by resuming one after a reload. */
  const finish = useCallback(
    async (hash: Hash, launchpad: Address) => {
      if (!client) throw new Error("No RPC client.");
      go("confirm");
      const receipt = await client.waitForTransactionReceipt({ hash, timeout: 5 * 60_000 });

      go("verify");
      if (receipt.status !== "success") throw new TxRevertedError("The transaction reverted on-chain. Nothing was created.");
      const [created] = parseEventLogs({ abi: launchpadAbi, eventName: "TokenCreated", logs: receipt.logs }).filter((l) =>
        isAddressEqual(l.address, launchpad),
      );
      if (!created) throw new Error("Transaction confirmed but no TokenCreated event was found.");
      const token = getAddress(created.args.token);
      const code = await client.getCode({ address: token });
      if (!code || code === "0x") throw new Error("No contract code at the reported token address.");
      setState((s) => ({ ...s, token }));
      writePending(null);
      setPending(null);

      go("save");
      let saved = false;
      for (let attempt = 0; attempt < 4 && !saved; attempt++) {
        try {
          await recordLaunch(hash);
          saved = true;
        } catch {
          await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
        }
      }
      if (!saved) {
        setState((s) => ({ ...s, status: "success", step: null, done: [...s.done, "verify"], saveFailed: true }));
        return;
      }

      go("redirect");
      setState((s) => ({ ...s, status: "success", done: FLOW_STEPS.map((f) => f.key) }));
      router.push(`/token/${token}`);
    },
    [client, go, router],
  );

  const launch = useCallback(
    async (input: LaunchInput) => {
      if (busy.current) return;
      if (readPendingLaunch()) {
        setState({ ...IDLE, status: "error", error: "A previous launch is still pending. Resume it first." });
        return;
      }
      busy.current = true;
      setState({ ...IDLE, status: "running" });
      try {
        go("validate");
        const errs = { ...validateDetails(input.details), ...validateSocials(input.links) };
        if (Object.keys(errs).length) throw new Error("Some fields are invalid. Go back and fix them.");

        go("wallet");
        if (!isConnected || !address) throw new Error("Connect a wallet first.");
        if (!client) throw new Error("No RPC client available.");

        go("network");
        if (chainId !== ACTIVE_CHAIN.id) await switchChainAsync({ chainId: ACTIVE_CHAIN.id });

        go("upload");
        let logoUrl = logoCache.current?.file === input.logo ? logoCache.current.url : null;
        if (!logoUrl) {
          logoUrl = (await uploadLogo(input.logo, (p) => setState((s) => ({ ...s, uploadPct: p })))).url;
          logoCache.current = { file: input.logo, url: logoUrl };
        }
        const metadataURI = await uploadMetadata({
          ...input.details,
          image: logoUrl,
          links: input.links,
          creator: address,
        });

        go("prepare");
        const supply = input.supplyTokens * 10n ** BigInt(TOKEN_DECIMALS);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);
        const call = {
          address: input.launchpad,
          abi: launchpadAbi,
          functionName: "createToken",
          args: [input.details.name.trim(), input.details.symbol, supply, metadataURI, input.minTokensOut, deadline],
          value: input.creationFee + input.initialBuyWei,
          account: address,
        } as const;

        go("simulate");
        await client.simulateContract(call);

        go("gas");
        const [units, fees] = await Promise.all([client.estimateContractGas(call), client.estimateFeesPerGas()]);
        const gasLimit = (units * 12n) / 10n; // 20 % headroom
        setState((s) => ({ ...s, gas: { units, maxFeeWei: units * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n) } }));

        go("sign");
        const hash = await writeContractAsync({ ...call, chainId: ACTIVE_CHAIN.id, gas: gasLimit });
        track(hash, `Launch ${input.details.symbol}`);
        writePending({ hash, launchpad: input.launchpad, symbol: input.details.symbol });
        setPending(readPendingLaunch());
        setState((s) => ({ ...s, txHash: hash }));

        await finish(hash, input.launchpad);
      } catch (err) {
        if (err instanceof TxRevertedError) {
          writePending(null);
          setPending(null);
        }
        setState((s) => ({ ...s, status: "error", error: explain(err) }));
      } finally {
        busy.current = false;
      }
    },
    [address, chainId, client, finish, go, isConnected, switchChainAsync, track, writeContractAsync],
  );

  const resume = useCallback(async () => {
    const p = readPendingLaunch();
    if (!p || busy.current) return;
    busy.current = true;
    setState({ ...IDLE, status: "running", txHash: p.hash, done: FLOW_STEPS.slice(0, 8).map((f) => f.key) });
    try {
      await finish(p.hash, p.launchpad);
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: explain(err) }));
      // A reverted tx is final: drop it so the user can launch again. Timeouts keep it resumable.
      if (err instanceof TxRevertedError) {
        writePending(null);
        setPending(null);
      }
    } finally {
      busy.current = false;
    }
  }, [finish]);

  const retrySave = useCallback(async () => {
    if (!state.txHash || busy.current) return;
    busy.current = true;
    try {
      const token = await recordLaunch(state.txHash);
      router.push(`/token/${token}`);
    } catch (err) {
      setState((s) => ({ ...s, error: explain(err) }));
    } finally {
      busy.current = false;
    }
  }, [router, state.txHash]);

  const reset = useCallback(() => {
    if (!busy.current) setState(IDLE);
  }, []);

  return { state, launch, resume, retrySave, reset, pending };
}
