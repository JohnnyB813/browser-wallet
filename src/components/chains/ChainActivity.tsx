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

const AMOUNT_COLOR: Record<ActivityItem["tone"], string> = {
  in: "var(--defi-buy, #34d399)",
  out: "var(--defi-sell, #fb7185)",
  swap: "#fdb913",
  fail: "var(--defi-sell, #fb7185)",
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

function abbreviate(value?: string): string {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function abbreviateTx(value?: string): string {
  if (!value) return "";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

function copy(text: string) {
  void navigator.clipboard.writeText(text).catch(() => undefined);
}

function badge(row: ActivityItem): { label: string; bg: string; color: string } {
  if (row.tone === "fail") return { label: "FAILED", bg: "#7f1d1d", color: "#fca5a5" };
  if (/^approved|^cleared/i.test(row.title)) return { label: "APPROVE", bg: "#854d0e", color: "#fde047" };
  if (row.tone === "swap") return { label: "SWAP", bg: "#581c87", color: "#d8b4fe" };
  if (row.tone === "in") return { label: "RECEIVED", bg: "#166534", color: "#86efac" };
  return { label: "SENT", bg: "#1e3a8a", color: "#93c5fd" };
}

function direction(row: ActivityItem): string {
  if (row.tone === "fail") return "Failed";
  if (/^approved/i.test(row.title)) return "Approved";
  if (/^cleared/i.test(row.title)) return "Cleared";
  if (row.tone === "swap") return "Swap";
  if (row.tone === "in") return "Received";
  return "Sent";
}

function markFor(row: ActivityItem, chain: Exclude<BrowserChain, "wart">): string {
  if (row.symbol) return tokenMark(row.symbol, chain, row.symbol === "ETH");
  if (chain === "bitcoin") return "BTC";
  if (chain === "solana") return "SOL";
  return tokenMark("ETH", chain, true);
}

function detail(row: ActivityItem, chainName: string): string {
  const text = row.subtitle.trim();
  if (!text || text === chainName) return "";
  if (row.hash && text.includes("…")) return "";
  return text;
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
      className="mr-1 inline-block h-2.5 w-2.5 shrink-0 align-middle animate-spin rounded-full border border-[#FDB913] border-t-transparent"
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

  const chainName = NAMES[chain];
  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
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
      {loading && shown.length === 0 ? <p className="tx-empty">Loading…</p> : null}
      {error ? <p className="tx-error">{error}</p> : null}
      {warning && tab === "transfers" ? <p className="tx-empty">{warning}</p> : null}
      {!loading && !error && shown.length === 0 ? (
        <p className="tx-empty">
          {tab === "tunnels" ? "No tunnels from this wallet yet." : `No ${chainName} transactions yet.`}
        </p>
      ) : null}
      <div className="tx-history-list">
        {shown.map((row) => {
          const kind = badge(row);
          const note = detail(row, chainName);
          const open = () => {
            if (row.url) window.open(row.url, "_blank", "noopener,noreferrer");
          };
          return (
            <div
              key={row.id}
              className="tx-card"
              role={row.url ? "button" : undefined}
              tabIndex={row.url ? 0 : undefined}
              onClick={row.url ? open : undefined}
              onKeyDown={(event) => {
                if (!row.url) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  open();
                }
              }}
            >
              <div className="tx-card-head">
                <span className="inline-flex items-center gap-1.5">
                  <TokenMark symbol={markFor(row, chain)} size={14} />
                  <span className="tx-type-badge" style={{ background: kind.bg, color: kind.color }}>
                    {kind.label}
                  </span>
                </span>
                {row.hash ? (
                  <button
                    type="button"
                    className="tx-value tx-link"
                    title={row.hash}
                    onClick={(event) => {
                      event.stopPropagation();
                      copy(row.hash as string);
                    }}
                  >
                    {abbreviateTx(row.hash)}
                  </button>
                ) : (
                  <span className="tx-value tx-muted">{row.title}</span>
                )}
              </div>
              {note ? <div className="tx-desc-block">{note}</div> : null}
              {row.from ? (
                <div className="tx-row">
                  <span className="tx-label">From</span>
                  <button
                    type="button"
                    className="tx-value tx-link"
                    title={row.from}
                    onClick={(event) => {
                      event.stopPropagation();
                      copy(row.from as string);
                    }}
                  >
                    {abbreviate(row.from)}
                  </button>
                </div>
              ) : null}
              {row.to ? (
                <div className="tx-row">
                  <span className="tx-label">To</span>
                  <button
                    type="button"
                    className="tx-value tx-link"
                    title={row.to}
                    onClick={(event) => {
                      event.stopPropagation();
                      copy(row.to as string);
                    }}
                  >
                    {abbreviate(row.to)}
                  </button>
                </div>
              ) : null}
              <div className="tx-row">
                <span className="tx-label">Amount</span>
                <span className="tx-value" style={{ color: /^approved|^cleared/i.test(row.title) ? "#e4e4e7" : AMOUNT_COLOR[row.tone] }}>{row.amount}</span>
              </div>
              {row.fee ? (
                <div className="tx-row">
                  <span className="tx-label">Fee</span>
                  <span className="tx-value tx-muted">{row.fee}</span>
                </div>
              ) : null}
              <div className="tx-row">
                <span className="tx-label">Direction</span>
                <span className="tx-value" style={{ color: AMOUNT_COLOR[row.tone] }}>
                  {row.spinning ? <Spinner /> : null}
                  {direction(row)}
                </span>
              </div>
              <div className="tx-card-foot">
                <span>{row.status || (row.spinning ? "Pending" : chainName)}</span>
                <span>{row.height ? (/^\d+$/.test(row.height) ? `H: ${row.height}` : row.height) : chainName}</span>
                <span className="tx-muted">{when(row.time)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
