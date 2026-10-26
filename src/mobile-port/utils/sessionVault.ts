/**
 * Selected account index for chain derivation.
 * The recovery phrase stays in the signing worker. This module does not keep it.
 */
let accountIndex = 0;

export function getSessionAccountIndex(): number {
  return accountIndex;
}

export function setSessionAccountIndex(index: number): void {
  accountIndex = Number.isSafeInteger(index) && index >= 0 && index < 0x80000000 ? index : 0;
}

/** Shape the phone ledger session uses. This port always returns null. */
export type ChainLedgerSession = {
  ethAddress?: string;
  btcAddress?: string;
  btcPublicKey?: string;
  btcFingerprint?: string;
  btcAccountXpub?: string;
  solAddress?: string;
  solPublicKey?: string;
};

/**
 * Remember which account is selected. A phrase argument used to be stored here.
 * It is ignored so a page signer cannot read the recovery phrase.
 */
export function setChainSession(mnemonic: string | null | undefined, index = 0): void {
  setSessionAccountIndex(mnemonic?.trim() ? index : 0);
}

export function getSessionMnemonic(): string {
  return "";
}

export function getLedgerSession(): ChainLedgerSession | null {
  return null;
}

export function getSessionPrivateKey(): string {
  return "";
}
