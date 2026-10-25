import { NavLink, Outlet, useLocation } from "react-router-dom";
import { IoWalletOutline, IoSwapHorizontalOutline, IoTimeOutline, IoSettingsOutline } from "react-icons/io5";
import useWallet from "../hooks/useWallet";
import { useChainAccounts } from "../chains/useChainAccounts";
import AppHeader from "./AppHeader";
import type { Capability } from "../config/walletNetworks";

const tabs = [
  { to: "/home", label: "Wallet", icon: IoWalletOutline },
  { to: "/trade", label: "Trade", icon: IoSwapHorizontalOutline },
  { to: "/activity", label: "Activity", icon: IoTimeOutline },
  { to: "/settings", label: "Settings", icon: IoSettingsOutline },
];

export default function WalletLayout() {
  const { selectedWalletIndex, tmpTransferType } = useWallet();
  const { network, chain } = useChainAccounts();
  const location = useLocation();
  const category = /^\/(trade|swap|liquidity|create-token|aave|safetrade)/.test(location.pathname) ? "/trade"
    : /^\/(activity|cancel-order)/.test(location.pathname) ? "/activity"
    : /^\/(settings|account-details|private-key|recovery-phrase|select-node|mainnet-nodes|manage-account)/.test(location.pathname) ? "/settings" : "/home";
  // SafeTrade lists every market itself, so the wallet network does not hide it.
  const required: Record<string, Capability> = { "/swap": "swap", "/liquidity": "liquidity", "/create-token": "createAsset", "/aave": "aave", "/cancel-order-step2": "orders" };
  const capability = required[location.pathname];
  const unsupported = (capability && !network.capabilities.includes(capability))
    || (location.pathname === "/sendstep2" && (chain !== "wart" || (tmpTransferType !== "wart" && network.id !== "wart-testnet")))
    || (location.pathname === "/chain-send" && chain === "wart")
    || (location.pathname === "/activity-details" && chain !== "wart");
  return (
    <div className="wallet-shell">
      <AppHeader />
      <main className="wallet-content" key={`${selectedWalletIndex}:${network.id}`}>
        {unsupported ? <div className="container"><h1 className="wallet-page-title">Unavailable on {network.label}</h1><p className="text-sm text-zinc-400">Choose a supported network in the selector above to use this feature.</p></div> : <Outlet />}
      </main>
      <nav className="wallet-bottom-nav" aria-label="Main navigation">
        {tabs.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={`wallet-nav-item ${category === to ? "wallet-nav-active" : ""}`}><Icon /><span>{label}</span></NavLink>)}
      </nav>
    </div>
  );
}
