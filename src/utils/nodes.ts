import { PRESET_NODES, type NodeGroups, type WalletNode } from "../config/network";

/** Normalize a node base URL from user input. */
export function normalizeNodeUrl(nodeBase: string | null | undefined): string {
  let normalized = String(nodeBase || "")
    .trim()
    .replace(/\/+$/, "");
  if (!normalized) return "";
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalized)) {
    normalized = `http://${normalized}`;
  }
  return normalized;
}

/**
 * True for a DeFi node.
 *
 * The family is on the node record, so this is a lookup and not a guess.
 */
export function isDefiNode(node: WalletNode | null | undefined): boolean {
  return node?.network === "defi-testnet";
}

export function networkLabel(
  node: WalletNode | null | undefined,
): "Mainnet" | "DeFi Testnet" {
  return isDefiNode(node) ? "DeFi Testnet" : "Mainnet";
}

/**
 * Group the nodes by family, the way they are stored.
 */
export function groupNodeRecords(nodes: WalletNode[]): NodeGroups {
  const groups: NodeGroups = { mainnet: [], "defi-testnet": [] };
  for (const node of nodes) {
    groups[node.network].push(node);
  }
  return groups;
}

/**
 * The flat list the picker shows: the mainnet nodes, then the DeFi ones.
 */
export function flattenNodeGroups(groups: NodeGroups): WalletNode[] {
  return [...groups.mainnet, ...groups["defi-testnet"]];
}

/**
 * Blocks a DeFi submit. Null means the action can be sent.
 * Home hides these screens until a DeFi testnet node is selected.
 */
export function defiSubmitHold(
  node: WalletNode | null | undefined,
  ledger: boolean,
): string | null {
  if (!node || !isDefiNode(node)) {
    return "Select a DeFi testnet node to submit.";
  }
  if (ledger) {
    return "This Nano signs WART sends on the DeFi testnet. Swap, liquidity, and mint need a software wallet.";
  }
  return null;
}

export function labelForNodeUrl(url: string): string {
  const preset = PRESET_NODES.find(
    (p) => normalizeNodeUrl(p.url) === normalizeNodeUrl(url),
  );
  if (preset) return preset.name;
  try {
    return new URL(normalizeNodeUrl(url)).host || url;
  } catch {
    return url;
  }
}
