import { describe, expect, test } from "bun:test";
import { base58, hex } from "@scure/base";
import { Transaction } from "@scure/btc-signer";
import { ed25519 } from "@noble/curves/ed25519";
import { ethers } from "ethers";
import { deriveEthAddress } from "../src/mobile-port/utils/evmAddress";
import { planBtcPsbt, tunnelMemo } from "../src/mobile-port/utils/networks/btc";
import { deriveChainKeys } from "../src/mobile-port/utils/networks/derive";
import {
  publicChains,
  signBitcoinPhrase,
  signEthereumPhrase,
  signSolanaPhrase,
} from "../src/workers/phraseSign";

// Public BIP39 test vector, never use it for funds.
const phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("chain signatures from a phrase", () => {
  test("public addresses follow the account index", () => {
    const pubs = publicChains(phrase, 2);
    const keys = deriveChainKeys(phrase, 2);
    try {
      expect(pubs.ethAddress).toBe(deriveEthAddress(phrase, 2));
      expect(pubs.btcAddress).toBe(keys.btcAddress);
      expect(pubs.solAddress).toBe(keys.solAddress);
      expect(pubs.btcPublicKey).toBe(ethers.hexlify(keys.btcPublicKey));
      expect(Object.keys(pubs).sort()).toEqual(["btcAddress", "btcPublicKey", "ethAddress", "solAddress"]);
    } finally {
      keys.btcPrivateKey.fill(0);
      keys.solPrivateKey.fill(0);
    }
  });

  test("an ethereum signature recovers the requested account", () => {
    const unsigned = ethers.Transaction.from({
      type: 2,
      chainId: 1,
      nonce: 3,
      maxFeePerGas: 20n,
      maxPriorityFeePerGas: 1n,
      gasLimit: 21_000n,
      to: "0x0000000000000000000000000000000000000001",
      value: 5n,
    });
    unsigned.signature = signEthereumPhrase(phrase, 1, unsigned.unsignedSerialized);
    expect(unsigned.from).toBe(deriveEthAddress(phrase, 1));
  });

  test("a solana signature verifies for that account", () => {
    const message = new TextEncoder().encode("warthog");
    const signature = signSolanaPhrase(phrase, 4, message);
    const owner = base58.decode(publicChains(phrase, 4).solAddress);
    expect(ed25519.verify(signature, message, owner)).toBe(true);
  });

  test("a bitcoin spend signs without putting the private key in the transaction", () => {
    const keys = deriveChainKeys(phrase, 0);
    const other = deriveChainKeys(phrase, 1);
    try {
      const secret = ethers.hexlify(keys.btcPrivateKey).slice(2).toLowerCase();
      const planned = planBtcPsbt({
        publicKey: keys.btcPublicKey,
        utxos: [{ txid: "11".repeat(32), vout: 1, value: 100_000 }],
        payTo: { address: other.btcAddress, amount: 20_000n },
        changeAddress: keys.btcAddress,
        feeRate: 2,
        memo: tunnelMemo("0x9858EfFD232B4033E47d90003D41EC34EcaEda94"),
      });
      const signed = signBitcoinPhrase(phrase, 0, planned.psbt);
      expect(signed.txid).toMatch(/^[0-9a-f]{64}$/);
      expect(signed.hex.toLowerCase()).not.toContain(secret);
      const tx = Transaction.fromRaw(hex.decode(signed.hex), { allowUnknownOutputs: true });
      expect(tx.inputsLength).toBe(1);
      expect(tx.outputsLength).toBeGreaterThan(1);
      expect(tx.id).toBe(signed.txid);
    } finally {
      keys.btcPrivateKey.fill(0);
      keys.solPrivateKey.fill(0);
      other.btcPrivateKey.fill(0);
      other.solPrivateKey.fill(0);
    }
  });
});
