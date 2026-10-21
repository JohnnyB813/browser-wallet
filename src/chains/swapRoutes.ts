/**
 * Locked Hemi bridge legs. Sushi keeps the token list.
 * Stargate and the ETH tunnel are ETH ↔ hemiETH.
 * The Bitcoin tunnel is BTC ↔ hemiBTC.
 * Labels stay "ETH"; the Hemi side uses the hemiETH mark.
 */

export type RoutedChain = "ethereum" | "bitcoin" | "hemi" | "solana";
export type SwapMode = "swap" | "tunnel";
export type SwapVenue = "stargate" | "sushi";
export type SwapDirection = "deposit" | "withdraw";

export type RouteLeg = {
  symbol: string;
  /** Glyph name. Hemi ETH differs from the ticker. */
  mark: string;
};

export type LockedRoute = {
  pay: RouteLeg;
  receive: RouteLeg;
  subtitle: string;
  payNetwork: string;
  receiveNetwork: string;
  hint: string;
};

const ETH: RouteLeg = { symbol: "ETH", mark: "ETH" };
const HEMI_ETH: RouteLeg = { symbol: "ETH", mark: "HEMIETH" };
const BTC: RouteLeg = { symbol: "BTC", mark: "BTC" };
const HEMI_BTC: RouteLeg = { symbol: "hemiBTC", mark: "HEMIBTC" };
const SOL: RouteLeg = { symbol: "SOL", mark: "SOL" };

export function lockedSwapRoute(input: {
  chain: RoutedChain;
  mode: SwapMode;
  venue: SwapVenue;
  /** Active tunnel target. Hemi uses "btc" or "eth". Ethereum uses "hemi" or "solana". */
  target: string;
  direction: SwapDirection;
}): LockedRoute | null {
  const withdraw = input.direction === "withdraw";
  const stargate = input.chain === "hemi" && input.mode === "swap" && input.venue === "stargate";
  const ethTunnel =
    (input.chain === "hemi" && input.mode === "tunnel" && input.target === "eth") ||
    (input.chain === "ethereum" && input.mode === "tunnel" && input.target === "hemi");
  if (stargate || ethTunnel) {
    return {
      pay: withdraw ? HEMI_ETH : ETH,
      receive: withdraw ? ETH : HEMI_ETH,
      subtitle: stargate
        ? (withdraw ? "ETH · Hemi → Ethereum" : "ETH · Ethereum → Hemi")
        : (withdraw ? "hemiETH → ETH" : "ETH → hemiETH"),
      payNetwork: withdraw ? "Hemi" : "Ethereum",
      receiveNetwork: withdraw ? "Ethereum" : "Hemi",
      hint: stargate
        ? "Stargate moves native ETH between Ethereum and Hemi. The message fee is on top of the amount."
        : "The Hemi standard bridge moves ETH 1 for 1. A withdrawal is proved on Ethereum, then finalized after the wait.",
    };
  }
  if (input.chain === "solana" && input.mode === "tunnel" && input.target === "bitcoin") {
    return {
      pay: withdraw ? BTC : SOL,
      receive: withdraw ? SOL : BTC,
      subtitle: withdraw ? "Bitcoin → Solana" : "Solana → Bitcoin",
      payNetwork: withdraw ? "Bitcoin" : "Solana",
      receiveNetwork: withdraw ? "Solana" : "Bitcoin",
      hint: "This tunnel moves SOL and BTC between Solana and Bitcoin.",
    };
  }
  const btcTunnel = input.chain === "bitcoin" || (input.chain === "hemi" && input.mode === "tunnel" && input.target === "btc");
  if (btcTunnel) {
    return {
      pay: withdraw ? HEMI_BTC : BTC,
      receive: withdraw ? BTC : HEMI_BTC,
      subtitle: withdraw ? "hemiBTC → BTC" : "BTC → hemiBTC",
      payNetwork: withdraw ? "Hemi" : "Bitcoin",
      receiveNetwork: withdraw ? "Bitcoin" : "Hemi",
      hint: "The Hemi vault tunnels Bitcoin. hemiBTC mints after confirmations, and a withdrawal pays Bitcoin back.",
    };
  }
  return null;
}

/**
 * Chain names for a tunnel, including a tunnel with one target.
 * Deposit follows the forward route. Withdraw swaps the two sides.
 */
export function tunnelEnds(input: {
  chain: RoutedChain;
  mode: SwapMode;
  target: string;
  direction: SwapDirection;
}): { payChain: string; receiveChain: string; subtitle: string } | null {
  if (input.mode !== "tunnel") return null;
  const forward = forwardChains(input.chain, input.target);
  if (!forward) return null;
  const withdraw = input.direction === "withdraw";
  const payChain = withdraw ? forward.to : forward.from;
  const receiveChain = withdraw ? forward.from : forward.to;
  return { payChain, receiveChain, subtitle: `${payChain} → ${receiveChain}` };
}

function forwardChains(chain: RoutedChain, target: string): { from: string; to: string } | null {
  if (chain === "bitcoin" || (chain === "hemi" && target === "btc")) return { from: "Bitcoin", to: "Hemi" };
  if ((chain === "hemi" && target === "eth") || (chain === "ethereum" && target === "hemi")) return { from: "Ethereum", to: "Hemi" };
  if (chain === "ethereum" && target === "solana") return { from: "Ethereum", to: "Solana" };
  if (chain === "solana" && target === "ethereum") return { from: "Solana", to: "Ethereum" };
  if (chain === "solana" && target === "bitcoin") return { from: "Solana", to: "Bitcoin" };
  return null;
}

/**
 * Jupiter tunnel pair. Each side stays on its own chain.
 * ETH, SOL, USDC, and USDT bridge. A Solana swap token such as JUP does not.
 * The Solana page starts at SOL → ETH. The Ethereum page starts at ETH → SOL.
 */
export function jupTunnelPair<T extends { id: string; network: "ethereum" | "solana" }>(input: {
  page: "ethereum" | "solana";
  payId: string;
  receiveId: string;
  ethereum: T[];
  solana: T[];
}): { pay: T; receive: T } {
  const all = [...input.ethereum, ...input.solana];
  const pickedPay = all.find((row) => row.id === input.payId);
  const pickedReceive = all.find((row) => row.id === input.receiveId);
  const otherSide = (asset: T): T | undefined => (asset.network === "ethereum" ? input.solana[0] : input.ethereum[0]);
  if (pickedPay && pickedReceive && pickedPay.network !== pickedReceive.network) {
    return { pay: pickedPay, receive: pickedReceive };
  }
  // A Solana swap id such as JUP is ignored. One real bridge pick is kept.
  if (pickedPay) {
    const receive = otherSide(pickedPay);
    if (!receive) throw new Error("The bridge has no assets.");
    return { pay: pickedPay, receive };
  }
  if (pickedReceive) {
    const pay = otherSide(pickedReceive);
    if (!pay) throw new Error("The bridge has no assets.");
    return { pay, receive: pickedReceive };
  }
  const pay = input.page === "solana" ? input.solana[0] : input.ethereum[0];
  const receive = input.page === "solana" ? input.ethereum[0] : input.solana[0];
  if (!pay || !receive) throw new Error("The bridge has no assets.");
  return { pay, receive };
}

/** Hemi Sushi starts on USDT, the same default as the mobile wallet. Other networks keep the next listed token. */
export function counterpartToken<T extends { id: string; symbol: string }>(
  tokens: T[],
  pay: T | undefined,
  receiveId: string,
  chain: RoutedChain,
): T | undefined {
  const chosen = tokens.find((token) => token.id === receiveId && token.id !== pay?.id);
  if (chosen) return chosen;
  if (chain === "hemi") {
    const usdt = tokens.find((token) => token.symbol === "USDT" && token.id !== pay?.id);
    if (usdt) return usdt;
  }
  return tokens.find((token) => token.id !== pay?.id);
}
