import Link from "next/link";
import { LEARN_PAGES } from "@/content/site";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/** Shared frame for the information pages: hero, content, then links to the other pages. */
export function InfoPage({
  eyebrow,
  title,
  lead,
  current,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise space-y-12">
      <header className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 py-10 sm:px-10 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-accent/10 blur-3xl" />
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.1]">{title}</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">{lead}</p>
      </header>

      {children}

      <nav aria-label="Learn more" className="border-t border-line pt-8">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-faint">Keep exploring</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {LEARN_PAGES.filter((p) => p.href !== current).map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className={cn("group flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm transition hover:border-accent/50")}
            >
              <Icon name={p.icon} className="text-faint transition group-hover:text-accent" />
              <span className="text-muted transition group-hover:text-fg">{p.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** A titled block inside an information page. */
export function InfoBlock({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-4 text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="max-w-3xl space-y-4 text-[15px] leading-7 text-muted [&_strong]:font-medium [&_strong]:text-fg">{children}</div>;
}
