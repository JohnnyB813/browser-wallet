import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import browser from "webextension-polyfill";
import Start from "./pages/startedPage";
import Intro from "./pages/intro";
import ImportPage from "./pages/importPage";
import RecoveryPhase from "./pages/RecoveryPhase";
import ValidateIntro from "./pages/validateIntro";
import Validate from "./pages/validate";
import SetPassword from "./pages/SetPassword";
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

const App: React.FC = () => {
  const {
    seedPhrase,
    wallet,
    password,
    token,
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
    if (sendMode && sendToAddress) {
      if (!token) {
        navigate("/locked", { state: { from: `/send?address=${sendToAddress}` } });
      } else {
        navigate(`/send?address=${sendToAddress}`);
      }
    }
  }, [sendMode, sendToAddress, token, navigate]);

  useEffect(() => {
    const checkPendingSend = async () => {
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
    const handleStorageChange = async (changes: any) => {
      if (changes.pendingApproval && changes.pendingApproval.newValue) {
        try {
          const data = JSON.parse(changes.pendingApproval.newValue);
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
  }, [navigate]);

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
    if (seedPhrase && wallet && password) {
      if (!token) {
        clearToken();
        navigate("/locked");
      }
    }
  }, [token, clearToken, navigate, seedPhrase, wallet, password]);

  // For send mode with address, redirect to send page
  // (normal routing will handle approval mode by showing Home with pending approval banner)
  if (sendMode && sendToAddress && token) {
    // This is handled in a useEffect above
  }

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
      {/* <Route path="" element={<LockScreen />} /> */}
      <Route path="/receive" element={<ReceivePage />} />
      <Route path="/send" element={<SendPage />} />
      <Route path="/sendstep2" element={<SendFinalStep />} />
      <Route path="/manage-account" element={<ManageAccounts />} />
      <Route path="/select-node" element={<SelectNode />} />
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
    </Routes>
  );

  const UnauthenticatedRoutes = () => (
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/intro" element={<Intro />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/recover" element={<RecoveryPhase />} />
      <Route path="/validate" element={<Validate />} />
      <Route
        path="/validate-intro"
        element={
          <ValidateIntro
            recoveryPhrase={seedPhrase?.split(" ") || []}
            onGoBack={() => navigate(-2)}
            onComplete={() => navigate("/set-password")}
          />
        }
      />
      <Route path="/set-password" element={<SetPassword />} />
    </Routes>
  );

  return seedPhrase && wallet && password ? (
    <AuthenticatedRoutes />
  ) : (
    <UnauthenticatedRoutes />
  );
};

export default App;
