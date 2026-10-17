import React from "react";
import { useNavigate } from "react-router-dom";
import { IoArrowDownCircle } from "react-icons/io5";
import { formatWalletAddress } from "../utils";

interface WalletInfoProps {
  wallet: string | null;
  onCopy: () => void;
}

const WalletInfo: React.FC<WalletInfoProps> = ({ wallet, onCopy }) => {
  const navigate = useNavigate();

  return (
    <div className="flex-col gap-2.5 py-4 px-2 rounded-[10px] border border-[#e0e0e0] w-full">
      <div className="flex items-center gap-3">
        <div className="w-[27px] h-[27px] bg-linear-to-br from-primary to-[#9f750d] rounded-full" />
        <h2
          className="text-white text-lg font-normal cursor-pointer"
          onClick={onCopy}
        >
          {formatWalletAddress(wallet || "")}
        </h2>
      </div>
      <div className="flex gap-8 mt-5">
        <button
          onClick={() => navigate("/receive")}
          className="flex items-center gap-2"
        >
          <IoArrowDownCircle className="w-5 h-5 text-white" />
          <span className="text-white text-sm">Receive</span>
        </button>
      </div>
    </div>
  );
};

export default WalletInfo;
