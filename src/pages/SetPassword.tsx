import React, { useState } from "react";
import BackButton from "../components/BackButton";
import Button from "../components/Button";
import { useNavigate } from "react-router-dom";
import useWallet from "../hooks/useWallet";
import { IoEye, IoEyeOff } from "react-icons/io5";

const SetPassword: React.FC = () => {
  const { setPassword } = useWallet();
  const navigate = useNavigate();
  const [password, setPass] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  const validatePasswords = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};
    if (password.length < 8)
      newErrors.password = "Password must be at least 8 characters long.";
    if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validatePasswords()) {
      setPassword(password);
      navigate("/");
    }
  };

  return (
    <div className="container min-h-screen relative">
      <BackButton />
      <div className="grid justify-center items-center gap-5 mt-2">
        <h1 className="text-center text-white text-xl font-semibold capitalize">
          Choose your password
        </h1>
        <p className="text-center text-white text-sm font-medium leading-tight">
          Please write this down on paper as well.
        </p>
      </div>
      <div className="mt-5 grid gap-5">
        <div>
          <label className="text-white text-sm font-normal">
            Enter Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full bg-primary/10 placeholder:text-sm text-white border border-primary/50 rounded-lg px-4 py-2 mt-1 pr-10 focus-visible:outline-primary"
              placeholder="Your password..."
              value={password}
              onChange={(e) => setPass(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <IoEyeOff size={20} /> : <IoEye size={20} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password}</p>
          )}
        </div>
        <div>
          <label className="text-white text-sm font-normal">
            Enter Password Again
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              className="w-full bg-primary/10 placeholder:text-sm text-white border border-primary/50 rounded-lg px-4 py-2 mt-1 pr-10 focus-visible:outline-primary"
              placeholder="Your password..."
              value={confirmPassword}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <IoEyeOff size={20} /> : <IoEye size={20} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-red-500 text-xs mt-1">
              {errors.confirmPassword}
            </p>
          )}
        </div>
      </div>
      <div className="absolute bottom-5 left-0 px-6 w-full">
        <Button className="w-full" variant="primary" onClick={handleSubmit}>
          Continue
        </Button>
      </div>
    </div>
  );
};

export default SetPassword;
