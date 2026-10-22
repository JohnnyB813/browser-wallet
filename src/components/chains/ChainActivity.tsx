import { useCallback, useEffect, useRef, useState } from "react";
import {
  readTransferActivity,
  readTunnelActivity,
  type ActivityChain,
  type ActivityItem,
} from "../../mobile-port/utils/networkActivity";
import type { BrowserChain } from "../../chains/useChainAccounts";
import TokenMark, { tokenMark } from "./TokenMark";

const NAMES: Record<Exclude<BrowserChain, "wart">, string> = {
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
  hemi: "Hemi",
  solana: "Solana",
};

const TONE: Record<ActivityItem["tone"], string> = {
  in: "text-emerald-400",
  out: "text-zinc-400",
  swap: "text-[#FDB913]",
  fail: "text-rose-400",
};

function when(time: number): string {
  if (!time) return "Pending";
  return new Date(time).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function explorerFor(chain: Exclude<BrowserChain, "wart">, address: string): string {
  if (chain === "ethereum") return `https://etherscan.io/address/${address}`;
  if (chain === "hemi") return `https://explorer.hemi.xyz/address/${address}`;
  if (chain === "bitcoin") return `https://mempool.space/address/${address}`;
  return `https://solscan.io/account/${address}`;
}

function Spinner() {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 animate-spin rounded-full border border-[#FDB913] border-t-transparent"
      aria-hidden
    />
  );
}

/** Transfers and tunnels for the open chain tab. A row opens that transaction. */
export default function ChainActivity({
  chain,
  address,
  ethAddress,
  btcAddress,
  solAddress,
  refreshTick = 0,
}: {
  chain: Exclude<BrowserChain, "wart">;
  address: string;
  ethAddress: string;
  btcAddress: string;
  solAddress: string;
  refreshTick?: number;
}) {
  const [tab, setTab] = useState<"transfers" | "tunnels">("transfers");
  const [rows, setRows] = useState<ActivityItem[]>([]);
  const [tunnels, setTunnels] = useState<ActivityItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);

  const load = useCallback(async (quiet = false) => {
    const mine = ++ticket.current;
    if (!quiet) setLoading(true);
    setError(null);
    const addresses = { eth: ethAddress, btc: btcAddress, sol: solAddress };
    const activityChain: ActivityChain = chain;
    const current = () => mine === ticket.current;
    try {
      const [transfers, tunnelRows] = await Promise.all([
        readTransferActivity(activityChain, addresses),
        readTunnelActivity(activityChain, addresses),
      ]);
      if (!current()) return;
      setRows(transfers.rows);
      setWarning(transfers.warning);
      setTunnels(tunnelRows);
    } catch (err: unknown) {
      if (!current()) return;
      if (!quiet) {
        setRows([]);
        setTunnels([]);
        setWarning(null);
      }
      setError(err instanceof Error ? err.message : "Activity is unavailable.");
    } finally {
      if (current()) setLoading(false);
    }
  }, [chain, ethAddress, btcAddress, solAddress]);

  useEffect(() => {
    setTab("transfers");
  }, [chain]);

  useEffect(() => {
    void load();
  }, [load, refreshTick]);

  const tunnelSpinning = tunnels.some((row) => row.spinning);
  useEffect(() => {
    if (tab !== "tunnels" || !tunnelSpinning) return undefined;
    const timer = window.setInterval(() => {
      void load(true);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [tab, tunnelSpinning, load]);

  const shown = tab === "tunnels" ? tunnels : rows;
  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
      on ? "bg-[#E79300]/25 text-[#FDB913]" : "bg-white/5 text-zinc-400"
    }`;

  return (
    <div className="mt-2 border-t border-zinc-800 pt-2">
      <div className="mb-1 flex items-center gap-1.5">
        <button type="button" className={chip(tab === "transfers")} onClick={() => setTab("transfers")}>
          Transfers
        </button>
        <button type="button" className={chip(tab === "tunnels")} onClick={() => setTab("tunnels")}>
          {`Tunnels${tunnels.length ? ` ${tunnels.length}` : ""}`}
        </button>
        <button
          type="button"
          className="ml-auto text-[11px] font-semibold text-[#FDB913] disabled:opacity-60"
          onClick={() => {
            void load();
          }}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        {address ? (
          <button
            type="button"
            className="text-[11px] text-zinc-500"
            onClick={() => window.open(explorerFor(chain, address), "_blank", "noopener,noreferrer")}
          >
            Explorer
          </button>
        ) : null}
      </div>
      {loading && shown.length === 0 ? <p className="py-2 text-[11px] text-zinc-500">Loading…</p> : null}
      {error ? <p className="py-1 text-xs text-red-300">{error}</p> : null}
      {warning && tab === "transfers" ? <p className="py-1 text-[11px] text-zinc-500">{warning}</p> : null}
      {!loading && !error && shown.length === 0 ? (
        <p className="py-2 text-[11px] text-zinc-500">
          {tab === "tunnels" ? "No tunnels from this wallet yet." : `No ${NAMES[chain]} transactions yet.`}
        </p>
      ) : null}
      <div className="max-h-56 overflow-y-auto">
        {shown.map((row) => {
          const body = (
            <>
              <TokenMark symbol={tokenMark(row.symbol || "ETH", chain, true)} size={22} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-zinc-100">{row.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  {row.spinning ? <Spinner /> : null}
                  <span className="min-w-0 truncate">
                    {when(row.time)} · {row.subtitle}
                  </span>
                </p>
              </div>
              <p className={`max-w-[7.5rem] break-words text-right text-[11px] leading-tight ${TONE[row.tone]}`}>{row.amount}</p>
            </>
          );
          const className = "flex w-full items-center gap-2 border-b border-zinc-800 py-2 text-left";
          if (!row.url) {
            return (
              <div key={row.id} className={className}>
                {body}
              </div>
            );
          }
          return (
            <button
              key={row.id}
              type="button"
              className={`${className} hover:bg-white/5`}
              onClick={() => window.open(row.url as string, "_blank", "noopener,noreferrer")}
            >
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}
