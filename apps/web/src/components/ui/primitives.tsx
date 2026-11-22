import { cn } from "@/lib/cn";
import type { ModuleStatus } from "@/config/modules";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({
  eyebrow,
  title,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-faint">{eyebrow}</p>}
        <h2 className="truncate text-[15px] font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:brightness-110 active:brightness-95",
  secondary: "border border-line-strong bg-raised text-fg hover:border-faint",
  ghost: "text-muted hover:bg-raised hover:text-fg",
  danger: "border border-down/40 text-down hover:bg-down/10",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

type Tone = "neutral" | "accent" | "up" | "down" | "info" | "warn";
const toneStyles: Record<Tone, string> = {
  neutral: "border-line-strong text-muted",
  accent: "border-accent/40 text-accent bg-accent-soft",
  up: "border-up/30 text-up bg-up/10",
  down: "border-down/30 text-down bg-down/10",
  info: "border-info/30 text-info bg-info/10",
  warn: "border-warn/30 text-warn bg-warn/10",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: ModuleStatus }) {
  if (status === "live") return <Badge tone="up">Live</Badge>;
  if (status === "partial") return <Badge tone="info">Partial</Badge>;
  return <Badge>Not built</Badge>;
}

export function Dot({ tone = "up", pulse }: { tone?: "up" | "down" | "accent" | "muted"; pulse?: boolean }) {
  const color = { up: "bg-up", down: "bg-down", accent: "bg-accent", muted: "bg-faint" }[tone];
  return <span className={cn("inline-block size-1.5 rounded-full", color, pulse && "animate-pulse-dot")} />;
}

export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[12px] text-muted">{label}</p>
      <div className="num mt-1 truncate text-lg font-medium text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-[12px] text-faint">{hint}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("inline-block h-[1em] w-20 animate-pulse rounded bg-raised align-middle", className)} />;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
