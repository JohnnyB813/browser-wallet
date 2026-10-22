import { useEffect, useState } from "react";
import { fetchBtcBalance, formatBtc } from "../../mobile-port/utils/networks/btc";
import { readHoldingAmounts } from "../../mobile-port/utils/tokenBalances";
import {
  addCustomToken,
  showOnHoldings,
  subscribeTokens,
  tokensFor,
  type TokenNetwork,
  type WalletToken,
} from "../../mobile-port/utils/walletTokens";
import type { BrowserChain } from "../../chains/useChainAccounts";
import { toast } from "../../utils/toast";
import { formatDisplayNumber, loadNumberDisplayPrefs } from "../../utils/numberDisplay";
import ChainActivity from "./ChainActivity";
import TokenMark, { tokenMark } from "./TokenMark";

function short(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function showAmount(value: string | null, failed: boolean): string {
  if (value == null) return failed ? "—" : "…";
  return formatDisplayNumber(value, loadNumberDisplayPrefs(), { fallback: value });
}

const LABELS: Record<Exclude<BrowserChain, "wart">, string> = {
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
  hemi: "Hemi",
  solana: "Solana",
};

const actionBtn =
  "rounded-md border border-[#E79300]/60 bg-[#E79300]/12 px-2.5 py-1 text-[11px] font-semibold text-[#FDB913]";

export default function ChainHoldings({
  chain,
  ethAddress,
  btcAddress,
  solAddress,
  refreshTick = 0,
  onSend,
  onTunnel,
}: {
  chain: Exclude<BrowserChain, "wart">;
  ethAddress: string;
  btcAddress: string;
  solAddress: string;
  refreshTick?: number;
  onSend: () => void;
  onTunnel: () => void;
}) {
  const [rows, setRows] = useState<{ token: WalletToken; amount: string | null }[]>([]);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [known, setKnown] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  useEffect(() => {
    setAdding(false);
    setDraft("");
    setAddError("");
    setActivityOpen(false);
  }, [chain]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        if (chain === "bitcoin") {
          setAddress(btcAddress);
          const sats = await fetchBtcBalance(btcAddress);
          if (!alive) return;
          setRows([
            {
              token: {
                id: "bitcoin:native",
                network: "hemi",
                symbol: "BTC",
                name: "Bitcoin",
                decimals: 8,
                address: "native",
                native: true,
              },
              amount: formatBtc(sats),
            },
          ]);
          setKnown(true);
          setError("");
          return;
        }
        const network: TokenNetwork = chain === "ethereum" ? "ethereum" : chain === "hemi" ? "hemi" : "solana";
        const owner = network === "solana" ? solAddress : ethAddress;
        setAddress(owner);
        const tokens = await tokensFor(network);
        const amounts = await readHoldingAmounts(owner, tokens);
        if (!alive) return;
        const failed = Object.values(amounts).every((amount) => amount == null);
        setRows(tokens.map((token) => ({ token, amount: amounts[token.id] ?? null })));
        setKnown(!failed);
        setError(failed ? `${LABELS[chain]} balances unavailable` : "");
      } catch (err) {
        if (!alive) return;
        setKnown(false);
        setError(err instanceof Error ? err.message : "Balances are unavailable.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const stop = subscribeTokens(() => {
      void load();
    });
    return () => {
      alive = false;
      stop();
    };
  }, [chain, ethAddress, btcAddress, solAddress, refreshTick]);

  const visible = known
    ? rows.filter((row) => showOnHoldings(row.token, row.amount))
    : rows.filter((row) => row.token.native);

  const note =
    chain === "hemi"
      ? "Same address as Ethereum. Gas is ETH on Hemi."
      : chain === "solana"
        ? "SOL on this address. Other tokens show here once they have a balance."
        : null;

  const network: TokenNetwork | null =
    chain === "ethereum" ? "ethereum" : chain === "hemi" ? "hemi" : chain === "solana" ? "solana" : null;

  const submitToken = async () => {
    if (!network) return;
    setAddBusy(true);
    setAddError("");
    try {
      await addCustomToken(network, draft);
      setDraft("");
      setAdding(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "That token could not be added.");
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between border-t border-zinc-700 pt-2">
        <p className="text-[10px] font-semibold tracking-[1.4px] text-zinc-500 uppercase">{LABELS[chain]}</p>
        {loading ? <span className="text-[10px] text-[#FDB913]">…</span> : null}
      </div>
      {error ? <p className="mb-1 text-xs text-red-300">{error}</p> : null}
      <div>
        {visible.map((row) => {
          const mark = tokenMark(
            row.token.symbol,
            chain === "hemi" ? "hemi" : undefined,
            row.token.native,
          );
          const subtitle =
            row.token.name !== row.token.symbol ? row.token.name : row.token.custom ? row.token.name : "";
          return (
            <div key={row.token.id} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex min-w-0 items-center gap-2">
                <TokenMark symbol={mark} size={28} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{row.token.symbol}</p>
                  {subtitle ? <p className="truncate text-[11px] text-zinc-500">{subtitle}</p> : null}
                </div>
              </div>
              <p className="font-mono text-sm font-semibold text-white">
                {showAmount(row.amount, known || Boolean(error))}
              </p>
            </div>
          );
        })}
      </div>
      {address ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-zinc-400"
            onClick={() => {
              void navigator.clipboard.writeText(address);
              toast.success("Copied", address);
            }}
          >
            {short(address)}
          </button>
          <button type="button" className={actionBtn} onClick={onSend}>
            Send
          </button>
          <button
            type="button"
            className={`${actionBtn} ${activityOpen ? "bg-[#E79300]/30" : ""}`}
            aria-expanded={activityOpen}
            onClick={() => setActivityOpen((open) => !open)}
          >
            Activity
          </button>
          {chain === "hemi" ? (
            <button type="button" className={actionBtn} onClick={onTunnel}>
              Tunnel
            </button>
          ) : null}
          {chain !== "bitcoin" ? (
            <button type="button" className={actionBtn} onClick={() => setAdding((value) => !value)}>
              Add token
            </button>
          ) : null}
        </div>
      ) : null}
      {activityOpen && address ? (
        <ChainActivity
          chain={chain}
          address={address}
          ethAddress={ethAddress}
          btcAddress={btcAddress}
          solAddress={solAddress}
          refreshTick={refreshTick}
        />
      ) : null}
      {note ? <p className="mt-2 text-[11px] text-zinc-500">{note}</p> : null}
      {adding && network ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitToken();
          }}
        >
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-primary"
            value={draft}
            placeholder={network === "solana" ? "Mint address" : "Contract address"}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className={actionBtn} disabled={addBusy || !draft.trim()}>
            {addBusy ? "…" : "Add"}
          </button>
        </form>
      ) : null}
      {addError ? <p className="mt-1 text-xs text-red-300">{addError}</p> : null}
    </div>
  );
}
