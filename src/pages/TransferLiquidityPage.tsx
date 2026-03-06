import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress } from "../utils";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import { Address, Liquidity } from "warthog-ts";

interface AccountType {
  id: number;
  name: string;
  address: string;
  balance: number;
  balanceUSD: number;
  visible: boolean;
}

function TransferLiquidityPage() {
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
    setTmpDestinationWalletState,
    setTmpAssetHashState,
    setTmpTokenAmountState,
  } = useWallet();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);

  const [assetHash, setAssetHash] = useState("");
  const [assetHashError, setAssetHashError] = useState<string | null>(null);

  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);

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

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRecipientAddress(value);
    if (!Address.validate(value)) {
      setRecipientError("Invalid address format");
    } else {
      setRecipientError(null);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    const parsed = Liquidity.parse(value);
    if (parsed === null) {
      setAmountError("Invalid amount");
    } else {
      setAmountError(null);
    }
  };

  const handleSubmit = () => {
    setGeneralError(null);

    if (!assetHash || assetHashError) {
      setGeneralError("Please enter a valid asset hash");
      return;
    }
    if (!recipientAddress || recipientError) {
      setGeneralError("Please enter a valid recipient address");
      return;
    }
    if (!amount || amountError) {
      setGeneralError("Please enter a valid amount");
      return;
    }

    const parsedAmount = Liquidity.parse(amount);
    if (parsedAmount === null) {
      setGeneralError("Failed to parse amount");
      return;
    }

    setTmpDestinationWalletState(recipientAddress);
    setTmpAssetHashState(assetHash);
    setTmpTokenAmountState(amount);
    navigate("/transfer-liquidity-step2");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  useEffect(() => {
    if (nameList.length !== walletList.length) {
      console.log(
        `**** unmatched error in nameList and walletList:`,
        nameList.length,
        walletList.length,
      );
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
    recipientAddress &&
    !recipientError &&
    amount &&
    !amountError;

  return (
    <div className="min-h-screen container relative">
      <Header title="Transfer Liquidity" />

      <div className="mt-4">
        <p className="text-white text-sm">From</p>
        <div className="relative">
          <div
            className="flex items-center justify-between gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md cursor-pointer"
            onClick={toggleDropdown}
          >
            <div className="flex items-center gap-3">
              {<Jazzicon diameter={48} seed={selectedWalletIndex} />}
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
                  <div className="w-10 h-10">
                    {<Jazzicon diameter={40} seed={account.id} />}
                  </div>
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
        <p className="text-white text-sm">Asset Hash</p>
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
        <p className="text-white text-sm">To</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
            placeholder="Enter recipient address"
            value={recipientAddress}
            onChange={handleAddressChange}
            onKeyDown={handleKeyDown}
          />
        </div>
        {recipientError && (
          <div className="text-red-500 text-sm mt-2">{recipientError}</div>
        )}
      </div>

      <div className="mt-4">
        <p className="text-white text-sm"> Liquidity Units</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none no-spinner"
            placeholder="Enter liquidity units"
            type="number"
            value={amount}
            onChange={handleAmountChange}
            onKeyDown={handleKeyDown}
          />
        </div>
        {amountError && (
          <div className="text-red-500 text-sm mt-2">{amountError}</div>
        )}
      </div>

      {generalError && (
        <div className="text-red-500 text-sm mt-4">{generalError}</div>
      )}

      <div className="flex bottom-3 absolute left-0 px-3 w-full gap-3">
        <Button
          variant="outline"
          ariaLabel="Back"
          className="w-full mt-5 hover:bg-primary/10"
          onClick={() => navigate("/transactions")}
        >
          Back
        </Button>
        <Button
          variant="primary"
          ariaLabel="Continue"
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

export default TransferLiquidityPage;
