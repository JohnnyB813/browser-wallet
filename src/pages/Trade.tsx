import { useNavigate } from "react-router-dom";
import { IoSwapHorizontalOutline, IoBusinessOutline, IoLayersOutline } from "react-icons/io5";
import { useChainAccounts } from "../chains/useChainAccounts";
import type { Capability } from "../config/walletNetworks";

const actions: { capability: Capability; title: string; description: string; path: string; icon: typeof IoBusinessOutline }[] = [
  { capability: "swap", title: "Swap", description: "Market and limit orders", path: "/swap", icon: IoSwapHorizontalOutline },
  { capability: "safetrade", title: "SafeTrade", description: "Centralized exchange. Requires a SafeTrade account and API key", path: "/safetrade", icon: IoBusinessOutline },
  { capability: "aave", title: "Aave", description: "Supply, borrow, repay and withdraw on Ethereum", path: "/aave", icon: IoLayersOutline },
];

export default function Trade() {
  const { network, chain } = useChainAccounts();
  const navigate = useNavigate();
  const supported = actions.filter((item) => item.capability === "safetrade" || network.capabilities.includes(item.capability));
  const primary = supported.filter((item) => item.capability !== "aave");
  const aave = supported.filter((item) => item.capability === "aave");
  return <div className="container">
    <h1 className="wallet-page-title">Trade</h1>
    {primary.map(({ title, description, path, icon: Icon, capability }) =>
      <button key={path} className="wallet-menu-card" onClick={() => navigate(path)}><Icon /><span><strong>{title}</strong><small>{capability === "swap" && chain !== "wart" ? "Swap, bridge and cross-chain routes" : description}</small></span></button>)}
    {aave.length > 0 && <>
      <h2 className="wallet-section-label">Integrations</h2>
      {aave.map(({ title, description, path, icon: Icon }) =>
        <button key={path} className="wallet-menu-card" onClick={() => navigate(path)}><Icon /><span><strong>{title}</strong><small>{description}</small></span></button>)}
    </>}
    {chain === "wart" && network.id === "wart-mainnet" && <p className="text-xs text-zinc-500 mt-4">Native swap is on the DeFi testnet. Switch with the badge on the Warthog card.</p>}
  </div>;
}
