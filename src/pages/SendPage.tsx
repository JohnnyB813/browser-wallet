import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Address, Wart, Funds, TokenDecimals, Liquidity } from "warthog-ts";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import { useChainAccounts } from "../chains/useChainAccounts";
import ChainSend from "./ChainSend";

export default function SendPage() {
  const { chain } = useChainAccounts();
  return chain === "wart" ? <WarthogSend /> : <ChainSend />;
}

function WarthogSend() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { activeNetwork, ledgerAccount, setTmpDestinationWalletState, setTmpWartAmountState, setTmpAssetHashState, setTmpTokenAmountState, setTmpPrecisionState, setTmpTransferTypeState } = useWallet();
  const defi = activeNetwork === "defi-testnet" && !ledgerAccount;
  const prefillHash = params.get("hash") || "";
  const [type, setType] = useState<"wart" | "token" | "liquidity">(defi && prefillHash ? "token" : "wart");
  const [to, setTo] = useState(params.get("address") || "");
  const [amount, setAmount] = useState("");
  const [hash, setHash] = useState(prefillHash);
  const initialDecimals = Number(params.get("decimals") ?? 8);
  const [decimals, setDecimals] = useState(Number.isInteger(initialDecimals) && initialDecimals >= 0 && initialDecimals <= 18 ? initialDecimals : 8);
  const [error, setError] = useState("");
  const submit = () => {
    try {
      if (!Address.validate(to.trim())) throw new Error("Enter a valid recipient address");
      if (type !== "wart" && !defi) throw new Error("Asset transfers require the DeFi testnet and a software wallet");
      if (type !== "wart" && !/^[a-f0-9]{64}$/i.test(hash.trim())) throw new Error("Enter a 64-character asset hash");
      const parsed = type === "wart" ? Wart.parse(amount) : type === "token" ? Funds.parse(amount, new TokenDecimals(decimals)) : Liquidity.parse(amount);
      if (!parsed || !/\d/.test(amount) || Number(amount) <= 0) throw new Error("Enter a positive amount with the correct precision");
      setTmpDestinationWalletState(to.trim());
      setTmpTransferTypeState(type);
      setTmpWartAmountState(amount);
      setTmpAssetHashState(hash.trim());
      setTmpTokenAmountState(amount);
      setTmpPrecisionState(decimals);
      navigate("/sendstep2");
    } catch (err) { setError(err instanceof Error ? err.message : "Invalid transfer"); }
  };
  return <div className="container">
    <Header title="Send" />
    <form onSubmit={(event) => { event.preventDefault(); submit(); }}>
      {defi && <label className="defi-label">Asset type<select className="defi-input" value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="wart">WART</option><option value="token">Token</option><option value="liquidity">Liquidity units</option></select></label>}
      {type !== "wart" && <label className="defi-label">Asset hash<input className="defi-input font-mono" value={hash} onChange={(event) => setHash(event.target.value)} placeholder="64-character asset hash" /></label>}
      <label className="defi-label">Recipient<input className="defi-input font-mono" value={to} onChange={(event) => setTo(event.target.value)} placeholder="Warthog public address" autoComplete="off" /></label>
      <label className="defi-label">Amount<input className="defi-input" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>
      {type === "token" && <label className="defi-label">Token decimals<select className="defi-input" value={decimals} onChange={(event) => setDecimals(Number(event.target.value))}>{Array.from({ length: 19 }, (_, n) => <option key={n}>{n}</option>)}</select></label>}
      {error && <p className="defi-error">{error}</p>}
      <button className="defi-btn-primary" disabled={!to || !amount}>Review transfer</button>
    </form>
  </div>;
}
