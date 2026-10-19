import { useEffect, useRef, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { CHAIN_LABEL, type BrowserChain } from "../../chains/useChainAccounts";

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

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white"
        onClick={() => setOpen((value) => !value)}
      >
        {CHAIN_LABEL[chain]}
        <FaChevronDown className={`text-white/50 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-primary/40 bg-black shadow-xl">
          {chains.map((id) => (
            <button
              key={id}
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm ${
                id === chain ? "bg-primary/15 text-primary" : "text-white hover:bg-white/10"
              }`}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
            >
              {CHAIN_LABEL[id]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
