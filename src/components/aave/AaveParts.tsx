import { useId, useState, type ReactNode } from "react";
import TokenMark from "../chains/TokenMark";

/** Card surface used across the Aave page. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.04] p-3 ${className}`}>
      {children}
    </section>
  );
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
      className={`shrink-0 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
    >
      <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Collapsible card. The header keeps its size when it opens, so nothing above it moves. */
export function Accordion({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.04]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-white">{title}</span>
          {hint ? <span className="block truncate text-[11px] text-white/40">{hint}</span> : null}
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <div id={id} className="space-y-2 border-t border-white/10 px-3 pb-3 pt-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Tab-style control. Only the selected form is shown by the caller. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="grid grid-cols-4 gap-1 rounded-xl bg-black/40 p-1">
      {options.map((option) => {
        const on = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={on}
            className={`rounded-lg px-1 py-1.5 text-xs font-semibold transition-colors ${
              on ? "bg-primary text-black" : "text-white/70 hover:bg-white/10"
            }`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-black/30 px-2.5 py-2">
      <p className="truncate text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className={`truncate font-mono text-sm ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

/** Small card for one asset: icon, symbol, main value and an optional second line. */
export function AssetCard({
  symbol,
  title,
  value,
  sub,
  badge,
  onClick,
}: {
  symbol: string;
  title?: string;
  value: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <TokenMark symbol={symbol} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight text-white">{title ?? symbol}</span>
        {sub ? <span className="block truncate text-[11px] leading-tight text-white/45">{sub}</span> : null}
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-xs leading-tight text-zinc-100">{value}</span>
        {badge ? <span className="block text-[10px] leading-tight text-white/40">{badge}</span> : null}
      </span>
    </>
  );
  const cls = "flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-left";
  return onClick ? (
    <button type="button" className={`${cls} hover:border-primary/40`} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Compact vertical card for the borrow market grid. */
export function MarketCard({
  symbol,
  rate,
  room,
  onClick,
}: {
  symbol: string;
  rate: string;
  room: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="min-w-0 rounded-lg border border-white/10 bg-black/25 p-2.5 text-left hover:border-primary/40"
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <TokenMark symbol={symbol} size={24} />
        <span className="truncate text-sm font-semibold text-white">{symbol}</span>
      </span>
      <span className="mt-1.5 block font-mono text-xs text-primary">~{rate} APR</span>
      <span className="block truncate text-[10px] text-white/45">Available {room}</span>
    </button>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-white/50">{label}</span>
      <span className="text-right font-mono text-white/90">{value}</span>
    </div>
  );
}

/** Address line with a copy button and an Etherscan link. */
export function AddressRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => undefined);
  };
  return (
    <div className="space-y-1 rounded-lg bg-black/25 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="break-all font-mono text-[11px] text-white/80">{address}</p>
      <div className="flex gap-3 pt-0.5 text-xs">
        <button type="button" className="font-semibold text-primary" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          className="font-semibold text-primary"
          href={`https://etherscan.io/address/${address}`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Etherscan
        </a>
      </div>
    </div>
  );
}
