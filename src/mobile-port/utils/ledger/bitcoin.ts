const LEDGER = 'This browser wallet signs Bitcoin from the recovery phrase. Open the phone app to sign it on a Ledger.';

export async function signPsbtOnLedger(
  psbt: Uint8Array,
  payer: unknown,
): Promise<{ publicKey: Uint8Array; signature: Uint8Array; inputIndex: number }[]> {
  void psbt;
  void payer;
  throw new Error(LEDGER);
}
