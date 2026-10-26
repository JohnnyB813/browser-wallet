import { afterEach, describe, expect, test } from "bun:test";
import { ethers } from "ethers";
import { HDKey } from "@scure/bip32";
import { NETWORK, p2wpkh } from "@scure/btc-signer";
import { base58 } from "@scure/base";
import { ed25519 } from "@noble/curves/ed25519";
import { deriveEthAddress, deriveEthWallet } from "../src/mobile-port/utils/evmAddress";
import { chainAddresses, deriveChainKeys } from "../src/mobile-port/utils/networks/derive";
import { slip10Derive } from "../src/mobile-port/utils/networks/slip10";
import { getSessionAccountIndex, getSessionMnemonic, setChainSession, setSessionAccountIndex } from "../src/mobile-port/utils/sessionVault";
import { WALLET_NETWORKS } from "../src/config/walletNetworks";
import { accountPreferencesKey, parseStringList } from "../src/utils/accountPreferences";
import { deriveAccountAtIndex } from "../src/utils/walletKeys";

// Public BIP39 test vector, never use it for funds.
const phrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
afterEach(() => setChainSession(null));

describe("one address per account and network", () => {
  test("account zero preserves the original chain derivations", () => {
    expect(deriveEthAddress(phrase, 0)).toBe("0x9858EfFD232B4033E47d90003D41EC34EcaEda94");
    const seed = ethers.getBytes(ethers.Mnemonic.fromPhrase(phrase).computeSeed());
    const btc = HDKey.fromMasterSeed(seed).derive("m/84'/0'/0'/0/0");
    const sol = slip10Derive(seed, "m/44'/501'/0'/0'");
    expect(chainAddresses(phrase, 0)).toEqual({
      btcAddress: p2wpkh(btc.publicKey!, NETWORK).address!,
      solAddress: base58.encode(ed25519.getPublicKey(sol)),
    });
  });

  test("every account gets a distinct address on each chain", () => {
    const accounts = [0, 1, 2].map((index) => ({ eth: deriveEthAddress(phrase, index), ...chainAddresses(phrase, index) }));
    for (const key of ["eth", "btcAddress", "solAddress"] as const) {
      expect(new Set(accounts.map((account) => account[key])).size).toBe(3);
    }
  });

  test("the default signing index follows the selected account, not index zero", () => {
    setSessionAccountIndex(2);
    expect(deriveEthWallet(phrase).address).toBe(deriveEthAddress(phrase, 2));
    const keys = deriveChainKeys(phrase);
    expect(keys.btcAddress).toBe(chainAddresses(phrase, 2).btcAddress);
    expect(keys.solAddress).toBe(chainAddresses(phrase, 2).solAddress);
    keys.btcPrivateKey.fill(0); keys.solPrivateKey.fill(0);
  });

  test("the session keeps the account index and not the recovery phrase", () => {
    setChainSession(phrase, 3);
    expect(getSessionMnemonic()).toBe("");
    expect(getSessionAccountIndex()).toBe(3);
    setChainSession(null);
    expect(getSessionMnemonic()).toBe("");
    expect(getSessionAccountIndex()).toBe(0);
  });

  test("invalid account indexes are rejected", () => {
    for (const index of [-1, 0.5, NaN, 0x80000000]) {
      expect(() => deriveEthWallet(phrase, index)).toThrow("Invalid account index");
      expect(() => deriveChainKeys(phrase, index)).toThrow("Invalid account index");
    }
  });

  test("the network registry exposes only supported features", () => {
    expect(WALLET_NETWORKS).toHaveLength(6);
    expect(WALLET_NETWORKS.find((network) => network.id === "wart-mainnet")!.capabilities).not.toContain("liquidity");
    expect(WALLET_NETWORKS.find((network) => network.id === "wart-testnet")!.capabilities).toContain("createAsset");
    expect(WALLET_NETWORKS.filter((network) => network.capabilities.includes("aave")).map((network) => network.id)).toEqual(["ethereum"]);
    expect(WALLET_NETWORKS.filter((network) => network.capabilities.includes("safetrade")).map((network) => network.id)).toEqual(["wart-mainnet"]);
  });
});

describe("public account preferences", () => {
  test("JSON names preserve commas and legacy lists still load", () => {
    expect(parseStringList('["Main", "Savings, trading"]')).toEqual(["Main", "Savings, trading"]);
    expect(parseStringList("Main,Savings")).toEqual(["Main", "Savings"]);
    expect(parseStringList(null)).toEqual([]);
  });
  test("preferences are scoped by root address and derivation path, not account name", () => {
    const hardened = deriveAccountAtIndex(phrase, "hardened", 0);
    const legacy = deriveAccountAtIndex(phrase, "non-hardened", 0);
    expect(accountPreferencesKey(hardened.address)).not.toBe(accountPreferencesKey(legacy.address));
    expect(accountPreferencesKey(hardened.address)).toBe(accountPreferencesKey(hardened.address.toUpperCase()));
  });
});
