import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress, parsePriceInput } from "../utils";
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

function SellTokenPage() {
  const navigate = useNavigate();

  const {
    name,
    wallet,
    nameList,
    selectedWalletIndex,
    walletList,
    visibleWalletList,
    setSelectedWalletIndex,
    setName,
    setWallet,
    setTmpAssetHashState,
    setTmpTokenAmountState,
    setTmpLimitPriceState,
    setTmpPrecisionState,
  } = useWallet();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);

  const [assetHash, setAssetHash] = useState("");
  const [assetHashError, setAssetHashError] = useState<string | null>(null);

  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAmountError, setTokenAmountError] = useState<string | null>(null);

  const [precision, setPrecision] = useState(8);

  const [limitPrice, setLimitPrice] = useState("");
  const [limitPriceError, setLimitPriceError] = useState<string | null>(null);

  const [generalError, setGeneralError] = useState<string | null>(null);

  const toggleDropdown = () => setDropdownVisible((prev) => !prev);

  const selectUser = (id: number) => {
    setName(nameList[id]);
    setWallet(walletList[id]);
    setSelectedWalletIndex(id);
    setDropdownVisible(false);
  };

  const handleAssetHashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAssetHash(value);
    if (value.length !== 64) {
      setAssetHashError("Asset hash must be 64 characters");
    } else if (!/^[a-fA-F0-9]+$/.test(value)) {
      setAssetHashError("Asset hash must be valid hex");
    } else {
      setAssetHashError(null);
    }
  };

  const handleTokenAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTokenAmount(value);
    const parsed = Funds.parse(value, new TokenPrecision(precision));
    if (parsed === null) {
      setTokenAmountError("Invalid amount");
    } else {
      setTokenAmountError(null);
    }
  };

  const handlePrecisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    setPrecision(value);
    const parsed = Funds.parse(tokenAmount, new TokenPrecision(value));
    if (parsed === null && tokenAmount !== "") {
      setTokenAmountError("Invalid amount for selected precision");
    } else {
      setTokenAmountError(null);
    }
  };

  const handleLimitPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLimitPrice(value);
    const parsed = parsePriceInput(value);
    if (parsed === null) {
      setLimitPriceError("Invalid price format");
    } else {
      setLimitPriceError(null);
    }
  };

  const handleSubmit = () => {
    setGeneralError(null);

    if (!assetHash || assetHashError) {
      setGeneralError("Please enter a valid asset hash");
      return;
    }
    if (!tokenAmount || tokenAmountError) {
      setGeneralError("Please enter a valid token amount");
      return;
    }
    if (!limitPrice || limitPriceError) {
      setGeneralError("Please enter a valid limit price");
      return;
    }

    setTmpAssetHashState(assetHash);
    setTmpTokenAmountState(tokenAmount);
    setTmpLimitPriceState(limitPrice);
    setTmpPrecisionState(precision);
    navigate("/sell-token-step2");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  useEffect(() => {
    if (nameList.length !== walletList.length) {
      console.log(`**** unmatched error:`, nameList.length, walletList.length);
    } else {
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
    }
  }, [walletList, nameList, visibleWalletList]);

  const isFormValid =
    assetHash &&
    !assetHashError &&
    tokenAmount &&
    !tokenAmountError &&
    limitPrice &&
    !limitPriceError;

  return (
    <div className="min-h-screen container relative">
      <Header title="Sell Token" />

      <div className="mt-4">
        <p className="text-white text-sm">From</p>
        <div className="relative">
          <div
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md cursor-pointer"
            onClick={toggleDropdown}
          >
            <div className="flex items-center gap-3">
              <Jazzicon diameter={48} seed={selectedWalletIndex} />
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
                  <Jazzicon diameter={40} seed={account.id} />
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
        <p className="text-white text-sm">Asset Hash (Token to Sell)</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
            placeholder="Enter asset hash (64 char hex)"
            value={assetHash}
            onChange={handleAssetHashChange}
            onKeyDown={handleKeyDown}
            maxLength={64}
          />
        </div>
        {assetHashError && (
          <div className="text-red-500 text-sm mt-2">{assetHashError}</div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-white text-sm">Token Amount to Sell</p>
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
            <input
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none no-spinner"
              placeholder="Enter token amount"
              type="number"
              value={tokenAmount}
              onChange={handleTokenAmountChange}
              onKeyDown={handleKeyDown}
            />
          </div>
          <select
            className="bg-primary/10 border border-primary/50 rounded-lg px-3 text-white outline-none"
            value={precision}
            onChange={handlePrecisionChange}
          >
            {[
              0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
            ].map((p) => (
              <option key={p} value={p} className="bg-black">
                {p} decimals
              </option>
            ))}
          </select>
        </div>
        {tokenAmountError && (
          <div className="text-red-500 text-sm mt-2">{tokenAmountError}</div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-white text-sm">Limit Price</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none no-spinner"
            placeholder="Enter limit price (e.g. 0.05)"
            type="number"
            step="any"
            value={limitPrice}
            onChange={handleLimitPriceChange}
            onKeyDown={handleKeyDown}
          />
        </div>
        {limitPriceError && (
          <div className="text-red-500 text-sm mt-2">{limitPriceError}</div>
        )}
      </div>

      {generalError && (
        <div className="text-red-500 text-sm mt-4">{generalError}</div>
      )}

      <div className="flex bottom-3 absolute left-0 px-3 w-full gap-3">
        <Button
          variant="outline"
          className="w-full mt-5 hover:bg-primary/10"
          onClick={() => navigate("/transactions")}
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

export default SellTokenPage;
