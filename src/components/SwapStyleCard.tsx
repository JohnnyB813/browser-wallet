import type { ReactNode } from "react";
import TokenMark from "./chains/TokenMark";

export type SwapTokenChoice = { id: string; symbol: string };

/**
 * You pay / flip / You receive card shared by every extension swap.
 * Same layout as the mobile wallet swap panels.
 */
export default function SwapStyleCard({
  title,
  subtitle,
  spotLabel,
  spotValue,
  toolbar,
  payHint,
  receiveHint,
  amount,
  onAmount,
  onMax,
  paySymbol,
  payChoices,
  payValue,
  onPay,
  receiveSymbol,
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
  toolbar?: ReactNode;
  payHint?: ReactNode;
  receiveHint?: string;
  amount: string;
  onAmount: (value: string) => void;
  onMax?: () => void;
  paySymbol: string;
  payChoices?: SwapTokenChoice[];
  payValue?: string;
  onPay?: (id: string) => void;
  receiveSymbol: string;
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
              <p className="text-[11px] text-zinc-600 tabular-nums">{subtitle}</p>
            ) : null}
          </div>
          {spotValue ? (
            <div className="text-right">
              <span className="text-zinc-600 block text-[10px] uppercase tracking-wide mb-0.5">
                {spotLabel || "Price"}
              </span>
              <span className="text-[11px] text-zinc-300 tabular-nums">{spotValue}</span>
            </div>
          ) : null}
        </div>

        <div className="p-2.5 space-y-2.5">
          {toolbar}
          <div className="swap-legs">
            <div className="swap-panel">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <span className="text-xs text-zinc-500 shrink-0 pt-0.5">You pay</span>
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
                <span className="text-xs text-zinc-500">You receive</span>
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
                  choices={receiveChoices}
                  value={receiveValue}
                  onChange={onReceive}
                />
              </div>
            </div>
          </div>

          {extra}
          {summary ? <div className="swap-summary space-y-1.5 text-[11px] text-zinc-500">{summary}</div> : null}
          {error ? <p className="text-xs text-amber-200/90">{error}</p> : null}
          <button type="button" className="swap-cta-btn" disabled={ctaDisabled} onClick={onCta}>
            {cta}
          </button>
        </div>
      </div>
      {hint ? <p className="swap-hint">{hint}</p> : null}
    </div>
  );
}

function TokenPill({
  symbol,
  choices,
  value,
  onChange,
}: {
  symbol: string;
  choices?: SwapTokenChoice[];
  value?: string;
  onChange?: (id: string) => void;
}) {
  const interactive = Boolean(onChange && choices && choices.length > 1);
  return (
    <label className="swap-token-btn">
      <TokenMark symbol={symbol} size={22} />
      {interactive ? (
        <select
          className="max-w-[5.5rem] bg-transparent text-inherit outline-none"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
        >
          {choices!.map((choice) => (
            <option key={choice.id} value={choice.id} className="bg-zinc-900">
              {choice.symbol}
            </option>
          ))}
        </select>
      ) : (
        <span>{symbol}</span>
      )}
      {interactive ? <span className="text-zinc-500 text-xs">▾</span> : null}
    </label>
  );
}
