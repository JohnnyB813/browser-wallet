import { explorerBaseUrl } from "./config/nodes";

const explorerFromEnv = import.meta.env.VITE_APP_EXPLORER_URL;
/** Warthog explorer. `VITE_APP_EXPLORER_URL` overrides the built-in wartscan host. */
export const EXPLORER_URL =
  (explorerFromEnv && String(explorerFromEnv).trim()) || explorerBaseUrl;