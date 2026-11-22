import { cn } from "@/lib/cn";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  counter,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium">
          {label}
          {optional && <span className="ml-1.5 font-normal text-faint">Optional</span>}
        </label>
        {counter && <span className="num text-[11px] text-faint">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-down" role="alert">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] leading-5 text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-lg border bg-canvas px-3 text-sm text-fg placeholder:text-faint transition outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

export function TextInput({ invalid, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(inputBase, "h-11", invalid ? "border-down/60" : "border-line-strong", className)}
      {...props}
    />
  );
}

export function TextArea({ invalid, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(inputBase, "min-h-28 resize-y py-2.5 leading-6", invalid ? "border-down/60" : "border-line-strong", className)}
      {...props}
    />
  );
}

export function ReadOnlyRow({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <div>
        <p className="text-muted">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] text-faint">{hint}</p>}
      </div>
      <div className="num shrink-0 text-right">{value}</div>
    </div>
  );
}
