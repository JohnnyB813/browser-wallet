/**
 * Phrase used by the ported Ethereum, Bitcoin, Hemi, and Solana signers.
 * The extension sets this from the unlocked recovery phrase. Ledger sessions
 * stay on the Warthog app, so other chains sign from the phrase only.
 */
let phrase = '';
let accountIndex = 0;

export function getSessionAccountIndex(): number {
  return accountIndex;
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

export function setChainSession(mnemonic: string | null | undefined, index = 0): void {
  phrase = mnemonic?.trim() ?? '';
  accountIndex = phrase ? index : 0;
}

export function getSessionMnemonic(): string {
  return phrase;
}

export function getLedgerSession(): ChainLedgerSession | null {
  return null;
}

export function getSessionPrivateKey(): string {
  return '';
}
