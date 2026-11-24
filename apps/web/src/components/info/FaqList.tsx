import { Icon } from "@/components/ui/Icon";

/** Native <details> accordion: accessible, works without JavaScript. */
export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-divider overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium transition hover:bg-raised [&::-webkit-details-marker]:hidden">
            {f.q}
            <Icon name="chevron" className="shrink-0 text-faint transition duration-200 group-open:rotate-180 group-open:text-accent" />
          </summary>
          <p className="px-5 pb-5 text-sm leading-6 text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
