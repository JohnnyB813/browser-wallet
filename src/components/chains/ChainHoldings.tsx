import { useEffect, useState } from "react";
import { fetchBtcBalance, formatBtc } from "../../mobile-port/utils/networks/btc";
import { readHoldingAmounts } from "../../mobile-port/utils/tokenBalances";
import {
  defaultsFor,
  showOnHoldings,
  type WalletToken,
} from "../../mobile-port/utils/walletTokens";
import type { BrowserChain } from "../../chains/useChainAccounts";
import { toast } from "../../utils/toast";

function short(value: string): string {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export default function ChainHoldings({
  chain,
  ethAddress,
  btcAddress,
  solAddress,
}: {
  chain: Exclude<BrowserChain, "wart">;
  ethAddress: string;
  btcAddress: string;
  solAddress: string;
}) {
  const [rows, setRows] = useState<{ token: WalletToken; amount: string | null }[]>([]);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
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
          setError("");
          return;
        }
        const network = chain === "ethereum" ? "ethereum" : chain === "hemi" ? "hemi" : "solana";
        const owner = network === "solana" ? solAddress : ethAddress;
        setAddress(owner);
        const tokens = defaultsFor(network);
        const amounts = await readHoldingAmounts(owner, tokens);
        if (!alive) return;
        setRows(tokens.map((token) => ({ token, amount: amounts[token.id] ?? null })));
        setError("");
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Balances are unavailable.");
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [chain, ethAddress, btcAddress, solAddress]);

  const visible = rows.filter((row) => showOnHoldings(row.token, row.amount));

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        className="mb-2 text-left text-xs text-white/50"
        onClick={() => {
          if (!address) return;
          void navigator.clipboard.writeText(address);
          toast.success("Copied", address);
        }}
      >
        {address ? short(address) : "—"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <div className="space-y-1">
        {visible.map((row) => (
          <div key={row.token.id} className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-white/70">{row.token.symbol}</span>
            <span className="text-lg font-semibold text-white">
              {row.amount ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
