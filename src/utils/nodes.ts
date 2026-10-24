import {
  PRESET_NODES,
  type NodeGroups,
  type NodeNetwork,
  type NodeSelection,
  type WalletNode,
} from "../config/network";

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
 * The family a node URL belongs to.
 *
 * The family is a field on the record, so this looks the URL up in the list.
 * A URL that is not in the list is mainnet, which is the safe default:
 * the legacy node is the one that accepts a plain WART transfer.
 */
export function familyOfUrl(
  nodes: WalletNode[],
  url: string | null | undefined,
): NodeNetwork {
  const wanted = normalizeNodeUrl(url || "");
  if (!wanted) return "mainnet";
  const found = nodes.find((n) => normalizeNodeUrl(n.url) === wanted);
  return found?.network ?? "mainnet";
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
 * The other family.
 */
export function otherNetwork(network: NodeNetwork): NodeNetwork {
  return network === "mainnet" ? "defi-testnet" : "mainnet";
}

/**
 * The node a family should use.
 *
 * The remembered one if it is still in the list, otherwise the first node of
 * that family. Null when the family has no nodes at all.
 */
export function nodeForFamily(
  nodes: WalletNode[],
  family: NodeNetwork,
  selection: NodeSelection,
): WalletNode | null {
  const remembered = selection[family];
  if (remembered) {
    const wanted = normalizeNodeUrl(remembered);
    const found = nodes.find((n) => normalizeNodeUrl(n.url) === wanted);
    if (found && found.network === family) return found;
  }
  return nodes.find((n) => n.network === family) ?? null;
}

/**
 * The node each family should use, as a selection.
 *
 * Used to seed the pair when there is nothing remembered yet.
 */
export function defaultSelection(nodes: WalletNode[]): NodeSelection {
  const selection: NodeSelection = { mainnet: "", "defi-testnet": "" };
  for (const family of ["mainnet", "defi-testnet"] as NodeNetwork[]) {
    const node = nodes.find((n) => n.network === family);
    if (node) selection[family] = node.url;
  }
  return selection;
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
