import React, { useState } from "react";
import Button from "../components/Button";
import { useNavigate, useLocation } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { IoEye, IoEyeOff } from "react-icons/io5";

function LockScreen() {
  const { password, setToken } = useWallet();
  const [enteredPassword, setEnteredPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnteredPassword(e.target.value);
  };

  const handleSubmit = () => {
    console.log("***** password", password);
    console.log("***** enteredPassword", enteredPassword);
    if (enteredPassword === password) {
      const token = password + Date.now().toString();
      setToken(token);
      const from = location.state?.from || "/home";
      navigate(from);
    } else {
      setError("Incorrect password. Please try again.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen container relative">
      <div className="flex flex-col justify-center items-center h-full mt-10">
        <div className="flex flex-col items-center gap-6 mb-8">
          <img className="w-28 h-28" src="logo.png" alt="logo" />
          <div className="text-center">
            <div className="text-white text-2xl font-semibold leading-8 mb-2">
              Welcome back!
            </div>
            <div className="text-white/60 text-base font-normal leading-6">
              Please enter your password to access your account.
            </div>
          </div>
        </div>

        <div className="w-full max-w-sm px-4">
          <label htmlFor="password" className="text-white text-sm font-normal">
            Enter password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={`w-full bg-primary/10 text-white border rounded-lg px-4 py-2 mt-1 outline-hidden focus:outline-hidden pr-10 ${
                error ? "border-red-500" : "border-primary/50"
              }`}
              placeholder="Your password..."
              value={enteredPassword}
              onKeyDown={handleKeyDown}
              onChange={handlePasswordChange}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <IoEyeOff size={20} /> : <IoEye size={20} />}
            </button>
          </div>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

          <div className="text-right text-white text-sm font-normal mt-2">
            <p className="hover:underline">Forgot Password?</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 justify-center items-center mt-5 w-full max-w-sm absolute bottom-4">
        <Button variant="primary" className="w-full" onClick={handleSubmit}>
          Continue
        </Button>

        <div className="w-full text-center mt-3">
          <span className="text-white text-sm font-medium">Need help?</span>
          <a
            className="text-primary text-sm font-medium underline"
            href="https://discord.com/invite/QMDV8bGTdQ"
            target="_blank"
          >
            {" "}
            Join our Discord
          </a>
        </div>
      </div>
    </div>
  );
}

export default LockScreen;
