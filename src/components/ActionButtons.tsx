import React from "react";
import Button from "./Button";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { isDefiNode } from "../utils/nodes";

const ActionButtons: React.FC = () => {
  const navigate = useNavigate();
  const { selectedNode } = useWallet();
  const showDefi = isDefiNode(selectedNode);

  return (
    <div className="flex flex-col w-full gap-3">
      <div className="flex justify-between w-full gap-3">
        <Button
          variant="primary"
          ariaLabel="Send"
          className="w-full"
          onClick={() => navigate("/send")}
        >
          Send
        </Button>
        <Button
          variant="white"
          ariaLabel="Receive"
          className="w-full"
          onClick={() => navigate("/receive")}
        >
          Receive
        </Button>
      </div>
      {showDefi && (
        <Button
          variant="outline"
          ariaLabel="DeFi"
          className="w-full py-3!"
          onClick={() => navigate("/defi")}
        >
          DeFi
        </Button>
      )}
    </div>
  );
};

export default ActionButtons;
