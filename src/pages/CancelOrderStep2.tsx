import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import DefiNodeGate from "../components/DefiNodeGate";
import useWallet from "../hooks/useWallet";
import { cancelOrderTx, cancelOrderTargetTx } from "../utils/defiClient";
import { DEFAULT_TX_FEE } from "../config/network";
import { defiSubmitHold } from "../utils/nodes";

export default function CancelOrderStep2() {
  const { wallet, selectedNodeUrl, selectedNode, ledgerAccount, tmpCancelHeight, tmpCancelNonceId } = useWallet();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [fee, setFee] = useState(DEFAULT_TX_FEE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const hash = params.get("hash");
  const hold = defiSubmitHold(selectedNode, Boolean(ledgerAccount));
  const valid = Boolean(hash) || (tmpCancelHeight != null && tmpCancelNonceId != null);
  const submit = async () => {
    if (!wallet || !selectedNodeUrl || hold || !valid) return;
    setBusy(true); setError("");
    try {
      const result = hash ? await cancelOrderTx(selectedNodeUrl, wallet, { orderTxHash: hash, fee })
        : await cancelOrderTargetTx(selectedNodeUrl, wallet, { cancelHeight: tmpCancelHeight!, cancelNonceId: tmpCancelNonceId!, fee });
      setStatus(`Cancellation submitted: ${result.txHash}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Cancellation failed"); }
    finally { setBusy(false); }
  };
  return <DefiNodeGate title="Cancel order"><div className="container">
    <Header title="Cancel order" />
    <p className="text-sm text-zinc-400 mb-4">Review the order before cancelling it. A cancellation is an on-chain transaction and costs a fee.</p>
    <p className="text-xs font-mono break-all mb-4">{hash || (valid ? `Pin height ${tmpCancelHeight}, nonce ${tmpCancelNonceId}` : "No order selected")}</p>
    <label className="defi-label">Fee (WART)<input className="defi-input" value={fee} onChange={(event) => setFee(event.target.value)} /></label>
    {hold && <p className="defi-hint">{hold}</p>}{error && <p className="defi-error">{error}</p>}{status && <p className="defi-success break-all">{status}</p>}
    {status ? <button className="defi-btn-primary" onClick={() => navigate("/activity")}>Back to activity</button> : <button className="defi-btn-primary" disabled={busy || !valid || Boolean(hold)} onClick={() => void submit()}>{busy ? "Submitting…" : "Confirm cancellation"}</button>}
  </div></DefiNodeGate>;
}
