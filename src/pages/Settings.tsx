import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import browser from "webextension-polyfill";
import { IoPersonOutline, IoGlobeOutline, IoKeyOutline } from "react-icons/io5";
import useWallet from "../hooks/useWallet";
import LedgerWindowSetting from "../components/LedgerWindowSetting";
import { getAutoLockMs, setAutoLockMinutes } from "../utils/signingBridge";
import { DEFAULT_NUMBER_DISPLAY_PREFS, NUMBER_DISPLAY_MODES, NUMBER_COLOR_OPTIONS, formatDisplayNumber, loadNumberDisplayPrefs, prefsForMode, saveNumberDisplayPrefs, type NumberDisplayMode, type NumberDisplayPrefs, type NumberNotation, type NumberColorId } from "../utils/numberDisplay";

type Connection = { origin: string; accounts: string[] };
export default function Settings() {
  const navigate = useNavigate();
  const { name, canAddAccounts, ledgerAccount } = useWallet();
  const [prefs, setPrefs] = useState(loadNumberDisplayPrefs);
  const [lockMinutes, setLockMinutes] = useState(getAutoLockMs() / 60000);
  const [sites, setSites] = useState<Connection[]>([]);
  const [error, setError] = useState("");
  const patch = (value: Partial<NumberDisplayPrefs>) => setPrefs(saveNumberDisplayPrefs({ ...prefs, ...value }));
  useEffect(() => {
    void browser.runtime.sendMessage({ action: "walletListConnections" }).then((data: unknown) => {
      if (!Array.isArray(data)) throw new Error("Invalid connections response");
      setSites(data as Connection[]);
    }).catch(() => setError("Could not load connected sites"));
  }, []);
  const revoke = async (origin: string) => {
    try {
      await browser.runtime.sendMessage({ action: "walletRevokeConnection", origin });
      setSites((previous) => previous.filter((site) => site.origin !== origin));
    } catch { setError("Could not revoke this connection"); }
  };
  return <div className="container">
    <h1 className="wallet-page-title">Settings</h1>
    <h2 className="wallet-section-label">Account and security</h2>
    <button className="wallet-menu-card" onClick={() => navigate("/account-details")}><IoPersonOutline /><span><strong>{name || "Account"}</strong><small>Rename, encrypted backup, passkey and 2FA</small></span></button>
    <button className="wallet-menu-card" onClick={() => navigate("/manage-account")}><IoPersonOutline /><span><strong>Manage accounts</strong><small>Add and switch accounts</small></span></button>
    {!ledgerAccount && <button className="wallet-menu-card" onClick={() => navigate("/private-key")}><IoKeyOutline /><span><strong>Warthog private key</strong><small>Reveal the selected account's Warthog key</small></span></button>}
    {canAddAccounts && <button className="wallet-menu-card" onClick={() => navigate("/recovery-phrase")}><IoKeyOutline /><span><strong>Recovery phrase</strong><small>Back up all accounts and networks. Keep it secret.</small></span></button>}
    <label className="defi-label mt-4">Auto-lock after inactivity
      <select className="defi-input mt-2" value={lockMinutes} onChange={(event) => { const minutes = Number(event.target.value); setAutoLockMinutes(minutes); setLockMinutes(minutes); }}>
        {[1, 5, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
      </select>
    </label>
    <h2 className="wallet-section-label">Networks</h2>
    <button className="wallet-menu-card" onClick={() => navigate("/select-node")}><IoGlobeOutline /><span><strong>Warthog nodes</strong><small>RPC endpoints for Mainnet and DeFi Testnet</small></span></button>
    <h2 className="wallet-section-label">Display</h2>
    <details className="defi-card"><summary className="cursor-pointer text-sm">Number formatting and colors</summary>
      <div className="defi-btn-row mt-3">{(Object.keys(NUMBER_DISPLAY_MODES) as NumberDisplayMode[]).map((mode) => <button key={mode} className="defi-compact-btn" onClick={() => patch(prefsForMode(mode))}>{NUMBER_DISPLAY_MODES[mode].label}</button>)}</div>
      <label className="defi-label mt-3">Maximum decimals<select className="defi-input" value={prefs.maxDecimals ?? "full"} onChange={(event) => patch({ maxDecimals: event.target.value === "full" ? null : Number(event.target.value) })}><option value="full">Full precision</option>{[0, 2, 4, 6, 8, 10, 12].map((n) => <option key={n}>{n}</option>)}</select></label>
      <label className="defi-label">Significant figures<select className="defi-input" value={prefs.sigFigs ?? "off"} onChange={(event) => patch({ sigFigs: event.target.value === "off" ? null : Number(event.target.value) })}><option value="off">Off</option>{[2, 3, 4, 5, 6, 8].map((n) => <option key={n}>{n}</option>)}</select></label>
      <label className="defi-label">Notation<select className="defi-input" value={prefs.notation} onChange={(event) => patch({ notation: event.target.value as NumberNotation })}>{["standard", "compact", "scientific"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="flex gap-2 text-xs mb-3"><input type="checkbox" checked={prefs.useGrouping} onChange={(event) => patch({ useGrouping: event.target.checked })} />Thousand separators</label>
      <label className="flex gap-2 text-xs mb-3"><input type="checkbox" checked={prefs.trimTrailingZeros} onChange={(event) => patch({ trimTrailingZeros: event.target.checked })} />Trim trailing zeros</label>
      {([ ["numberColor", "Numbers"], ["balanceColor", "Balances"], ["limitOrderBuyColor", "Buy orders"], ["limitOrderSellColor", "Sell orders"], ["liquidityPoolColor", "Liquidity pools"] ] as const).map(([key, label]) => <label key={key} className="defi-label">{label}<select className="defi-input" value={prefs[key]} onChange={(event) => patch({ [key]: event.target.value as NumberColorId })}>{NUMBER_COLOR_OPTIONS.map((color) => <option key={color.id} value={color.id}>{color.label}</option>)}</select></label>)}
      <p className="text-xs font-mono my-3">Preview: {formatDisplayNumber("2456789.12345678", prefs)}</p>
      <button className="defi-compact-btn" onClick={() => patch(DEFAULT_NUMBER_DISPLAY_PREFS)}>Reset display</button>
    </details>
    <h2 className="wallet-section-label">Hardware wallet</h2><LedgerWindowSetting />
    <h2 className="wallet-section-label">Connected sites</h2>
    {error && <p className="defi-error">{error}</p>}
    {!sites.length && !error && <p className="text-xs text-zinc-500">No connected sites</p>}
    {sites.map((site) => <div key={site.origin} className="defi-card"><p className="text-xs break-all">{site.origin}</p><p className="text-[10px] text-zinc-500 break-all mt-1">{site.accounts.join(", ")}</p><button className="defi-compact-btn mt-2" onClick={() => void revoke(site.origin)}>Disconnect</button></div>)}
  </div>;
}
