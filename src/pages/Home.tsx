import React, { useState, useEffect } from "react";
import axios from "axios";
import ProfileHeader from "../components/ProfileHeader";
import Balance from "../components/Balance";
import TabNavigation from "../components/TabNavigation";
import TokenItem from "../components/TokenItem";
import ActivityItem from "../components/ActivityItem";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { IoCash, IoTrendingUp, IoWater, IoCloseCircle } from "react-icons/io5";

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
  const { wallet, selectedNodeIndex, nodeList } = useWallet();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Assets);
  const [balance, setBalance] = useState(0);
  const [balanceUSD, setBalanceUSD] = useState(0);

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
      <div className="p-2.5 bg-white/10 w-full rounded-48 backdrop-blur-[9px] flex-col justify-center items-center gap-4 inline-flex">
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
            <IoCash className="text-2xl text-primary" />
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
