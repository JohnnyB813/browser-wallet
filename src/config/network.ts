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

/**
 * Which family a node belongs to.
 *
 * The two are separate APIs, not one API with a mode: the legacy node
 * (core/master) answers `/chain/head` flat and reads a transfer's amount
 * from `amountE8`, the DeFi node (core/defi) nests the chain head under
 * `chainHead` and reads the amount from `wartE8`.
 */
export type NodeNetwork = "mainnet" | "defi-testnet";

/**
 * A node the wallet can talk to.
 *
 * The family is part of the record, so nothing has to infer it from the URL.
 */
export type WalletNode = {
  url: string;
  name: string;
  network: NodeNetwork;
};

/** The wallet's nodes, kept apart by family. */
export type NodeGroups = Record<NodeNetwork, WalletNode[]>;

/** Built-in nodes shown in the selector (mainnet + DeFi testnet). */
export const PRESET_NODES: WalletNode[] = [
  { url: MAINNET_OFFICIAL_URL, name: "Official Mainnet", network: "mainnet" },
  { url: DEFI_TESTNET_URL, name: "DeFi Testnet (Official)", network: "defi-testnet" },
  { url: "http://104.251.219.14:3001", name: "DeFi Testnet 2", network: "defi-testnet" },
  { url: "http://65.87.7.86:3002", name: "DeFi Testnet 1", network: "defi-testnet" },
  { url: "http://85.56.145.106:3001", name: "DeFi Testnet 3", network: "defi-testnet" },
  { url: "http://209.127.34.202:3001", name: "DeFi Testnet 4", network: "defi-testnet" },
];

/** Preferred default selection index (Official Mainnet). */
export const DEFAULT_NODE_INDEX = 0;

/** Default fee preference (WART). Node min fee may raise this. */
export const DEFAULT_TX_FEE = "0.01";
