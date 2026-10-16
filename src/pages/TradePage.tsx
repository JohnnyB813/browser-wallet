import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Header from "../components/Header";
import DefiNodeGate from "../components/DefiNodeGate";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress, parsePriceInput, addressToSeed } from "../utils";
import { defiSubmitHold } from "../utils/nodes";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import { Wart, Funds, TokenDecimals } from "warthog-ts";

interface AccountType {
  id: number;
  name: string;
  address: string;
  balance: number;
  balanceUSD: number;
  visible: boolean;
}

type TradeType = "buy" | "sell";

function TradePage() {
  const navigate = useNavigate();

  const {
    name,
    wallet,
    nameList,
    walletList,
    visibleWalletList,
    nodeList,
    selectedNodeIndex,
    ledgerAccount,
    setSelectedWalletIndex,
    setName,
    setWallet,
    setTmpAssetHashState,
    setTmpWartAmountState,
    setTmpTokenAmountState,
    setTmpLimitPriceState,
    setTmpPrecisionState,
    setTmpTradeTypeState,
  } = useWallet();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tradeType, setTradeType] = useState<TradeType>("buy");

  const [assetHash, setAssetHash] = useState("");
  const [assetHashError, setAssetHashError] = useState<string | null>(null);

  const [wartAmount, setWartAmount] = useState("");
  const [wartAmountError, setWartAmountError] = useState<string | null>(null);

  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenAmountError, setTokenAmountError] = useState<string | null>(null);

  const [precision, setPrecision] = useState(8);

  const [limitPrice, setLimitPrice] = useState("");
  const [limitPriceError, setLimitPriceError] = useState<string | null>(null);

  const toggleDropdown = () => setDropdownVisible((prev) => !prev);

  const selectUser = (id: number) => {
    setName(nameList[id]);
    setWallet(walletList[id]);
    setSelectedWalletIndex(id);
    setDropdownVisible(false);
  };

  const handleTradeTypeChange = (type: TradeType) => {
    setTradeType(type);
  };

  const handleAssetHashChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAssetHash(value);
    if (value.length !== 64) {
      setAssetHashError("Asset hash must be 64 characters");
    } else if (!/^[a-fA-F0-9]+$/.test(value)) {
      setAssetHashError("Invalid hex");
    } else {
      setAssetHashError(null);
    }
  };

  const handleWartAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWartAmount(value);
    const parsed = Wart.parse(value);
    if (parsed === null) {
      setWartAmountError("Invalid WART amount");
    } else {
      setWartAmountError(null);
    }
  };

  const handleTokenAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTokenAmount(value);
    const parsed = Funds.parse(value, new TokenDecimals(precision));
    if (parsed === null) {
      setTokenAmountError("Invalid amount");
    } else {
      setTokenAmountError(null);
    }
  };

  const handlePrecisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    setPrecision(value);
    setTmpPrecisionState(value);
    const parsed = Funds.parse(tokenAmount, new TokenDecimals(value));
    if (parsed === null && tokenAmount !== "") {
      setTokenAmountError("Invalid amount for precision");
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

  const handelSubmit = () => {
    setError(null);
    setTmpTradeTypeState(tradeType);

    if (!assetHash || assetHashError) {
      setError("Please enter a valid asset hash");
      return;
    }

    if (tradeType === "buy") {
      if (!wartAmount || wartAmountError) {
        setError("Please enter a valid WART amount");
        return;
      }
    } else {
      if (!tokenAmount || tokenAmountError) {
        setError("Please enter a valid token amount");
        return;
      }
    }

    if (!limitPrice || limitPriceError) {
      setError("Please enter a valid limit price");
      return;
    }

    setTmpAssetHashState(assetHash);
    if (tradeType === "buy") {
      setTmpWartAmountState(wartAmount);
    } else {
      setTmpTokenAmountState(tokenAmount);
      setTmpPrecisionState(precision);
    }
    setTmpLimitPriceState(limitPrice);
    navigate("/trade-step2");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handelSubmit();
    }
  };

  useEffect(() => {
    if (nameList.length !== walletList.length) {
      console.log(`**** error:`, nameList.length, walletList.length);
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

  const submitHold = defiSubmitHold(
    nodeList[selectedNodeIndex],
    Boolean(ledgerAccount),
  );

  const isFormValid = () => {
    if (!assetHash || assetHashError) return false;
    if (!limitPrice || limitPriceError) return false;
    if (tradeType === "buy") return wartAmount && !wartAmountError;
    if (tradeType === "sell") return tokenAmount && !tokenAmountError;
    return false;
  };

  return (
    <DefiNodeGate title="Trade">
    <div className="flex flex-col min-h-screen container">
      <Header title="Trade" />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="mt-4">
          <p className="text-white text-sm">Trade Type</p>
          <div className="flex gap-2 mt-2">
            <button
              className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                tradeType === "buy"
                  ? "bg-primary text-black"
                  : "border border-primary text-primary hover:border-primary/80"
              }`}
              onClick={() => handleTradeTypeChange("buy")}
            >
              Buy
            </button>
            <button
              className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                tradeType === "sell"
                  ? "bg-primary text-black"
                  : "border border-primary text-primary hover:border-primary/80"
              }`}
              onClick={() => handleTradeTypeChange("sell")}
            >
              Sell
            </button>
          </div>
        </div>

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
          <p className="text-white text-sm">
            Asset Hash ({tradeType === "buy" ? "Token to Buy" : "Token to Sell"}
            )
          </p>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md">
            <input
              className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-hidden"
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

        {tradeType === "buy" && (
          <div className="mt-4">
            <p className="text-white text-sm">WART Amount to Spend</p>
            <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
              <input
                className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-hidden no-spinner"
                placeholder="Enter WART amount"
                type="text"
                inputMode="decimal"
                value={wartAmount}
                onChange={handleWartAmountChange}
                onKeyDown={handleKeyDown}
              />
            </div>
            {wartAmountError && (
              <div className="text-red-500 text-sm mt-2">{wartAmountError}</div>
            )}
          </div>
        )}

        {tradeType === "sell" && (
          <div className="mt-4">
            <p className="text-white text-sm">Token Amount to Sell</p>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
                <input
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-hidden no-spinner"
                  placeholder="Enter token amount"
                  type="text"
                  inputMode="decimal"
                  value={tokenAmount}
                  onChange={handleTokenAmountChange}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <select
                className="bg-primary/10 border border-primary/50 rounded-lg px-3 text-white outline-hidden"
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
            {tokenAmountError && (
              <div className="text-red-500 text-sm mt-2">
                {tokenAmountError}
              </div>
            )}
          </div>
        )}

        <div className="mt-4">
          <p className="text-white text-sm">Limit Price</p>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
            <input
              className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-hidden no-spinner"
              placeholder="Enter limit price (e.g. 0.05)"
              type="text"
              inputMode="decimal"
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

        {error && <div className="text-red-500 text-sm mt-4">{error}</div>}
        {submitHold && (
          <p className="text-amber-200/90 text-xs mt-3">{submitHold}</p>
        )}
      </div>

      <div className="flex gap-3 px-3 pb-4 pt-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/home")}
        >
          Back
        </Button>
        <Button
          variant="primary"
          className="w-full"
          onClick={handelSubmit}
          disabled={!isFormValid() || Boolean(submitHold)}
        >
          Continue
        </Button>
      </div>
    </div>
    </DefiNodeGate>
  );
}

export default TradePage;
