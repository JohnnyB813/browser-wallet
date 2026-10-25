import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoCopyOutline, IoLockClosedOutline, IoQrCodeOutline, IoSettingsOutline } from "react-icons/io5";
import Jazzicon from "react-jazzicon";
import useWallet from "../hooks/useWallet";
import { useChainAccounts } from "../chains/useChainAccounts";
import { addressToSeed } from "../utils";
import { toast } from "../utils/toast";
import type { WalletNetworkId } from "../config/walletNetworks";

export default function AppHeader() {
  const { wallet, nameList, walletList, selectedWalletIndex, switchActiveAccount, lockSession } = useWallet();
  const { network, networks, setNetwork, address } = useChainAccounts();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
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
        <button className="wallet-icon-button" aria-label="Settings" title="Settings" onClick={() => navigate("/settings")}><IoSettingsOutline /></button>
      </div>
      <div className="wallet-header-row wallet-network-row">
        <select className="wallet-network-select" aria-label="Network" value={network.id} onChange={(event) => {
          setNetwork(event.target.value as WalletNetworkId);
          navigate("/home");
        }}>
          {networks.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <button className="wallet-address-copy" disabled={!address} title={address || "Loading address"} aria-label="Copy address" onClick={() => {
          void navigator.clipboard.writeText(address).then(() => toast.success("Address copied", network.label)).catch(() => toast.error("Copy failed", "Try again"));
        }}><span>{address ? `${address.slice(0, 5)}…${address.slice(-4)}` : "…"}</span><IoCopyOutline /></button>
        <button className="wallet-icon-button" aria-label="Receive, show QR code" title="Receive" onClick={() => navigate("/receive")}><IoQrCodeOutline /></button>
      </div>
    </header>
  );
}
