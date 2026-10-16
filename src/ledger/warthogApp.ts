/**
 * Client for the Warthog Nano app (version 0.1.0).
 *
 * GET_PUBLIC_KEY 0x05 shows the 48-character address and returns the
 * uncompressed public key. SIGN_TX 0x06 accepts one WART transfer and
 * returns signature65.
 */
import { ethers } from "ethers";
import type { TransactionJson } from "warthog-ts";
import { isDefiNode } from "../utils/nodes";
import type { PathType } from "../utils/walletKeys";
import { apdu, exchange, LedgerError, requestLedgerDevice } from "./hid";

const GET_PUBLIC_KEY = 0x05;
const SIGN_TX = 0x06;
const P1_START = 0x00;
const P2_MORE = 0x80;
const P2_LAST = 0x00;
const HARDENED = 0x80000000;

export interface LedgerSession {
  address: string;
  publicKey: string;
  pathType: PathType;
  index: number;
}

export function ledgerPath(pathType: PathType, index: number): number[] {
  const account = pathType === "hardened" ? HARDENED : 0;
  return [HARDENED | 44, HARDENED | 2070, account, 0, index >>> 0];
}

function encodePath(path: number[]): Uint8Array {
  const out = new Uint8Array(1 + path.length * 4);
  out[0] = path.length;
  const view = new DataView(out.buffer);
  path.forEach((component, i) => view.setUint32(1 + i * 4, component, false));
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, "");
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new LedgerError("Expected hex");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Same address the device shows: RIPEMD160(SHA256(compressed key)) plus 4 checksum bytes. */
export function wartAddressFromUncompressed(publicKey: Uint8Array): string {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new LedgerError("Ledger returned a public key this wallet cannot use");
  }
  const compressed = new Uint8Array(33);
  compressed[0] = (publicKey[64] & 1) === 1 ? 0x03 : 0x02;
  compressed.set(publicKey.subarray(1, 33), 1);
  const sha = ethers.getBytes(ethers.sha256(compressed));
  const ripe = ethers.getBytes(ethers.ripemd160(sha));
  const checksum = ethers.getBytes(ethers.sha256(ripe)).subarray(0, 4);
  const full = new Uint8Array(24);
  full.set(ripe, 0);
  full.set(checksum, 20);
  return ethers.hexlify(full).slice(2);
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

function u64(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, false);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Bytes the device parses: pinHash || height || nonce || 3 zero bytes || fee || to || amount. */
export function wartTransferBytes(input: {
  pinHash: string;
  pinHeight: number;
  nonceId: number;
  feeE8: bigint;
  toAddress: string;
  amountE8: bigint;
}): Uint8Array {
  const pin = hexToBytes(input.pinHash);
  if (pin.length !== 32) {
    throw new LedgerError("This Ledger app expects a 32-byte chain pin");
  }
  const to = hexToBytes(input.toAddress);
  if (to.length !== 24) {
    throw new LedgerError("Recipient must be a 48-character Warthog address");
  }
  return concat([
    pin,
    u32(input.pinHeight),
    u32(input.nonceId),
    new Uint8Array(3),
    u64(input.feeE8),
    to.subarray(0, 20),
    u64(input.amountE8),
  ]);
}

async function withDevice<T>(run: (device: Awaited<ReturnType<typeof requestLedgerDevice>>) => Promise<T>): Promise<T> {
  const device = await requestLedgerDevice();
  try {
    if (!device.opened) await device.open();
    return await run(device);
  } finally {
    try {
      await device.close();
    } catch {
      /* the browser may already have dropped the handle */
    }
  }
}

export async function connectLedgerAccount(
  pathType: PathType,
  index = 0,
): Promise<LedgerSession> {
  const path = ledgerPath(pathType, index);
  return withDevice(async (device) => {
    const data = await exchange(
      device,
      apdu(GET_PUBLIC_KEY, 0x01, 0x00, encodePath(path)),
      120_000,
    );
    if (data.length < 66 || data[0] !== 65) {
      throw new LedgerError("Ledger did not return a public key");
    }
    const publicKey = data.subarray(1, 66);
    return {
      address: wartAddressFromUncompressed(publicKey),
      publicKey: ethers.hexlify(publicKey).slice(2),
      pathType,
      index,
    };
  });
}

export async function signWartTransferOnLedger(
  session: LedgerSession,
  fields: {
    pinHash: string;
    pinHeight: number;
    nonceId: number;
    feeE8: bigint;
    toAddress: string;
    amountE8: bigint;
  },
): Promise<TransactionJson> {
  const raw = wartTransferBytes(fields);
  const path = encodePath(ledgerPath(session.pathType, session.index));
  const signature = await withDevice(async (device) => {
    await exchange(device, apdu(SIGN_TX, P1_START, P2_MORE, path), 20_000);
    return exchange(device, apdu(SIGN_TX, 0x01, P2_LAST, raw), 120_000);
  });
  if (signature.length !== 65) {
    throw new LedgerError("Ledger signature was not 65 bytes");
  }
  const signature65 = ethers.hexlify(signature).slice(2);
  return {
    type: "wartTransfer",
    pinHeight: fields.pinHeight,
    nonceId: fields.nonceId,
    feeE8: fields.feeE8,
    toAddr: fields.toAddress,
    wartE8: fields.amountE8,
    signature65,
  };
}

/**
 * Mainnet reads amountE8. The DeFi testnet reads wartE8 plus type.
 * The Nano signs the same 79 bytes either way. Sending wartE8 to mainnet
 * comes back as "invalid amount".
 */
export function ledgerWartSubmitJson(
  signed: TransactionJson,
  nodeUrl: string | null | undefined,
): TransactionJson {
  const feeE8 = Number(signed.feeE8);
  const amountE8 = Number(signed.wartE8 ?? signed.amountE8);
  if (!Number.isSafeInteger(feeE8) || !Number.isSafeInteger(amountE8) || amountE8 < 0) {
    throw new LedgerError("Amount is too large to submit");
  }
  const pinHeight = Number(signed.pinHeight);
  const nonceId = Number(signed.nonceId);
  const toAddr = String(signed.toAddr || "");
  const signature65 = String(signed.signature65 || "");
  if (isDefiNode(nodeUrl)) {
    return {
      type: "wartTransfer",
      pinHeight,
      nonceId,
      feeE8,
      toAddr,
      wartE8: amountE8,
      signature65,
    };
  }
  return {
    pinHeight,
    nonceId,
    toAddr,
    amountE8,
    feeE8,
    signature65,
  } as unknown as TransactionJson;
}
