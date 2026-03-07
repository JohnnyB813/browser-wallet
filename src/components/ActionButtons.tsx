import React from "react";
import Button from "../components/Button";
import { useNavigate } from "react-router-dom";

const ActionButtons: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex justify-center w-full">
      <Button
        variant="primary"
        ariaLabel="Send"
        className="w-1/2"
        onClick={() => navigate("/transactions")}
      >
        Send
      </Button>
    </div>
  );
};

export default ActionButtons;
