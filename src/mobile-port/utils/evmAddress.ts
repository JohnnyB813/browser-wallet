import { ethers } from 'ethers';
import { getSessionAccountIndex } from './sessionVault';

export function normalizeEthPhrase(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Ethereum account for a BIP39 phrase at m/44'/60'/0'/0/0. No extra passphrase. */
export function deriveEthWallet(mnemonic: string, index = getSessionAccountIndex()): ethers.HDNodeWallet {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) throw new Error('Invalid account index');
  return ethers.HDNodeWallet.fromPhrase(normalizeEthPhrase(mnemonic), undefined, `m/44'/60'/0'/0/${index}`);
}

/** Ethereum address for a BIP39 phrase. Does not return the private key. */
export function deriveEthAddress(mnemonic: string, index = getSessionAccountIndex()): string {
  return deriveEthWallet(mnemonic, index).address;
}

export function isEthAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}
