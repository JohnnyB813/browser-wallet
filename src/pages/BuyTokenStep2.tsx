import { useEffect, useState } from "react";
import Header from "../components/Header";
import Button from "../components/Button";
import { useNavigate } from "react-router-dom";
import UserDropdown from "../components/UserDropdown";
import useWallet from "../hooks/useWallet";
import { formatWalletAddress, parsePriceInput } from "../utils";
import axios from "axios";
import { RoundedFee, NonceId, HDWallet } from "warthog-ts";

interface AccountType {
  id: number;
  name: string;
  address: string;
  balance: number;
  balanceUSD: number;
  visible: boolean;
}

function BuyTokenStep2() {
  const {
    password,
    selectedWalletIndex,
    selectedNodeIndex,
    nameList,
    walletList,
    nodeList,
    tmpAssetHash,
    tmpWartAmount,
    tmpLimitPrice,
    visibleWalletList,
    setSelectedWalletIndex,
    setName,
    setWallet,
    seedPhrase,
  } = useWallet();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [transactionError, setTransactionError] = useState<string>("");
  const [nonce, setNonce] = useState<number>(0);

  const selectUser = (id: number) => {
    setName(nameList[id]);
    setWallet(walletList[id]);
    setSelectedWalletIndex(id);
  };

  const getAccountFromIndex = (index: number) => {
    return HDWallet.fromMnemonic(seedPhrase!).deriveAccountAtIndex(index);
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

  const handleTransaction = async () => {
    if (confirmPassword !== password) {
      setPasswordError("Incorrect password. Please try again.");
      return;
    }

    if (!tmpAssetHash || !tmpWartAmount || !tmpLimitPrice) {
      setTransactionError("Missing transaction data");
      setTransactionStatus("error");
      return;
    }

    setIsProcessing(true);
    setTransactionStatus("processing");

    try {
      const headResponse = (
        await axios.get(`${nodeList[selectedNodeIndex]}/chain/head`)
      ).data;
      const pinHash = headResponse.data.pinHash;
      const pinHeight = headResponse.data.pinHeight as number;
      const nonceId = nonce + 1;
      setNonce(nonceId);

      const rawFeeE8 = "9999";
      const result = (
        await axios.get(
          `${nodeList[selectedNodeIndex]}/tools/encode16bit/from_e8/${rawFeeE8}`,
        )
      ).data;
      const feeE8 = result.data.roundedE8;

      const account = getAccountFromIndex(selectedWalletIndex);

      const chainPin = { pinHash, pinHeight };
      const fee = RoundedFee.fromE8(BigInt(feeE8), false)!;
      const nonceIdObj = NonceId.fromNumber(nonceId)!;

      const { TransactionContext } = await import("warthog-ts");
      const context = new TransactionContext(chainPin, fee, nonceIdObj);

      const wartParsed = tmpWartAmount
        ? require("warthog-ts").Wart.parse(tmpWartAmount)
        : null;
      const priceParsed = parsePriceInput(tmpLimitPrice);

      if (!wartParsed || !priceParsed) {
        throw new Error("Failed to parse values");
      }

      const tx = context.buy(account, tmpAssetHash, wartParsed, priceParsed);

      const postdata = {
        type: tx.type,
        pinHeight: tx.pinHeight,
        nonceId: tx.nonceId,
        feeE8: tx.feeE8,
        assetHash: tx.assetHash,
        isBuy: tx.isBuy,
        amountU64: Number(tx.amountU64),
        limit: tx.limit,
        signature65: tx.signature65,
      };

      axios
        .post(`${nodeList[selectedNodeIndex]}/transaction/add`, postdata)
        .then((res) => {
          if (res.data?.error) {
            setTransactionStatus("error");
            setTransactionError(res.data.error);
          } else {
            setTransactionHash(res?.data?.data?.txHash);
            setTransactionStatus("success");
          }
        })
        .catch((error) => {
          setTransactionStatus("error");
          setTransactionError(
            error instanceof Error ? error.message : "Transaction failed",
          );
        });
    } catch (error) {
      setTransactionStatus("error");
      setTransactionError(
        error instanceof Error ? error.message : "Transaction failed",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen container relative">
      <Header title="Buy Token" />

      <div className="flex flex-col gap-1">
        <p className="text-white text-sm">From</p>
        <UserDropdown
          users={accounts}
          selectedUser={accounts[selectedWalletIndex]}
          onSelectUser={selectUser}
        />

        <p className="text-white text-sm mt-3">Asset</p>
        <div className="flex items-center gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md">
          <div>
            <p className="text-white text-lg font-semibold">Token</p>
            <p className="text-white/50 text-xs">
              {tmpAssetHash
                ? formatWalletAddress(tmpAssetHash, 20, 10)
                : "None"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md mt-3">
          <div>
            <p className="text-white text-lg font-semibold">WART to Spend</p>
          </div>
          <div className="text-right">
            <p className="text-white text-lg">{tmpWartAmount || 0} WART</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md mt-3">
          <div>
            <p className="text-white text-lg font-semibold">Limit Price</p>
          </div>
          <div className="text-right">
            <p className="text-white text-lg">{tmpLimitPrice || 0}</p>
          </div>
        </div>
      </div>

      <div className="flex bottom-3 absolute left-0 px-3 w-full gap-3">
        <Button
          variant="outline"
          className="w-full mt-5 hover:bg-primary/10"
          onClick={() => navigate("/buy-token")}
        >
          Back
        </Button>
        <Button
          variant="primary"
          className="w-full mt-5"
          onClick={() => setShowConfirmation(true)}
        >
          Continue
        </Button>
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#1A1A1A] rounded-lg p-6 max-w-md w-full border border-primary/25">
            {transactionStatus === "idle" && (
              <>
                <h3 className="text-white text-xl font-semibold mb-4">
                  Confirm Transaction
                </h3>
                <div className="space-y-4 mb-6">
                  <div className="bg-[#2A2A2A] p-4 rounded-lg">
                    <p className="text-white/70 text-sm">Spending</p>
                    <p className="text-white text-lg font-semibold">
                      {tmpWartAmount || 0} WART
                    </p>
                  </div>
                  <div className="bg-[#2A2A2A] p-4 rounded-lg">
                    <p className="text-white/70 text-sm">Asset</p>
                    <p className="text-white/50 text-xs">
                      {tmpAssetHash
                        ? formatWalletAddress(tmpAssetHash, 20, 10)
                        : "None"}
                    </p>
                  </div>
                  <div className="bg-[#2A2A2A] p-4 rounded-lg">
                    <p className="text-white/70 text-sm">Limit Price</p>
                    <p className="text-white text-lg font-semibold">
                      {tmpLimitPrice || 0}
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-white/70 text-sm mb-2"
                    >
                      Enter your password to confirm
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordError("");
                      }}
                      className="w-full bg-[#2A2A2A] border border-primary/25 rounded-lg p-3 text-white focus:outline-none focus:border-primary"
                      placeholder="Enter your password"
                    />
                    {passwordError && (
                      <p className="text-red-500 text-sm mt-2">
                        {passwordError}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowConfirmation(false);
                      setConfirmPassword("");
                      setPasswordError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleTransaction}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Confirm"}
                  </Button>
                </div>
              </>
            )}

            {transactionStatus === "processing" && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
                <h3 className="text-white text-xl font-semibold mb-2">
                  Processing Transaction
                </h3>
                <p className="text-white/70">Please wait...</p>
              </div>
            )}

            {transactionStatus === "success" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">
                  Transaction Successful!
                </h3>
                <p className="text-white/70 mb-4">
                  Your transaction has been processed.
                </p>
                <p className="text-sm text-white/50 break-all mb-6">
                  Hash:{" "}
                  <a
                    href={`https://wartscan.io/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {transactionHash}
                  </a>
                </p>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    setShowConfirmation(false);
                    setTransactionStatus("idle");
                    navigate("/home");
                  }}
                >
                  Done
                </Button>
              </div>
            )}

            {transactionStatus === "error" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">
                  Transaction Failed
                </h3>
                <p className="text-red-500 mb-6">{transactionError}</p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowConfirmation(false);
                      setTransactionStatus("idle");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                      setTransactionStatus("idle");
                      setTransactionError("");
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BuyTokenStep2;
