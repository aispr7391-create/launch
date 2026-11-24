import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { InfoBlock, InfoPage, Prose } from "@/components/info/InfoPage";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Contact", description: `Official ${BRAND.name} community channels.` };

const CHANNELS: { key: keyof typeof BRAND.links; label: string; icon: IconName; hint: string }[] = [
  { key: "x", label: "X (Twitter)", icon: "globe", hint: "Announcements and updates" },
  { key: "telegram", label: "Telegram", icon: "mail", hint: "Community chat" },
  { key: "discord", label: "Discord", icon: "help", hint: "Community and support" },
  { key: "github", label: "GitHub", icon: "book", hint: "Source code" },
  { key: "email", label: "Email", icon: "mail", hint: "Partnerships and security reports" },
];

export default function ContactPage() {
  return (
    <InfoPage
      current="/contact"
      eyebrow="Contact"
      title="Join the community."
      lead="Official SYNORA channels are listed here, and only here. If a channel is not listed, it is not ours."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHANNELS.map((c) => {
          const url = BRAND.links[c.key];
          const href = url ? (c.key === "email" ? `mailto:${url}` : url) : null;
          const body = (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl border border-line bg-raised text-accent">
                  <Icon name={c.icon} size={18} />
                </span>
                {href ? <Icon name="external" size={14} className="text-faint transition group-hover:text-accent" /> : <span className="text-[11px] text-faint">Not published yet</span>}
              </div>
              <h3 className="font-semibold tracking-tight">{c.label}</h3>
              <p className="mt-1 text-[13px] text-muted">{c.hint}</p>
            </>
          );
          return href ? (
            <a key={c.key} href={href} target="_blank" rel="noreferrer" className="group rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent/40">
              {body}
            </a>
          ) : (
            <div key={c.key} className="rounded-2xl border border-dashed border-line bg-surface/60 p-5 opacity-80">
              {body}
            </div>
          );
        })}
      </div>

      <InfoBlock title="Stay safe">
        <Prose>
          <p>
            The SYNORA team will <strong>never</strong> message you first, ask for your seed phrase or private key, or ask you to send funds.
            SYNORA has not issued a token. Treat anything that claims otherwise as a scam.
          </p>
        </Prose>
      </InfoBlock>
    </InfoPage>
  );
}
