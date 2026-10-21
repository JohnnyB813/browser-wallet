import {
  DEFAULT_NODE_LIST,
  DEFAULT_NODE_NAME_LIST,
  MAINNET_OFFICIAL_URL,
  PRESET_NODES,
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

const PRESET_URLS = new Set(PRESET_NODES.map((n) => normalizeNodeUrl(n.url)));

/** True when the node URL matches a built-in preset (normalized). */
export function isPresetNodeUrl(node: string | null | undefined): boolean {
  const n = normalizeNodeUrl(node);
  return Boolean(n) && PRESET_URLS.has(n);
}

/**
 * True for DeFi / testnet nodes (wart_balance, Assets, DEX-style APIs).
 * Mirrors wartbunker `isDefiNode`.
 */
export function isDefiNode(node: string | null | undefined): boolean {
  const n = normalizeNodeUrl(node).toLowerCase();
  if (!n) return false;
  if (PRESET_NODES.some((p) => p.network === "defi-testnet" && normalizeNodeUrl(p.url) === n)) {
    return true;
  }
  if (n.includes("defitestnet") || n.includes("testnet")) return true;
  if (n.includes("localhost") || n.includes("127.0.0.1")) return true;
  if (n.includes(":3002")) return true;
  return false;
}

/** Mainnet nodes use /account/:addr/balance; DeFi testnet uses /wart_balance. */
export function isMainnetNode(node: string | null | undefined): boolean {
  return !isDefiNode(node);
}

export function networkLabel(node: string | null | undefined): "Mainnet" | "DeFi Testnet" {
  return isDefiNode(node) ? "DeFi Testnet" : "Mainnet";
}

/**
 * Blocks a DeFi submit. Null means the action can be sent.
 * Home hides these screens until a DeFi testnet node is selected.
 */
export function defiSubmitHold(
  node: string | null | undefined,
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

/** Legacy browser-wallet / website node keys that should map to official mainnet. */
const LEGACY_MAINNET = new Set([
  "losthymns",
  "official2",
  "polaire",
  "blu & Asia",
  "johnnyb Us East",
  "http://51.75.21.134:3001",
  "http://62.72.44.89:3001",
  "http://dev.node-s.com:3001",
  "http://65.87.7.86:3001",
]);

/**
 * Lists this extension used to write on its own. An exact match is replaced
 * with the two official nodes. A list that also contains a URL the user
 * added is kept, so a saved node survives the next login.
 */
const SHIPPED_NODE_SETS: string[][] = [
  [
    "http://localhost:3101",
    "http://localhost:3100",
    "http://51.75.21.134:3001",
    "http://62.72.44.89:3001",
    "http://dev.node-s.com:3001",
  ],
  [
    "https://warthognode.duckdns.org",
    "https://warthog-defitestnet.duckdns.org",
    "http://104.251.219.14:3001",
    "http://65.87.7.86:3002",
    "http://85.56.145.106:3001",
    "http://209.127.34.202:3001",
  ],
];

function sameNodeSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const seen = new Set(right);
  return left.every((url) => seen.has(url));
}

function officialNodes(): { urls: string[]; names: string[] } {
  return {
    urls: [...DEFAULT_NODE_LIST],
    names: [...DEFAULT_NODE_NAME_LIST],
  };
}

/**
 * Merge stored nodes with the built-in list.
 * Built-in nodes stay in preset order. A built-in URL the user removed is
 * listed in `dismissed` and stays gone. Custom URLs stay after the built-ins,
 * in the order they were saved. An old shipped list with no custom URL is
 * replaced by the built-in list.
 */
export function mergeNodeLists(
  storedUrls: string[] | null | undefined,
  storedNames: string[] | null | undefined,
  dismissed?: string[] | null,
): { urls: string[]; names: string[] } {
  const urls: string[] = [];
  const names: string[] = [];
  (storedUrls || []).forEach((raw, index) => {
    const url = normalizeNodeUrl(raw);
    if (!url || urls.includes(url)) return;
    urls.push(url);
    names.push((storedNames || [])[index] || "");
  });

  if (urls.length === 0) return officialNodes();

  const allLegacy = urls.every(
    (url) => LEGACY_MAINNET.has(url) || !url.startsWith("http"),
  );
  if (allLegacy) return officialNodes();

  const shipped = SHIPPED_NODE_SETS.some((set) =>
    sameNodeSet(urls, set.map((url) => normalizeNodeUrl(url))),
  );
  if (shipped) return officialNodes();

  const hidden = new Set((dismissed || []).map((url) => normalizeNodeUrl(url)).filter(Boolean));
  const presets = PRESET_NODES.filter((node) => !hidden.has(normalizeNodeUrl(node.url)));
  const presetUrls = new Set(presets.map((node) => normalizeNodeUrl(node.url)));
  const customUrls: string[] = [];
  const customNames: string[] = [];
  urls.forEach((url, index) => {
    if (presetUrls.has(url) || hidden.has(url)) return;
    customUrls.push(url);
    customNames.push(names[index] || labelForNodeUrl(url));
  });

  return {
    urls: [...presets.map((node) => normalizeNodeUrl(node.url)), ...customUrls],
    names: [...presets.map((node) => node.name), ...customNames],
  };
}

export function labelForNodeUrl(url: string): string {
  const preset = PRESET_NODES.find((p) => normalizeNodeUrl(p.url) === normalizeNodeUrl(url));
  if (preset) return preset.name;
  try {
    return new URL(normalizeNodeUrl(url)).host || url;
  } catch {
    return url;
  }
}

/** Ordered failover candidates for a preferred node (DeFi only hops across presets). */
export function buildFailoverCandidates(preferred: string): string[] {
  const preferredNorm = normalizeNodeUrl(preferred) || MAINNET_OFFICIAL_URL;
  const candidates = [preferredNorm];

  if (!isDefiNode(preferredNorm)) {
    return candidates;
  }

  for (const { url, network } of PRESET_NODES) {
    if (network !== "defi-testnet") continue;
    const normalized = normalizeNodeUrl(url);
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  }
  return candidates;
}
