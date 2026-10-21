import { IoMdTrash } from "react-icons/io";
import useWallet from "../hooks/useWallet";

function pingText(status: string, latency: number): string {
  if (status === "online") return `${Math.round(latency)} ms ping`;
  if (status === "offline") return "No reply";
  return "Checking ping…";
}

const NodeCard = ({
  id,
  name,
  address,
  status,
  latency,
  network,
  setPrimaryNode,
  removeNode,
  removable = true,
}: {
  id: number;
  name: string;
  address: string;
  status: string;
  latency: number;
  network: "mainnet" | "defi-testnet";
  setPrimaryNode: (id: number) => void;
  removeNode: (id: number) => void;
  removable?: boolean;
}) => {
  const { selectedNodeIndex } = useWallet();
  const isSelected = selectedNodeIndex === id;
  const defi = network === "defi-testnet";

  return (
    <div
      className={`mt-2 flex w-full items-start gap-2 rounded-lg border p-3 backdrop-blur-md transition-all duration-200 cursor-pointer ${
        isSelected
          ? "bg-primary/20 border-primary/50"
          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
      }`}
      onClick={() => setPrimaryNode(id)}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            status === "online"
              ? "bg-green-400"
              : status === "offline"
                ? "bg-red-400"
                : "bg-yellow-400 animate-pulse"
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">{name}</div>
          <div className="truncate font-mono text-xs text-white/40">{address.replace(/^https?:\/\//, "")}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                defi
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-emerald-500/15 text-emerald-300"
              }`}
            >
              {defi ? "DeFi" : "Mainnet"}
            </span>
            <span className="text-[11px] text-white/45" title="Time for this node to answer a chain check">
              {pingText(status, latency)}
            </span>
          </div>
        </div>
      </div>
      {removable ? (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={(event) => {
            event.stopPropagation();
            removeNode(id);
          }}
          className="shrink-0 rounded-md p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400"
        >
          <IoMdTrash className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export default NodeCard;