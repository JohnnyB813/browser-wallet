import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { fetchAssetBalance, searchAssetsDetailed, type AssetInfo, type DefiAssetBalance } from "../utils/defiClient";
import { loadWatched, saveWatched, type WatchedAsset } from "../utils/watchedAssets";
import AssetMark, { AssetTitle } from "./AssetMark";
import AssetChartPanel from "./AssetChartPanel";
import SpendableBalanceDisplay from "./SpendableBalanceDisplay";

export default function WatchedAssets({ refreshTick = 0 }: { refreshTick?: number }) {
  const { wallet, selectedNodeUrl } = useWallet();
  const navigate = useNavigate();
  const [watched, setWatched] = useState<WatchedAsset[]>(() => loadWatched(wallet || ""));
  const [balances, setBalances] = useState<DefiAssetBalance[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetInfo[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chart, setChart] = useState("");
  useEffect(() => {
    let alive = true;
    if (!wallet || !selectedNodeUrl) return;
    setBalances([]);
    void Promise.all(watched.map(async (item) => {
      try { return await fetchAssetBalance(selectedNodeUrl, wallet, item.hash); }
      catch { return { hash: item.hash, name: item.customName || "Asset", balance: "Unavailable", available: "Unavailable", locked: "0", hasLocked: false, decimals: 8 }; }
    })).then((items) => { if (alive) setBalances(items); });
    return () => { alive = false; };
  }, [wallet, selectedNodeUrl, watched, refreshTick]);
  const track = (hash: string, name?: string) => {
    if (!wallet) return;
    const next = watched.some((item) => item.hash === hash) ? watched.filter((item) => item.hash !== hash) : [...watched, { hash, customName: name }];
    saveWatched(wallet, next);
    setWatched(next);
  };
  const search = async () => {
    if (!selectedNodeUrl) return;
    setBusy(true); setError("");
    try {
      const hash = query.replace(/^0x/i, "");
      const data = await searchAssetsDetailed(selectedNodeUrl, /^[a-f0-9]{64}$/i.test(hash) ? "" : query, /^[a-f0-9]{64}$/i.test(hash) ? hash : undefined);
      setResults(data.matches);
      if (!data.matches.length) setError("No matching assets");
    } catch (err) { setError(err instanceof Error ? err.message : "Search failed"); }
    finally { setBusy(false); }
  };
  return <section>
    <h2 className="wallet-section-label">Your assets</h2>
    {!watched.length && <p className="text-xs text-zinc-500 mb-3">Search for an asset to add it to this account.</p>}
    {balances.map((asset) => <div className="defi-card" key={asset.hash}>
      <div className="flex items-center gap-2 mb-2"><AssetMark hash={asset.hash} name={asset.name} /><AssetTitle hash={asset.hash} name={asset.name} /></div>
      <SpendableBalanceDisplay available={asset.available} total={asset.balance} locked={asset.locked} unit={asset.name} />
      <div className="defi-btn-row">
        <button className="defi-compact-btn" onClick={() => navigate(`/send?hash=${asset.hash}&decimals=${asset.decimals}`)}>Send</button>
        <button className="defi-compact-btn" onClick={() => navigate(`/swap?hash=${asset.hash}&name=${encodeURIComponent(asset.name)}&decimals=${asset.decimals}`)}>Trade</button>
        <button className="defi-compact-btn" onClick={() => setChart(chart === asset.hash ? "" : asset.hash)}>Chart</button>
        <button className="defi-compact-btn" aria-label={`Untrack ${asset.name}`} onClick={() => track(asset.hash)}>Untrack</button>
      </div>
      {chart === asset.hash && <AssetChartPanel nodeUrl={selectedNodeUrl || ""} hash={asset.hash} assetName={asset.name} />}
    </div>)}
    <form className="flex gap-2 mt-3" onSubmit={(event) => { event.preventDefault(); void search(); }}>
      <input className="defi-input mb-0! min-w-0" aria-label="Search assets" placeholder="Asset name or full hash" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button className="defi-compact-btn" disabled={busy}>{busy ? "…" : query ? "Search" : "Browse"}</button>
    </form>
    {error && <p className="defi-error">{error}</p>}
    {results.map((asset) => asset.hash && <div key={asset.hash} className="flex items-center justify-between gap-2 py-3 border-b border-white/10">
      <div className="min-w-0"><AssetTitle hash={asset.hash} name={asset.name || "Asset"} /><p className="text-[10px] font-mono text-zinc-500">{asset.hash.slice(0, 12)}…{asset.hash.slice(-8)}</p></div>
      <button className="defi-compact-btn" onClick={() => track(asset.hash!, asset.name)}>{watched.some((item) => item.hash === asset.hash) ? "Untrack" : "+ Track"}</button>
    </div>)}
  </section>;
}
