import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import browser from "webextension-polyfill";
import { IoPersonOutline, IoGlobeOutline, IoKeyOutline } from "react-icons/io5";
import useWallet from "../hooks/useWallet";
import LedgerWindowSetting from "../components/LedgerWindowSetting";
import { getAutoLockMs, setAutoLockMinutes } from "../utils/signingBridge";
import { BRAND_COLOR_OPTIONS, DEFAULT_NUMBER_DISPLAY_PREFS, FUN_COLOR_OPTIONS, NUMBER_COLOR_OPTIONS, NUMBER_DISPLAY_MODES, detectMode, formatDisplayNumber, getBrandColorStyles, getColorHex, loadNumberDisplayPrefs, prefsForMode, saveNumberDisplayPrefs, type NumberColorId, type NumberDisplayMode, type NumberDisplayPrefs, type NumberNotation } from "../utils/numberDisplay";

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
    <NumberFormatSettings prefs={prefs} onChange={patch} />
    <h2 className="wallet-section-label">Hardware wallet</h2><LedgerWindowSetting />
    <h2 className="wallet-section-label">Connected sites</h2>
    {error && <p className="defi-error">{error}</p>}
    {!sites.length && !error && <p className="text-xs text-zinc-500">No connected sites</p>}
    {sites.map((site) => <div key={site.origin} className="defi-card"><p className="text-xs break-all">{site.origin}</p><p className="text-[10px] text-zinc-500 break-all mt-1">{site.accounts.join(", ")}</p><button className="defi-compact-btn mt-2" onClick={() => void revoke(site.origin)}>Disconnect</button></div>)}
  </div>;
}

const DECIMAL_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Full precision", value: null },
  { label: "0", value: 0 },
  { label: "2", value: 2 },
  { label: "4", value: 4 },
  { label: "6", value: 6 },
  { label: "8", value: 8 },
  { label: "10", value: 10 },
  { label: "12", value: 12 },
];

const SIG_FIG_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Off (use decimals)", value: null },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "8", value: 8 },
];

const NOTATION_OPTIONS: { label: string; value: NumberNotation }[] = [
  { label: "Standard (1,234.56)", value: "standard" },
  { label: "Compact (1.23M)", value: "compact" },
  { label: "Scientific (1.23e+6)", value: "scientific" },
];

const COLOR_ROWS: {
  key: "numberColor" | "balanceColor" | "limitOrderBuyColor" | "limitOrderSellColor" | "liquidityPoolColor";
  label: string;
  hint: string;
}[] = [
  { key: "numberColor", label: "Number color", hint: "Prices, limits, and general numbers" },
  { key: "balanceColor", label: "Balance color", hint: "Wallet balances, pool reserves, and LP share amounts" },
  { key: "limitOrderBuyColor", label: "Buy orders", hint: "Buy order badges, headers, and fill bars" },
  { key: "limitOrderSellColor", label: "Sell orders", hint: "Sell order badges, headers, and fill bars" },
  { key: "liquidityPoolColor", label: "Liquidity pool", hint: "Pool cards, LP positions, and reserve labels" },
];

const PREVIEW_SAMPLES: { label: string; value: number; balance: boolean }[] = [
  { label: "Large supply", value: 1000000000, balance: false },
  { label: "Pool reserve", value: 2456789.12345678, balance: true },
  { label: "Tiny price", value: 0.0000000342, balance: false },
  { label: "Limit price", value: 0.0001523, balance: false },
];

function ColorChoice({
  color,
  active,
  fallback,
  onPick,
}: {
  color: { id: NumberColorId; label: string; hex: string };
  active: boolean;
  fallback: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={`defi-compact-btn inline-flex items-center gap-1.5 ${active ? "defi-compact-btn-active" : ""}`}
      aria-pressed={active}
      onClick={onPick}
    >
      <span className="defi-swatch" style={{ background: color.hex, marginRight: 0 }} />
      {fallback ? "Default" : color.label}
    </button>
  );
}

function NumberFormatSettings({
  prefs,
  onChange,
}: {
  prefs: NumberDisplayPrefs;
  onChange: (patch: Partial<NumberDisplayPrefs>) => void;
}) {
  const mode = detectMode(prefs);
  const buy = getBrandColorStyles(prefs.limitOrderBuyColor);
  const sell = getBrandColorStyles(prefs.limitOrderSellColor);
  const pool = getBrandColorStyles(prefs.liquidityPoolColor);
  return (
    <details className="defi-card" open>
      <summary className="cursor-pointer text-sm">Number formatting and colors</summary>
      <label className="defi-label mt-3">Quick presets</label>
      <div className="defi-subtabs">
        {(Object.keys(NUMBER_DISPLAY_MODES) as NumberDisplayMode[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`defi-compact-btn ${mode === id ? "defi-compact-btn-active" : ""}`}
            aria-pressed={mode === id}
            onClick={() => onChange(prefsForMode(id))}
          >
            {NUMBER_DISPLAY_MODES[id].label}
          </button>
        ))}
      </div>
      <p className="defi-hint text-left mt-0 mb-2">
        {mode == null ? "Custom — manual tweaks differ from all presets." : NUMBER_DISPLAY_MODES[mode].description}
      </p>
      <label className="defi-label">Decimal places (max)</label>
      <div className="defi-subtabs">
        {DECIMAL_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`defi-compact-btn ${prefs.maxDecimals === option.value ? "defi-compact-btn-active" : ""}`}
            aria-pressed={prefs.maxDecimals === option.value}
            onClick={() => onChange({ maxDecimals: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="defi-label">Significant figures</label>
      <div className="defi-subtabs">
        {SIG_FIG_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`defi-compact-btn ${prefs.sigFigs === option.value ? "defi-compact-btn-active" : ""}`}
            aria-pressed={prefs.sigFigs === option.value}
            onClick={() => onChange({ sigFigs: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="defi-label">Notation</label>
      <div className="defi-subtabs">
        {NOTATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`defi-compact-btn ${prefs.notation === option.value ? "defi-compact-btn-active" : ""}`}
            aria-pressed={prefs.notation === option.value}
            onClick={() => onChange({ notation: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="defi-check-row" role="checkbox" aria-checked={prefs.useGrouping} tabIndex={0} onClick={() => onChange({ useGrouping: !prefs.useGrouping })} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onChange({ useGrouping: !prefs.useGrouping }); } }}>
        <span className={`defi-check ${prefs.useGrouping ? "defi-check-on" : ""}`} />
        Thousand separators
      </div>
      <div className="defi-check-row" role="checkbox" aria-checked={prefs.trimTrailingZeros} tabIndex={0} onClick={() => onChange({ trimTrailingZeros: !prefs.trimTrailingZeros })} onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); onChange({ trimTrailingZeros: !prefs.trimTrailingZeros }); } }}>
        <span className={`defi-check ${prefs.trimTrailingZeros ? "defi-check-on" : ""}`} />
        Trim trailing zeros
      </div>
      <div className="defi-card mt-2">
        <div className="defi-row" style={{ marginBottom: 8 }}>
          <span className="defi-label mb-0">Accent colors</span>
          <button
            type="button"
            className="defi-compact-btn"
            onClick={() => onChange({
              numberColor: DEFAULT_NUMBER_DISPLAY_PREFS.numberColor,
              balanceColor: DEFAULT_NUMBER_DISPLAY_PREFS.balanceColor,
              limitOrderBuyColor: DEFAULT_NUMBER_DISPLAY_PREFS.limitOrderBuyColor,
              limitOrderSellColor: DEFAULT_NUMBER_DISPLAY_PREFS.limitOrderSellColor,
              liquidityPoolColor: DEFAULT_NUMBER_DISPLAY_PREFS.liquidityPoolColor,
            })}
          >
            Color defaults
          </button>
        </div>
        {COLOR_ROWS.map((row) => {
          const current = NUMBER_COLOR_OPTIONS.find((color) => color.id === prefs[row.key]) ?? NUMBER_COLOR_OPTIONS[0];
          const currentName = current.id === DEFAULT_NUMBER_DISPLAY_PREFS[row.key] ? "Default" : current.label;
          return (
            <details key={row.key} className="color-drop">
              <summary>
                <span className="defi-swatch" style={{ background: current.hex, marginRight: 0 }} />
                <span className="color-drop-copy">
                  <strong>{row.label}</strong>
                  <small>{currentName}</small>
                </span>
              </summary>
              <div className="color-drop-body">
                <p className="defi-hint text-left mt-0 mb-2">{row.hint}</p>
                <div className="defi-subtabs">
                  {BRAND_COLOR_OPTIONS.map((color) => (
                    <ColorChoice
                      key={color.id}
                      color={color}
                      active={prefs[row.key] === color.id}
                      fallback={color.id === DEFAULT_NUMBER_DISPLAY_PREFS[row.key]}
                      onPick={() => onChange({ [row.key]: color.id })}
                    />
                  ))}
                </div>
                <p className="defi-hint text-left mt-1 mb-1">Fun colors</p>
                <div className="defi-subtabs">
                  {FUN_COLOR_OPTIONS.map((color) => (
                    <ColorChoice
                      key={color.id}
                      color={color}
                      active={prefs[row.key] === color.id}
                      fallback={false}
                      onPick={() => onChange({ [row.key]: color.id })}
                    />
                  ))}
                </div>
              </div>
            </details>
          );
        })}
        <div className="defi-btn-row">
          <span className="defi-order-badge" style={{ color: buy.text, background: buy.bgMuted }}>BUY</span>
          <span className="defi-order-badge" style={{ color: sell.text, background: sell.bgMuted }}>SELL</span>
          <span className="defi-order-badge" style={{ color: pool.text, background: pool.bgMuted }}>LP POOL</span>
        </div>
      </div>
      <div className="defi-card mt-2">
        <div className="defi-label">Preview</div>
        {PREVIEW_SAMPLES.map((sample) => (
          <div className="defi-row" key={sample.label}>
            <span className="defi-card-sub">{sample.label}</span>
            <span
              className="font-mono text-sm font-semibold"
              style={{ color: getColorHex(sample.balance ? prefs.balanceColor : prefs.numberColor) }}
            >
              {formatDisplayNumber(sample.value, prefs)}
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="defi-compact-btn mt-3" onClick={() => onChange(DEFAULT_NUMBER_DISPLAY_PREFS)}>Reset display</button>
    </details>
  );
}
