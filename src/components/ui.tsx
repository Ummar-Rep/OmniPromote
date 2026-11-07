import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-navy-100 bg-white px-3 py-2 text-sm text-navy-900 shadow-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-300/50";

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm transition hover:bg-gold-400 disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-800 transition hover:bg-navy-50 disabled:opacity-60",
  dark: "inline-flex items-center justify-center gap-2 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-navy-800 disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60",
};

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-navy-100 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}

export function Field({
  label,
  hint,
  children,
  optional,
}: {
  label: string;
  hint?: string;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-navy-800">
        {label}
        {optional && <span className="ms-1 font-normal text-navy-500">({optional})</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-navy-500">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={4} {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

const badgeTones = {
  gray: "bg-navy-50 text-navy-700",
  gold: "bg-gold-100 text-gold-600",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-navy-100 bg-navy-50 text-navy-800",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-navy-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
