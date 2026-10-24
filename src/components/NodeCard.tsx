import { IoMdTrash } from "react-icons/io";
import useWallet from "../hooks/useWallet";

const NodeCard = ({
  id,
  name,
  address,
  status,
  latency,
  setPrimaryNode,
  removeNode,
}: {
  id: number;
  name: string;
  address: string;
  status: string;
  latency: number;
  setPrimaryNode: (id: number) => void;
  removeNode: (id: number) => void;
}) => {
  const { selectedNodeIndex } = useWallet();
  const isSelected = selectedNodeIndex === id;

  return (
    <div
      className={`p-3 flex items-center gap-2 w-full min-w-0 mt-2 rounded-lg border backdrop-blur-md transition-all duration-200 cursor-pointer ${
        isSelected
          ? "bg-primary/20 border-primary/50"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
      }`}
      onClick={() => setPrimaryNode(id)}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            status === "online"
              ? "bg-green-400"
              : status === "offline"
                ? "bg-red-400"
                : "bg-yellow-400 animate-pulse"
          }`}
        />
        <div className="min-w-0">
          <div className="text-white text-sm font-medium truncate">{name}</div>
          <div className="text-white/40 text-xs font-mono truncate">{address.replace(/^https?:\/\//, '')}</div>
        </div>
</div>
      <div className="flex items-center gap-1 shrink-0">
        {latency > 0 && (
          <div className="text-white/30 text-xs tabular-nums">{Math.round(latency)}ms</div>
        )}
        <div
          onClick={(e) => {
            e.stopPropagation();
            removeNode(id);
          }}
          className="p-1.5 rounded-sm hover:bg-red-500/20 transition-colors"
        >
          <IoMdTrash className="w-4 h-4 cursor-pointer text-white/40 hover:text-red-400" />
        </div>
      </div>
    </div>
  );
};

export default NodeCard;
