import { useNavigate } from "react-router-dom";
import { IoSwapHorizontalOutline, IoWaterOutline, IoAddCircleOutline, IoBusinessOutline, IoLayersOutline } from "react-icons/io5";
import { useChainAccounts } from "../chains/useChainAccounts";
import type { Capability } from "../config/walletNetworks";

const actions: { capability: Capability; title: string; description: string; path: string; icon: typeof IoWaterOutline }[] = [
  { capability: "swap", title: "Swap", description: "Market and limit orders", path: "/swap", icon: IoSwapHorizontalOutline },
  { capability: "liquidity", title: "Liquidity", description: "Add, remove and manage pool positions", path: "/liquidity", icon: IoWaterOutline },
  { capability: "createAsset", title: "Create asset", description: "Issue a new asset on the DeFi testnet", path: "/create-token", icon: IoAddCircleOutline },
  { capability: "aave", title: "Aave", description: "Supply, borrow, repay and withdraw on Ethereum", path: "/aave", icon: IoLayersOutline },
  { capability: "safetrade", title: "SafeTrade", description: "Centralized exchange. Requires a SafeTrade account and API key", path: "/safetrade", icon: IoBusinessOutline },
];

export default function Trade() {
  const { network, chain } = useChainAccounts();
  const navigate = useNavigate();
  const supported = actions.filter((item) => network.capabilities.includes(item.capability));
  return <div className="container">
    <h1 className="wallet-page-title">Trade</h1>
    {supported.filter((item) => item.capability !== "aave" && item.capability !== "safetrade").map(({ title, description, path, icon: Icon, capability }) =>
      <button key={path} className="wallet-menu-card" onClick={() => navigate(path)}><Icon /><span><strong>{title}</strong><small>{capability === "swap" && chain !== "wart" ? "Swap, bridge and cross-chain routes" : description}</small></span></button>)}
    {supported.some((item) => item.capability === "aave" || item.capability === "safetrade") && <>
      <h2 className="wallet-section-label">Integrations</h2>
      {supported.filter((item) => item.capability === "aave" || item.capability === "safetrade").map(({ title, description, path, icon: Icon }) =>
        <button key={path} className="wallet-menu-card" onClick={() => navigate(path)}><Icon /><span><strong>{title}</strong><small>{description}</small></span></button>)}
    </>}
    {chain === "wart" && network.id === "wart-mainnet" && <p className="text-xs text-zinc-500 mt-4">Native swaps, liquidity and asset creation are available on Warthog DeFi Testnet. Choose it in the network selector above.</p>}
  </div>;
}
