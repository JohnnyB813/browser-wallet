import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { getOpenOrders, type OpenOrdersByAsset } from "../utils/defiClient";

export default function OpenOrders() {
  const { wallet, selectedNodeUrl } = useWallet();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<OpenOrdersByAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!wallet || !selectedNodeUrl) return;
    setLoading(true); setError("");
    void getOpenOrders(selectedNodeUrl, wallet).then((items) => { if (alive) setGroups(items); }).catch((err: unknown) => {
      if (alive) setError(err instanceof Error ? err.message : "Orders unavailable");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [wallet, selectedNodeUrl, tick]);
  return <section>
    <button className="defi-compact-btn mb-3" disabled={loading} onClick={() => setTick((n) => n + 1)}>{loading ? "Loading…" : "Refresh orders"}</button>
    {error && <p className="defi-error">{error}</p>}
    {!loading && !error && !groups.length && <p className="defi-empty">No open orders</p>}
    {groups.map((group, index) => <div key={group.baseAsset.hash || index} className="defi-card">
      <h3 className="text-sm font-semibold mb-2">{group.baseAsset.name || "Asset"}</h3>
      {([...(group.wartToAssetSwaps || []).map((order) => ({ order, side: "Buy" })), ...(group.assetToWartSwaps || []).map((order) => ({ order, side: "Sell" }))]).map(({ order, side }, i) =>
        <div key={order.txHash || i} className="border-t border-white/10 py-3">
          <div className="flex justify-between gap-2 text-xs"><span>{side} {order.amount?.str || "0"}</span><span>{order.formattedLimitPrice ?? order.limit?.doubleAdjusted ?? "?"} WART</span></div>
          <p className="text-[11px] text-zinc-500 mt-1">Filled: {order.filled?.str || "0"}</p>
          {order.txHash && <button className="defi-compact-btn mt-2" onClick={() => navigate(`/cancel-order-step2?hash=${order.txHash}`)}>Cancel order</button>}
        </div>)}
    </div>)}
  </section>;
}
