import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ProfileHeader from "../components/ProfileHeader";
import TabNavigation, { Tab } from "../components/TabNavigation";
import HistoryTxRow from "../components/HistoryTxRow";
import PendingTxRow from "../components/PendingTxRow";
import CancelConfirmModal from "../components/CancelConfirmModal";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { IoSend, IoTrendingUp, IoWater, IoDiamond, IoCloseCircleOutline } from "react-icons/io5";
import { FaChevronDown, FaSearch, FaSync } from "react-icons/fa";
import Jazzicon from "react-jazzicon";
import { getPendingApproval, approveRequest, rejectRequest, PendingApproval } from "../utils/extensionApi";
import { addressToSeed, formatAddress } from "../utils";
import {
  NODE_TX_TYPES,
  type ActionsByBlock,
  type NodeHistoryBlock,
  type NodeMempoolEntry,
  type NodeTx,
} from "../types/nodeTx";

interface Token {
  spec: string;
  name: string;
  hash: string | null;
}

const RECENT_TOKENS_KEY = 'recent_tokens';
const MAX_RECENT = 5;

function TokenSelector({ selectedToken, onSelect, nodeUrl }: { selectedToken: Token; onSelect: (token: Token) => void; nodeUrl: string }) {
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

    const search = async () => {
      setSearchLoading(true);
      try {
        const [byName, byHash] = await Promise.all([
          axios.get(`${nodeUrl}/asset/complete?namePrefix=${searchQuery}`),
          axios.get(`${nodeUrl}/asset/complete?hashPrefix=${searchQuery}`),
        ]);
        const merged: Token[] = [...(byName.data?.data?.matches || []), ...(byHash.data?.data?.matches || [])];
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
  }, [searchQuery, nodeUrl]);

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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-left flex items-center justify-between hover:bg-white/15 transition-colors"
      >
        <span className="text-primary font-medium">{displayName}</span>
        <FaChevronDown className={`text-white/50 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 border border-white/20 rounded-xl overflow-hidden z-50 backdrop-blur-md">
          <div className="p-2 border-b border-white/10">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tokens..."
                className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {!searchQuery && recentTokens.length > 0 && (
              <div>
                <div className="px-3 py-1 text-xs text-white/40 uppercase tracking-wider">Recent</div>
                {recentTokens.map((token) => (
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
  const { wallet, selectedNodeIndex, nodeList, walletList, nameList } = useWallet();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [balanceUSD, setBalanceUSD] = useState(0);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);
  const [approvalWalletIndex, setApprovalWalletIndex] = useState(selectedNodeIndex);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token>({ spec: 'WART', name: 'WART', hash: null });

  const [activeTab, setActiveTab] = useState<Tab>(Tab.Actions);
  const [historyBlocks, setHistoryBlocks] = useState<NodeHistoryBlock[]>([]);
  const [historyFromId, setHistoryFromId] = useState<number>(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingTxs, setPendingTxs] = useState<NodeMempoolEntry[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTx, setCancelTx] = useState<NodeTx | null>(null);
  const [cancelType, setCancelType] = useState<string>("");
  const [lastChainHeadHash, setLastChainHeadHash] = useState<string>("");

  const historyObserverRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async (reset = false) => {
    if (!wallet || !nodeList[selectedNodeIndex]) return;

    const nodeUrl = nodeList[selectedNodeIndex];
    const beforeId = reset ? Number.MAX_SAFE_INTEGER : (historyFromId > 0 ? historyFromId - 1 : Number.MAX_SAFE_INTEGER);

    if (!reset && !historyHasMore) return;

    setHistoryLoading(true);
    try {
      const response = await axios.get<{
        data?: ActionsByBlock;
      }>(`${nodeUrl}/account/${wallet}/history/${beforeId}`);
      const data = response.data?.data;

      if (data && data.perBlock) {
        if (reset) {
          setHistoryBlocks(data.perBlock);
        } else {
          setHistoryBlocks(prev => [...prev, ...data.perBlock]);
        }
        setHistoryFromId(data.fromId);
        setHistoryHasMore(data.fromId > 1);
      } else {
        if (reset) {
          setHistoryBlocks([]);
        }
        setHistoryHasMore(false);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
      if (reset) setHistoryBlocks([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [wallet, nodeList, selectedNodeIndex, historyFromId, historyHasMore]);

  const loadPending = useCallback(async () => {
    if (!wallet || !nodeList[selectedNodeIndex]) return;

    const nodeUrl = nodeList[selectedNodeIndex];
    setPendingLoading(true);
    try {
      const response = await axios.get<{
        data?: NodeMempoolEntry[];
      }>(`${nodeUrl}/account/${wallet}/mempool`);
      setPendingTxs(response.data?.data || []);
    } catch (err) {
      console.error("Error fetching pending:", err);
      setPendingTxs([]);
    } finally {
      setPendingLoading(false);
    }
  }, [wallet, nodeList, selectedNodeIndex]);

  // `loadHistory` is intentionally omitted: it depends on historyFromId and
  // historyHasMore, which it itself sets. Listing it would make this effect
  // re-run on every load, refetching history in a loop.
  useEffect(() => {
    if (activeTab === Tab.History) {
      loadHistory(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, wallet, selectedNodeIndex]);

  useEffect(() => {
    if (activeTab === Tab.History && wallet && nodeList[selectedNodeIndex]) {
      const interval = setInterval(async () => {
        const nodeUrl = nodeList[selectedNodeIndex];
        try {
          const response = await axios.get(`${nodeUrl}/chain/head`);
          const headHash = response.data?.data?.chainHead?.hash;
          if (headHash && headHash !== lastChainHeadHash) {
            setLastChainHeadHash(headHash);
            loadHistory(true);
          }
        } catch (err) {
          console.error("Error polling chain head:", err);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, wallet, selectedNodeIndex, lastChainHeadHash, loadHistory, nodeList]);

  useEffect(() => {
    if (activeTab === Tab.Pending) {
      loadPending();
      const interval = setInterval(loadPending, 15000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadPending]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && historyHasMore && !historyLoading && activeTab === Tab.History) {
          loadHistory(false);
        }
      },
      { threshold: 0.1 }
    );

    if (historyObserverRef.current) {
      observer.observe(historyObserverRef.current);
    }

    return () => observer.disconnect();
  }, [historyHasMore, historyLoading, activeTab, loadHistory]);

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
    } else if (pendingApproval?.action === 'openSendPage') {
      await approveRequest();
      setShowApprovalBanner(false);
      setPendingApproval(null);
      navigate(`/send?address=${pendingApproval.to}`);
    }
  };

  const handleReject = async () => {
    await rejectRequest();
    setShowApprovalBanner(false);
    setPendingApproval(null);
  };

  const updateBalance = useCallback(() => {
    if (wallet && nodeList[selectedNodeIndex]) {
      const nodeUrl = nodeList[selectedNodeIndex];
      if (selectedToken.hash) {
        const tokenSpec = `asset:${selectedToken.hash}`;
        axios
          .get(`${nodeUrl}/account/${wallet}/balance/${tokenSpec}`)
          .then((response) => {
            const data = response?.data?.data;
            if (data?.balance?.total?.u64 !== undefined) {
              const decimals = data.balance.total.decimals || 8;
              setBalance(data.balance.total.u64 / Math.pow(10, decimals));
            }
          })
          .catch((error) => {
            console.error("Error fetching token balance:", error);
            setBalance(0);
          });
      } else {
        axios
          .get(`${nodeUrl}/account/${wallet}/wart_balance`)
          .then((response) => {
            const data = response?.data?.data;
            setBalance(data?.wart?.total?.E8 ? Number(data.wart.total.E8) / 1e8 : 0);
          })
          .catch((error) => {
            console.error("Error fetching WART balance:", error);
            setBalance(0);
          });
      }
    }
  }, [wallet, nodeList, selectedNodeIndex, selectedToken]);

  const updateBalanceUSD = useCallback(() => {
    axios
      .get(`${import.meta.env.VITE_APP_COINGECKO_API_URL}`)
      .then((response) => {
        const data = response?.data;
        setBalanceUSD(data?.warthog?.usd ? parseFloat(data.warthog.usd) : 0);
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

  useEffect(() => {
    if (wallet) {
      updateBalance();
      const intervalIdPrice = setInterval(updateBalanceUSD, 1500);
      const intervalId = setInterval(updateBalance, 1500);
      return () => {
        clearInterval(intervalIdPrice);
        clearInterval(intervalId);
      };
    }
  }, [wallet, selectedToken, selectedNodeIndex, updateBalance, updateBalanceUSD]);

  const flattenHistoryBlocks = () => {
    const rows: { type: string; tx: NodeTx; confirmations: number }[] = [];
    historyBlocks.forEach(block => {
      const confirmations = block.confirmations || 0;
      NODE_TX_TYPES.forEach(type => {
        const entries = block.body?.[type];
        if (Array.isArray(entries)) {
          entries.forEach((entry: { transaction?: NodeTx }) => {
            rows.push({
              type,
              tx: entry.transaction ?? {},
              confirmations
            });
          });
        }
      });
    });
    return rows;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case Tab.Actions:
        return (
          <div className="space-y-4">
            <div className="p-2.5 bg-white/10 w-full rounded-48 backdrop-blur-[9px] flex-col justify-center items-center gap-4 inline-flex">
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <p className="text-white/50 text-sm mb-1">Wallet</p>
                  <p className="text-white text-2xl font-semibold">
                    {balance ? parseFloat(balance.toFixed(2)) : '0.00'} {selectedToken.name}
                  </p>
                  <p className="text-white/50 text-sm">
                    ${(balance * balanceUSD).toFixed(2)}
                  </p>
                </div>
                <TokenSelector
                  selectedToken={selectedToken}
                  onSelect={setSelectedToken}
                  nodeUrl={nodeList[selectedNodeIndex]}
                />
              </div>
            </div>
            <div className="flex flex-row justify-center gap-3 w-full">
              <div
                className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                onClick={() => navigate("/send")}
              >
                <IoSend className="text-2xl text-primary" />
                <p className="text-white text-sm font-semibold">Send</p>
              </div>
              <div
                className="p-4 bg-white/10 rounded-xl flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200 min-w-[80px]"
                onClick={() => navigate("/trade")}
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
            </div>
          </div>
        );

      case Tab.History:
        return (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {historyBlocks.length === 0 && !historyLoading && (
              <div className="text-center text-white/50 py-8">
                No transaction history
              </div>
            )}
            {flattenHistoryBlocks().map((item, idx) => (
              <HistoryTxRow
                key={`${item.tx?.hash}-${idx}`}
                type={item.type}
                tx={item.tx}
                confirmations={item.confirmations}
              />
            ))}
            {historyLoading && (
              <div className="flex justify-center py-4">
                <FaSync className="animate-spin text-white/50" size={20} />
              </div>
            )}
            {historyHasMore && !historyLoading && (
              <div ref={historyObserverRef} className="h-10" />
            )}
            {!historyHasMore && historyBlocks.length > 0 && (
              <div className="text-center text-white/30 text-sm py-4">
                No more transactions
              </div>
            )}
          </div>
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
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleReject}
              className="flex-1 px-4 py-2 border border-white/30 text-white rounded-lg hover:bg-white/10"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              className="flex-1 px-4 py-2 bg-primary text-black font-semibold rounded-lg hover:bg-primary/80"
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