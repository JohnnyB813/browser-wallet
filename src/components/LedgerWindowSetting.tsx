import { useEffect, useState } from "react";
import {
  readLedgerWindowMode,
  writeLedgerWindowMode,
  type LedgerWindowMode,
} from "../ledger/session";
import { openDockedWalletNow, openToolbarDropdownNow, warmDockWindow } from "../ledger/shell";
import { isFirefoxBrowser } from "../utils/browserName";
import { hasDockedPanel } from "../utils/extensionNav";

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
  const isFirefox = isFirefoxBrowser();
  // Chrome has a side panel, Firefox a sidebar. Elsewhere there is nowhere
  // to dock, so the choice is not offered. Firefox has no toolbar dropdown
  // either: its icon opens the sidebar, so there is nothing to choose.
  const canDock = hasDockedPanel();
  const dockedOnly = isFirefox && canDock;

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
        {dockedOnly
          ? "The wallet opens in the sidebar next to the page. The toolbar icon opens and closes it. The Nano connects there."
          : mode === "dropdown"
            ? "The toolbar icon opens the small menu. A tab opens while the Nano connects or signs, then the wallet returns to that menu."
            : isFirefox
              ? "The Nano connects in the sidebar next to the page. The toolbar icon still opens the small menu."
              : "The toolbar icon opens a panel docked on the side of the browser. The Nano connects there."}
      </p>
      <div
        className={`mt-2 grid gap-2 ${canDock && !dockedOnly ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {!dockedOnly && (
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
        )}
        {canDock && (
          <button
            type="button"
            onClick={() => choose("sidepanel")}
            className={`rounded-lg border px-3 py-2 text-sm ${
              mode === "sidepanel"
                ? "border-primary bg-primary/20 text-white"
                : "border-white/20 text-white/60"
            }`}
          >
            {isFirefox ? "Sidebar" : "Side panel"}
          </button>
        )}
      </div>
    </div>
  );
}
