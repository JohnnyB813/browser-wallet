import { useEffect, useState, useRef } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress, addressToSeed } from "../utils";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import { Address, Wart, Funds, TokenDecimals, Liquidity } from "warthog-ts";

interface AccountType {
  id: number;
  name: string;
  address: string;
  balance: number;
  balanceUSD: number;
  visible: boolean;
}

type TransferType = "wart" | "token" | "liquidity";

function SendPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    wallet,
    name,
    nameList,
    walletList,
    visibleWalletList,
    selectedNetworkLabel,
    setSelectedWalletIndex,
    setName,
    setWallet,
    setTmpDestinationWalletState,
    setTmpWartAmountState,
    setTmpAssetHashState,
    setTmpTokenAmountState,
    setTmpPrecisionState,
    setTmpTransferTypeState,
  } = useWallet();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transferType, setTransferType] = useState<TransferType>("wart");
  const [publicAddress, setPublicAddress] = useState<string>("");
  const [addressError, setAddressError] = useState<string | null>(null);

  const [wartAmount, setWartAmount] = useState<string>("");
  const [wartAmountError, setWartAmountError] = useState<string | null>(null);

  const [assetHash, setAssetHash] = useState<string>("");
  const [assetHashError, setAssetHashError] = useState<string | null>(null);

  const [tokenAmount, setTokenAmount] = useState<string>("");
  const [tokenAmountError, setTokenAmountError] = useState<string | null>(null);

  const [precision, setPrecision] = useState(8);

  const [liquidityUnits, setLiquidityUnits] = useState<string>("");
  const [liquidityError, setLiquidityError] = useState<string | null>(null);

  const wartAmountRef = useRef<HTMLInputElement>(null);

  const toggleDropdown = () => setDropdownVisible((prev) => !prev);

  const selectUser = (id: number) => {
    setName(nameList[id]);
    setWallet(walletList[id]);
    setSelectedWalletIndex(id);
    setDropdownVisible(false);
  };

  const handleTransferTypeChange = (type: TransferType) => {
    setTransferType(type);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log("Address input:", value);
    setPublicAddress(value);
    if (!Address.validate(value)) {
      setAddressError("Invalid address format");
    } else {
      setAddressError(null);
    }
  };

  const handleWartAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log("WART input:", value);
    setWartAmount(value);
    const parsed = Wart.parse(value);
    console.log("WART parsed:", parsed);
    if (parsed === null) {
      console.log("Setting WART error");
      setWartAmountError("Invalid WART amount");
    } else {
      setWartAmountError(null);
    }
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

  const handleLiquidityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLiquidityUnits(value);
    const parsed = Liquidity.parse(value);
    if (parsed === null) {
      setLiquidityError("Invalid liquidity units");
    } else {
      setLiquidityError(null);
    }
  };

  const handelSubmit = () => {
    setError(null);
    setTmpTransferTypeState(transferType);

    if (!publicAddress || addressError) {
      setError("Please enter a valid address");
      return;
    }

    if (transferType === "wart") {
      if (!wartAmount || wartAmountError) {
        setError("Please enter a valid WART amount");
        return;
      }
      setTmpWartAmountState(wartAmount);
    } else if (transferType === "token") {
      if (!assetHash || assetHashError) {
        setError("Please enter a valid asset hash");
        return;
      }
      if (!tokenAmount || tokenAmountError) {
        setError("Please enter a valid token amount");
        return;
      }
      setTmpAssetHashState(assetHash);
      setTmpTokenAmountState(tokenAmount);
      setTmpPrecisionState(precision);
    } else if (transferType === "liquidity") {
      if (!assetHash || assetHashError) {
        setError("Please enter a valid asset hash");
        return;
      }
      if (!liquidityUnits || liquidityError) {
        setError("Please enter valid liquidity units");
        return;
      }
      setTmpAssetHashState(assetHash);
      setTmpTokenAmountState(liquidityUnits);
    }

    setTmpDestinationWalletState(publicAddress);
    navigate("/sendstep2");
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

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const addressParam = urlParams.get('address');
    if (addressParam) {
      setPublicAddress(addressParam);
      if (Address.validate(addressParam)) {
        setAddressError(null);
      } else {
        setAddressError("Invalid address format");
      }
    }
    wartAmountRef.current?.focus();
  }, [location]);

  const isFormValid = () => {
    if (!publicAddress || addressError) return false;
    if (transferType === "wart") return wartAmount && !wartAmountError;
    if (transferType === "token")
      return assetHash && !assetHashError && tokenAmount && !tokenAmountError;
    if (transferType === "liquidity")
      return assetHash && !assetHashError && liquidityUnits && !liquidityError;
    return false;
  };

  return (
    <div className="flex flex-col min-h-screen container">
      <Header title="Send" />
      <p className="text-xs text-white/50 mt-1">
        Network: <span className="text-primary">{selectedNetworkLabel}</span>
      </p>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="mt-4">
          <p className="text-white text-sm">Transfer Type</p>
          <div className="flex gap-2 mt-2">
            <button
              className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                transferType === "wart"
                  ? "bg-primary text-black"
                  : "border border-primary text-primary hover:border-primary/80"
              }`}
              onClick={() => handleTransferTypeChange("wart")}
            >
              WART
            </button>
            <button
              className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                transferType === "token"
                  ? "bg-primary text-black"
                  : "border border-primary text-primary hover:border-primary/80"
              }`}
              onClick={() => handleTransferTypeChange("token")}
            >
              Token
            </button>
            <button
              className={`flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                transferType === "liquidity"
                  ? "bg-primary text-black"
                  : "border border-primary text-primary hover:border-primary/80"
              }`}
              onClick={() => handleTransferTypeChange("liquidity")}
            >
              Liquidity
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
          <p className="text-white text-sm">To</p>
          <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
            <input
              className="flex-1 bg-transparent text-white text-sm font-mono placeholder-gray-500 outline-none"
              placeholder="Enter public address"
              value={publicAddress}
              onChange={handleAddressChange}
              onKeyDown={handleKeyDown}
            />
          </div>
          {addressError && (
            <div className="text-red-500 text-sm mt-2">{addressError}</div>
          )}
        </div>

        {transferType === "wart" && (
          <div className="mt-4">
            <p className="text-white text-sm">Amount</p>
            <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
              <input
                ref={wartAmountRef}
                className="flex-1 bg-transparent text-white text-sm font-mono placeholder-gray-500 outline-none no-spinner"
                placeholder="Enter amount to transfer"
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

        {transferType === "token" && (
          <>
            <div className="mt-4">
              <p className="text-white text-sm">Asset Hash</p>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
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
                <div className="text-red-500 text-sm mt-2">
                  {assetHashError}
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-white text-sm">Amount</p>
              <div className="flex gap-3">
                <div className="flex-1 flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
                  <input
                    className="flex-1 bg-transparent text-white text-sm font-mono placeholder-gray-500 outline-none no-spinner"
                    placeholder="Enter amount to transfer"
                    type="text"
                    inputMode="decimal"
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
                    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                    17, 18,
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
          </>
        )}

        {transferType === "liquidity" && (
          <>
            <div className="mt-4">
              <p className="text-white text-sm">Asset Hash</p>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
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
                <div className="text-red-500 text-sm mt-2">
                  {assetHashError}
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-white text-sm">Amount</p>
              <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
                <input
                  className="flex-1 bg-transparent text-white text-sm font-mono placeholder-gray-500 outline-none no-spinner"
                  placeholder="Enter amount to transfer"
                  type="text"
                  inputMode="decimal"
                  value={liquidityUnits}
                  onChange={handleLiquidityChange}
                  onKeyDown={handleKeyDown}
                />
              </div>
              {liquidityError && (
                <div className="text-red-500 text-sm mt-2">
                  {liquidityError}
                </div>
              )}
            </div>
          </>
        )}

        {error && <div className="text-red-500 text-sm mt-4">{error}</div>}
      </div>

      <div className="flex gap-3 px-3 pb-4 pt-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/home")}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          className="w-full"
          onClick={handelSubmit}
          disabled={!isFormValid()}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

export default SendPage;
