import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress, addressToSeed } from "../utils";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import { Funds, TokenPrecision } from "warthog-ts";

interface AccountType {
  id: number;
  name: string;
  address: string;
  balance: number;
  balanceUSD: number;
  visible: boolean;
}

function CreateTokenPage() {
  const navigate = useNavigate();
  const {
    name,
    wallet,
    nameList,
    walletList,
    visibleWalletList,
    setSelectedWalletIndex,
    setName,
    setWallet,
    setTmpTokenNameState,
    setTmpTokenAmountState,
    setTmpPrecisionState,
  } = useWallet();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenNameError, setTokenNameError] = useState<string | null>(null);
  const [totalSupply, setTotalSupply] = useState("");
  const [totalSupplyError, setTotalSupplyError] = useState<string | null>(null);
  const [precision, setPrecision] = useState(8);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const toggleDropdown = () => setDropdownVisible((prev) => !prev);
  const selectUser = (id: number) => {
    setName(nameList[id]);
    setWallet(walletList[id]);
    setSelectedWalletIndex(id);
    setDropdownVisible(false);
  };

  const handleTokenNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    setTokenName(value);
    if (value.length === 0) setTokenNameError("Token name is required");
    else if (value.length > 5) setTokenNameError("Max 5 characters");
    else if (!/^[A-Z0-9]+$/.test(value))
      setTokenNameError("Only alphanumeric characters");
    else setTokenNameError(null);
  };

  const handleTotalSupplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTotalSupply(value);
    const parsed = Funds.parse(value, new TokenPrecision(precision));
    setTotalSupplyError(parsed === null ? "Invalid amount" : null);
  };

  const handlePrecisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    setPrecision(value);
    const parsed = Funds.parse(totalSupply, new TokenPrecision(value));
    if (parsed === null && totalSupply !== "")
      setTotalSupplyError("Invalid amount for precision");
    else setTotalSupplyError(null);
  };

  const handleSubmit = () => {
    setGeneralError(null);
    if (!tokenName || tokenNameError) {
      setGeneralError("Invalid token name");
      return;
    }
    if (!totalSupply || totalSupplyError) {
      setGeneralError("Invalid total supply");
      return;
    }
    setTmpTokenNameState(tokenName);
    setTmpTokenAmountState(totalSupply);
    setTmpPrecisionState(precision);
    navigate("/create-token-step2");
  };

  useEffect(() => {
    if (nameList.length !== walletList.length) console.log(`error`);
    else
      setAccounts(
        nameList.map((name, index) => ({
          id: index,
          name,
          address: walletList[index],
          balance: 0,
          balanceUSD: 0,
          visible: visibleWalletList[index],
        })),
      );
  }, [walletList, nameList, visibleWalletList]);

  const isFormValid =
    tokenName && !tokenNameError && totalSupply && !totalSupplyError;

  return (
    <div className="min-h-screen container relative">
      <Header title="Create Token" />
      <div className="mt-4">
        <p className="text-white text-sm">From</p>
        <div className="relative">
          <div
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md cursor-pointer"
            onClick={toggleDropdown}
          >
            <div className="flex items-center gap-3">
              <Jazzicon diameter={48} seed={addressToSeed(wallet || "")} />
              <div>
                <p className="text-white text-lg font-semibold">{name}</p>
                <p className="text-white/50 text-xs">
                  {formatWalletAddress(wallet || "")}
                </p>
              </div>
            </div>
            <FaChevronDown className="text-white" />
          </div>
          {isDropdownVisible && (
            <div className="absolute z-10 mt-2 left-0 w-full bg-black border border-primary/50 rounded-lg overflow-hidden">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-4 hover:bg-white/10 cursor-pointer"
                  onClick={() => selectUser(account.id)}
                >
                  <Jazzicon diameter={40} seed={addressToSeed(account.address)} />
                  <div>
                    <p className="text-white text-sm font-semibold">
                      {account.name}
                    </p>
                    <p className="text-white/50 text-xs">{account.address}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-white text-sm">Token Name (Max 5 chars)</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none uppercase"
            placeholder="e.g. MYCOIN"
            value={tokenName}
            onChange={handleTokenNameChange}
            maxLength={5}
          />
        </div>
        {tokenNameError && (
          <div className="text-red-500 text-sm mt-2">{tokenNameError}</div>
        )}
      </div>
      <div className="mt-4">
          <div>
        <p className="text-white text-sm">Total Supply</p>
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
            <input
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none no-spinner"
              placeholder="Enter total supply"
              type="number"
              value={totalSupply}
              onChange={handleTotalSupplyChange}
            />
          </div>
          </div>
          <div>
            <p className="text-white text-sm">Decimals</p>
            <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
              <select
                className="bg-transparent text-white outline-none"
                value={precision}
                onChange={handlePrecisionChange}
              >
                {[
                  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
                  18,
                ].map((p) => (
                  <option key={p} value={p} className="bg-black">
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {totalSupplyError && (
          <div className="text-red-500 text-sm mt-2">{totalSupplyError}</div>
        )}
      </div>
      {generalError && (
        <div className="text-red-500 text-sm mt-4">{generalError}</div>
      )}
      <div className="flex bottom-3 absolute left-0 px-3 w-full gap-3">
        <Button
          variant="outline"
          className="w-full mt-5 hover:bg-primary/10"
          onClick={() => navigate("/home")}
        >
          Back
        </Button>
        <Button
          variant="primary"
          className="w-full mt-5"
          onClick={handleSubmit}
          disabled={!isFormValid}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
export default CreateTokenPage;
