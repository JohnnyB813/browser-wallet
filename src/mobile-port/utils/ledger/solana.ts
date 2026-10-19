const LEDGER = 'This browser wallet signs Solana from the recovery phrase. Open the phone app to sign it on a Ledger.';

export async function signSolanaOnLedger(message: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
  void message;
  void publicKey;
  throw new Error(LEDGER);
}
