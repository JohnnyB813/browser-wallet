import { useEffect, useState } from "react";
import {
  readLedgerWindowMode,
  writeLedgerWindowMode,
  type LedgerWindowMode,
} from "../ledger/session";
import { openDockedWalletNow, openToolbarDropdownNow, warmDockWindow } from "../ledger/shell";

/**
 * Public preference. Dropdown is the toolbar menu. Side panel is the
 * docked column on the edge of the browser.
 */
export default function LedgerWindowSetting({
  onChange,
}: {
  onChange?: (mode: LedgerWindowMode) => void;
}) {
  const [mode, setMode] = useState<LedgerWindowMode>("dropdown");

  useEffect(() => {
    warmDockWindow();
    let alive = true;
    void readLedgerWindowMode().then((next) => {
      if (!alive) return;
      setMode(next);
      onChange?.(next);
    });
    return () => {
      alive = false;
    };
  }, [onChange]);

  const choose = (next: LedgerWindowMode) => {
    setMode(next);
    onChange?.(next);
    if (next === "sidepanel") openDockedWalletNow();
    if (next === "dropdown") openToolbarDropdownNow();
    void writeLedgerWindowMode(next);
  };

  return (
    <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-3">
      <p className="text-white text-sm font-medium">Wallet window</p>
      <p className="text-white/45 text-xs mt-1 leading-relaxed">
        {mode === "dropdown"
          ? "The toolbar icon opens the small menu. A tab opens while the Nano connects or signs, then the wallet returns to that menu."
          : "The toolbar icon opens a panel docked on the side of the browser. The Nano connects there."}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose("dropdown")}
          className={`rounded-lg border px-3 py-2 text-sm ${
            mode === "dropdown"
              ? "border-primary bg-primary/20 text-white"
              : "border-white/20 text-white/60"
          }`}
        >
          Dropdown
        </button>
        <button
          type="button"
          onClick={() => choose("sidepanel")}
          className={`rounded-lg border px-3 py-2 text-sm ${
            mode === "sidepanel"
              ? "border-primary bg-primary/20 text-white"
              : "border-white/20 text-white/60"
          }`}
        >
          Side panel
        </button>
      </div>
    </div>
  );
}
