import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import browser from "webextension-polyfill";
import type { Storage } from "webextension-polyfill/namespaces/storage";
import Start from "./pages/startedPage";
import Intro from "./pages/intro";
import ImportPage from "./pages/importPage";
import ImportPrivateKey from "./pages/ImportPrivateKey";
import LoginSaved from "./pages/LoginSaved";
import LoginFile from "./pages/LoginFile";
import RecoveryPhase from "./pages/RecoveryPhase";
import ValidateIntro from "./pages/validateIntro";
import Validate from "./pages/validate";
import SetPassword from "./pages/SetPassword";
import SecureSetup from "./pages/SecureSetup";
import Home from "./pages/Home";
import LockScreen from "./pages/LockScreen";
import ReceivePage from "./pages/ReceivePage";
import SendPage from "./pages/SendPage";
import ManageAccounts from "./pages/ManageAccounts";
import AccountDetails from "./pages/AccountDetails";
import ShowPrivateKey from "./pages/ShowPrivateKey";
import useWallet from "./hooks/useWallet";
import SendFinalStep from "./pages/Sendstep2";
import SelectNode from "./pages/SelectNode";
import TradePage from "./pages/TradePage";
import TradeStep2 from "./pages/TradeStep2";
import LiquidityPage from "./pages/LiquidityPage";
import LiquidityStep2 from "./pages/LiquidityStep2";
import CancelOrderPage from "./pages/CancelOrderPage";
import CancelOrderStep2 from "./pages/CancelOrderStep2";
import CreateTokenPage from "./pages/CreateTokenPage";
import CreateTokenStep2 from "./pages/CreateTokenStep2";
import DefiHub from "./pages/DefiHub";
import SwapPage from "./pages/SwapPage";
import ChainSend from "./pages/ChainSend";
import SafeTradePage from "./pages/SafeTradePage";
import AavePage from "./pages/AavePage";
import AppToast from "./components/AppToast";
import { useChainAccounts } from "./chains/useChainAccounts";
import ActivityDetailPage from "./pages/ActivityDetailPage";
import PasskeyHost from "./pages/PasskeyHost";
import LedgerHost from "./pages/LedgerHost";
import { takeLedgerPanelRoute } from "./ledger/session";
import { isExtensionSidePanel } from "./utils/extensionNav";

const App: React.FC = () => {
  const {
    seedPhrase,
    wallet,
    password,
    token,
    isAuthenticated,
    sessionReady,
    clearToken,
    refreshTokenExpiration,
  } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const [initialUrlProcessed, setInitialUrlProcessed] = useState(false);

  const sendMode = new URLSearchParams(initialUrlProcessed ? location.search : window.location.search).get('mode') === 'send';
  const sendToAddress = new URLSearchParams(initialUrlProcessed ? location.search : window.location.search).get('to') || '';

  useEffect(() => {
    if (!initialUrlProcessed && window.location.search) {
      setInitialUrlProcessed(true);
    }
  }, [initialUrlProcessed]);

  useEffect(() => {
    if (!isExtensionSidePanel()) return;
    let alive = true;
    const pull = async () => {
      const route = await takeLedgerPanelRoute();
      if (!alive || !route) return;
      navigate(route, { replace: true });
    };
    void pull();
    const onChanged = (
      changes: Record<string, Storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "session" && area !== "local") return;
      if (!changes.warthogLedgerPanelRoute) return;
      void pull();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, [navigate]);

  useEffect(() => {
    if (location.pathname === "/passkey-host" || location.pathname === "/ledger-host") return;
    if (sendMode && sendToAddress) {
      if (!token) {
        navigate("/locked", { state: { from: `/send?address=${sendToAddress}` } });
      } else {
        navigate(`/send?address=${sendToAddress}`);
      }
    }
  }, [sendMode, sendToAddress, token, navigate, location.pathname]);

  useEffect(() => {
    const checkPendingSend = async () => {
      if (location.pathname === "/passkey-host" || location.pathname === "/ledger-host") return;
      try {
        const result = await browser.storage.local.get('pendingApproval');
        if (result.pendingApproval) {
          const data = JSON.parse(result.pendingApproval as string);
          if (data.action === 'sendTo' && data.to) {
            await browser.storage.local.remove('pendingApproval');
            navigate(`/send?address=${data.to}`);
          }
        }
      } catch (e) {
        console.error('Error checking pending send:', e);
      }
    };

    checkPendingSend();
  }, [location.pathname, navigate]);

  useEffect(() => {
    // Params are contextually typed by addListener as
    // (changes: Record<string, StorageChange>, areaName: string).
    const handleStorageChange = async (
      changes: Record<string, Storage.StorageChange>,
    ) => {
      if (location.pathname === "/passkey-host" || location.pathname === "/ledger-host") return;
      const change = changes.pendingApproval;
      if (change && change.newValue) {
        try {
          const data = JSON.parse(change.newValue as string);
          if (data.action === 'sendTo' && data.to) {
            await browser.storage.local.remove('pendingApproval');
            navigate(`/send?address=${data.to}`);
          }
        } catch (e) {
          console.error('Error handling storage change:', e);
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [navigate, location.pathname]);

  useEffect(() => {
    const handleActivity = () => {
      if (token) {
        refreshTokenExpiration();
      }
    };
    window.addEventListener("click", handleActivity);
    window.addEventListener("keydown", handleActivity);
    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [token, refreshTokenExpiration]);

  useEffect(() => {
    if (location.pathname === "/passkey-host" || location.pathname === "/ledger-host") return;
    if (seedPhrase && wallet && password) {
      if (!token) {
        clearToken();
        navigate("/locked");
      }
    }
  }, [token, clearToken, navigate, seedPhrase, wallet, password, location.pathname]);

  const AuthenticatedRoutes = () => (
    <Routes>
      <Route
        path="/"
        element={<Home />}
      />
      <Route
        path="/home"
        element={<Home />}
      />
      <Route path="/locked" element={<LockScreen />} />
      <Route path="/receive" element={<ReceivePage />} />
      <Route path="/send" element={<SendPage />} />
      <Route path="/sendstep2" element={<SendFinalStep />} />
      <Route path="/manage-account" element={<ManageAccounts />} />
      <Route path="/select-node" element={<SelectNode />} />
      <Route path="/mainnet-nodes" element={<SelectNode family="mainnet" />} />
      <Route path="/defi" element={<DefiHub />} />
      <Route path="/swap" element={<SwapPage />} />
      <Route path="/chain-send" element={<ChainSend />} />
      <Route path="/safetrade" element={<SafeTradePage />} />
      <Route path="/aave" element={<AavePage />} />
      <Route path="/activity-details" element={<ActivityDetailPage />} />
      <Route path="/account-details" element={<AccountDetails />} />
      <Route path="/private-key" element={<ShowPrivateKey />} />
      <Route path="/trade" element={<TradePage />} />
      <Route path="/trade-step2" element={<TradeStep2 />} />
      <Route path="/liquidity" element={<LiquidityPage />} />
      <Route path="/liquidity-step2" element={<LiquidityStep2 />} />
      <Route path="/cancel-order" element={<CancelOrderPage />} />
      <Route path="/cancel-order-step2" element={<CancelOrderStep2 />} />
      <Route path="/create-token" element={<CreateTokenPage />} />
      <Route path="/create-token-step2" element={<CreateTokenStep2 />} />
      <Route path="/secure-setup" element={<SecureSetup />} />
    </Routes>
  );

  const UnauthenticatedRoutes = () => (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/intro" element={<Intro />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/import-key" element={<ImportPrivateKey />} />
      <Route path="/login-saved" element={<LoginSaved />} />
      <Route path="/login-file" element={<LoginFile />} />
      <Route path="/recover" element={<RecoveryPhase />} />
      <Route path="/validate" element={<Validate />} />
      <Route
        path="/validate-intro"
        element={
          <ValidateIntro
            recoveryPhrase={seedPhrase?.split(/\s+/).filter(Boolean) || []}
            onGoBack={() => navigate(-2)}
            onComplete={() => navigate("/set-password")}
          />
        }
      />
      <Route path="/set-password" element={<SetPassword />} />
      <Route path="/secure-setup" element={<SecureSetup />} />
    </Routes>
  );

  if (location.pathname === "/passkey-host") {
    return <PasskeyHost />;
  }

  if (location.pathname === "/ledger-host") {
    return <LedgerHost />;
  }

  if (!sessionReady) {
    return null;
  }

  return (
    <>
      <ChainSessionSync />
      <AppToast />
      {isAuthenticated ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />}
    </>
  );
};

function ChainSessionSync() {
  useChainAccounts();
  return null;
}

export default App;
