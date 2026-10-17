import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Buffer } from "buffer";
import "./index.css";
import "./styles/defi.css";
import App from "./App";
import { WalletProvider } from "./context/WalletContext";
import { warmDockWindow } from "./ledger/shell";
import {
  applyExtensionShellClass,
  isCompactShellPreferred,
  isHelperTab,
  markHelperTab,
} from "./utils/extensionNav";

// HashRouter so extension tabs can open deep links (e.g. index.html#/login-file).
// File pickers must not run inside the action popup — it closes when the OS
// dialog steals focus. After file login we switch this tab to a compact
// popup-sized shell (see switchToLoggedInPopupShell).

if (isHelperTab()) {
  markHelperTab();
}
warmDockWindow();
// Already logged-in compact shell (file-login success) OR real popup OR full helper tab
applyExtensionShellClass(isCompactShellPreferred());

window.Buffer = window.Buffer || Buffer;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </HashRouter>
  </StrictMode>,
);
