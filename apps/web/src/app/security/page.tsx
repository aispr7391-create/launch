import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { InfoBlock, InfoPage, Prose } from "@/components/info/InfoPage";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Security", description: `How ${BRAND.name} approaches security, audits and transparency.` };

const PRACTICES = [
  { icon: "lock" as const, title: "Non-custodial", body: "SYNORA never holds your funds. Every transaction is signed in your own wallet." },
  { icon: "alert" as const, title: "No seed phrases, ever", body: "SYNORA will never ask for your seed phrase or private key — not in the app, not in support, not in DMs." },
  { icon: "check" as const, title: "Simulate before signing", body: "Transactions are simulated and gas-estimated first. If a call would fail, you see it before paying gas." },
  { icon: "wallet" as const, title: "Exact approvals", body: "Token approvals are for the exact amount needed by default, not unlimited allowances." },
  { icon: "shield" as const, title: "Verified addresses only", body: "Contract addresses are taken from official sources and re-verified on-chain on the Status page." },
  { icon: "globe" as const, title: "One network", body: "The app runs on Robinhood Chain Mainnet only and asks you to switch if your wallet is elsewhere." },
];

const CONTRACT_DESIGN = [
  "Bonding-curve trade fees have a hard cap of 2% in the contract code.",
  "Pausing the launchpad blocks new launches and buys, but never blocks selling.",
  "Graduated liquidity is held permanently by the graduator contract and cannot be withdrawn.",
  "Tokens cannot be transferred wallet-to-wallet before graduation, preventing early pool manipulation.",
  "If graduation cannot complete safely, it reverts and can be retried instead of graduating at a bad price.",
];

const RISKS = [
  "Smart contracts can contain bugs, even after an audit.",
  "Token prices can be volatile; new tokens can lose all of their value.",
  "Anyone can create a token with any name or logo. Always check the contract address.",
  "Concentrated liquidity positions can go out of range and stop earning fees.",
];

export default function SecurityPage() {
  const ours = [CONTRACTS.pxLaunchpad, CONTRACTS.pxGraduator];
  return (
    <InfoPage
      current="/security"
      eyebrow="Security"
      title="Security first, transparency always."
      lead={`How ${BRAND.name} protects users today, the current audit status of its contracts, and the risks you should understand.`}
    >
      <InfoBlock title="Audit status">
        <div className="rounded-2xl border border-warn/30 bg-warn/10 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-warn" />
            <div className="text-[14px] leading-6 text-muted">
              <p className="font-medium text-fg">{BRAND.name}&apos;s own contracts have not been audited yet, and none are deployed.</p>
              <p className="mt-1.5">
                The launchpad and graduator are written and unit-tested. They will be deployed to Robinhood Chain only after an external
                audit and after its findings are resolved. When that happens, the audit report and the verified addresses will be
                published here.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ours.map((c) => (
            <div key={c.label} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4 text-[13px]">
              <span className="text-fg">{c.label}</span>
              <span className="text-faint">{c.address ? "Deployed" : "Not deployed"}</span>
            </div>
          ))}
        </div>
      </InfoBlock>

      <InfoBlock title="How SYNORA protects you">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRACTICES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-line bg-surface p-5">
              <Icon name={p.icon} size={18} className="mb-3 text-accent" />
              <h3 className="font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </InfoBlock>

      <InfoBlock title="Smart contract design">
        <Prose>
          <p>Trading and liquidity use <strong>Uniswap&apos;s official deployments</strong> on Robinhood Chain; SYNORA does not modify them. The SYNORA launchpad, once audited and deployed, is designed with these safeguards:</p>
        </Prose>
        <ul className="mt-4 max-w-3xl space-y-2.5">
          {CONTRACT_DESIGN.map((d) => (
            <li key={d} className="flex gap-3 text-[14px] leading-6 text-muted">
              <Icon name="check" size={16} className="mt-1 shrink-0 text-up" />
              {d}
            </li>
          ))}
        </ul>
      </InfoBlock>

      <InfoBlock title="Transparency">
        <Prose>
          <p>
            Every contract address is listed in the <Link href="/docs#contracts" className="text-accent hover:text-accent-hover">documentation</Link> with
            its source, and re-checked on-chain on the <Link href="/network" className="text-accent hover:text-accent-hover">Status page</Link>. Market
            figures come from indexed on-chain events; when data is unavailable, the app says so instead of showing an estimate.
          </p>
        </Prose>
      </InfoBlock>

      <InfoBlock title="Risks to understand">
        <ul className="max-w-3xl space-y-2.5">
          {RISKS.map((r) => (
            <li key={r} className="flex gap-3 text-[14px] leading-6 text-muted">
              <Icon name="alert" size={16} className="mt-1 shrink-0 text-warn" />
              {r}
            </li>
          ))}
        </ul>
      </InfoBlock>

      <InfoBlock title="Report a vulnerability">
        <Prose>
          <p>
            A dedicated security contact will be published on the <Link href="/contact" className="text-accent hover:text-accent-hover">Contact page</Link> before
            any SYNORA contract is deployed. Please do not disclose vulnerabilities publicly before they are fixed.
          </p>
        </Prose>
      </InfoBlock>
    </InfoPage>
  );
}
