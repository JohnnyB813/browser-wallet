import { useState } from "react";
import { IoDiamond } from "react-icons/io5";
import Header from "../components/Header";
import DefiNodeGate from "../components/DefiNodeGate";
import SpendConfirm from "../components/SpendConfirm";
import useWallet from "../hooks/useWallet";
import { createAssetTx } from "../utils/defiClient";
import { DEFAULT_TX_FEE } from "../config/network";
import { defiSubmitHold } from "../utils/nodes";

export default function CreateAsset() {
  const { wallet, selectedNodeUrl, selectedNode, ledgerAccount } = useWallet();
  const [name, setName] = useState("");
  const [supply, setSupply] = useState("");
  const [decimals, setDecimals] = useState(8);
  const [fee, setFee] = useState(DEFAULT_TX_FEE);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const hold = defiSubmitHold(selectedNode, Boolean(ledgerAccount));
  const submit = async () => {
    if (!wallet || !selectedNodeUrl || hold) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const result = await createAssetTx(selectedNodeUrl, wallet, { name, supply, decimals, fee });
      setStatus(`Asset creation submitted: ${result.txHash}`); setConfirm(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Creation failed"); setConfirm(false); }
    finally { setBusy(false); }
  };
  return <DefiNodeGate title="Create asset"><div className="container">
    <Header title="Mint" />
    <div className="wallet-feature-card">
      <IoDiamond />
      <div>
        <strong>Mint</strong>
        <small>Issue a new asset on the DeFi testnet. The name is one to five characters, then you set the supply.</small>
      </div>
    </div>
    <label className="defi-label">Name (1 to 5 characters)<input className="defi-input" maxLength={5} value={name} onChange={(event) => setName(event.target.value.toUpperCase())} /></label>
    <label className="defi-label">Total supply<input className="defi-input" inputMode="decimal" value={supply} onChange={(event) => setSupply(event.target.value)} /></label>
    <label className="defi-label">Decimals<select className="defi-input" value={decimals} onChange={(event) => setDecimals(Number(event.target.value))}>{Array.from({ length: 19 }, (_, i) => <option key={i}>{i}</option>)}</select></label>
    <label className="defi-label">Fee (WART)<input className="defi-input" inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} /></label>
    {hold && <p className="defi-hint">{hold}</p>}{error && <p className="defi-error">{error}</p>}{status && <p className="defi-success break-all">{status}</p>}
    <button className="defi-btn-primary" disabled={busy || Boolean(hold) || !name || !supply} onClick={() => setConfirm(true)}>Review asset creation</button>
    <SpendConfirm open={confirm} title="Create asset" rows={[{ label: "Name", value: name }, { label: "Supply", value: supply }, { label: "Decimals", value: String(decimals) }, { label: "Fee", value: `${fee} WART` }]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void submit()} />
  </div></DefiNodeGate>;
}
