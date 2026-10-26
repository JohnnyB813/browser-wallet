/**
 * Holds the recovery phrase and the active Warthog key off the page.
 * Chain calls return addresses and signatures. The phrase leaves only
 * through exportWallet, which the reveal and backup screens ask for.
 */
import { deriveAccountAtIndex, type PathType } from "../utils/walletKeys";
import {
  publicChains,
  signBitcoinPhrase,
  signEthereumPhrase,
  signSolanaPhrase,
} from "./phraseSign";
import { signWarthogTx, type WarthogSignRequest } from "./warthogSign";

let privateKey: string | null = null;
let publicKey: string | null = null;
let address: string | null = null;
let mnemonic: string | null = null;

function normalizeHex(raw: unknown): string {
  return String(raw || "")
    .trim()
    .replace(/^0x/i, "");
}

function respond(requestId: number, payload: Record<string, unknown>) {
  self.postMessage({ requestId, ok: true, ...payload });
}

function respondError(requestId: number, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  self.postMessage({ requestId, ok: false, error: message });
}

function requireMnemonic(): string {
  if (!mnemonic) throw new Error("Wallet is locked");
  return mnemonic;
}

function readIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= 0x80000000) {
    throw new Error("Invalid account index");
  }
  return value;
}

function readPathType(value: unknown): PathType {
  if (value === "hardened" || value === "non-hardened") return value;
  throw new Error("Invalid derivation path");
}

self.onmessage = (event: MessageEvent) => {
  const { requestId, action, payload = {} } = event.data || {};
  try {
    switch (action) {
      case "unlock": {
        const pk = normalizeHex(payload.privateKey);
        if (pk.length !== 64 || !/^[0-9a-fA-F]+$/.test(pk)) {
          throw new Error("Invalid private key");
        }
        privateKey = pk;
        publicKey = normalizeHex(payload.publicKey) || null;
        address = normalizeHex(payload.address) || null;
        mnemonic = payload.mnemonic ? String(payload.mnemonic) : null;
        respond(requestId, {
          unlocked: true,
          address,
          publicKey,
          hasMnemonic: Boolean(mnemonic),
        });
        break;
      }
      case "lock": {
        privateKey = null;
        publicKey = null;
        address = null;
        mnemonic = null;
        respond(requestId, { unlocked: false, hasMnemonic: false });
        break;
      }
      case "status": {
        respond(requestId, {
          unlocked: Boolean(privateKey),
          address,
          publicKey,
          hasMnemonic: Boolean(mnemonic),
        });
        break;
      }
      case "exportWallet": {
        if (!privateKey) throw new Error("Wallet is locked");
        respond(requestId, {
          wallet: {
            privateKey,
            publicKey,
            address,
            mnemonic,
          },
        });
        break;
      }
      case "chainPublic": {
        const chains = publicChains(requireMnemonic(), readIndex(payload.index));
        respond(requestId, { chains });
        break;
      }
      case "activateAccount": {
        const data = deriveAccountAtIndex(
          requireMnemonic(),
          readPathType(payload.pathType),
          readIndex(payload.index),
        );
        privateKey = data.privateKey;
        publicKey = data.publicKey;
        address = data.address;
        respond(requestId, {
          address: data.address,
          publicKey: data.publicKey,
          hasMnemonic: true,
        });
        break;
      }
      case "signEthereum": {
        const signature = signEthereumPhrase(
          requireMnemonic(),
          readIndex(payload.index),
          String(payload.unsignedSerialized || ""),
        );
        respond(requestId, { signature });
        break;
      }
      case "signSolana": {
        const message = payload.message;
        if (!(message instanceof Uint8Array) || message.length === 0) {
          throw new Error("Bad Solana transaction.");
        }
        const signature = signSolanaPhrase(requireMnemonic(), readIndex(payload.index), message);
        respond(requestId, { signature });
        break;
      }
      case "signBitcoin": {
        const psbt = payload.psbt;
        if (!(psbt instanceof Uint8Array) || psbt.length === 0) {
          throw new Error("Bad Bitcoin transaction.");
        }
        const signed = signBitcoinPhrase(requireMnemonic(), readIndex(payload.index), psbt);
        respond(requestId, signed);
        break;
      }
      case "signWarthog": {
        if (!privateKey) throw new Error("Wallet is locked");
        const request = payload.request;
        if (!request || typeof request !== "object") throw new Error("Could not sign the Warthog transaction.");
        const expected = typeof payload.expectedAddress === "string" ? payload.expectedAddress : undefined;
        const signed = signWarthogTx(privateKey, request as WarthogSignRequest, expected);
        const tx: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(signed)) {
          tx[key] = typeof value === "bigint" ? { $bigint: value.toString() } : value;
        }
        respond(requestId, { tx });
        break;
      }
      default:
        throw new Error(`Unknown signing worker action: ${action}`);
    }
  } catch (error) {
    respondError(requestId, error);
  }
};
