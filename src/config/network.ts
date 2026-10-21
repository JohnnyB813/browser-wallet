import { explorerBaseUrl } from "./nodes";

/** Official mainnet node (same as website webwallet). */
export const MAINNET_OFFICIAL_URL = "https://warthognode.duckdns.org";

/** Wartnode mainnet. Same chain as the official mainnet. */
export const WARTNODE_MAINNET_URL = "https://mainnet.wartnode.com";

/** Official Warthog DeFi testnet (same as wartbunker). */
export const DEFI_TESTNET_URL = "https://warthog-defitestnet.duckdns.org";

/** Wartnode testnet. Same chain as the DeFi testnet. */
export const WARTNODE_TESTNET_URL = "https://testnet.wartnode.com";

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

/** Built-in nodes. Same four the mobile wallet ships. */
export const PRESET_NODES: WalletNode[] = [
  { url: MAINNET_OFFICIAL_URL, name: "Mainnet", network: "mainnet" },
  { url: WARTNODE_MAINNET_URL, name: "Wartnode Mainnet", network: "mainnet" },
  { url: DEFI_TESTNET_URL, name: "DeFi Testnet", network: "defi-testnet" },
  { url: WARTNODE_TESTNET_URL, name: "Wartnode Testnet", network: "defi-testnet" },
];

/** Preferred default selection index (Official Mainnet). */
export const DEFAULT_NODE_INDEX = 0;

/** Default fee preference (WART). Node min fee may raise this. */
export const DEFAULT_TX_FEE = "0.01";
