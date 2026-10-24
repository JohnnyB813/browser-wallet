import React, { useState, useEffect, useRef, useCallback } from "react";
import { searchAssetsDetailed, type AssetInfo } from "../utils/defiClient";
import { fetchWartUsdPrice } from "../utils/wartPrice";
import { shouldStartUpdate } from "../utils/updatePending";
import { fetchBalanceAndPin, nodeRead } from "../utils/warthogNode";
import ProfileHeader from "../components/ProfileHeader";
import TabNavigation, { Tab } from "../components/TabNavigation";
import TransactionHistoryPanel, {
  type HistoryActivity,
} from "../components/TransactionHistoryPanel";
import PendingTxRow from "../components/PendingTxRow";
import CancelConfirmModal from "../components/CancelConfirmModal";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { IoSend, IoTrendingUp, IoWater, IoDiamond, IoCloseCircleOutline } from "react-icons/io5";
import { useChainAccounts } from "../chains/useChainAccounts";
import ChainPicker from "../components/chains/ChainPicker";
import ChainHoldings from "../components/chains/ChainHoldings";
import NetworkBadge from "../components/chains/NetworkBadge";
import NodeError from "../components/NodeError";
import TokenMark from "../components/chains/TokenMark";
import { toast } from "../utils/toast";
import { isDefiNode } from "../utils/nodes";
import { hasPositiveLocked } from "../utils/balanceBreakdown";
import { formatDisplayNumber, loadNumberDisplayPrefs } from "../utils/numberDisplay";
import { FaChevronDown, FaSearch, FaSync } from "react-icons/fa";
import Jazzicon from "react-jazzicon";
import { getPendingApproval, approveRequest, rejectRequest, PendingApproval } from "../utils/extensionApi";
import { addressToSeed, createTransactionContext, formatAddress, submitTransaction } from "../utils";
import { Address, NonceId, RoundedFee, Wart } from "warthog-ts";
import { ledgerWartSubmitJson, signWartTransferOnLedger } from "../ledger/warthogApp";
import { readLedgerWindowMode, storeLedgerSignJob, takeLedgerLastTx, type LedgerWindowMode } from "../ledger/session";
import { isToolbarActionPopup, openLedgerHost, openLedgerInSidePanel } from "../ledger/shell";
import { reloadDocumentOnce } from "../utils/extensionNav";
import { DEFAULT_FEE_WART } from "../config";
import {
  type NodeMempoolEntry,
  type NodeTx,
} from "../types/nodeTx";

interface Token {
  spec: string;
  name: string;
  hash: string | null;
}

/** Map a node asset-search match onto the shape the balance UI selects with. */
const toToken = (match: AssetInfo): Token => ({
  spec: "asset",
  name: match.name || match.hash || "?",
  hash: match.hash ?? null,
});

const RECENT_TOKENS_KEY = 'recent_tokens';
const MAX_RECENT = 5;

function TokenSelector({ selectedToken, onSelect, nodeUrl, defi }: { selectedToken: Token; onSelect: (token: Token) => void; nodeUrl: string; defi: boolean }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Token[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentTokens, setRecentTokens] = useState<Token[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(RECENT_TOKENS_KEY);
    if (stored) {
      setRecentTokens(JSON.parse(stored) as Token[]);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    // Only a DeFi node has assets. Searching a mainnet node would fail on
    // an endpoint it does not serve, and the user would see no results for
    // no reason.
    if (!defi) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      setSearchLoading(true);
      try {
        const [byName, byHash] = await Promise.all([
          searchAssetsDetailed(nodeUrl, searchQuery),
          searchAssetsDetailed(nodeUrl, "", searchQuery),
        ]);
        const merged: Token[] = [
          ...byName.matches.map(toToken),
          ...byHash.matches.map(toToken),
        ];
        const unique = merged.filter((t, i, a) => a.findIndex(x => x.hash === t.hash) === i);
        setSearchResults(unique.slice(0, 20));
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    search();
  }, [searchQuery, nodeUrl, defi]);

  const handleSelect = (token: Token) => {
    onSelect(token);
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);

    const stored = localStorage.getItem(RECENT_TOKENS_KEY);
    let recent: Token[] = stored ? JSON.parse(stored) : [];
    recent = recent.filter((t: Token) => t.hash !== token.hash);
    recent.unshift(token);
    recent = recent.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_TOKENS_KEY, JSON.stringify(recent));
    setRecentTokens(recent);
  };

  const displayName = selectedToken.hash
    ? `${selectedToken.name} (${formatAddress(selectedToken.hash, 8)})`
    : 'WART';

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-left transition-colors hover:bg-white/15"
      >
        <span className="text-primary font-medium">{displayName}</span>
        <FaChevronDown className={`text-white/50 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <div className="home-token-menu">
          <div className="p-2 border-b border-white/10">
            {defi ? (
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tokens..."
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-hidden focus:border-primary"
                  autoFocus
                />
              </div>
            ) : (
              <p className="text-[11px] text-white/40 py-1">
                Assets are on the DeFi testnet. Switch the network to pick one.
              </p>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {!searchQuery && recentTokens.length > 0 && (
              <div>
                <div className="px-3 py-1 text-xs text-white/40 uppercase tracking-wider">Recent</div>
                {/* A testnet asset does not belong in a mainnet list. */}
                {recentTokens
                  .filter((token) => defi || !token.hash)
                  .map((token) => (
                  <button
                    key={token.hash || 'wart'}
                    onClick={() => handleSelect(token)}
                    className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2"
                  >
                    <span className={token.hash ? 'text-primary' : 'text-yellow-400'}>
                      {token.name}
                    </span>
                    {token.hash && (
                      <span className="text-white/40 text-xs font-mono">
                        ({formatAddress(token.hash, 6)})
                      </span>
                    )}
                  </button>
                ))}
                <div className="border-t border-white/10 mt-1" />
              </div>
            )}

            {searchQuery && (
            <div>
              <div className="px-3 py-1 text-xs text-white/40 uppercase tracking-wider">Search Results</div>
              {searchLoading && (
                <div className="px-3 py-2 text-white/50 text-sm">Searching...</div>
              )}
              {!searchLoading && searchResults.length === 0 && searchQuery && (
                <div className="px-3 py-2 text-white/50 text-sm">No tokens found</div>
              )}
              {!searchLoading && searchResults.map((token) => (
                <button
                  key={token.hash}
                  onClick={() => handleSelect({ spec: 'asset', name: token.name, hash: token.hash })}
                  className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2"
                >
                  <span className="text-primary">{token.name}</span>
                  <span className="text-white/40 text-xs font-mono">
                    ({token.hash && formatAddress(token.hash, 6)})
                  </span>
                </button>
              ))}
            </div>
            )}

            {!searchQuery && (
              <button
                onClick={() => handleSelect({ spec: 'WART', name: 'WART', hash: null })}
                className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 border-t border-white/10"
              >
                <span className="text-yellow-400 font-semibold">WART</span>
                <span className="text-white/40 text-xs">(native currency)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const Home: React.FC = () => {
  const {
    wallet,
    selectedNodeIndex,
    nodeList,
    walletList,
    nameList,
    ledgerAccount,
    activeNetwork,
    switchNetwork,
    setActiveNetwork,
    nodeError,
    selectedNode,
  } = useWallet();
  const { accounts, chains, chain, setChain, phrasePending } = useChainAccounts();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [balanceUSD, setBalanceUSD] = useState(0);
  const [wartSpend, setWartSpend] = useState({
    available: "0",
    locked: "0",
    total: "0",
    hasLocked: false,
  });
  // The node that has an update running. The node URL carries the network
  // with it, because a node belongs to one family. An update is assigned
  // to the node it was started for, so a second request for the same node
  // is not started while the first is still running.
  const [pendingNodeUrl, setPendingNodeUrl] = useState<string | null>(null);
  // The same thing as a ref, so the read can read it without the effect
  // that starts the read having to depend on it.
  const pendingNodeRef = useRef<string | null>(null);
  // The node the wallet is on. A read that finishes after the wallet moved
  // to another node must not overwrite what that node says.
  //
  // It is set while rendering, not in an effect, so it is right on the
  // first render too and never lags a commit behind the state.
  const currentNodeRef = useRef<string | null>(selectedNode?.url ?? null);
  currentNodeRef.current = selectedNode?.url ?? null;
  const [holdingsTick, setHoldingsTick] = useState(0);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);
  const [approvalWalletIndex, setApprovalWalletIndex] = useState(selectedNodeIndex);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token>({ spec: 'WART', name: 'WART', hash: null });
  // WART is the native currency. Any other selection is a DeFi testnet
  // asset, which only the testnet node knows about.
  const isWart = !selectedToken.hash;
  // The card is pending while the update of the node the wallet is on is
  // running. An update of another node does not make this one wait.
  const refreshing = Boolean(
    pendingNodeUrl && pendingNodeUrl === currentNodeRef.current,
  );

  const [activeTab, setActiveTab] = useState<Tab>(Tab.Actions);
  const [ledgerNote, setLedgerNote] = useState<string | null>(null);
  const windowModeRef = useRef<LedgerWindowMode>("dropdown");
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [pendingTxs, setPendingTxs] = useState<NodeMempoolEntry[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTx, setCancelTx] = useState<NodeTx | null>(null);
  const [cancelType, setCancelType] = useState<string>("");
  const openActivity = (item: HistoryActivity) => {
    navigate("/activity-details", { state: item });
  };

  /**
   * Pick the coin the card shows.
   *
   * A DeFi asset only exists on the testnet, so picking one moves the
   * wallet there. The mainnet node has no asset balances and no asset
   * search, so a testnet asset on a mainnet node would show nothing.
   */
  const selectToken = useCallback(
    (token: Token) => {
      setSelectedToken(token);
      if (token.hash) setActiveNetwork("defi-testnet");
    },
    [setActiveNetwork],
  );

  useEffect(() => {
    void readLedgerWindowMode().then((mode) => {
      windowModeRef.current = mode;
    });
    void takeLedgerLastTx().then((hash) => {
      if (hash) setLedgerNote(`Broadcast ${hash}`);
    });
  }, []);

  const loadPending = useCallback(async () => {
    if (!wallet || !nodeList[selectedNodeIndex]) return;

    const nodeUrl = nodeList[selectedNodeIndex].url;
    setPendingLoading(true);
    try {
      const entries = await nodeRead<NodeMempoolEntry[]>(
        nodeUrl,
        `account/${wallet}/mempool`,
      );
      setPendingTxs(Array.isArray(entries) ? entries : []);
    } catch (err) {
      console.error("Error fetching pending:", err);
      setPendingTxs([]);
    } finally {
      setPendingLoading(false);
    }
  }, [wallet, nodeList, selectedNodeIndex]);

  useEffect(() => {
    if (activeTab === Tab.Pending) {
      loadPending();
      const interval = setInterval(loadPending, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadPending]);

  const handleCancel = (tx: NodeTx, type: string) => {
    setCancelTx(tx);
    setCancelType(type);
    setShowCancelModal(true);
  };

  const handleApprove = async () => {
    if (pendingApproval?.action === 'requestAccounts') {
      const account = walletList[approvalWalletIndex];
      await approveRequest([account]);
      setShowApprovalBanner(false);
      setPendingApproval(null);
      return;
    }
    if (pendingApproval?.action === 'openSendPage') {
      await approveRequest();
      setShowApprovalBanner(false);
      setPendingApproval(null);
      navigate(`/send?address=${pendingApproval.to}`);
      return;
    }
    if (
      ledgerAccount &&
      (pendingApproval?.action === 'sendTransaction' || pendingApproval?.action === 'transferWart')
    ) {
      setApprovalBusy(true);
      setLedgerNote(null);
      try {
        const toAddr = Address.fromHex(pendingApproval.to || "");
        if (!toAddr) throw new Error("Invalid recipient address");
        const wartParsed = Wart.parse(pendingApproval.amount || "0");
        if (!wartParsed) throw new Error("Invalid WART amount");
        const fee = RoundedFee.fromE8(
          BigInt(Math.round(parseFloat(DEFAULT_FEE_WART) * 1e8)),
          false,
        );
        if (!fee) throw new Error("Invalid fee");
        const nonceId = NonceId.random();
        const handOff = isToolbarActionPopup();
        const opened = handOff && windowModeRef.current === "sidepanel"
          ? await openLedgerInSidePanel("/ledger-host?op=sign")
          : false;
        const context = await createTransactionContext(nodeList, selectedNodeIndex, fee, nonceId);
        if (handOff) {
          await storeLedgerSignJob({
            pinHash: context.chainPin.pinHash,
            pinHeight: context.chainPin.pinHeight,
            nonceId: nonceId.value,
            feeE8: fee.E8.toString(),
            toAddress: toAddr.hex,
            amountE8: wartParsed.E8.toString(),
            nodeIndex: selectedNodeIndex,
            approveDapp: true,
          });
          if (!opened) await openLedgerHost("op=sign");
          window.close();
          return;
        }
        const tx = await signWartTransferOnLedger(ledgerAccount, {
          pinHash: context.chainPin.pinHash,
          pinHeight: context.chainPin.pinHeight,
          nonceId: nonceId.value,
          feeE8: fee.E8,
          toAddress: toAddr.hex,
          amountE8: wartParsed.E8,
        });
        const txHash = await submitTransaction(
          nodeList,
          selectedNodeIndex,
          ledgerWartSubmitJson(tx, nodeList[selectedNodeIndex]),
        );
        await approveRequest(undefined, txHash);
        setShowApprovalBanner(false);
        setPendingApproval(null);
        setLedgerNote(`Broadcast ${txHash}`);
      } catch (error) {
        setLedgerNote(error instanceof Error ? error.message : "Ledger sign failed");
      } finally {
        setApprovalBusy(false);
      }
    }
  };

  const handleReject = async () => {
    await rejectRequest();
    setShowApprovalBanner(false);
    setPendingApproval(null);
  };

  /**
   * Read the balance from the node the wallet is on.
   *
   * The read is awaited so the pending state can follow it, and it is
   * assigned to the node it was started for. A result that arrives after
   * the wallet moved to another node is dropped: it says what the old
   * node thought, and the card now shows the new one.
   */
  const updateBalance = useCallback(
    async (ownsPending: boolean): Promise<void> => {
      const node = nodeList[selectedNodeIndex];
      if (!wallet || !node) return;
      const nodeUrl = node.url;
      const isCurrentNode = () => currentNodeRef.current === nodeUrl;

      try {
        if (selectedToken.hash) {
          const tokenSpec = `asset:${selectedToken.hash}`;
          const data = await nodeRead<{
            balance?: { total?: { u64?: number; decimals?: number } };
          }>(nodeUrl, `account/${wallet}/balance/${tokenSpec}`);
          if (!isCurrentNode()) return;
          if (data?.balance?.total?.u64 !== undefined) {
            const decimals = data.balance.total.decimals || 8;
            const amount = data.balance.total.u64 / Math.pow(10, decimals);
            setBalance(amount);
            setWartSpend({
              available: String(amount),
              locked: "0",
              total: String(amount),
              hasLocked: false,
            });
            setBalanceError(null);
          }
        } else {
          const result = await fetchBalanceAndPin(node, wallet);
          if (!isCurrentNode()) return;
          setBalance(parseFloat(result.balance) || 0);
          setWartSpend({
            available: result.available,
            locked: result.locked,
            total: result.balance,
            hasLocked: result.hasLocked,
          });
          setBalanceError(null);
        }
      } catch (error) {
        console.error("Error fetching balance:", error);
        const message =
          error instanceof Error ? error.message : "Could not load the balance";
        if (/failed to fetch/i.test(message) && reloadDocumentOnce()) return;
        if (!isCurrentNode()) return;
        setBalance(0);
        setBalanceError(message);
      } finally {
        // The update is over, whether it read the balance or failed. The
        // pending state ends here, so the card does not wait for a node
        // that never answers.
        //
        // Only the read that owns the pending state ends it. A background
        // poll reads the same node and must not cut the user's update short.
        if (ownsPending && pendingNodeRef.current === nodeUrl) {
          pendingNodeRef.current = null;
          setPendingNodeUrl(null);
        }
      }
    },
    [wallet, nodeList, selectedNodeIndex, selectedToken],
  );

  const updateBalanceUSD = useCallback(() => {
    // wartPrice tries CoinGecko, falls back to CoinPaprika, and caches. Home
    // previously polled CoinGecko alone every 1.5s with no fallback.
    fetchWartUsdPrice()
      .then((price) => {
        setBalanceUSD(price ?? 0);
      })
      .catch((error) => {
        console.error("Error fetching balance:", error);
      });
  }, []);

  useEffect(() => {
    const checkPendingApproval = async () => {
      const pending = await getPendingApproval();
      if (pending && pending.action) {
        setPendingApproval(pending);
        setShowApprovalBanner(true);
      }
    };
    checkPendingApproval();
  }, []);

  /**
   * Start an update for the node the wallet is on, if it is not already
   * running for it.
   *
   * The update is assigned to the node. An update that is already running
   * for that node is not started again, so toggling back to a node that is
   * still being read does not queue a second read of it.
   */
  const startUpdate = useCallback((nodeUrl: string | null): boolean => {
    if (!shouldStartUpdate(nodeUrl, pendingNodeRef.current)) return false;
    pendingNodeRef.current = nodeUrl;
    setPendingNodeUrl(nodeUrl);
    return true;
  }, []);

  /**
   * Refresh the card, the way the refresh button does.
   *
   * The pending state lasts as long as the read does, so the card says it
   * is working for as long as the node takes to answer.
   */
  const refreshCard = useCallback(() => {
    // An update already running for this node is not started again.
    if (!startUpdate(currentNodeRef.current)) return;
    updateBalance(true);
    updateBalanceUSD();
    setHoldingsTick((tick) => tick + 1);
  }, [startUpdate, updateBalance, updateBalanceUSD]);

  /**
   * Move to the other family and refresh what the card shows.
   *
   * The read itself happens in the balance effect, which re-runs when the
   * selected node changes. This cannot fetch: the state has not changed
   * yet, so it would read the node being left. The pending state is set
   * by that effect, once it knows which node the wallet landed on.
   */
  const switchNetworkAndRefresh = useCallback(() => {
    switchNetwork();
    setHoldingsTick((tick) => tick + 1);
  }, [switchNetwork]);

  // Read the balance when the node changes.
  //
  // This is where the update of a switched-to node starts: the switch
  // itself cannot fetch, because at that moment the state has not changed
  // and it would read the node being left. Here the new node is known, so
  // the update is assigned to it and the card is pending for it.
  //
  // An update that is already running for this node is not started again,
  // so toggling back to a node that is still being read does not queue a
  // second read of it.
  useEffect(() => {
    if (!wallet) return;
    const nodeUrl = selectedNode?.url ?? null;
    if (!nodeUrl) return;
    if (!shouldStartUpdate(nodeUrl, pendingNodeRef.current)) return;
    pendingNodeRef.current = nodeUrl;
    setPendingNodeUrl(nodeUrl);
    void updateBalance(true);
  }, [wallet, selectedNode?.url, updateBalance]);

  useEffect(() => {
    if (wallet) {
      const intervalIdPrice = setInterval(updateBalanceUSD, 1500);
      // A poll is a background refresh, not something the user asked for,
      // so it does not own the pending state.
      const intervalId = setInterval(() => void updateBalance(false), 1500);
      return () => {
        clearInterval(intervalIdPrice);
        clearInterval(intervalId);
      };
    }
  }, [wallet, selectedToken, selectedNodeIndex, updateBalance, updateBalanceUSD]);

  const renderTabContent = () => {
    switch (activeTab) {
      case Tab.Actions: {
        const showAmount = (value: string) =>
          formatDisplayNumber(value, loadNumberDisplayPrefs(), { fallback: value || "0" });
        const usd = balance * balanceUSD;
        const copyAddress = (value: string) => {
          void navigator.clipboard.writeText(value);
          toast.success("Copied", value);
        };
        return (
          <div className="space-y-4">
            <div className="home-wallet-card">
              {/* One row: the chain, the network within it, and the refresh.
                  The badge belongs beside the chain picker, because the two
                  answer the same question from different sides: the picker
                  says which chain, the badge says which network in it. */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ChainPicker chains={chains} chain={chain} onChange={setChain} />
                  {/* The network switch is a Warthog setting. A testnet asset
                      is not on the Warthog chain, so there is no network to
                      switch and the badge does not apply. Off the Warthog
                      chain the card shows that chain's coins, and the
                      Warthog node's family says nothing about them. */}
                  {chain === "wart" && isWart ? (
                    <NetworkBadge
                      network={activeNetwork}
                      onSwitch={switchNetworkAndRefresh}
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  className="main-balance-refresh"
                  disabled={refreshing}
                  onClick={refreshCard}
                >
                  <span className="text-[#FDB913]">{refreshing ? "…" : "⟳"}</span>
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {chain === "wart" || !accounts ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <TokenMark symbol={selectedToken.hash ? selectedToken.name : "WART"} size={28} />
                      <p className="text-sm font-semibold text-white">
                        {selectedToken.hash ? selectedToken.name : "WART"}
                      </p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-white">
                      {showAmount(wartSpend.available || "0")}
                    </p>
                  </div>
                  {!selectedToken.hash && hasPositiveLocked(wartSpend.locked) ? (
                    <p className="text-[11px] text-zinc-500">
                      Locked {showAmount(wartSpend.locked)} · Total {showAmount(wartSpend.total)}
                    </p>
                  ) : null}
                  {!selectedToken.hash && usd > 0 ? (
                    <p className="font-mono text-sm text-zinc-400">≈ {showAmount(String(usd))} USD</p>
                  ) : null}
                  <NodeError message={balanceError} />
                  {/* The family has no node at all, so the picker is the
                      way out of it. */}
                  {nodeError ? (
                    <NodeError
                      message={nodeError}
                      linkLabel="Choose a node"
                      alwaysLink
                    />
                  ) : null}
                  {wallet ? (
                    <button
                      type="button"
                      className="text-center font-mono text-[11px] text-zinc-400"
                      onClick={() => copyAddress(wallet)}
                    >
                      {wallet.slice(0, 10)}…{wallet.slice(-8)}
                    </button>
                  ) : null}
                  <TokenSelector
                    selectedToken={selectedToken}
                    onSelect={selectToken}
                    nodeUrl={nodeList[selectedNodeIndex]?.url || ""}
                    defi={activeNetwork === "defi-testnet"}
                  />
                  {chains.length < 2 && !phrasePending ? (
                    <p className="text-[11px] text-zinc-500">
                      {ledgerAccount
                        ? "This Ledger session is the Warthog account. Other networks sign in the phone app."
                        : "Bitcoin, Ethereum, Hemi, and Solana come from the recovery phrase. A private-key import only has the Warthog account."}
                    </p>
                  ) : null}
                </>
              ) : (
                <ChainHoldings
                  chain={chain}
                  ethAddress={accounts.ethAddress}
                  btcAddress={accounts.btcAddress}
                  solAddress={accounts.solAddress}
                  refreshTick={holdingsTick}
                  onSend={() => navigate("/chain-send")}
                  onTunnel={() => navigate("/swap", { state: { mode: "tunnel" } })}
                />
              )}
            </div>
            <div className="flex flex-row justify-center gap-3 w-full">
              <div
                className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                onClick={() => navigate(chain === "wart" ? "/send" : "/chain-send")}
              >
                <IoSend className="text-2xl text-primary" />
                <p className="text-white text-sm font-semibold">Send</p>
              </div>
              {/* The Warthog dex swap needs a DeFi node: the mainnet node has
                  no dex endpoints and cannot build a limit swap. Off the
                  Warthog chain the swap screen is the cross-chain one, which
                  does not use a Warthog node at all, so it is always here. */}
              {chain !== "wart" ? (
                <div
                  className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                  onClick={() => navigate("/swap")}
                >
                  <IoTrendingUp className="text-2xl text-primary" />
                  <p className="text-white text-sm font-semibold">Swap</p>
                </div>
              ) : null}
              {/* Liquidity and Mint are the Warthog dex actions. They need a
                  DeFi node: the mainnet node has no dex endpoints and cannot
                  build a liquidity deposit or an asset creation. They are
                  for WART on the testnet, so a testnet asset does not show
                  them either. They are also Warthog chain actions, so they
                  are hidden on Ethereum, Bitcoin, Hemi and Solana. */}
              {isWart && chain === "wart" && isDefiNode(selectedNode) ? (
                <>
                  <div
                    className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                    onClick={() => navigate("/swap")}
                  >
                    <IoTrendingUp className="text-2xl text-primary" />
                    <p className="text-white text-sm font-semibold">Swap</p>
                  </div>
                  <div
                    className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                    onClick={() => navigate("/liquidity")}
                  >
                    <IoWater className="text-2xl text-primary" />
                    <p className="text-white text-sm font-semibold">Liquidity</p>
                  </div>
                  <div
                    className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                    onClick={() => navigate("/create-token")}
                  >
                    <IoDiamond className="text-2xl text-primary" />
                    <p className="text-white text-sm font-semibold">Mint</p>
                  </div>
                </>
              ) : null}
              {chain === "ethereum" ? (
                <div
                  className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                  onClick={() => navigate("/aave")}
                >
                  <IoWater className="text-2xl text-primary" />
                  <p className="text-white text-sm font-semibold">Aave</p>
                </div>
              ) : null}
            </div>
            {ledgerNote && (
              <p className="text-amber-200/90 text-xs text-center px-2">{ledgerNote}</p>
            )}
          </div>
        );
      }

      case Tab.History:
        return (
          <TransactionHistoryPanel
            wallet={wallet}
            node={nodeList[selectedNodeIndex] || null}
            active
            onActivityClick={openActivity}
          />
        );

      case Tab.Pending:
        return (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {pendingTxs.length === 0 && !pendingLoading && (
              <div className="text-center text-white/50 py-8">
                No pending transactions
              </div>
            )}
            {pendingTxs.map((item, idx) => (
              <PendingTxRow
                key={item.transaction?.hash || idx}
                type={item.type}
                tx={item.transaction ?? {}}
                onCancel={handleCancel}
              />
            ))}
            {pendingLoading && (
              <div className="flex justify-center py-4">
                <FaSync className="animate-spin text-white/50" size={20} />
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container min-h-screen">
      {showApprovalBanner && pendingApproval && (
        <div className="p-4 bg-primary/20 border border-primary/50 rounded-lg mb-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-white font-semibold">
                {pendingApproval.action === 'requestAccounts' ? 'Connect Wallet Request' : pendingApproval.action === 'openSendPage' ? 'Send Request' : 'Transaction Request'}
              </p>
              <p className="text-white/50 text-sm">{pendingApproval.origin}</p>
            </div>
            <button
              onClick={handleReject}
              className="text-white/50 hover:text-white"
            >
              <IoCloseCircleOutline size={24} />
            </button>
          </div>
          {pendingApproval.action === 'requestAccounts' && (
            <div className="relative mb-2">
              <div
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/25 bg-[#1a1a1a] cursor-pointer"
                onClick={() => setDropdownVisible((prev) => !prev)}
              >
                <div className="flex items-center gap-3">
                  <Jazzicon diameter={32} seed={addressToSeed(walletList[approvalWalletIndex])} />
                  <div>
                    <p className="text-white text-sm font-semibold">
                      {nameList[approvalWalletIndex] || 'Loading...'}
                    </p>
                    <p className="text-white/50 text-xs">
                      {walletList[approvalWalletIndex] ? `${walletList[approvalWalletIndex].slice(0, 6)}...${walletList[approvalWalletIndex].slice(-4)}` : '...'}
                    </p>
                  </div>
                </div>
                <FaChevronDown className="text-white" />
              </div>
              {isDropdownVisible && walletList.length > 0 && (
                <div className="absolute z-10 mt-2 left-0 w-full bg-black border border-primary/50 rounded-lg overflow-hidden">
                  {walletList.map((wallet, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 hover:bg-white/10 cursor-pointer"
                      onClick={() => {
                        setApprovalWalletIndex(idx);
                        setDropdownVisible(false);
                      }}
                    >
                      <Jazzicon diameter={32} seed={addressToSeed(wallet)} />
                      <div>
                        <p className="text-white text-sm font-semibold">
                          {nameList[idx] || `Account ${idx + 1}`}
                        </p>
                        <p className="text-white/50 text-xs">
                          {`${wallet.slice(0, 6)}...${wallet.slice(-4)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {pendingApproval.to && (
            <p className="text-white/70 text-sm mb-2">To: {pendingApproval.to}</p>
          )}
          {pendingApproval.amount && (
            <p className="text-white/70 text-sm mb-2">Amount: {pendingApproval.amount} WART</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleReject}
              className="flex-1 px-4 py-2 border border-white/30 text-white rounded-lg hover:bg-white/10"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={approvalBusy}
              className="flex-1 px-4 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/80 disabled:opacity-60"
            >
              {pendingApproval.action === 'requestAccounts' ? 'Connect' : pendingApproval.action === 'openSendPage' ? 'Send' : 'Approve'}
            </button>
          </div>
        </div>
      )}

      <div className="p-2.5 bg-white/10 w-full rounded-48 backdrop-blur-[9px] flex-col justify-center items-center gap-4 inline-flex overflow-visible relative z-10">
        <ProfileHeader wallet={wallet} />
      </div>

      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-4">
        {renderTabContent()}
      </div>

      {showCancelModal && cancelTx && (
        <CancelConfirmModal
          tx={cancelTx}
          type={cancelType}
          onCancel={() => {
            setShowCancelModal(false);
            setCancelTx(null);
          }}
        />
      )}
    </div>
  );
};

export default Home;