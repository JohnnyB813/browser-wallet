import { useEffect, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import Header from "../components/Header";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress, addressToSeed } from "../utils";
import Jazzicon from "react-jazzicon/dist/Jazzicon";
import { NonceId } from "warthog-ts";

interface AccountType {
  id: number;
  name: string;
  address: string;
  balance: number;
  balanceUSD: number;
  visible: boolean;
}

function CancelOrderPage() {
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
    setTmpCancelHeightState,
    setTmpCancelNonceIdState,
  } = useWallet();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [cancelHeight, setCancelHeight] = useState("");
  const [cancelHeightError, setCancelHeightError] = useState<string | null>(
    null,
  );
  const [cancelNonceId, setCancelNonceId] = useState("");
  const [cancelNonceIdError, setCancelNonceIdError] = useState<string | null>(
    null,
  );
  const [generalError, setGeneralError] = useState<string | null>(null);

  const toggleDropdown = () => setDropdownVisible((prev) => !prev);
  const selectUser = (id: number) => {
    setName(nameList[id]);
    setWallet(walletList[id]);
    setSelectedWalletIndex(id);
    setDropdownVisible(false);
  };

  const handleCancelHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCancelHeight(value);
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) setCancelHeightError("Invalid height");
    else setCancelHeightError(null);
  };

  const handleCancelNonceIdChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setCancelNonceId(value);
    const num = parseInt(value);
    if (isNaN(num) || !NonceId.validate(num))
      setCancelNonceIdError("Invalid nonce");
    else setCancelNonceIdError(null);
  };

  const handleSubmit = () => {
    setGeneralError(null);
    const height = parseInt(cancelHeight);
    const nonce = parseInt(cancelNonceId);
    if (!cancelHeight || cancelHeightError) {
      setGeneralError("Invalid height");
      return;
    }
    if (!cancelNonceId || cancelNonceIdError) {
      setGeneralError("Invalid nonce");
      return;
    }
    setTmpCancelHeightState(height);
    setTmpCancelNonceIdState(nonce);
    navigate("/cancel-order-step2");
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
    cancelHeight && !cancelHeightError && cancelNonceId && !cancelNonceIdError;

  return (
    <div className="min-h-screen container relative">
      <Header title="Cancel Order" />
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
        <p className="text-white text-sm">Cancel Height (Block Height)</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-hidden no-spinner"
            placeholder="Enter block height"
            type="number"
            value={cancelHeight}
            onChange={handleCancelHeightChange}
          />
        </div>
        {cancelHeightError && (
          <div className="text-red-500 text-sm mt-2">{cancelHeightError}</div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-white text-sm">Cancel Nonce ID</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-yellow-300/25 backdrop-blur-md">
          <input
            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-hidden no-spinner"
            placeholder="Enter nonce ID"
            type="number"
            value={cancelNonceId}
            onChange={handleCancelNonceIdChange}
          />
        </div>
        {cancelNonceIdError && (
          <div className="text-red-500 text-sm mt-2">{cancelNonceIdError}</div>
        )}
      </div>
      <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10">
        <p className="text-white/60 text-sm">
          Note: You need to know the block height and nonce ID of the order you
          want to cancel. This data can be found in your transaction history or
          by querying the blockchain.
        </p>
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
export default CancelOrderPage;
