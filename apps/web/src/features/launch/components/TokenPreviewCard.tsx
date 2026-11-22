import { Badge, Card } from "@/components/ui/primitives";
import { ACTIVE_CHAIN } from "@/config/wagmi";
import type { SocialLinks } from "../validation";

const LINK_LABELS: Record<keyof SocialLinks, string> = { website: "Website", x: "X", telegram: "Telegram", discord: "Discord" };

export function TokenPreviewCard({
  logoUrl,
  name,
  symbol,
  description,
  links,
  supply,
}: {
  logoUrl?: string;
  name: string;
  symbol: string;
  description: string;
  links: SocialLinks;
  supply: bigint | null;
}) {
  const activeLinks = (Object.keys(LINK_LABELS) as (keyof SocialLinks)[]).filter((k) => links[k].trim());
  const initials = (symbol || name).slice(0, 2).toUpperCase();

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line px-5 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">Live preview</p>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-raised">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="text-lg font-semibold text-faint">{initials || "?"}</span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className={name ? "truncate text-lg font-semibold" : "text-lg font-semibold text-faint"}>
              {name.trim() || "Token name"}
            </h3>
            <p className={symbol ? "num text-sm text-accent" : "num text-sm text-faint"}>${symbol || "TICKER"}</p>
          </div>
        </div>

        <p className={description ? "mt-4 whitespace-pre-line break-words text-[13px] leading-5 text-muted" : "mt-4 text-[13px] text-faint"}>
          {description.trim() || "No description."}
        </p>

        {activeLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {activeLinks.map((k) => (
              <a key={k} href={links[k]} target="_blank" rel="noreferrer nofollow" className="rounded-md border border-line-strong px-2 py-0.5 text-[12px] text-muted hover:text-fg">
                {LINK_LABELS[k]}
              </a>
            ))}
          </div>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[13px]">
          <div>
            <dt className="text-faint">Total supply</dt>
            <dd className="num mt-0.5">{supply ? supply.toLocaleString("en-US") : "—"}</dd>
          </div>
          <div>
            <dt className="text-faint">Launch type</dt>
            <dd className="mt-0.5">Bonding curve</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Badge tone="accent">{ACTIVE_CHAIN.name} Mainnet</Badge>
          <Badge><span className="num">Chain {ACTIVE_CHAIN.id}</span></Badge>
        </div>
      </div>
    </Card>
  );
}
