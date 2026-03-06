import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress } from "../utils";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import { Liquidity } from "warthog-ts";

interface AccountType {
  id: number;
  name: string;
  address: string;
  balance: number;
  balanceUSD: number;
  visible: boolean;
}

function RemoveLiquidityPage() {
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
  } = useWallet();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [assetHash, setAssetHash] = useState("");
  const [assetHashError, setAssetHashError] = useState<string | null>(null);
  const [units, setUnits] = useState("");
  const [unitsError, setUnitsError] = useState<string | null>(null);
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
    if (value.length !== 64)
      setAssetHashError("Asset hash must be 64 characters");
    else if (!/^[a-fA-F0-9]+$/.test(value)) setAssetHashError("Invalid hex");
    else setAssetHashError(null);
  };

  const handleUnitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUnits(value);
    const parsed = Liquidity.parse(value);
    setUnitsError(parsed === null ? "Invalid amount" : null);
  };

  const handleSubmit = () => {
    setGeneralError(null);
    if (!assetHash || assetHashError) {
      setGeneralError("Invalid asset hash");
      return;
    }
    if (!units || unitsError) {
      setGeneralError("Invalid units");
      return;
    }
    setTmpAssetHashState(assetHash);
    setTmpTokenAmountState(units);
    navigate("/remove-liquidity-step2");
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

  const isFormValid = assetHash && !assetHashError && units && !unitsError;

  return (
    <div className="min-h-screen container relative">
      <Header title="Remove Liquidity" />
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
        <p className="text-white text-sm">Asset Hash</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none"
            placeholder="Enter asset hash"
            value={assetHash}
            onChange={handleAssetHashChange}
            maxLength={64}
          />
        </div>
        {assetHashError && (
          <div className="text-red-500 text-sm mt-2">{assetHashError}</div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-white text-sm">Liquidity Units to Withdraw</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 outline-none no-spinner"
            placeholder="Enter units"
            type="number"
            value={units}
            onChange={handleUnitsChange}
          />
        </div>
        {unitsError && (
          <div className="text-red-500 text-sm mt-2">{unitsError}</div>
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
export default RemoveLiquidityPage;
