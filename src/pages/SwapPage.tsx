/**
 * DeFi swap screen. Hosts the same Market / Limit / Pool panel as the
 * extension DeFi hub, using that hub's watched-asset list.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import DefiNodeGate from "../components/DefiNodeGate";
import SwapDexPanel, { type SwapOrderMode } from "../components/SwapDexPanel";
import ChainSwap from "./ChainSwap";
import { useChainAccounts } from "../chains/useChainAccounts";
import useWallet from "../hooks/useWallet";
import { DEFAULT_TX_FEE } from "../config/network";
import { defiSubmitHold, isDefiNode } from "../utils/nodes";
import {
  computeSuggestedTxFee,
  fetchBalanceAndPin,
} from "../utils/warthogNode";
import {
  fetchAssetBalance,
  type DefiAssetBalance,
} from "../utils/defiClient";

const WATCHED_KEY = (addr: string) =>
  `warthogWatchedAssets_${addr.toLowerCase()}`;

function loadWatched(address: string): { hash: string; customName?: string }[] {
  try {
    const raw = localStorage.getItem(WATCHED_KEY(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: { hash?: string; customName?: string } | string) =>
        typeof x === "string"
          ? { hash: x }
          : { hash: x.hash || "", customName: x.customName },
      )
      .filter((x) => x.hash);
  } catch {
    return [];
  }
}

function parseMode(raw: string | null): SwapOrderMode {
  if (raw === "limit" || raw === "pool" || raw === "market") return raw;
  return "market";
}

function SwapPage() {
  const [params] = useSearchParams();
  const { wallet, selectedNode, selectedNodeUrl, ledgerAccount } = useWallet();
  const { chain } = useChainAccounts();

  const nodeUrl = selectedNodeUrl || "";
  const defi = isDefiNode(selectedNode);
  const inactiveReason = defiSubmitHold(selectedNode, Boolean(ledgerAccount));

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fee, setFee] = useState(DEFAULT_TX_FEE);
  const [wartBalance, setWartBalance] = useState("0");
  const [wartAvailable, setWartAvailable] = useState("0");
  const [wartLocked, setWartLocked] = useState("0");
  const [assetBalances, setAssetBalances] = useState<DefiAssetBalance[]>([]);

  const refreshBalance = useCallback(async () => {
    if (!wallet || !nodeUrl) return;
    const bal = await fetchBalanceAndPin(selectedNode!, wallet);
    setWartBalance(bal.balance);
    setWartAvailable(bal.available);
    setWartLocked(bal.locked);
  }, [wallet, nodeUrl, selectedNode]);

  const refreshAssets = useCallback(async () => {
    if (!wallet || !nodeUrl) return;
    const watched = loadWatched(wallet);
    const results: DefiAssetBalance[] = [];
    for (const item of watched) {
      try {
        const bal = await fetchAssetBalance(nodeUrl, wallet, item.hash);
        if (item.customName) bal.name = item.customName;
        results.push(bal);
      } catch {
        results.push({
          hash: item.hash,
          name: item.customName || "?",
          balance: "—",
          available: "—",
          locked: "0",
          hasLocked: false,
          decimals: 8,
        });
      }
    }
    setAssetBalances(results);
  }, [wallet, nodeUrl]);

  const refreshAll = useCallback(async () => {
    await refreshBalance();
    await refreshAssets();
  }, [refreshBalance, refreshAssets]);

  useEffect(() => {
    if (!wallet || !nodeUrl) return;
    refreshBalance().catch(() => undefined);
    if (!defi) return;
    refreshAssets().catch(() => undefined);
    computeSuggestedTxFee(nodeUrl)
      .then((suggested) => {
        if (suggested) setFee(suggested);
      })
      .catch(() => undefined);
  }, [wallet, nodeUrl, defi, refreshBalance, refreshAssets]);

  const decimals = parseInt(params.get("decimals") || "8", 10);

  if (chain !== "wart") {
    return <ChainSwap chain={chain} />;
  }

  return (
    <DefiNodeGate title="Swap">
    <div className="defi-page container">
      <Header title="Swap" />
      {status && <p className="defi-success">{status}</p>}
      {error && <p className="defi-error">{error}</p>}
      <SwapDexPanel
        nodeUrl={nodeUrl}
        wallet={wallet || ""}
        fee={fee}
        onFeeChange={setFee}
        wartAvailable={wartAvailable}
        wartLocked={wartLocked}
        wartBalance={wartBalance}
        assetBalances={assetBalances}
        prefillHash={params.get("hash") || undefined}
        prefillName={params.get("name") || undefined}
        prefillDecimals={Number.isFinite(decimals) ? decimals : 8}
        busy={busy}
        setBusy={setBusy}
        setStatus={setStatus}
        setError={setError}
        onSuccess={refreshAll}
        initialMode={parseMode(params.get("mode"))}
        inactiveReason={inactiveReason}
      />
    </div>
    </DefiNodeGate>
  );
}

export default SwapPage;
