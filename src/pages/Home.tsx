import React, { useState, useEffect } from "react";
import axios from "axios";
import ProfileHeader from "../components/ProfileHeader";
import Balance from "../components/Balance";
import TabNavigation from "../components/TabNavigation";
import TokenItem from "../components/TokenItem";
import ActivityItem from "../components/ActivityItem";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { IoSend, IoTrendingUp, IoWater, IoCloseCircle } from "react-icons/io5";
import { FaChevronDown } from "react-icons/fa";
import Jazzicon from "react-jazzicon";
import { getPendingApproval, approveRequest, rejectRequest, PendingApproval } from "../utils/extensionApi";
import { addressToSeed } from "../utils";

interface Activity {
  date: string;
  action: string;
  amount: string;
  usdAmount: string;
}

interface Props {
  setSelectedActivity: (activity: Activity) => void;
}

enum Tab {
  Assets,
  Activity,
}

const activities: Activity[] = [
  // {
  //     date: "Nov 13, 2024",
  //     action: "Send USDT",
  //     amount: "-10 USDT",
  //     usdAmount: "-$10.01 USD",
  // },
];

const Home: React.FC<Props> = ({ setSelectedActivity }) => {
  const { wallet, selectedNodeIndex, nodeList, walletList, nameList } = useWallet();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Assets);
  const [balance, setBalance] = useState(0);
  const [balanceUSD, setBalanceUSD] = useState(0);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);
  const [approvalWalletIndex, setApprovalWalletIndex] = useState(selectedNodeIndex);
  const [isDropdownVisible, setDropdownVisible] = useState(false);

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

  const handleActivityClick = (activityItem: Activity) => {
    setSelectedActivity(activityItem);
    navigate("/activity-details");
  };

  const updateBalance = () => {
    if (wallet) {
      axios
        .get(`${nodeList[selectedNodeIndex]}/account/${wallet}/balance`)
        .then((response) => {
          console.log("**** here is Home page response", response);
          const data = response?.data?.data;
          console.log("**** here is Home page response data", data);
          setBalance(data?.balance ? parseFloat(data?.balance) : 0);
          console.log(
            "**** here is Home page response data balance",
            data?.balance,
          );
        })
        .catch((error) => {
          console.error("Error fetching balance:", error);
        });
    }
  };

  const updateBalanceUSD = () => {
    axios
      .get(`${import.meta.env.VITE_APP_COINGECKO_API_URL}`)
      .then((response) => {
        const data = response?.data;
        setBalanceUSD(data?.warthog?.usd ? parseFloat(data.warthog.usd) : 0);
      })
      .catch((error) => {
        console.error("Error fetching balance:", error);
      });
  };

  useEffect(() => {
    console.log("**** here is Home page");
    if (wallet) {
      updateBalance();

      const intervalIdPrice = setInterval(updateBalanceUSD, 1500);
      const intervalId = setInterval(updateBalance, 1500);
      return () => {
        clearInterval(intervalIdPrice);
        clearInterval(intervalId);
      };
    }
  }, []);

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
              <IoCloseCircle size={24} />
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
      <div className="p-2.5 bg-white/10 w-full rounded-48 backdrop-blur-[9px] flex-col justify-center items-center gap-4 inline-flex overflow-visible">
        <ProfileHeader wallet={wallet} />
      </div>
      <div className="p-2.5 bg-white/10 w-full rounded-48 backdrop-blur-[9px] flex-col justify-center items-center gap-4 inline-flex mt-4">
        <Balance
          balance={balance ? parseFloat(balance.toFixed(2)) : 0}
          usdValue={balanceUSD ? parseFloat(balanceUSD.toFixed(2)) : 0}
        />
        <div className="grid grid-cols-4 gap-2 w-full">
          <div
            className="p-2 bg-white/10 rounded-lg flex flex-col items-center gap-1 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200"
            onClick={() => navigate("/send")}
          >
            <IoSend className="text-2xl text-primary" />
            <p className="text-white text-xs font-semibold">Send</p>
          </div>
          <div
            className="p-2 bg-white/10 rounded-lg flex flex-col items-center gap-1 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200"
            onClick={() => navigate("/trade")}
          >
            <IoTrendingUp className="text-2xl text-primary" />
            <p className="text-white text-xs font-semibold">Trade</p>
          </div>
          <div
            className="p-2 bg-white/10 rounded-lg flex flex-col items-center gap-1 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200"
            onClick={() => navigate("/liquidity")}
          >
            <IoWater className="text-2xl text-primary" />
            <p className="text-white text-xs font-semibold">Liquidity</p>
          </div>
          <div
            className="p-2 bg-white/10 rounded-lg flex flex-col items-center gap-1 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200"
            onClick={() => navigate("/cancel-order")}
          >
            <IoCloseCircle className="text-2xl text-primary" />
            <p className="text-white text-xs font-semibold">Cancel</p>
          </div>
        </div>
      </div>
      <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
      {activeTab === Tab.Assets ? (
        <>
          <div className="flex justify-end mt-4">
            <button
              onClick={() => navigate("/create-token")}
              className="text-primary text-sm hover:underline"
            >
              + create asset
            </button>
          </div>
          <TokenItem
            token="WART"
            balance={balance ? parseFloat(balance.toFixed(2)) : 0}
            usdValue={balanceUSD ? parseFloat(balanceUSD.toFixed(2)) : 0}
          />
        </>
      ) : (
        <ActivityItem
          activities={activities}
          onActivityClick={handleActivityClick}
        />
      )}
    </div>
  );
};

export default Home;
