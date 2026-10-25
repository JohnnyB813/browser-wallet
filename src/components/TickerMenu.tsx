import { useEffect, useId, useRef, useState } from "react";
import AssetMark from "./AssetMark";
import TokenMark from "./chains/TokenMark";
import {
  assetDisplayName,
  assetDisplayTicker,
  useAssetMetadata,
} from "../utils/assetMetadata";

export type TickerMenuItem = {
  id: string;
  label: string;
  hint?: string;
  /** Glyph name when it differs from the label, such as HEMIETH. */
  symbol?: string;
  /** DeFi asset hash. The row shows that asset's logo. */
  hash?: string;
  name?: string;
};

/** Icon and ticker for one menu row. A hash uses the asset logo. */
export function TickerFace({
  item,
  size = 22,
  compact = false,
}: {
  item: TickerMenuItem;
  size?: number;
  compact?: boolean;
}) {
  const meta = useAssetMetadata(item.hash);
  const ticker = item.hash
    ? assetDisplayTicker(item.name || item.label, meta) || item.label
    : item.label;
  const display = item.hash ? assetDisplayName(item.name || item.label, meta) : "";
  const named = display && display.toLowerCase() !== ticker.toLowerCase() ? display : "";
  const hint = [named, item.hint].filter(Boolean).join(" · ");
  return (
    <>
      {item.hash ? (
        <AssetMark hash={item.hash} name={item.name || item.label} size="xs" round />
      ) : (
        <TokenMark symbol={item.symbol || item.label} size={size} />
      )}
      <span className="ticker-menu-copy">
        <span>{ticker}</span>
        {!compact && hint ? <small>{hint}</small> : null}
      </span>
    </>
  );
}

/**
 * Asset menu used on master: a closed pill with the ticker mark, and a list
 * where every choice shows that same mark beside the symbol.
 */
export default function TickerMenu({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  items: TickerMenuItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = items.find((item) => item.id === value) ?? items[0];

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

  if (!selected) return null;

  return (
    <div className={`ticker-menu${open ? " ticker-menu--open" : ""} ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="ticker-menu-btn"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <TickerFace item={selected} size={18} compact />
        <span className="ticker-menu-chevron" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div className="ticker-menu-panel">
          <div className="ticker-menu-list" id={listId} role="listbox" aria-label={ariaLabel}>
            {items.map((item) => {
              const on = item.id === selected.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`ticker-menu-option${on ? " ticker-menu-option--active" : ""}`}
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                >
                  <TickerFace item={item} />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
