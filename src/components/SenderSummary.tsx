import { formatWalletAddress } from "../utils";
import useWallet from "../hooks/useWallet";

/** Read-only sender summary. Accounts are selected exclusively in the header. */
export default function SenderSummary() {
  const { name, wallet } = useWallet();
  return <div className="rounded-xl border border-white/10 bg-white/5 p-3">
    <p className="text-sm font-semibold">{name}</p>
    <p className="text-xs text-zinc-500 font-mono">{formatWalletAddress(wallet || "")}</p>
  </div>;
}
