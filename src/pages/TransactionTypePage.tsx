import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import { IoWater, IoCloseCircle, IoTrendingUp, IoCash } from "react-icons/io5";

interface TransactionType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
}

const transactionTypes: TransactionType[] = [
  {
    id: "send",
    title: "Send",
    description: "Transfer WART, tokens, or liquidity",
    icon: <IoCash className="text-3xl text-primary" />,
    route: "/send",
  },
  {
    id: "trade",
    title: "Trade",
    description: "Buy or sell tokens at limit price",
    icon: <IoTrendingUp className="text-3xl text-primary" />,
    route: "/trade",
  },
  {
    id: "liquidity",
    title: "Liquidity",
    description: "Add or remove liquidity from pools",
    icon: <IoWater className="text-3xl text-primary" />,
    route: "/liquidity",
  },
  {
    id: "cancel",
    title: "Cancel Order",
    description: "Cancel a pending limit order",
    icon: <IoCloseCircle className="text-3xl text-primary" />,
    route: "/cancel-order",
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
