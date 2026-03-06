import React, { useCallback, useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Loading from "./pages/loading";
import Start from "./pages/startedPage";
import Intro from "./pages/intro";
import ImportPage from "./pages/importPage";
import RecoveryPhase from "./pages/RecoveryPhase";
import ValidateIntro from "./pages/validateIntro";
import Validate from "./pages/validate";
import SetPassword from "./pages/SetPassword";
import Home from "./pages/Home";
import ActivityDetailPage from "./pages/ActivityDetailPage";
import LockScreen from "./pages/LockScreen";
import ReceivePage from "./pages/ReceivePage";
import SendPage from "./pages/SendPage";
import ManageAccounts from "./pages/ManageAccounts";
import AccountDetails from "./pages/AccountDetails";
import ShowPrivateKey from "./pages/ShowPrivateKey";
import useWallet from "./hooks/useWallet";
import SendFinalStep from "./pages/Sendstep2";
import SelectNode from "./pages/SelectNode";
import TransactionTypePage from "./pages/TransactionTypePage";
import TransferTokenPage from "./pages/TransferTokenPage";
import TransferTokenStep2 from "./pages/TransferTokenStep2";
import TransferLiquidityPage from "./pages/TransferLiquidityPage";
import TransferLiquidityStep2 from "./pages/TransferLiquidityStep2";
import BuyTokenPage from "./pages/BuyTokenPage";
import BuyTokenStep2 from "./pages/BuyTokenStep2";
import SellTokenPage from "./pages/SellTokenPage";
import SellTokenStep2 from "./pages/SellTokenStep2";
import AddLiquidityPage from "./pages/AddLiquidityPage";
import AddLiquidityStep2 from "./pages/AddLiquidityStep2";
import RemoveLiquidityPage from "./pages/RemoveLiquidityPage";
import RemoveLiquidityStep2 from "./pages/RemoveLiquidityStep2";
import CancelOrderPage from "./pages/CancelOrderPage";
import CancelOrderStep2 from "./pages/CancelOrderStep2";
import CreateTokenPage from "./pages/CreateTokenPage";
import CreateTokenStep2 from "./pages/CreateTokenStep2";

interface Activity {
  date: string;
  action: string;
  amount: string;
  usdAmount: string;
}

const App: React.FC = () => {
  const { seedPhrase, wallet, password, token, clearToken } = useWallet();
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const navigate = useNavigate();

  const startLoading = useCallback(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setLoading(false), 100);
          return 100;
        }
        return prev + 5;
      });
    }, 10);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const clear = startLoading();
    return clear;
  }, [startLoading]);

  useEffect(() => {
    if (seedPhrase && wallet && password) {
      if (!token) {
        clearToken();
        navigate("/locked");
      }
    }
  }, [token, clearToken, navigate, seedPhrase, wallet, password]);

  if (loading) return <Loading progress={progress} />;

  const AuthenticatedRoutes = () => (
    <Routes>
      <Route
        path="/"
        element={<Home setSelectedActivity={setSelectedActivity} />}
      />
      <Route
        path="/home"
        element={<Home setSelectedActivity={setSelectedActivity} />}
      />
      <Route
        path="/activity-details"
        element={<ActivityDetailPage selectedActivity={selectedActivity} />}
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
      <Route path="/transactions" element={<TransactionTypePage />} />
      <Route path="/send-token" element={<TransferTokenPage />} />
      <Route path="/send-token-step2" element={<TransferTokenStep2 />} />
      <Route path="/transfer-liquidity" element={<TransferLiquidityPage />} />
      <Route
        path="/transfer-liquidity-step2"
        element={<TransferLiquidityStep2 />}
      />
      <Route path="/buy-token" element={<BuyTokenPage />} />
      <Route path="/buy-token-step2" element={<BuyTokenStep2 />} />
      <Route path="/sell-token" element={<SellTokenPage />} />
      <Route path="/sell-token-step2" element={<SellTokenStep2 />} />
      <Route path="/add-liquidity" element={<AddLiquidityPage />} />
      <Route path="/add-liquidity-step2" element={<AddLiquidityStep2 />} />
      <Route path="/remove-liquidity" element={<RemoveLiquidityPage />} />
      <Route
        path="/remove-liquidity-step2"
        element={<RemoveLiquidityStep2 />}
      />
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
