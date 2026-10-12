import { useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';
import browser from 'webextension-polyfill';
import Jazzicon from 'react-jazzicon/dist/Jazzicon';
import Button from '../components/Button';
import Header from '../components/Header';
import { formatWalletAddress, addressToSeed, createTransactionContext, submitTransaction } from '../utils';
import useWallet from '../hooks/useWallet';
import { IoEye, IoEyeOff } from 'react-icons/io5';
import {
  Address,
  Wart,
  RoundedFee,
  NonceId,
  HDWallet,
  TransactionJson,
} from 'warthog-ts';

interface ApprovalPageProps {
  onApproved: () => void;
}

function ApprovalPage({ onApproved }: ApprovalPageProps) {
  const location = useLocation();
  const urlSearchParams = new URLSearchParams(location.search);
  const {
    password,
    selectedWalletIndex,
    selectedNodeIndex,
    walletList,
    nameList,
    nodeList,
    seedPhrase,
  } = useWallet();

  const [approvalWalletIndex, setApprovalWalletIndex] = useState(selectedWalletIndex);
  const [isDropdownVisible, setDropdownVisible] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const action = urlSearchParams.get('action') || '';
  const origin = urlSearchParams.get('origin') || '';
  const to = urlSearchParams.get('to') || '';
  const amount = urlSearchParams.get('amount') || '';
  const from = urlSearchParams.get('from') || '';

const getAccountFromIndex = (index: number) => {
    return HDWallet.fromMnemonic(seedPhrase!).deriveAccountAtIndex(index);
  };

  const handleApprove = async () => {
    console.log('handleApprove called, action:', action, 'to:', to);
    if (confirmPassword !== password) {
      setError('Incorrect password');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      console.log('inside try, action:', action);
      if (action === 'requestAccounts') {
        await browser.runtime.sendMessage({
          action: 'approvalResult',
          payload: {
            approved: true,
            accounts: [walletList[selectedWalletIndex]],
          },
        });
        window.close();
        return;
      }

      const account = getAccountFromIndex(selectedWalletIndex);
      const toAddr = Address.fromHex(to);
      if (!toAddr) {
        throw new Error('Invalid recipient address');
      }

      const fee = RoundedFee.fromE8(1000n, false);
      if (!fee) {
        throw new Error('Invalid fee');
      }
      const nonceId = NonceId.random();

      const context = await createTransactionContext(
        nodeList,
        selectedNodeIndex,
        fee,
        nonceId,
      );
      const wartParsed = Wart.parse(amount);
      if (!wartParsed) {
        throw new Error('Invalid amount');
      }

      const tx = context.transferWart(account, toAddr, wartParsed);
      const txHash = await submitTransaction(nodeList, selectedNodeIndex, tx as TransactionJson);

      await browser.runtime.sendMessage({
        action: 'approvalResult',
        payload: {
          approved: true,
          txHash,
        },
      });

      window.close();
    } catch (err) {
      console.error('Transaction error:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    try {
      await browser.runtime.sendMessage({
        action: 'approvalResult',
        payload: {
          approved: false,
        },
      });
    } catch (e) {
      console.error('Error sending reject:', e);
    }
    window.close();
  };

  return (
    <div className="min-h-screen container relative">
      <Header title={action === 'requestAccounts' ? 'Connect Wallet' : 'Approve Transaction'} />

      <div className="flex flex-col gap-4">
        <div className="bg-[#2A2A2A] p-4 rounded-lg">
          <p className="text-white/70 text-sm mb-1">Website</p>
          <p className="text-white font-mono text-sm">{origin}</p>
        </div>

        <div className="bg-[#2A2A2A] p-4 rounded-lg">
          <p className="text-white/70 text-sm mb-1">Action</p>
          <p className="text-white">
            {action === 'requestAccounts'
              ? 'Connect Wallet'
              : action === 'sendTransaction' || action === 'transferWart'
              ? 'Send Transaction'
              : action}
          </p>
        </div>

        {action === 'requestAccounts' && (
          <div className="bg-[#2A2A2A] p-4 rounded-lg">
            <p className="text-white/70 text-sm mb-1">Account</p>
            <div className="relative">
              <div
                className="flex items-center justify-between gap-3 p-4 rounded-lg border border-primary/25 backdrop-blur-md cursor-pointer"
                onClick={() => setDropdownVisible((prev) => !prev)}
              >
                <div className="flex items-center gap-3">
                  <Jazzicon diameter={40} seed={addressToSeed(walletList[approvalWalletIndex])} />
                  <div>
                    <p className="text-white text-sm font-semibold">
                      {nameList[approvalWalletIndex] || 'Loading...'}
                    </p>
                    <p className="text-white/50 text-xs">
                      {walletList[approvalWalletIndex] ? formatWalletAddress(walletList[approvalWalletIndex]) : '...'}
                    </p>
                  </div>
                </div>
                <FaChevronDown className="text-white" />
              </div>
              {isDropdownVisible && walletList.length > 0 && (
                <div className="absolute z-10 mt-2 left-0 w-full bg-black border border-primary/50 rounded-lg overflow-hidden">
                  {walletList.map((wallet, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-4 hover:bg-white/10 cursor-pointer"
                      onClick={() => {
                        setApprovalWalletIndex(idx);
                        setDropdownVisible(false);
                      }}
                    >
                      <Jazzicon diameter={40} seed={addressToSeed(walletList[idx])} />
                      <div>
                        <p className="text-white text-sm font-semibold">
                          {nameList[idx] || `Account ${idx + 1}`}
                        </p>
                        <p className="text-white/50 text-xs">
                          {formatWalletAddress(wallet)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {from && (
          <div className="bg-[#2A2A2A] p-4 rounded-lg">
            <p className="text-white/70 text-sm mb-1">From</p>
            <p className="text-white font-mono text-sm">{formatWalletAddress(from)}</p>
          </div>
        )}

        {to && (
          <div className="bg-[#2A2A2A] p-4 rounded-lg">
            <p className="text-white/70 text-sm mb-1">To</p>
            <p className="text-white font-mono text-sm">{formatWalletAddress(to)}</p>
          </div>
        )}

        {amount && (
          <div className="bg-[#2A2A2A] p-4 rounded-lg">
            <p className="text-white/70 text-sm mb-1">Amount</p>
            <p className="text-white text-lg font-semibold">{amount} WART</p>
          </div>
        )}

        {action !== 'requestAccounts' && (
          <div className="mt-4">
            <label className="block text-white/70 text-sm mb-2">
              Enter password to confirm
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="w-full bg-[#2A2A2A] border border-primary/25 rounded-lg p-3 pr-10 text-white focus:outline-none focus:border-primary"
                placeholder="Enter your password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <IoEyeOff size={20} /> : <IoEye size={20} />}
              </button>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}
      </div>

      <div className="flex bottom-3 absolute left-0 px-3 w-full gap-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleReject}
          disabled={isProcessing}
        >
          Reject
        </Button>
        {action !== 'requestAccounts' ? (
          <Button
            variant="primary"
            className="w-full"
            onClick={handleApprove}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Approve'}
          </Button>
        ) : (
          <Button
            variant="primary"
            className="w-full"
            onClick={async () => {
              if (!walletList[approvalWalletIndex]) {
                setError('Wallet not loaded yet. Please try again.');
                setIsProcessing(false);
                return;
              }
              setIsProcessing(true);
              await browser.runtime.sendMessage({
                action: 'approvalResult',
                payload: {
                  approved: true,
                  accounts: [walletList[approvalWalletIndex]],
                },
              });
              onApproved();
            }}
            disabled={isProcessing}
          >
            {isProcessing ? 'Connecting...' : 'Connect'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ApprovalPage;
