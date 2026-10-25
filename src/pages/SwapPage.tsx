/**
 * DeFi swap screen. Hosts the same Market / Limit / Pool panel as the
 * extension DeFi hub, using that hub's watched-asset list.
 */
import { useCallback, useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
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
  fetchLiquidityPositions,
  type LiquidityPosition,
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

function SwapPage({ pool = false }: { pool?: boolean }) {
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
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [positionsError, setPositionsError] = useState("");

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

  useEffect(() => {
    let alive = true;
    if (!pool || !defi || !wallet || !nodeUrl) return;
    setPositionsError("");
    void fetchLiquidityPositions(nodeUrl, wallet, assetBalances.map((asset) => asset.hash), assetBalances)
      .then((items) => { if (alive) setPositions(items); })
      .catch(() => { if (alive) setPositionsError("Could not load liquidity positions"); });
    return () => { alive = false; };
  }, [pool, defi, wallet, nodeUrl, assetBalances]);

  if (chain !== "wart") {
    return <ChainSwap chain={chain} />;
  }
  if (!pool && params.get("mode") === "pool") {
    return <Navigate to={`/liquidity?${params.toString()}`} replace />;
  }

  return (
    <DefiNodeGate title={pool ? "Liquidity" : "Swap"}>
    <div className="defi-page container">
      <Header title={pool ? "Liquidity" : "Swap"} />
      {status && <p className="defi-success">{status}</p>}
      {error && <p className="defi-error">{error}</p>}
      <SwapDexPanel
        key={pool ? "pool" : params.get("mode") || "market"}
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
        initialMode={pool ? "pool" : parseMode(params.get("mode"))}
        poolOnly={pool}
        inactiveReason={inactiveReason}
      />
      {pool && <section className="mt-6">
        <h2 className="wallet-section-label">Your liquidity positions</h2>
        {positionsError && <p className="defi-error">{positionsError}</p>}
        {!positions.length && !positionsError && <p className="defi-hint">No positions found for tracked assets. Track pool assets in Wallet to include them here.</p>}
        {positions.map((position) => <div className="defi-card" key={position.hash}><p className="text-sm font-semibold">{position.name} / WART</p><p className="text-xs text-zinc-400 mt-1">LP shares: {position.lpBalance}</p><p className="text-xs text-zinc-500">Pool: {position.poolWart} WART · {position.poolAsset} {position.name}</p><a className="defi-compact-btn mt-2 inline-block" href={`#/liquidity?hash=${position.hash}&name=${encodeURIComponent(position.name)}&decimals=${position.decimals}`}>Manage position</a></div>)}
      </section>}
    </div>
    </DefiNodeGate>
  );
}

export default SwapPage;
