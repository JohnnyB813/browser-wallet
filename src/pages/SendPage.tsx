import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Address, Wart, Funds, TokenDecimals, Liquidity } from "warthog-ts";
import Header from "../components/Header";
import TickerMenu from "../components/TickerMenu";
import useWallet from "../hooks/useWallet";
import { useChainAccounts } from "../chains/useChainAccounts";
import { loadWatched, type WatchedAsset } from "../utils/watchedAssets";
import ChainSend from "./ChainSend";

export default function SendPage() {
  const { chain } = useChainAccounts();
  return chain === "wart" ? <WarthogSend /> : <ChainSend />;
}

function WarthogSend() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { wallet, activeNetwork, ledgerAccount, setTmpDestinationWalletState, setTmpWartAmountState, setTmpAssetHashState, setTmpTokenAmountState, setTmpPrecisionState, setTmpTransferTypeState } = useWallet();
  const defi = activeNetwork === "defi-testnet" && !ledgerAccount;
  const prefillHash = params.get("hash") || "";
  const initialWatched = wallet ? loadWatched(wallet) : [];
  const [watched, setWatched] = useState<WatchedAsset[]>(initialWatched);
  const [type, setType] = useState<"wart" | "token" | "liquidity">(defi && prefillHash ? "token" : "wart");
  const [to, setTo] = useState(params.get("address") || "");
  const [amount, setAmount] = useState("");
  const [hash, setHash] = useState(prefillHash);
  const [custom, setCustom] = useState(Boolean(prefillHash) && !initialWatched.some((item) => item.hash.toLowerCase() === prefillHash.toLowerCase()));
  useEffect(() => { setWatched(wallet ? loadWatched(wallet) : []); }, [wallet]);
  useEffect(() => {
    if (!prefillHash) return;
    const known = watched.some((item) => item.hash.toLowerCase() === prefillHash.toLowerCase());
    if (known) setCustom(false);
  }, [watched, prefillHash]);
  const tracked = watched.find((item) => item.hash.toLowerCase() === hash.toLowerCase());
  const assetId = type === "wart" ? "wart" : type === "liquidity" ? "liquidity" : !custom && tracked ? tracked.hash : "custom";
  const pickAsset = (id: string) => {
    if (id === "wart") { setType("wart"); setCustom(false); return; }
    if (id === "liquidity") { setType("liquidity"); setCustom(true); return; }
    if (id === "custom") {
      setType("token");
      setCustom(true);
      if (tracked) setHash("");
      return;
    }
    setType("token");
    setCustom(false);
    setHash(id);
  };
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
      {defi && <div className="defi-label"><span>Asset</span><TickerMenu className="ticker-menu--field" ariaLabel="Asset" value={assetId} onChange={pickAsset} items={[
        { id: "wart", label: "WART", symbol: "WART", hint: "Native currency" },
        ...watched.map((item) => ({ id: item.hash, label: item.customName || "Asset", hash: item.hash, name: item.customName, hint: `${item.hash.slice(0, 8)}…${item.hash.slice(-4)}` })),
        { id: "custom", label: "Other token", symbol: "TOKEN", hint: "Paste an asset hash" },
        { id: "liquidity", label: "Liquidity units", symbol: "LP", hint: "Pool shares for an asset" },
      ]} /></div>}
      {type !== "wart" && (custom || type === "liquidity") && <label className="defi-label">Asset hash<input className="defi-input font-mono" value={hash} onChange={(event) => setHash(event.target.value)} placeholder="64-character asset hash" /></label>}
      <label className="defi-label">Recipient<input className="defi-input font-mono" value={to} onChange={(event) => setTo(event.target.value)} placeholder="Warthog public address" autoComplete="off" /></label>
      <label className="defi-label">Amount<input className="defi-input" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>
      {type === "token" && <label className="defi-label">Token decimals<select className="defi-input" value={decimals} onChange={(event) => setDecimals(Number(event.target.value))}>{Array.from({ length: 19 }, (_, n) => <option key={n}>{n}</option>)}</select></label>}
      {error && <p className="defi-error">{error}</p>}
      <button className="defi-btn-primary" disabled={!to || !amount}>Review transfer</button>
    </form>
  </div>;
}
