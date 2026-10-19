import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { IoSettingsOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import { addressToSeed } from "../utils";
import useWallet from "../hooks/useWallet";

type MenuPos = { top: number; right: number };

interface ProfileHeaderProps {
  /**
   * Address of the active account. Optional: when omitted the address is read
   * from wallet context, so callers that render <ProfileHeader /> bare (the
   * DefiHub header) keep working.
   */
  wallet?: string | null;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ wallet }) => {
  const { wallet: contextWallet } = useWallet();
  const activeWallet = wallet ?? contextWallet ?? "";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const { name, lockSession } = useWallet();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  const formatAddress = (addr: string): string => {
    if (!addr) return "";
    const noPrefix = addr.startsWith("0x") ? addr.slice(2) : addr;
    if (noPrefix.length <= 8) return noPrefix;
    return `${noPrefix.slice(0, 4)}...${noPrefix.slice(-4)}`;
  };

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const updateMenuPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    // Fixed coords so the menu is not trapped under .main-balance-hero /
    // backdrop-filter stacking on .main-home-card.
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  const handleClickOutside = (event: MouseEvent) => {
    const t = event.target as Node;
    // Ignore clicks on the toggle button itself, otherwise opening the menu
    // immediately closes it.
    if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) {
      return;
    }
    setIsMenuOpen(false);
  };

  const handleLockScreen = () => {
    void lockSession().then(() => navigate("/login-saved"));
  };

  const go = (path: string) => {
    setIsMenuOpen(false);
    navigate(path);
  };

  useLayoutEffect(() => {
    if (!isMenuOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
  }, [isMenuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isMenuOpen) return;

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", updateMenuPosition);
    // Popup content scrolls on #root
    const scrollRoot = document.getElementById("root");
    scrollRoot?.addEventListener("scroll", updateMenuPosition, { passive: true });
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", updateMenuPosition);
      scrollRoot?.removeEventListener("scroll", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isMenuOpen, updateMenuPosition]);

  const menu =
    isMenuOpen &&
    menuPos &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        className="p-5 bg-[#272727] rounded-[10px] border border-primary w-[210px] shadow-xl"
        style={{
          position: "fixed",
          top: menuPos.top,
          right: menuPos.right,
          zIndex: 2147483000,
        }}
      >
        <p
          className="text-white text-lg font-normal cursor-pointer"
          role="menuitem"
          onClick={() => go("/account-details")}
        >
          Account details
        </p>
        <div className="border border-white/20 my-2" />
        <p
          className="text-white text-lg font-normal cursor-pointer"
          role="menuitem"
          onClick={() => go("/manage-account")}
        >
          Manage Accounts
        </p>
        <div className="border border-white/20 my-2" />
        <p
          className="text-white text-lg font-normal cursor-pointer"
          role="menuitem"
          onClick={() => go("/select-node")}
        >
          Select Node
        </p>
        <div className="border border-white/20 my-2" />
        <p
          className="text-white text-lg font-normal cursor-pointer"
          role="menuitem"
          onClick={() => go("/safetrade")}
        >
          SafeTrade
        </p>
        <div className="border border-white/20 my-2" />
        <p
          className="text-white text-lg font-normal cursor-pointer"
          role="menuitem"
          onClick={handleLockScreen}
        >
          Lock Screen
        </p>
      </div>,
      document.body,
    );

  return (
    // z-30 + shrink-0/self-start: the DefiHub header lays this out in a flex
    // row, where a shrinkable right column would collapse the settings button.
    <div
      className="flex justify-between w-full cursor-pointer relative z-30"
      onClick={() => navigate("/receive")}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Seed from the address, not the index: the index changes when the
            user switches accounts, which would recolour the avatar. */}
        <Jazzicon diameter={60} seed={addressToSeed(activeWallet)} />
        <div className="grid min-w-0 gap-1">
          <h1 className="text-white text-xl font-semibold truncate">{name}</h1>
          <p className="text-white/30 text-xs font-normal">
            {formatAddress(activeWallet)}
          </p>
        </div>
      </div>
      <div className="relative shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
        <div
          ref={buttonRef}
          onClick={toggleMenu}
          className="w-9 h-9 bg-white/5 rounded-full border border-primary flex justify-center items-center cursor-pointer"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
        >
          <IoSettingsOutline
            className={`text-white text-lg transition-transform duration-300 ${
              isMenuOpen ? "rotate-90" : "rotate-0"
            }`}
          />
        </div>
        {menu}
      </div>
    </div>
  );
};

export default ProfileHeader;
