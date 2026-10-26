import { describe, expect, test } from "bun:test";
import {
  Account,
  Address,
  ChainPin,
  Funds,
  Liquidity,
  NonceId,
  Price,
  RoundedFee,
  TokenDecimals,
  Wart,
  WarthogDeFiTransactionContext,
  WarthogLegacyTransactionContext,
} from "warthog-ts";
import { deriveAccountAtIndex } from "../src/utils/walletKeys";
import { signWarthogTx, type WarthogSignRequest } from "../src/workers/warthogSign";

// Public BIP39 test vector, never use it for funds.
const phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

function canon(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

function must<T>(value: T | null, label: string): T {
  if (value == null) throw new Error(label);
  return value;
}

describe("warthog signatures stay off the page", () => {
  const material = deriveAccountAtIndex(phrase, "hardened", 0);
  const other = deriveAccountAtIndex(phrase, "hardened", 1);
  const account = Account.fromPrivateKeyHex(material.privateKey);
  const to = must(Address.fromHex(other.address), "recipient");
  const pin = new ChainPin("11".repeat(32), 32);
  const fee = must(RoundedFee.fromE8(1_000_000n, false), "fee");
  const nonce = must(NonceId.fromNumber(7), "nonce");
  const legacy = new WarthogLegacyTransactionContext(pin, fee, nonce);
  const defi = new WarthogDeFiTransactionContext(pin, fee, nonce);
  const asset = "ab".repeat(32);
  const base = {
    pinHash: pin.pinHash,
    pinHeight: pin.pinHeight,
    nonceId: nonce.value,
    feeE8: fee.E8.toString(),
  };

  function expectSame(request: WarthogSignRequest, library: object) {
    const signed = signWarthogTx(material.privateKey, request, material.address);
    const encoded = canon(signed);
    expect(encoded).toBe(canon(library));
    expect(encoded.toLowerCase()).not.toContain(material.privateKey.toLowerCase());
    expect(account.address.hex.toLowerCase()).toBe(material.address.toLowerCase());
  }

  test("a legacy WART transfer matches the library", () => {
    const wart = must(Wart.parse("1.5"), "wart");
    expectSame(
      { ...base, family: "legacy", op: "wartTransfer", toAddr: to.hex, amountE8: wart.E8.toString() },
      legacy.transferWart(account, to, wart),
    );
  });

  test("a DeFi WART transfer matches the library", () => {
    const wart = must(Wart.parse("2"), "wart");
    expectSame(
      { ...base, family: "defi", op: "wartTransfer", toAddr: to.hex, amountE8: wart.E8.toString() },
      defi.transferWart(account, to, wart),
    );
  });

  test("a token transfer matches the library", () => {
    const funds = must(Funds.parse("3.5", new TokenDecimals(8)), "funds");
    expectSame(
      {
        ...base,
        family: "defi",
        op: "tokenTransfer",
        assetHash: asset,
        isLiquidity: false,
        toAddr: to.hex,
        amountU64: funds.amount.toString(),
      },
      defi.transferAsset(account, asset, to, funds),
    );
  });

  test("a liquidity transfer matches the library", () => {
    const units = must(Liquidity.parse("4"), "liquidity");
    expectSame(
      {
        ...base,
        family: "defi",
        op: "tokenTransfer",
        assetHash: asset,
        isLiquidity: true,
        toAddr: to.hex,
        amountU64: units.E8.toString(),
      },
      defi.transferLiquidity(account, asset, to, units),
    );
  });

  test("a limit buy, deposit, withdrawal, cancel, and asset creation match the library", () => {
    const wart = must(Wart.parse("1.25"), "wart");
    const funds = must(Funds.parse("9", new TokenDecimals(8)), "funds");
    const units = must(Liquidity.parse("0.5"), "liquidity");
    const limit = must(Price.fromNumberDecimals(1.5, new TokenDecimals(8), true), "price");
    const cancelNonce = must(NonceId.fromNumber(3), "cancel");
    const supply = must(Funds.parse("1000", new TokenDecimals(8)), "supply");

    expectSame(
      {
        ...base,
        family: "defi",
        op: "limitSwap",
        assetHash: asset,
        isBuy: true,
        amountU64: wart.E8.toString(),
        limitHex: limit.toHex(),
      },
      defi.buy(account, asset, wart, limit),
    );
    expectSame(
      {
        ...base,
        family: "defi",
        op: "liquidityDeposit",
        assetHash: asset,
        amountU64: funds.amount.toString(),
        wartE8: wart.E8.toString(),
      },
      defi.depositLiquidity(account, asset, funds, wart),
    );
    expectSame(
      {
        ...base,
        family: "defi",
        op: "liquidityWithdrawal",
        assetHash: asset,
        amountE8: units.E8.toString(),
      },
      defi.withdrawLiquidity(account, asset, units),
    );
    expectSame(
      {
        ...base,
        family: "defi",
        op: "cancelation",
        cancelHeight: 64,
        cancelNonceId: cancelNonce.value,
      },
      defi.cancelTransaction(account, 64, cancelNonce),
    );
    expectSame(
      {
        ...base,
        family: "defi",
        op: "assetCreation",
        supplyU64: supply.amount.toString(),
        decimals: 8,
        name: "TEST",
      },
      defi.createAssets(account, supply, new TokenDecimals(8), "TEST"),
    );
  });

  test("a ceil-rounded fee is signed at that exact amount", () => {
    const ceilFee = must(Wart.parse("0.015"), "fee wart").roundedFee(true);
    const amount = must(Wart.parse("1"), "wart");
    const ctx = new WarthogLegacyTransactionContext(pin, ceilFee, nonce);
    expectSame(
      {
        ...base,
        family: "legacy",
        feeE8: ceilFee.E8.toString(),
        op: "wartTransfer",
        toAddr: to.hex,
        amountE8: amount.E8.toString(),
      },
      ctx.transferWart(account, to, amount),
    );
  });

  test("the wrong account is refused", () => {
    const wart = must(Wart.parse("1"), "wart");
    expect(() => signWarthogTx(
      material.privateKey,
      { ...base, family: "legacy", op: "wartTransfer", toAddr: to.hex, amountE8: wart.E8.toString() },
      other.address,
    )).toThrow("The active account changed. Review the transaction again.");
  });

  test("a token transfer on a legacy node is refused", () => {
    expect(() => signWarthogTx(material.privateKey, {
      ...base,
      family: "legacy",
      op: "tokenTransfer",
      assetHash: asset,
      isLiquidity: false,
      toAddr: to.hex,
      amountU64: "1",
    })).toThrow("This transaction needs a DeFi node");
  });
});
