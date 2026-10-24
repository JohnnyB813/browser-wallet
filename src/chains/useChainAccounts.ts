import { useEffect, useMemo, useState } from "react";
import useWallet from "../hooks/useWallet";
import { deriveEthAddress } from "../mobile-port/utils/evmAddress";
import { chainAddresses } from "../mobile-port/utils/networks/derive";
import { setChainSession } from "../mobile-port/utils/sessionVault";
import { exportWalletFromWorker, getSigningStatus } from "../utils/signingBridge";

export type BrowserChain = "wart" | "ethereum" | "bitcoin" | "hemi" | "solana";

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

function readChain(): BrowserChain {
  const saved = localStorage.getItem(KEY);
  return ORDER.includes(saved as BrowserChain) ? (saved as BrowserChain) : "wart";
}

export function useChainAccounts() {
  const { seedPhrase, canAddAccounts, signingUnlocked } = useWallet();
  const [recovered, setRecovered] = useState("");
  const [phrasePending, setPhrasePending] = useState(false);

  useEffect(() => {
    const direct = seedPhrase?.trim() ?? "";
    if (direct || !signingUnlocked || !canAddAccounts) {
      setRecovered("");
      setPhrasePending(false);
      return;
    }
    let alive = true;
    setPhrasePending(true);
    void (async () => {
      try {
        const status = await getSigningStatus();
        if (!alive || !status.hasMnemonic) return;
        const exported = await exportWalletFromWorker();
        const mnemonic = exported.mnemonic?.trim() ?? "";
        exported.privateKey = "";
        if (alive) setRecovered(mnemonic);
      } catch {
        if (alive) setRecovered("");
      } finally {
        if (alive) setPhrasePending(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [seedPhrase, signingUnlocked, canAddAccounts]);

  const phrase = seedPhrase?.trim() || recovered;

  useEffect(() => {
    setChainSession(phrase || null);
  }, [phrase]);

  const accounts = useMemo(() => {
    if (!phrase) return null;
    try {
      const derived = chainAddresses(phrase);
      return {
        ethAddress: deriveEthAddress(phrase),
        btcAddress: derived.btcAddress,
        solAddress: derived.solAddress,
      };
    } catch {
      return null;
    }
  }, [phrase]);

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

  return { accounts, chains, chain: active, setChain, phrasePending };
}
