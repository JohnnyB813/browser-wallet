/**
 * The public node list.
 *
 * The `public-data` repo holds the community node lists and publishes them
 * as JSON at `data.warthog.network`. It is the canonical source: one file
 * for the mainnet nodes and one for the DeFi testnet nodes.
 *
 * The list only ever adds. A node the wallet already has keeps the name it
 * has, because the wallet's own names are the ones the user reads, and the
 * public list names the same node differently (it names the operator, the
 * wallet names the chain).
 */
import {
  type NodeNetwork,
  type WalletNode,
} from "../config/network";
import { labelForNodeUrl, normalizeNodeUrl } from "./nodes";

const PUBLIC_DATA_BASE = "https://data.warthog.network";

/** Which file holds the nodes of which family. */
const SOURCE_FOR_FAMILY: Record<NodeNetwork, string> = {
  mainnet: "/legacy-nodes.json",
  "defi-testnet": "/defi-nodes.json",
};

const FETCH_TIMEOUT_MS = 8_000;

/**
 * Fetch the public node list of a family.
 *
 * The family comes from the file, not from the URL: a node's family is
 * fixed and is never guessed from how its address looks.
 */
export async function fetchPublicNodes(
  family: NodeNetwork,
): Promise<WalletNode[]> {
  const url = `${PUBLIC_DATA_BASE}${SOURCE_FOR_FAMILY[family]}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { nodes?: unknown };
    if (!body || !Array.isArray(body.nodes)) {
      throw new Error("unexpected shape");
    }
    const nodes: WalletNode[] = [];
    for (const entry of body.nodes) {
      const node = toNode(entry, family);
      if (node) nodes.push(node);
    }
    return nodes;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One entry of the public list, as a node record.
 *
 * An entry without a usable URL is skipped rather than added as a broken
 * node. A missing name falls back to the host, which is what the wallet
 * shows for a node it does not know by name.
 */
function toNode(entry: unknown, family: NodeNetwork): WalletNode | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as { url?: unknown; name?: unknown };
  if (typeof record.url !== "string") return null;
  const normalized = normalizeNodeUrl(record.url);
  if (!normalized) return null;
  const rawName = typeof record.name === "string" ? record.name.trim() : "";
  return {
    url: normalized,
    name: rawName || labelForNodeUrl(normalized),
    network: family,
  };
}

/** What a merge did. */
export type MergeResult = {
  /** The nodes to add. */
  added: WalletNode[];
  /** How many entries were already in the list and kept their name. */
  kept: number;
  /** How many entries were already in the list on the other family. */
  skipped: number;
};

/**
 * Fold the public list into the node list.
 *
 * A URL that is already in the list is not added again, and its name is
 * left alone. The comparison is on the normalized URL, so a public entry
 * with a trailing slash is recognised as the same node as one without.
 *
 * A URL that is in the list under the other family is skipped as well.
 * Adding it would give one host two entries, and the family of the node
 * the wallet picks would depend on which one it found first.
 */
export function mergePublicNodes(
  existing: WalletNode[],
  incoming: WalletNode[],
): MergeResult {
  const byUrl = new Map<string, WalletNode>();
  for (const node of existing) {
    byUrl.set(normalizeNodeUrl(node.url), node);
  }

  const added: WalletNode[] = [];
  let kept = 0;
  let skipped = 0;

  for (const node of incoming) {
    const key = normalizeNodeUrl(node.url);
    const found = byUrl.get(key);
    if (found) {
      if (found.network === node.network) {
        // Already in this family. The name stays the one it has.
        kept++;
      } else {
        // Already in the other family. Adding it here would put one host
        // in both lists.
        skipped++;
      }
      continue;
    }
    byUrl.set(key, node);
    // The URL is stored normalized, the way the rest of the wallet stores
    // it, so a trailing slash does not make the same node look like two.
    added.push({ ...node, url: key });
  }

  return { added, kept, skipped };
}
