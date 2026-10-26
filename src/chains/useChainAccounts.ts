import { useEffect, useState } from "react";
import useWallet from "../hooks/useWallet";
import { setSessionAccountIndex } from "../mobile-port/utils/sessionVault";
import { chainPublicFromWorker } from "../utils/signingBridge";
import { WALLET_NETWORKS, type WalletNetworkId, type BrowserChain } from "../config/walletNetworks";
export type { BrowserChain } from "../config/walletNetworks";

const KEY = "warthogBrowserChain";
const EVENT = "warthog-chain";
const ORDER: BrowserChain[] = ["wart", "ethereum", "bitcoin", "hemi", "solana"];

export const CHAIN_LABEL: Record<BrowserChain, string> = {
  wart: "Warthog",
  ethereum: "Ethereum",
  bitcoin: "Bitcoin",
  hemi: "Hemi",
  solana: "Solana",
};

type ChainAccounts = {
  ethAddress: string;
  btcAddress: string;
  solAddress: string;
};

function readChain(): BrowserChain {
  const saved = localStorage.getItem(KEY);
  return ORDER.includes(saved as BrowserChain) ? (saved as BrowserChain) : "wart";
}

export function useChainAccounts(syncSession = false) {
  const { canAddAccounts, signingUnlocked, selectedWalletIndex, wallet, activeNetwork, setActiveNetwork } = useWallet();
  const [accounts, setAccounts] = useState<ChainAccounts | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!syncSession) return;
    setSessionAccountIndex(signingUnlocked ? selectedWalletIndex : 0);
  }, [syncSession, signingUnlocked, selectedWalletIndex]);

  useEffect(() => {
    if (!signingUnlocked || !canAddAccounts) {
      setAccounts(null);
      setSettled(true);
      return;
    }
    let alive = true;
    setSettled(false);
    void (async () => {
      try {
        const pubs = await chainPublicFromWorker(selectedWalletIndex);
        if (!alive) return;
        setAccounts(pubs ? {
          ethAddress: pubs.ethAddress,
          btcAddress: pubs.btcAddress,
          solAddress: pubs.solAddress,
        } : null);
      } catch {
        if (alive) setAccounts(null);
      } finally {
        if (alive) setSettled(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [signingUnlocked, canAddAccounts, selectedWalletIndex, wallet]);

  const chains: BrowserChain[] = accounts
    ? ["wart", "ethereum", "bitcoin", "hemi", "solana"]
    : ["wart"];

  const [chain, setChainState] = useState<BrowserChain>(readChain);

  useEffect(() => {
    const sync = () => setChainState(readChain());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const active = chains.includes(chain) ? chain : "wart";

  const setChain = (next: BrowserChain) => {
    localStorage.setItem(KEY, next);
    setChainState(next);
    window.dispatchEvent(new Event(EVENT));
  };

  const networkId: WalletNetworkId = active === "wart"
    ? activeNetwork === "defi-testnet" ? "wart-testnet" : "wart-mainnet"
    : active;
  const network = WALLET_NETWORKS.find((item) => item.id === networkId)!;
  const networks = WALLET_NETWORKS.filter((item) => chains.includes(item.chain));
  const setNetwork = (id: WalletNetworkId) => {
    const next = networks.find((item) => item.id === id);
    if (!next) return;
    if (next.chain === "wart") setActiveNetwork(id === "wart-testnet" ? "defi-testnet" : "mainnet");
    setChain(next.chain);
  };
  const address = active === "wart" ? wallet || "" : active === "bitcoin"
    ? accounts?.btcAddress || "" : active === "solana" ? accounts?.solAddress || "" : accounts?.ethAddress || "";
  const phrasePending = Boolean(signingUnlocked && canAddAccounts && !settled);
  return { accounts, chains, chain: active, setChain, phrasePending, network, networks, setNetwork, address };
}
