import { useEffect, useRef, useState } from "react";
import { CHAIN_LABEL, type BrowserChain } from "../../chains/useChainAccounts";
import TokenMark from "./TokenMark";

const ICONS: Record<BrowserChain, string> = {
  wart: "WART",
  ethereum: "ETH",
  bitcoin: "BTC",
  hemi: "HEMI",
  solana: "SOL",
};

/** Gold network menu. Hidden when this wallet only has Warthog. */
export default function ChainPicker({
  chains,
  chain,
  onChange,
}: {
  chains: BrowserChain[];
  chain: BrowserChain;
  onChange: (chain: BrowserChain) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (chains.length < 2) return null;
  const current = ICONS[chain] ?? "WART";

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="flex items-center gap-2 self-start rounded-full border border-[#FDB913]/75 bg-[#FDB913]/12 py-1.5 pr-3 pl-2 text-[13px] font-semibold text-[#FDB913]"
        aria-label="Network"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <TokenMark symbol={current} size={18} />
        {CHAIN_LABEL[chain]}
        <span className="text-[11px]" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 z-30 mt-1.5 min-w-[180px] rounded-[14px] border border-[#FDB913]/35 bg-[#18181b] p-1.5 shadow-xl">
          {chains.map((id) => {
            const on = id === chain;
            return (
              <button
                key={id}
                type="button"
                role="menuitem"
                aria-selected={on}
                className={`flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold ${
                  on ? "bg-[#FDB913]/12 text-[#FDB913]" : "text-zinc-300 hover:bg-white/10"
                }`}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
              >
                <TokenMark symbol={ICONS[id]} size={22} />
                {CHAIN_LABEL[id]}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
