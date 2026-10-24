import { ethers } from 'ethers';

const LEDGER = 'This browser wallet signs that chain from the recovery phrase. Open the phone app to sign it on a Ledger.';

export async function signEthereumOnLedger(unsignedSerialized: string): Promise<ethers.Signature> {
  void unsignedSerialized;
  throw new Error(LEDGER);
}
