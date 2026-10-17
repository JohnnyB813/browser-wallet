import React from "react";
import { FaGift, FaCoins, FaExchangeAlt, FaPlus, FaMinus, FaTimes, FaClipboardList } from "react-icons/fa";
import { EXPLORER_URL } from "../config";
import type { IconType } from "react-icons";
import type { NodeTx, NodeTxData } from "../types/nodeTx";

interface HistoryTxRowProps {
  type: string;
  tx: NodeTx;
  confirmations: number;
}

function TxTypeIcon({ type }: { type: string }) {
  const icons: Record<string, IconType> = {
    wartTransfer: FaCoins,
    tokenTransfer: FaExchangeAlt,
    assetCreation: FaPlus,
    cancelation: FaTimes,
    liquidityDeposit: FaPlus,
    liquidityWithdrawal: FaMinus,
    limitSwap: FaClipboardList,
    reward: FaGift,
    match: FaExchangeAlt,
  };
  const Icon = icons[type] || FaCoins;
  return <Icon size={14} />;
}

function getTxLabel(type: string, data: NodeTxData | undefined): string {
  switch (type) {
    case "wartTransfer":
      return `Send ${data?.amount?.str || "?"} WART`;
    case "tokenTransfer":
      return `Send ${data?.amount?.str || "?"} ${data?.asset?.name || "?"}`;
    case "assetCreation":
      return `Create ${data?.name || "?"}`;
    case "cancelation":
      return "Cancel Order";
    case "liquidityDeposit":
      return `Add ${data?.baseAsset?.name || "?"} Liquidity`;
    case "liquidityWithdrawal":
      return `Remove ${data?.baseAsset?.name || "?"} Liquidity`;
    case "limitSwap":
      return data?.buy ? "Buy Limit" : "Sell Limit";
    case "reward":
      return "Block Reward";
    case "match":
      return "Swap Match";
    default:
      return type;
  }
}

const HistoryTxRow: React.FC<HistoryTxRowProps> = ({ type, tx, confirmations }) => {
  const data = tx?.data;
  const txHash = tx?.hash;
  const explorerUrl = EXPLORER_URL;

  return (
    <a
      href={`${explorerUrl}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 py-3 px-4 bg-white/5 rounded-lg border border-white/10 hover:border-primary/50 transition-colors cursor-pointer no-underline"
    >
      <div className={`px-2 py-1 rounded-sm text-xs font-medium ${type === "wartTransfer" || type === "tokenTransfer" ? "bg-blue-500/20 text-blue-400" : type === "assetCreation" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>
        <TxTypeIcon type={type} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-medium truncate">
          {getTxLabel(type, data)}
        </div>
        <div className="text-white/50 text-xs">
          {confirmations} confirmations
        </div>
      </div>
      <span className="text-primary hover:underline font-mono text-xs">
        {txHash?.slice(0, 8)}...
      </span>
    </a>
  );
};

export default HistoryTxRow;