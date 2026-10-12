import React from "react";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";

interface CancelConfirmModalProps {
  tx: any;
  type: string;
  onCancel: () => void;
}

const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({ tx, type, onCancel }) => {
  const navigate = useNavigate();
  const { setTmpCancelHeightState, setTmpCancelNonceIdState } = useWallet();

  const signedCommon = tx?.signedCommon;
  const txHash = tx?.hash;

  const handleConfirm = () => {
    if (signedCommon) {
      setTmpCancelHeightState(signedCommon.pinHeight);
      setTmpCancelNonceIdState(signedCommon.nonceId);
      navigate("/cancel-order-step2");
    }
  };

  const getTxTypeLabel = (type: string): string => {
    switch (type) {
      case "wartTransfer": return "WART Transfer";
      case "tokenTransfer": return "Token Transfer";
      case "assetCreation": return "Asset Creation";
      case "cancelation": return "Cancelation";
      case "liquidityDeposit": return "Liquidity Deposit";
      case "liquidityWithdrawal": return "Liquidity Withdrawal";
      case "limitSwap": return "Limit Swap";
      case "reward": return "Reward";
      case "match": return "Match";
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm z-50">
      <div className="bg-[#1A1A1A] rounded-lg p-6 max-w-md w-full border border-primary/25">
        <h3 className="text-white text-xl font-semibold mb-4">Cancel Transaction</h3>

        <div className="space-y-3 mb-6">
          {txHash && (
            <div className="flex items-start gap-2">
              <span className="text-white/50 text-sm w-24">Tx Hash:</span>
              <span className="text-white font-mono text-sm break-all">{txHash}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-white/50 text-sm w-24">Type:</span>
            <span className="text-white text-sm">{getTxTypeLabel(type)}</span>
          </div>
          {signedCommon && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-sm w-24">Account ID:</span>
                <span className="text-white font-mono text-sm">{signedCommon.originId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-sm w-24">Nonce ID:</span>
                <span className="text-white font-mono text-sm">{signedCommon.nonceId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-sm w-24">Pin Height:</span>
                <span className="text-white font-mono text-sm">{signedCommon.pinHeight}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-white/30 text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            Go Back
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Confirm Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelConfirmModal;