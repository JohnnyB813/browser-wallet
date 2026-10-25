export type BrowserChain = "wart" | "ethereum" | "bitcoin" | "hemi" | "solana";
export type WalletNetworkId = "wart-mainnet" | "wart-testnet" | "ethereum" | "bitcoin" | "hemi" | "solana";
export type Capability = "send" | "swap" | "orders" | "liquidity" | "createAsset" | "aave" | "safetrade";

export const WALLET_NETWORKS: { id: WalletNetworkId; chain: BrowserChain; label: string; symbol: string; capabilities: Capability[] }[] = [
  { id: "wart-mainnet", chain: "wart", label: "Warthog Mainnet", symbol: "WART", capabilities: ["send", "safetrade"] },
  { id: "wart-testnet", chain: "wart", label: "Warthog DeFi Testnet", symbol: "WART", capabilities: ["send", "swap", "orders", "liquidity", "createAsset"] },
  { id: "ethereum", chain: "ethereum", label: "Ethereum", symbol: "ETH", capabilities: ["send", "swap", "aave"] },
  { id: "bitcoin", chain: "bitcoin", label: "Bitcoin", symbol: "BTC", capabilities: ["send", "swap"] },
  { id: "hemi", chain: "hemi", label: "Hemi", symbol: "HEMI", capabilities: ["send", "swap"] },
  { id: "solana", chain: "solana", label: "Solana", symbol: "SOL", capabilities: ["send", "swap"] },
];
