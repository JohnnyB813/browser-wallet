import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Buffer } from "buffer";
import "./index.css";
import App from "./App";
import { WalletProvider } from "./context/WalletContext";

window.Buffer = window.Buffer || Buffer;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MemoryRouter>
      <WalletProvider>
        <App />
      </WalletProvider>
    </MemoryRouter>
  </StrictMode>,
);
