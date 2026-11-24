"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import { Badge, Button, Card, CardHeader, Dot } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { explorer } from "@/lib/explorer";
import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { launchpadAbi, TOKEN_DECIMALS } from "../abi";
import { economics, quoteInitialBuy } from "../curve";
import { useLaunchpadConfig } from "../useLaunchpadConfig";
import { FLOW_STEPS, useLaunchFlow } from "../useLaunchFlow";
import {
  DEFAULT_MAX_SUPPLY,
  DEFAULT_MIN_SUPPLY,
  DESCRIPTION_MAX,
  NAME_MAX,
  SYMBOL_MAX,
  normalizeSymbol,
  parseSupply,
  validateDetails,
  validateEthAmount,
  validateSocials,
  validateSupply,
  type SocialLinks,
} from "../validation";
import { Field, ReadOnlyRow, TextArea, TextInput } from "./Fields";
import { LogoField, type LogoValue } from "./LogoField";
import { TokenPreviewCard } from "./TokenPreviewCard";

const STEPS = ["Token details", "Social links", "Configuration", "Preview", "Launch"] as const;
const SLIPPAGE_OPTIONS = [50, 100, 300] as const;

const eth = (wei: bigint, max = 6) =>
  `${Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: max })} ETH`;
const pct = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const tokens = (wei: bigint) =>
  Number(formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 0 });

export function LaunchForm() {
  const lp = useLaunchpadConfig();
  const flow = useLaunchFlow();
  const { address, isConnected, chainId } = useAccount();
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });

  const storage = useQuery({
    queryKey: ["storage-configured"],
    queryFn: async () => ((await (await fetch("/api/uploads/logo")).json()) as { configured: boolean }).configured,
    staleTime: 60_000,
  });

  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState<Record<number, boolean>>({});
  const [logo, setLogo] = useState<LogoValue | null>(null);
  const [details, setDetails] = useState({ name: "", symbol: "", description: "" });
  const [links, setLinks] = useState<SocialLinks>({ website: "", x: "", telegram: "", discord: "" });
  const [supplyRaw, setSupplyRaw] = useState("1000000000");
  const [initialBuy, setInitialBuy] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [confirmed, setConfirmed] = useState(false);

  const running = flow.state.status === "running";
  const minSupply = lp.kind === "ready" ? lp.minSupply : DEFAULT_MIN_SUPPLY;
  const maxSupply = lp.kind === "ready" ? lp.maxSupply : DEFAULT_MAX_SUPPLY;
  const supply = parseSupply(supplyRaw);

  // ── validation per step ──
  const errors = useMemo(() => {
    const e: Record<number, Record<string, string | undefined>> = {
      0: { ...validateDetails(details), logo: logo ? undefined : "A logo is required." },
      1: validateSocials(links),
      2: { supply: validateSupply(supplyRaw, minSupply, maxSupply), initialBuy: validateEthAmount(initialBuy) },
    };
    return e;
  }, [details, logo, links, supplyRaw, minSupply, maxSupply, initialBuy]);
  const stepValid = (i: number) => !errors[i] || Object.values(errors[i]).every((v) => !v);
  const err = (i: number, k: string) => (showErrors[i] ? errors[i]?.[k] : undefined);

  const initialBuyWei = (() => {
    try {
      return initialBuy && !validateEthAmount(initialBuy) ? parseEther(initialBuy) : 0n;
    } catch {
      return 0n;
    }
  })();

  // ── economics, from on-chain config only ──
  const econ = lp.kind === "ready" && supply && !errors[2].supply ? economics(supply * 10n ** 18n, lp.config) : null;
  const buyQuote =
    lp.kind === "ready" && supply && initialBuyWei > 0n
      ? quoteInitialBuy(supply * 10n ** 18n, initialBuyWei, lp.config)
      : null;
  const minTokensOut = buyQuote ? (buyQuote.tokensOut * BigInt(10_000 - slippageBps)) / 10_000n : 0n;

  // ── gas estimate for the review screen (approximate: real metadata URI is created at launch) ──
  const gasQ = useQuery({
    queryKey: ["launch-gas", lp.kind === "ready" ? lp.address : null, address, details.name, details.symbol, supplyRaw, initialBuyWei.toString()],
    enabled: step === 4 && lp.kind === "ready" && Boolean(address && client) && Boolean(supply) && stepValid(0) && stepValid(2),
    retry: false,
    queryFn: async () => {
      if (lp.kind !== "ready" || !client || !address || !supply) return null;
      const placeholderUri = "x".repeat(120); // same length class as the real content-addressed URL
      const call = {
        address: lp.address,
        abi: launchpadAbi,
        functionName: "createToken",
        args: [details.name.trim(), details.symbol, supply * 10n ** 18n, placeholderUri, minTokensOut, BigInt(Math.floor(Date.now() / 1000) + 1200)],
        value: lp.config.creationFee + initialBuyWei,
        account: address,
      } as const;
      const [units, fees] = await Promise.all([client.estimateContractGas(call), client.estimateFeesPerGas()]);
      return { units, feeWei: units * (fees.maxFeePerGas ?? fees.gasPrice ?? 0n) };
    },
  });

  const next = () => {
    if (!stepValid(step)) return setShowErrors((s) => ({ ...s, [step]: true }));
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goTo = (i: number) => {
    if (running) return;
    for (let j = 0; j < i; j++) {
      if (!stepValid(j)) {
        setShowErrors((s) => ({ ...s, [j]: true }));
        return setStep(j);
      }
    }
    setStep(i);
  };

  const blockers: string[] = [];
  if (lp.kind === "not-deployed") blockers.push("The PROJECT X launchpad contract is not deployed on Robinhood Chain Mainnet yet (pending audit).");
  if (lp.kind === "error") blockers.push(lp.message);
  if (lp.kind === "ready" && lp.paused) blockers.push("New launches are paused by the protocol.");
  if (storage.data === false) blockers.push("Logo and metadata storage is not configured on this server.");
  const canLaunch =
    blockers.length === 0 && lp.kind === "ready" && storage.data === true && isConnected && confirmed && !running &&
    flow.state.status !== "success" && !flow.pending && [0, 1, 2].every(stepValid) && Boolean(logo && supply);

  const onLaunch = () => {
    if (!canLaunch || lp.kind !== "ready" || !logo || !supply) return;
    flow.launch({
      launchpad: lp.address,
      details: { ...details, name: details.name.trim(), description: details.description.trim() },
      links: { website: links.website.trim(), x: links.x.trim(), telegram: links.telegram.trim(), discord: links.discord.trim() },
      supplyTokens: supply,
      logo: logo.file,
      creationFee: lp.config.creationFee,
      initialBuyWei,
      minTokensOut,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {/* Stepper */}
        <ol className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label} className="flex-1">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13px] transition",
                  i === step ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                <span
                  className={cn(
                    "num grid size-5 place-items-center rounded-full text-[11px]",
                    i < step && stepValid(i) ? "bg-accent text-white" : i === step ? "bg-accent-soft text-accent" : "bg-line text-faint",
                  )}
                >
                  {i < step && stepValid(i) ? "✓" : i + 1}
                </span>
                <span className={i === step ? "" : "hidden sm:inline"}>{label}</span>
              </button>
            </li>
          ))}
        </ol>

        <Card>
          <CardHeader eyebrow={`Step ${step + 1} of ${STEPS.length}`} title={STEPS[step]} />
          <div className="space-y-5 p-5">
            {step === 0 && (
              <>
                <LogoField value={logo} onChange={setLogo} error={err(0, "logo")} disabled={running} />
                <Field label="Token name" htmlFor="name" error={err(0, "name")} hint="Shown everywhere your token appears. 2–32 characters." counter={`${details.name.length}/${NAME_MAX}`}>
                  <TextInput id="name" placeholder="e.g. Project X" maxLength={NAME_MAX} value={details.name} invalid={Boolean(err(0, "name"))}
                    onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))} autoComplete="off" />
                </Field>
                <Field label="Ticker" htmlFor="symbol" error={err(0, "symbol")} hint="Letters and digits, converted to uppercase. 2–10 characters." counter={`${details.symbol.length}/${SYMBOL_MAX}`}>
                  <TextInput id="symbol" placeholder="e.g. PRTX" className="num uppercase" value={details.symbol} invalid={Boolean(err(0, "symbol"))}
                    onChange={(e) => setDetails((d) => ({ ...d, symbol: normalizeSymbol(e.target.value) }))} autoComplete="off" />
                </Field>
                <Field label="Description" htmlFor="description" optional error={err(0, "description")} hint="Explain the token and its purpose." counter={`${details.description.length}/${DESCRIPTION_MAX}`}>
                  <TextArea id="description" maxLength={DESCRIPTION_MAX} value={details.description} invalid={Boolean(err(0, "description"))}
                    onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))} placeholder="What is this token for?" />
                </Field>
              </>
            )}

            {step === 1 && (
              <>
                {(
                  [
                    ["website", "Website", "https://example.com"],
                    ["x", "X (Twitter)", "https://x.com/yourproject"],
                    ["telegram", "Telegram", "https://t.me/yourproject"],
                    ["discord", "Discord", "https://discord.gg/invite"],
                  ] as const
                ).map(([k, label, ph]) => (
                  <Field key={k} label={label} htmlFor={k} optional error={err(1, k)}>
                    <TextInput id={k} type="url" inputMode="url" placeholder={ph} value={links[k]} invalid={Boolean(err(1, k))}
                      onChange={(e) => setLinks((l) => ({ ...l, [k]: e.target.value }))} autoComplete="off" />
                  </Field>
                ))}
                <p className="text-[12px] text-faint">Links must use https. They are stored with your token metadata and shown on its page.</p>
              </>
            )}

            {step === 2 && (
              <ConfigStep
                lp={lp}
                supplyRaw={supplyRaw}
                setSupplyRaw={setSupplyRaw}
                supplyError={err(2, "supply")}
                minSupply={minSupply}
                maxSupply={maxSupply}
                econ={econ}
                initialBuy={initialBuy}
                setInitialBuy={setInitialBuy}
                initialBuyError={err(2, "initialBuy")}
                buyQuote={buyQuote}
                supply={supply}
                slippageBps={slippageBps}
                setSlippageBps={setSlippageBps}
              />
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted">Check how your token will appear. Use Edit to change anything.</p>
                <dl className="divide-y divide-divider rounded-xl border border-line">
                  {[
                    ["Name", details.name.trim(), 0],
                    ["Ticker", details.symbol, 0],
                    ["Description", details.description.trim() || "—", 0],
                    ["Website", links.website || "—", 1],
                    ["X", links.x || "—", 1],
                    ["Telegram", links.telegram || "—", 1],
                    ["Discord", links.discord || "—", 1],
                    ["Total supply", supply ? supply.toLocaleString("en-US") : "—", 2],
                    ["Initial buy", initialBuyWei > 0n ? eth(initialBuyWei) : "None", 2],
                  ].map(([k, v, s]) => (
                    <div key={k as string} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
                      <dt className="w-28 shrink-0 text-muted">{k}</dt>
                      <dd className="min-w-0 flex-1 whitespace-pre-line break-words">{v}</dd>
                      <button type="button" onClick={() => setStep(s as number)} className="text-[12px] text-accent hover:underline">Edit</button>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                {blockers.length > 0 && (
                  <div className="rounded-xl border border-warn/30 bg-warn/10 p-4 text-[13px] leading-5">
                    <p className="font-medium text-warn">Launching is not available yet</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
                      {blockers.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo.previewUrl} alt="" className="size-14 rounded-2xl border border-line object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{details.name.trim()}</p>
                    <p className="num text-sm text-accent">${details.symbol}</p>
                  </div>
                </div>
                {details.description.trim() && <p className="whitespace-pre-line break-words text-[13px] leading-5 text-muted">{details.description.trim()}</p>}

                <div className="divide-y divide-divider rounded-xl border border-line px-4">
                  <ReadOnlyRow label="Total supply" value={supply ? `${supply.toLocaleString("en-US")} ${details.symbol}` : "—"} />
                  <ReadOnlyRow label="Launch type" value="Bonding curve → Uniswap v3" />
                  <ReadOnlyRow label="Creation fee" value={lp.kind === "ready" ? eth(lp.config.creationFee) : "Unavailable"} />
                  <ReadOnlyRow label="Buy / sell fee" value={lp.kind === "ready" ? `${pct(lp.config.tradeFeeBps)} / ${pct(lp.config.tradeFeeBps)}` : "Unavailable"} />
                  <ReadOnlyRow label="Graduation threshold" value={lp.kind === "ready" ? eth(lp.config.targetEth, 4) : "Unavailable"} />
                  <ReadOnlyRow
                    label="Initial buy"
                    value={initialBuyWei > 0n ? eth(initialBuyWei) : "None"}
                    hint={buyQuote ? `≈ ${tokens(buyQuote.tokensOut)} ${details.symbol}, min ${tokens(minTokensOut)} at ${pct(slippageBps)} slippage` : undefined}
                  />
                  <ReadOnlyRow
                    label="Total ETH sent"
                    value={lp.kind === "ready" ? eth(lp.config.creationFee + initialBuyWei) : "Unavailable"}
                  />
                  <ReadOnlyRow
                    label="Estimated network fee"
                    value={
                      gasQ.data ? eth(gasQ.data.feeWei, 8) : gasQ.isFetching ? "Estimating…" : gasQ.isError ? "Unavailable (simulation failed)" : "Available when wallet is connected and the launchpad is live"
                    }
                    hint={gasQ.data ? `${gasQ.data.units.toLocaleString("en-US")} gas · re-estimated before signing` : undefined}
                  />
                  <ReadOnlyRow label="Wallet" value={address ? <a className="hover:text-accent" href={explorer.address(address)} target="_blank" rel="noreferrer">{shortAddress(address, 6)}</a> : "Not connected"} />
                  <ReadOnlyRow
                    label="Network"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <Dot tone={chainId === ACTIVE_CHAIN.id ? "up" : isConnected ? "down" : "muted"} />
                        {ACTIVE_CHAIN.name} Mainnet · {ACTIVE_CHAIN.id}
                      </span>
                    }
                    hint={isConnected && chainId !== ACTIVE_CHAIN.id ? "Your wallet will be asked to switch." : undefined}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-[13px] leading-5">
                  <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={confirmed} disabled={running} onChange={(e) => setConfirmed(e.target.checked)} />
                  <span className="text-muted">
                    I confirm the details above are correct. Name, ticker and supply are permanent once deployed, and the transaction
                    cannot be reversed.
                  </span>
                </label>

                {!isConnected ? (
                  <ConnectWalletButton block />
                ) : (
                  <Button variant="primary" className="h-12 w-full text-[15px]" disabled={!canLaunch} onClick={onLaunch}>
                    {running ? "Launching…" : `Launch ${details.symbol || "token"}`}
                  </Button>
                )}

                <LaunchProgress flow={flow} />
              </div>
            )}
          </div>

          {step < 4 && (
            <div className="flex items-center justify-between border-t border-line px-5 py-4">
              <Button variant="ghost" type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
              <Button variant="primary" type="button" onClick={next}>
                {step === 3 ? "Continue to launch" : "Continue"}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <TokenPreviewCard
          logoUrl={logo?.previewUrl}
          name={details.name}
          symbol={details.symbol}
          description={details.description}
          links={links}
          supply={supply && !errors[2].supply ? supply : null}
        />
      </aside>
    </div>
  );
}

function ConfigStep(props: {
  lp: ReturnType<typeof useLaunchpadConfig>;
  supplyRaw: string;
  setSupplyRaw: (v: string) => void;
  supplyError?: string;
  minSupply: bigint;
  maxSupply: bigint;
  econ: ReturnType<typeof economics> | null;
  initialBuy: string;
  setInitialBuy: (v: string) => void;
  initialBuyError?: string;
  buyQuote: ReturnType<typeof quoteInitialBuy> | null;
  supply: bigint | null;
  slippageBps: number;
  setSlippageBps: (v: number) => void;
}) {
  const { lp, econ } = props;
  const c = lp.kind === "ready" ? lp.config : null;
  const na = <span className="text-faint">Unavailable</span>;

  return (
    <div className="space-y-6">
      <Field
        label="Total supply"
        htmlFor="supply"
        error={props.supplyError}
        hint={`Whole tokens. Allowed: ${props.minSupply.toLocaleString("en-US")} – ${props.maxSupply.toLocaleString("en-US")}${lp.kind === "ready" ? " (read from the launchpad)" : " (launchpad contract limits)"}.`}
      >
        <TextInput id="supply" inputMode="numeric" className="num" value={props.supplyRaw} invalid={Boolean(props.supplyError)}
          onChange={(e) => props.setSupplyRaw(e.target.value.replace(/[^\d,]/g, ""))} />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium">Protocol parameters</p>
          <Badge>Set by the launchpad · read-only</Badge>
        </div>
        {lp.kind !== "ready" && (
          <p className="mb-2 rounded-lg border border-line bg-raised px-3 py-2 text-[12px] leading-5 text-muted">
            {lp.kind === "loading"
              ? "Reading parameters from Robinhood Chain…"
              : lp.kind === "error"
                ? lp.message
                : "These values are read from the deployed launchpad contract. It is not deployed yet, so they cannot be shown — PROJECT X does not display assumed values."}
          </p>
        )}
        <div className="divide-y divide-divider rounded-xl border border-line px-4">
          <ReadOnlyRow label="Decimals" value={TOKEN_DECIMALS} hint="Fixed by the token contract." />
          <ReadOnlyRow label="Launch type" value="Bonding curve" hint="Constant-product curve on virtual reserves." />
          <ReadOnlyRow label="Buy fee" value={c ? pct(c.tradeFeeBps) : na} hint={c ? `${pct(c.creatorShareBps)} of fees go to you as creator` : undefined} />
          <ReadOnlyRow label="Sell fee" value={c ? pct(c.tradeFeeBps) : na} />
          <ReadOnlyRow label="Creation fee" value={c ? eth(c.creationFee) : na} />
          <ReadOnlyRow label="Graduation threshold" value={c ? eth(c.targetEth, 4) : na} hint="ETH raised on the curve before moving to Uniswap v3." />
          <ReadOnlyRow label="Graduation fee" value={c ? eth(c.graduationFee, 4) : na} />
          <ReadOnlyRow label="Initial virtual ETH" value={c ? eth(c.virtualEth, 4) : na} hint="Sets the starting price." />
          <ReadOnlyRow label="Curve / liquidity split" value={econ ? `${pct(econ.curvePctBps)} / ${pct(econ.lpPctBps)}` : na} />
          <ReadOnlyRow label="Starting price" value={econ ? `${formatEther(econ.startPrice)} ETH` : na} />
          <ReadOnlyRow label="Market cap at graduation" value={econ ? eth(econ.graduationMcapWei, 4) : na} hint="Uniswap opening price equals the final curve price." />
        </div>
      </div>

      <div className="space-y-3">
        <Field label="Initial buy" htmlFor="initialBuy" optional error={props.initialBuyError}
          hint="ETH you spend buying your own token in the same transaction, before anyone else can.">
          <div className="relative">
            <TextInput id="initialBuy" inputMode="decimal" className="num pr-14" placeholder="0.0" value={props.initialBuy}
              invalid={Boolean(props.initialBuyError)} onChange={(e) => props.setInitialBuy(e.target.value.replace(",", "."))} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">ETH</span>
          </div>
        </Field>
        {props.initialBuy && !props.initialBuyError && (
          <div className="rounded-lg border border-line bg-raised px-3 py-2 text-[13px]">
            {props.buyQuote && props.supply ? (
              <>
                You receive ≈ <span className="num">{tokens(props.buyQuote.tokensOut)}</span> tokens (
                {pct(Number((props.buyQuote.tokensOut * 10_000n) / (props.supply * 10n ** 18n)))} of supply).
                {props.buyQuote.completesCurve && (
                  <span className="mt-1 block text-warn">This buy completes the curve: the token graduates immediately and {eth(props.buyQuote.refund)} is refunded.</span>
                )}
              </>
            ) : (
              <span className="text-faint">Quote available once the launchpad is deployed.</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted">Slippage</span>
          {SLIPPAGE_OPTIONS.map((s) => (
            <button key={s} type="button" onClick={() => props.setSlippageBps(s)}
              className={cn("num rounded-md border px-2 py-0.5", props.slippageBps === s ? "border-accent text-accent" : "border-line-strong text-muted")}>
              {pct(s)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function LaunchProgress({ flow }: { flow: ReturnType<typeof useLaunchFlow> }) {
  const { state, pending } = flow;

  if (pending && state.status === "idle") {
    return (
      <div className="rounded-xl border border-info/30 bg-info/10 p-4 text-[13px]">
        <p className="font-medium text-info">A launch transaction ({pending.symbol}) is still pending</p>
        <p className="mt-1 text-muted">Resume to wait for its confirmation instead of creating a duplicate.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="primary" onClick={flow.resume}>Resume</Button>
          <a href={explorer.tx(pending.hash)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 px-2 text-[13px] text-muted hover:text-fg">
            View transaction <Icon name="external" size={12} />
          </a>
        </div>
      </div>
    );
  }
  if (state.status === "idle") return null;

  const currentIdx = state.step ? FLOW_STEPS.findIndex((s) => s.key === state.step) : -1;

  return (
    <div className="rounded-xl border border-line" aria-live="polite">
      <ol className="divide-y divide-divider">
        {FLOW_STEPS.map((s, i) => {
          const done = state.done.includes(s.key);
          const active = s.key === state.step && state.status === "running";
          const failed = s.key === state.step && state.status === "error";
          return (
            <li key={s.key} className={cn("flex items-center gap-3 px-4 py-2 text-[13px]", !done && !active && !failed && i > currentIdx && "text-faint")}>
              <span className={cn("grid size-4 place-items-center rounded-full text-[10px]",
                done ? "bg-up/20 text-up" : failed ? "bg-down/20 text-down" : active ? "bg-accent-soft text-accent" : "bg-line")}>
                {done ? "✓" : failed ? "!" : active ? <Dot tone="accent" pulse /> : ""}
              </span>
              <span className="flex-1">{s.label}</span>
              {s.key === "upload" && active && <span className="num text-[12px] text-muted">{state.uploadPct}%</span>}
              {s.key === "sign" && active && <span className="text-[12px] text-accent">Check your wallet</span>}
              {s.key === "confirm" && state.txHash && (
                <a href={explorer.tx(state.txHash)} target="_blank" rel="noreferrer" className="num text-[12px] text-muted hover:text-accent">
                  {shortAddress(state.txHash, 4)}
                </a>
              )}
            </li>
          );
        })}
      </ol>

      {state.status === "error" && (
        <div className="border-t border-line p-4 text-[13px]">
          <p className="font-medium text-down">Launch failed</p>
          <p className="mt-1 text-muted">{state.error}</p>
          {state.txHash && <p className="mt-1 text-faint">Check the transaction on the explorer before trying again.</p>}
          <Button size="sm" className="mt-3" onClick={flow.reset}>Try again</Button>
        </div>
      )}
      {state.status === "success" && state.token && (
        <div className="border-t border-line p-4 text-[13px]">
          <p className="font-medium text-up">Token deployed on Robinhood Chain</p>
          <p className="num mt-1 break-all text-muted">{state.token}</p>
          {state.saveFailed ? (
            <>
              <p className="mt-2 text-warn">The token exists on-chain, but saving its metadata failed{state.error ? `: ${state.error}` : "."}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="primary" onClick={flow.retrySave}>Retry saving</Button>
                <a className="inline-flex h-8 items-center px-2 text-muted hover:text-fg" href={`/token/${state.token}`}>Open token page</a>
              </div>
            </>
          ) : (
            <p className="mt-2 text-faint">Opening the token page…</p>
          )}
        </div>
      )}
    </div>
  );
}
