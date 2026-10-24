import { useEffect, useRef, useState, type ReactNode } from "react";
import TokenMark from "./chains/TokenMark";
import NodeError from "./NodeError";

export type SwapTokenChoice = { id: string; symbol: string; mark?: string };

/**
 * You pay / flip / You receive card shared by every extension swap.
 * Same layout as the mobile wallet swap panels.
 */
export default function SwapStyleCard({
  title,
  subtitle,
  spotLabel,
  spotValue,
  mark,
  toolbar,
  payHint,
  receiveHint,
  amount,
  onAmount,
  onMax,
  paySymbol,
  payMark,
  payChain,
  payChoices,
  payValue,
  onPay,
  receiveSymbol,
  receiveMark,
  receiveChain,
  receiveChoices,
  receiveValue,
  onReceive,
  receiveAmount,
  onFlip,
  summary,
  extra,
  error,
  hint,
  cta,
  ctaDisabled,
  onCta,
}: {
  title: string;
  subtitle?: string;
  spotLabel?: string;
  spotValue?: string;
  /** Corner mark, such as the SafeTrade favicon beside the price. */
  mark?: ReactNode;
  toolbar?: ReactNode;
  payHint?: ReactNode;
  receiveHint?: string;
  amount: string;
  onAmount: (value: string) => void;
  onMax?: () => void;
  paySymbol: string;
  /** Glyph when it differs from the ticker, such as hemiETH. */
  payMark?: string;
  /** Chain this side leaves, shown even when the asset cannot be changed. */
  payChain?: string;
  payChoices?: SwapTokenChoice[];
  payValue?: string;
  onPay?: (id: string) => void;
  receiveSymbol: string;
  /** Glyph when it differs from the ticker, such as hemiETH. */
  receiveMark?: string;
  /** Chain this side arrives on, shown even when there is one target. */
  receiveChain?: string;
  receiveChoices?: SwapTokenChoice[];
  receiveValue?: string;
  onReceive?: (id: string) => void;
  receiveAmount: string;
  onFlip?: () => void;
  summary?: ReactNode;
  extra?: ReactNode;
  error?: string;
  hint?: string;
  cta: string;
  ctaDisabled?: boolean;
  onCta: () => void;
}) {
  return (
    <div className="swap-page w-full">
      <div className="swap-card w-full">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800/50 px-3 pt-3 pb-2.5">
          <div className="min-w-0">
            <h2 className="font-semibold tracking-tight text-sm text-zinc-100 mb-0.5">
              {title}
            </h2>
            {subtitle ? (
              <p className="text-[11px] font-medium text-zinc-300 tabular-nums">{subtitle}</p>
            ) : null}
          </div>
          {spotValue || mark ? (
            <div className="flex items-start gap-2">
              {spotValue ? (
                <div className="text-right">
                  <span className="text-zinc-600 block text-[10px] uppercase tracking-wide mb-0.5">
                    {spotLabel || "Price"}
                  </span>
                  <span className="text-[11px] text-zinc-300 tabular-nums">{spotValue}</span>
                </div>
              ) : null}
              {mark}
            </div>
          ) : null}
        </div>

        <div className="p-2.5 space-y-2.5">
          {toolbar}
          <div className="swap-legs">
            <div className="swap-panel">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <LegLabel action="You pay" chain={payChain} />
                {payHint ? (
                  onMax ? (
                    <button type="button" className="swap-balance-btn" onClick={onMax}>
                      {payHint}
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-500 text-right">{payHint}</span>
                  )
                ) : null}
              </div>
              <div className="swap-amount-row">
                <div className="swap-amount-value">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    placeholder="0"
                    onChange={(event) => onAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                  />
                </div>
                {onMax ? (
                  <button type="button" className="swap-chip-btn" onClick={onMax}>
                    MAX
                  </button>
                ) : null}
                <TokenPill
                  symbol={paySymbol}
                  mark={payMark}
                  chain={payChain}
                  choices={payChoices}
                  value={payValue}
                  onChange={onPay}
                />
              </div>
            </div>

            <div className="swap-legs-flip">
              <button
                type="button"
                className="swap-flip-btn"
                onClick={onFlip}
                disabled={!onFlip}
                aria-label="Flip swap direction"
              >
                ⇅
              </button>
            </div>

            <div className="swap-panel">
              <div className="flex items-center justify-between mb-2.5">
                <LegLabel action="You receive" chain={receiveChain} />
                {receiveHint ? (
                  <span className="text-[10px] text-zinc-600">{receiveHint}</span>
                ) : null}
              </div>
              <div className="swap-amount-row">
                <div className="swap-amount-value">
                  <span className={receiveAmount === "0" || receiveAmount === "…" ? "text-zinc-500" : "text-white"}>
                    {receiveAmount}
                  </span>
                </div>
                <TokenPill
                  symbol={receiveSymbol}
                  mark={receiveMark}
                  chain={receiveChain}
                  choices={receiveChoices}
                  value={receiveValue}
                  onChange={onReceive}
                />
              </div>
            </div>
          </div>

          {extra}
          {summary ? <div className="swap-summary space-y-1.5 text-[11px] text-zinc-500">{summary}</div> : null}
          {error ? (
            <NodeError
              message={error}
              className="text-xs text-amber-200/90"
            />
          ) : null}
          <button type="button" className="swap-cta-btn" disabled={ctaDisabled} onClick={onCta}>
            {cta}
          </button>
        </div>
      </div>
      {hint ? <p className="swap-hint">{hint}</p> : null}
    </div>
  );
}

function LegLabel({ action, chain }: { action: string; chain?: string }) {
  return (
    <span className="text-xs text-zinc-500 shrink-0 pt-0.5">
      {action}
      {chain ? <span className="font-medium text-zinc-100"> · {chain}</span> : null}
    </span>
  );
}

function TokenPill({
  symbol,
  mark,
  chain,
  choices,
  value,
  onChange,
}: {
  symbol: string;
  mark?: string;
  chain?: string;
  choices?: SwapTokenChoice[];
  value?: string;
  onChange?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const interactive = Boolean(onChange && choices && choices.length > 1);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!interactive) setOpen(false);
  }, [interactive]);

  const face = (
    <>
      <TokenMark symbol={mark || symbol} size={22} />
      <span className="flex min-w-0 flex-col items-start leading-none">
        <span>{symbol}</span>
        {chain ? <span className="mt-0.5 text-[10px] font-medium text-zinc-300">{chain}</span> : null}
      </span>
    </>
  );

  if (!interactive) {
    return <span className="swap-token-btn">{face}</span>;
  }

  return (
    <div className={`swap-token-menu${open ? " swap-token-menu--open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="swap-token-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Choose ${symbol}`}
        onClick={() => setOpen((current) => !current)}
      >
        {face}
        <span className="text-zinc-500 text-xs" aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="swap-token-list" role="listbox" aria-label={`Choose ${symbol}`}>
          {choices!.map((choice) => (
            <button
              key={choice.id}
              type="button"
              role="option"
              aria-selected={choice.id === value}
              className={`swap-token-option${choice.id === value ? " swap-token-option--active" : ""}`}
              onClick={() => {
                onChange?.(choice.id);
                setOpen(false);
              }}
            >
              <TokenMark symbol={choice.mark || choice.symbol} size={18} />
              <span>{choice.symbol}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
