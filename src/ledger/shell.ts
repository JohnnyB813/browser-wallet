/**
 * The toolbar dropdown closes as soon as Brave's device list takes focus.
 * Brave on Wayland also hides that list behind a small popup, so Ledger
 * connect and sign run in a normal browser tab. The wallet then returns to
 * the dropdown unless the user chose to stay in that tab.
 */
import browser from "webextension-polyfill";
import {
  armLedgerPopup,
  clearLedgerHandoff,
  markLedgerHandoff,
  readLedgerWindowMode,
  setLedgerPanelRoute,
} from "./session";
import { askBackgroundToReopenToolbar } from "../utils/passkeyHandoff";

const SHELL_KEY = "warthogLedgerShell";

let dockWindowId: number | null = null;

type SidePanelApi = {
  open?: (details: { windowId: number }) => Promise<void>;
};

function sidePanelApi(): SidePanelApi | undefined {
  return (globalThis as { chrome?: { sidePanel?: SidePanelApi } }).chrome?.sidePanel;
}

/** Remember this browser window so a click can dock the panel immediately. */
export function warmDockWindow(): void {
  void browser.windows
    .getCurrent()
    .then((current) => {
      if (typeof current?.id === "number") dockWindowId = current.id;
    })
    .catch(() => {
      /* ignore */
    });
}

/** Open the docked panel during the click, before any await. */
export function openDockedWalletNow(): void {
  const open = sidePanelApi()?.open;
  if (!open || dockWindowId == null) return;
  void open({ windowId: dockWindowId });
}

/**
 * Switch to the toolbar dropdown. openPopup from this side-panel document
 * resolves with no menu, and waiting for it then window.close() only
 * dismisses the panel. The service worker opens the menu after this
 * document is gone.
 */
export function openToolbarDropdownNow(): void {
  const inPanel = isExtensionSidePanel();
  void browser.runtime.sendMessage({ action: "showToolbarDropdown" }).catch((err) => {
    console.warn("[warthog] dropdown message failed", err);
  });
  if (!inPanel) return;
  // Let the message leave, then close. Waiting for the worker keeps this
  // panel up until the menu opens, and that close can dismiss the menu.
  setTimeout(() => {
    try {
      window.close();
    } catch {
      /* already closing */
    }
  }, 0);
}

/**
 * Dock the wallet. The first await is sidePanel.open so the click still counts.
 * hashPath is consumed by the panel once it is open.
 */
export async function openLedgerInSidePanel(hashPath: string): Promise<boolean> {
  const open = sidePanelApi()?.open;
  if (!open || dockWindowId == null) return false;
  try {
    await open({ windowId: dockWindowId });
  } catch (err) {
    console.warn("[warthog] side panel open failed", err);
    return false;
  }
  await setLedgerPanelRoute(hashPath);
  return true;
}

export function sidePanelHomeUrl(): string {
  return `${browser.runtime.getURL("index.html")}?sidepanel=1#/home`;
}

export function markLedgerShell(): void {
  try {
    sessionStorage.setItem(SHELL_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** The wallet page Brave docks beside the browser. It stays up while the device list is open. */
export function isExtensionSidePanel(): boolean {
  try {
    return new URLSearchParams(location.search).get("sidepanel") === "1";
  } catch {
    return false;
  }
}

/** True only for the toolbar dropdown. The Ledger window and passkey window are not this. */
export function isToolbarActionPopup(): boolean {
  try {
    if (/ledger-host|passkey-host/.test(location.hash || "")) return false;
    if (sessionStorage.getItem(SHELL_KEY) === "1") return false;
  } catch {
    return false;
  }
  try {
    const chromeApi = (
      globalThis as {
        chrome?: {
          extension?: { getViews?: (opts: { type: string }) => Window[] };
        };
      }
    ).chrome;
    const views = chromeApi?.extension?.getViews?.({ type: "popup" });
    return Boolean(views && views.includes(window));
  } catch {
    return false;
  }
}

/**
 * After the Nano approves the address, close this tab and open the toolbar
 * dropdown. Same service-worker path passkey login uses.
 */
export async function returnLedgerToToolbar(): Promise<boolean> {
  try {
    await armLedgerPopup();
    await clearLedgerHandoff();
    const current = await browser.windows.getCurrent();
    await askBackgroundToReopenToolbar(current?.id);
    const tab = await browser.tabs.getCurrent();
    if (tab?.id != null) {
      await browser.tabs.remove(tab.id);
    } else {
      window.close();
    }
    return true;
  } catch (err) {
    console.warn("[warthog] could not return Ledger login to the toolbar", err);
    return false;
  }
}

/**
 * Device step is finished. Dropdown mode closes this tab and opens the toolbar.
 * Side-panel mode reloads the docked panel. A full load can reach the node;
 * staying on the page that just talked to the Nano cannot.
 */
export async function finishLedgerDeviceStep(stayInPage: () => void): Promise<void> {
  const mode = await readLedgerWindowMode();
  if (mode === "sidepanel") {
    if (isExtensionSidePanel()) {
      location.replace(sidePanelHomeUrl());
      return;
    }
    const opened = await openLedgerInSidePanel("/home");
    if (opened) {
      try {
        const tab = await browser.tabs.getCurrent();
        if (tab?.id != null) await browser.tabs.remove(tab.id);
      } catch {
        /* the panel has no tab to close */
      }
      return;
    }
    location.replace(`${browser.runtime.getURL("index.html")}#/home`);
    return;
  }
  const returned = await returnLedgerToToolbar();
  if (!returned) stayInPage();
}

export async function openLedgerHost(query = ""): Promise<void> {
  if (isToolbarActionPopup()) {
    await markLedgerHandoff();
  }
  const path = query ? `/ledger-host?${query}` : "/ledger-host";
  const url = `${browser.runtime.getURL("index.html")}#${path}`;
  await browser.tabs.create({ url, active: true });
}
