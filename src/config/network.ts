import { explorerBaseUrl } from "./nodes";

/** Official mainnet node (same as website webwallet). */
export const MAINNET_OFFICIAL_URL = "https://warthognode.duckdns.org";

/** Official Warthog DeFi testnet (same as wartbunker). */
export const DEFI_TESTNET_URL = "https://warthog-defitestnet.duckdns.org";

export const WARTHOG_NETWORK = {
  chainId: 1337,
  name: "Warthog Network",
  rpcUrl: MAINNET_OFFICIAL_URL,
  currency: {
    name: "Warthog",
    symbol: "WART",
    decimals: 8,
  },
  explorer: explorerBaseUrl,
} as const;

export const NETWORKS = {
  WARTHOG: WARTHOG_NETWORK,
} as const;

export type PresetNode = {
  url: string;
  name: string;
  network: "mainnet" | "defi-testnet";
};

/**
 * Built-in nodes. Same pair the mobile wallet ships in WARTHOG_NODES:
 * mainnet, then the DeFi testnet. Anything else is a node the user saved.
 */
export const PRESET_NODES: PresetNode[] = [
  { url: MAINNET_OFFICIAL_URL, name: "Mainnet", network: "mainnet" },
  { url: DEFI_TESTNET_URL, name: "DeFi Testnet", network: "defi-testnet" },
];

export const DEFAULT_NODE_LIST = PRESET_NODES.map((n) => n.url);
export const DEFAULT_NODE_NAME_LIST = PRESET_NODES.map((n) => n.name);

/** Preferred default selection index (Official Mainnet). */
export const DEFAULT_NODE_INDEX = 0;

/** Default fee preference (WART). Node min fee may raise this. */
export const DEFAULT_TX_FEE = "0.01";
