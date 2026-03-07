import React, { useState, useEffect, useRef } from "react";
import { IoSettingsOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import useWallet from "../hooks/useWallet";

interface ProfileHeaderProps {
  wallet: string | null;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ wallet }) => {
  const { selectedWalletIndex } = useWallet();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { name, clearToken } = useWallet();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const formatAddress = (addr: string): string => {
    if (!addr) return "";
    const noPrefix = addr.startsWith("0x") ? addr.slice(2) : addr;
    if (noPrefix.length <= 8) return noPrefix;
    return `${noPrefix.slice(0, 4)}...${noPrefix.slice(-4)}`;
  };

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsMenuOpen(false);
    }
  };

  const handleLockScreen = () => {
    clearToken();
    navigate("/locked");
  };

  useEffect(() => {
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div
      className="flex justify-between w-full cursor-pointer"
      onClick={() => navigate("/receive")}
    >
      <div className="flex items-center gap-3">
        <Jazzicon diameter={60} seed={selectedWalletIndex} />
        <div className="grid gap-1">
          <h1 className="text-white text-xl font-semibold">{name}</h1>
          <p className="text-white/30 text-xs font-normal">
            {formatAddress(wallet || "")}
          </p>
        </div>
      </div>
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <div
          onClick={toggleMenu}
          className="w-[70px] h-[70px] bg-white/5 rounded-full border border-primary flex justify-center items-center cursor-pointer"
        >
          <IoSettingsOutline
            className={`text-white text-3xl transition-transform duration-300 ${
              isMenuOpen ? "rotate-90" : "rotate-0"
            }`}
          />
        </div>

        {isMenuOpen && (
          <div className="p-5 bg-[#272727] rounded-[10px] border border-[#fdb913] absolute right-0 w-[210px] mt-2">
            <p
              className="text-white text-lg font-normal cursor-pointer"
              onClick={() => navigate("/account-details")}
            >
              Account details
            </p>
            <div className="border border-white/20 my-2" />
            <p
              className="text-white text-lg font-normal cursor-pointer"
              onClick={() => navigate("/manage-account")}
            >
              Manage Accounts
            </p>
            <div className="border border-white/20 my-2" />
            <p
              className="text-white text-lg font-normal cursor-pointer"
              onClick={() => navigate("/select-node")}
            >
              Select Node
            </p>
            <div className="border border-white/20 my-2" />
            <p
              className="text-white text-lg font-normal cursor-pointer"
              onClick={handleLockScreen}
            >
              Lock Screen
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileHeader;
