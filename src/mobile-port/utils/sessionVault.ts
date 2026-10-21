/**
 * Phrase used by the ported Ethereum, Bitcoin, Hemi, and Solana signers.
 * The extension sets this from the unlocked recovery phrase. Ledger sessions
 * stay on the Warthog app, so other chains sign from the phrase only.
 */
let phrase = '';

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

export function setChainSession(mnemonic: string | null | undefined): void {
  phrase = mnemonic?.trim() ?? '';
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
