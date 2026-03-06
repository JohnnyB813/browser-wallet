import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import {
  IoSwapVertical,
  IoAddCircle,
  IoRemoveCircle,
  IoCloseCircle,
  IoCreate,
  IoTrendingUp,
  IoTrendingDown,
  IoCash,
  IoWater,
} from "react-icons/io5";

interface TransactionType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

const transactionTypes: TransactionType[] = [
  {
    id: "wart",
    title: "Send WART",
    description: "Transfer native WART tokens",
    icon: <IoCash className="text-3xl text-primary" />,
    route: "/send",
  },
  {
    id: "token",
    title: "Send Token",
    description: "Transfer existing tokens/assets",
    icon: <IoSwapVertical className="text-3xl text-primary" />,
    route: "/send-token",
  },
  {
    id: "liquidity",
    title: "Transfer Liquidity",
    description: "Transfer liquidity pool tokens",
    icon: <IoWater className="text-3xl text-primary" />,
    route: "/transfer-liquidity",
  },
  {
    id: "buy",
    title: "Buy Token",
    description: "Buy tokens with WART at limit price",
    icon: <IoTrendingUp className="text-3xl text-primary" />,
    route: "/buy-token",
  },
  {
    id: "sell",
    title: "Sell Token",
    description: "Sell tokens for WART at limit price",
    icon: <IoTrendingDown className="text-3xl text-primary" />,
    route: "/sell-token",
  },
  {
    id: "add-liquidity",
    title: "Add Liquidity",
    description: "Deposit tokens + WART to pool",
    icon: <IoAddCircle className="text-3xl text-primary" />,
    route: "/add-liquidity",
  },
  {
    id: "remove-liquidity",
    title: "Remove Liquidity",
    description: "Withdraw tokens + WART from pool",
    icon: <IoRemoveCircle className="text-3xl text-primary" />,
    route: "/remove-liquidity",
  },
  {
    id: "cancel",
    title: "Cancel Order",
    description: "Cancel a pending limit order",
    icon: <IoCloseCircle className="text-3xl text-primary" />,
    route: "/cancel-order",
  },
  {
    id: "create",
    title: "Create Token",
    description: "Mint a new token with supply",
    icon: <IoCreate className="text-3xl text-primary" />,
    route: "/create-token",
  },
];

function TransactionTypePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen container">
      <Header title="Select Transaction" />

      <div className="grid grid-cols-2 gap-3 mt-4">
        {transactionTypes.map((type) => (
          <div
            key={type.id}
            className="p-4 bg-white/10 backdrop-blur-[9px] rounded-48 flex flex-col items-center gap-2 cursor-pointer border border-transparent hover:border-primary/50 transition-all duration-200"
            onClick={() => navigate(type.route)}
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              {type.icon}
            </div>
            <p className="text-white text-sm font-semibold text-center">
              {type.title}
            </p>
            <p className="text-white/50 text-xs text-center">
              {type.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TransactionTypePage;
