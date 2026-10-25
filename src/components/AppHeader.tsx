import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IoCopyOutline, IoLockClosedOutline, IoQrCodeOutline, IoSettingsOutline } from "react-icons/io5";
import Jazzicon from "react-jazzicon";
import useWallet from "../hooks/useWallet";
import { useChainAccounts } from "../chains/useChainAccounts";
import { addressToSeed } from "../utils";
import { toast } from "../utils/toast";
import type { WalletNetworkId } from "../config/walletNetworks";
import TickerMenu from "./TickerMenu";

export default function AppHeader() {
  const { wallet, nameList, walletList, selectedWalletIndex, switchActiveAccount, lockSession, activeNetwork } = useWallet();
  const { network, networks, setNetwork, address } = useChainAccounts();
  const networkItems = networks.reduce<{ id: string; label: string; symbol: string }[]>((items, item) => {
    if (item.chain === "wart") {
      if (!items.some((row) => row.id === "wart")) items.push({ id: "wart", label: "Warthog", symbol: item.symbol });
      return items;
    }
    items.push({ id: item.id, label: item.label, symbol: item.symbol });
    return items;
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const onSettings = location.pathname === "/settings";
  const [gearTurns, setGearTurns] = useState(0);
  const wasSettings = useRef(onSettings);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (wasSettings.current === onSettings) return;
    wasSettings.current = onSettings;
    setGearTurns((turns) => turns + 1);
  }, [onSettings]);
  const switchAccount = async (index: number) => {
    setBusy(true);
    try {
      await switchActiveAccount(index);
      navigate("/home");
    } catch (error) {
      toast.error("Account switch failed", error instanceof Error ? error.message : "Try again");
    } finally { setBusy(false); }
  };
  return (
    <header className="wallet-header">
      <div className="wallet-header-row">
        <Jazzicon diameter={30} seed={addressToSeed(wallet || "")} />
        <select aria-label="Account" value={selectedWalletIndex} disabled={busy} onChange={(event) => {
          if (event.target.value === "manage") navigate("/manage-account");
          else void switchAccount(Number(event.target.value));
        }} className="wallet-account-select">
          {walletList.map((item, index) => <option key={item} value={index}>{nameList[index] || `Account ${index}`}</option>)}
          <option value="manage">Manage accounts…</option>
        </select>
        <button className="wallet-icon-button" aria-label="Lock wallet" title="Lock wallet" onClick={() => void lockSession().then(() => navigate("/login-saved"))}><IoLockClosedOutline /></button>
        <button className="wallet-icon-button" aria-label={onSettings ? "Close settings" : "Settings"} title={onSettings ? "Close settings" : "Settings"} onClick={() => navigate(onSettings ? "/home" : "/settings")}><IoSettingsOutline className="wallet-gear" style={{ transform: `rotate(${gearTurns * 360}deg)` }} /></button>
      </div>
      <div className="wallet-header-row wallet-network-row">
        <TickerMenu
          className="ticker-menu--header"
          ariaLabel="Network"
          value={network.chain === "wart" ? "wart" : network.id}
          onChange={(id) => {
            const next = id === "wart"
              ? (activeNetwork === "defi-testnet" ? "wart-testnet" : "wart-mainnet")
              : id as WalletNetworkId;
            setNetwork(next);
            navigate("/home");
          }}
          items={networkItems}
        />
        <button className="wallet-address-copy" disabled={!address} title={address || "Loading address"} aria-label="Copy address" onClick={() => {
          void navigator.clipboard.writeText(address).then(() => toast.success("Address copied", network.label)).catch(() => toast.error("Copy failed", "Try again"));
        }}><span>{address ? `${address.slice(0, 5)}…${address.slice(-4)}` : "…"}</span><IoCopyOutline /></button>
        <button className="wallet-icon-button" aria-label="Receive, show QR code" title="Receive" onClick={() => navigate("/receive")}><IoQrCodeOutline /></button>
      </div>
    </header>
  );
}
