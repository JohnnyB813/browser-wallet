import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Header from "./Header";
import useWallet from "../hooks/useWallet";
import { isDefiNode } from "../utils/nodes";

/**
 * Swaps, pools, and the DeFi hub render only while a DeFi testnet node
 * is selected. Mainnet keeps the send wallet.
 */
export default function DefiNodeGate({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { selectedNode } = useWallet();

  if (isDefiNode(selectedNode)) return <>{children}</>;

  return (
    <div className="defi-page container">
      <Header title={title} />
      <p className="defi-empty">
        Switch to a DeFi testnet node to use swaps, pools, and assets.
      </p>
      <button
        type="button"
        className="defi-btn-primary"
        onClick={() => navigate("/select-node")}
      >
        Select DeFi node
      </button>
    </div>
  );
}
