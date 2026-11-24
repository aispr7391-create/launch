import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "./Reveal";

export function SectionHeading({
  eyebrow,
  title,
  lead,
  link,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {lead && <p className="mt-2 text-sm leading-6 text-muted">{lead}</p>}
      </div>
      {link && (
        <Link href={link.href} className="group inline-flex shrink-0 items-center gap-1.5 text-[13px] text-muted transition hover:text-fg">
          {link.label}
          <Icon name="arrow" size={14} className="transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function Section({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={className ?? "scroll-mt-20"}>
      <Reveal>{children}</Reveal>
    </section>
  );
}
