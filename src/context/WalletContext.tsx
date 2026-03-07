import React, {
  createContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import * as bip39 from "bip39";
import { getKeyFromPassword, encrypt, decrypt } from "dha-encryption";
import browser from "webextension-polyfill";
import { HDWallet, Account } from "warthog-ts";

interface WalletContextProps {
  seedPhrase: string | null;
  wallet: string | null;
  walletList: string[];
  nameList: string[];
  nodeList: string[];
  nodeNameList: string[];
  visibleWalletList: boolean[];
  selectedWalletIndex: number;
  selectedNodeIndex: number;
  password: string | null;
  name: string | null;
  tmpDestinationWallet: string | null;
  tmpAssetHash: string | null;
  tmpTokenAmount: string | null;
  tmpWartAmount: string | null;
  tmpLimitPrice: string | null;
  tmpPrecision: number;
  tmpCancelHeight: number | null;
  tmpCancelNonceId: number | null;
  tmpTokenName: string | null;
  tmpTransferType: "wart" | "token" | "liquidity";
  tmpTradeType: "buy" | "sell";
  tmpLiquidityType: "add" | "remove";
  inputWordsBackup: string[];
  setName: (name: string) => void;
  setSeedPhrase: (seedPhrase: string) => void;
  setWallet: (wallet: string) => void;
  setPassword: (password: string) => void;
  setWalletList: (walletList: string[]) => void;
  setNodeList: (nodeList: string[]) => void;
  setNodeNameList: (nodeNameList: string[]) => void;
  setNameList: (nameList: string[]) => void;
  setSelectedNodeIndex: (selectedNodeIndex: number) => void;
  setVisibleWalletList: (visibleWalletList: boolean[]) => void;
  setSelectedWalletIndex: (selectedWalletIndex: number) => void;
  setInputWordsBackup: (inputWordsBackup: string[]) => void;
  clearWalletData: () => void;
  token: string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  accountPath: (index: number) => string;
  newWallet: () => void;
  addAccount: (name: string | null) => void;
  importWallet: (seedPhrase: string) => void;
  setWalletListState: (walletList: string[]) => void;
  setNodeListState: (nodeList: string[]) => void;
  setNodeNameListState: (nodeNameList: string[]) => void;
  setNameListState: (nameList: string[]) => void;
  setSelectedWalletIndexState: (selectedWalletIndex: number) => void;
  setSelectedNodeIndexState: (selectedNodeIndex: number) => void;
  setVisibleWalletListState: (visibleWalletList: boolean[]) => void;
  setTmpDestinationWalletState: (tmpDestinationWallet: string) => void;
  setTmpAssetHashState: (tmpAssetHash: string) => void;
  setTmpTokenAmountState: (tmpTokenAmount: string) => void;
  setTmpWartAmountState: (tmpWartAmount: string) => void;
  setTmpLimitPriceState: (tmpLimitPrice: string) => void;
  setTmpPrecisionState: (tmpPrecision: number) => void;
  setTmpCancelHeightState: (tmpCancelHeight: number) => void;
  setTmpCancelNonceIdState: (tmpCancelNonceId: number) => void;
  setTmpTokenNameState: (tmpTokenName: string) => void;
  setTmpTransferTypeState: (
    tmpTransferType: "wart" | "token" | "liquidity",
  ) => void;
  refreshTokenExpiration: () => void;
  setTmpTradeTypeState: (tmpTradeType: "buy" | "sell") => void;
  setTmpLiquidityTypeState: (tmpLiquidityType: "add" | "remove") => void;
  getAccountFromIndex: (index: number) => Account;
}

const defaultNodeList = [
  "http://localhost:3100",
  "http://51.75.21.134:3001",
  "http://62.72.44.89:3001",
  "http://dev.node-s.com:3001",
];

const defaultNodeNameList = [
  "localhost",
  "polaire",
  "blu & Asia",
  "johnnyb Us East",
];

const WalletContext = createContext<WalletContextProps | undefined>(undefined);

const ENCRYPTION_KEY =
  import.meta.env.VITE_APP_ENCRYPTION_KEY || "encryption_key";

export const WalletProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [seedPhrase, setSeedPhraseState] = useState<string | null>(null);
  const [wallet, setWalletState] = useState<string | null>(null);
  const [password, setPasswordState] = useState<string | null>(null);
  const [name, setNameState] = useState<string | null>(null);
  const [walletList, setWalletListState] = useState<string[]>([]);
  const [selectedWalletIndex, setSelectedWalletIndexState] =
    useState<number>(0);
  const [selectedNodeIndex, setSelectedNodeIndexState] = useState<number>(0);
  const [nameList, setNameListState] = useState<string[]>([]);
  const [nodeList, setNodeListState] = useState<string[]>([]);
  const [nodeNameList, setNodeNameListState] = useState<string[]>([]);
  const [token, setTokenState] = useState<string | null>(null);
  const [visibleWalletList, setVisibleWalletListState] = useState<boolean[]>(
    [],
  );
  const [tmpDestinationWallet, setTmpDestinationWalletState] = useState<
    string | null
  >(null);
  const [tmpAssetHash, setTmpAssetHashState] = useState<string | null>(null);
  const [tmpTokenAmount, setTmpTokenAmountState] = useState<string | null>(
    null,
  );
  const [tmpWartAmount, setTmpWartAmountState] = useState<string | null>(null);
  const [tmpLimitPrice, setTmpLimitPriceState] = useState<string | null>(null);
  const [tmpPrecision, setTmpPrecisionState] = useState<number>(8);
  const [tmpCancelHeight, setTmpCancelHeightState] = useState<number | null>(
    null,
  );
  const [tmpCancelNonceId, setTmpCancelNonceIdState] = useState<number | null>(
    null,
  );
  const [tmpTokenName, setTmpTokenNameState] = useState<string | null>(null);
  const [tmpTransferType, setTmpTransferTypeState] = useState<
    "wart" | "token" | "liquidity"
  >("wart");
  const [tmpTradeType, setTmpTradeTypeState] = useState<"buy" | "sell">("buy");
  const [tmpLiquidityType, setTmpLiquidityTypeState] = useState<
    "add" | "remove"
  >("add");
  const [inputWordsBackup, setInputWordsBackupState] = useState<string[]>([]);

  const arrayBufferToHex = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const hexToArrayBuffer = (hex: string): ArrayBuffer => {
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
    );
    return bytes.buffer;
  };

  const saveToBrowserStorage = async (
    key: string,
    value: string | null,
  ): Promise<void> => {
    try {
      const keyObject = await getKeyFromPassword(ENCRYPTION_KEY);
      const encryptedValue = value ? await encrypt(value, keyObject) : null;
      const hexValue = encryptedValue ? arrayBufferToHex(encryptedValue) : null;

      browser.storage.local
        .set({ [key]: hexValue })
        .then(() => {
          console.log(`${key} saved to browser storage`);
        })
        .catch((error: unknown) => {
          console.error(`Error saving ${key} to browser storage:`, error);
        });
    } catch (error) {
      console.error(`Error saving ${key} to browser storage:`, error);
    }
  };

  const decryptValue = async (
    value: string | undefined,
  ): Promise<string | null> => {
    const keyObject = await getKeyFromPassword(ENCRYPTION_KEY);
    const arrayBuffer = value ? hexToArrayBuffer(value) : null;
    const decryptedValue = arrayBuffer
      ? await decrypt(arrayBuffer, keyObject)
      : null;
    return decryptedValue;
  };

  const setInputWordsBackup = (inputWordsBackup: string[]): void => {
    setInputWordsBackupState(inputWordsBackup);
    saveToBrowserStorage("inputWordsBackup", inputWordsBackup.join(","));
  };

  const loadFromChromeStorage = useCallback(
    (key: string, callback: (value: string | null) => void): void => {
      try {
        browser.storage.local
          .get(key)
          .then((result: Record<string, unknown>) => {
            console.log("***** result", result);
            decryptValue(result[key] as string | undefined)
              .then((decryptedValue) => {
                callback(decryptedValue);
              })
              .catch((error: unknown) => {
                console.error(
                  `Error decrypting ${key} from browser storage:`,
                  error,
                );
              });
          })
          .catch((error: unknown) => {
            console.error(`Error loading ${key} from browser storage:`, error);
          });
      } catch (error) {
        console.error(`Error loading ${key} from browser storage:`, error);
      }
    },
    [],
  );

  const accountPath = (index: number): string => {
    const path = `m/44'/2070'/0/0/${index}`;
    return path;
  };

  const newWallet = async (): Promise<void> => {
    try {
      console.log("-------------- newWallet --------------");
      // mnemonic 12 words
      const mnemonic = bip39.generateMnemonic();

      const address =
        HDWallet.fromMnemonic(mnemonic).deriveAccountAtIndex(0).address.hex;

      // save to storage
      setSeedPhrase(mnemonic);
      setWallet(address);
      setWalletList([address]);
      setNameList(["Account 0"]);
      setVisibleWalletList([true]);
      setSelectedWalletIndex(0);
      setNodeList(defaultNodeList);
      setNodeNameList(defaultNodeNameList);
      setName("Account 0");
      console.log("***** walletList length", walletList.length);

      console.log("-------------- End of newWallet --------------");
    } catch (error) {
      console.log("Error creating new wallet:", error);
    }
  };

  const addAccount = async (name: string | null): Promise<void> => {
    try {
      const index = walletList.length;
      const address = HDWallet.fromMnemonic(seedPhrase!).deriveAccountAtIndex(
        index,
      ).address.hex;

      // save to storage
      setWallet(address);
      setWalletList([...walletList, address]);
      setNameList([...nameList, name || `Account ${index}`]);
      setVisibleWalletList([...visibleWalletList, true]);
      setSelectedWalletIndex(index);
      setName(name || `Account ${index}`);
      console.log("***** walletList length", walletList.length);

      console.log("-------------- End of add account --------------");
    } catch (error) {
      console.log("Error adding new account:", error);
    }
  };

  const importWallet = (seedPhrase: string): void => {
    console.log("-------------- importWallet --------------");
    // mnemonic 12 words
    const mnemonic = seedPhrase;

    // generate key pair
    const address =
      HDWallet.fromMnemonic(mnemonic).deriveAccountAtIndex(0).address.hex;
    console.log("***** address", address);

    // save to storage
    setSeedPhrase(mnemonic);
    setWallet(address);
    setWalletList([address]);
    setNameList(["Account 0"]);
    setVisibleWalletList([true]);
    setSelectedWalletIndex(0);
    setNodeList(defaultNodeList);
    setNodeNameList(defaultNodeNameList);
    console.log("defaultNodeList", defaultNodeList);
    setName("Account 0");
    console.log("***** walletList length", walletList.length);

    console.log("-------------- End of importWallet --------------");
  };
  const setToken = (token: string): void => {
    setTokenState(token);
    saveToBrowserStorage("token", token);
    refreshTokenExpiration();
  };

  const refreshTokenExpiration = (): void => {
    const expirationTime = Date.now() + 3600 * 1000;
    saveToBrowserStorage("tokenExpiration", expirationTime.toString());
  };

  const clearToken = (): void => {
    setTokenState(null);
    browser.storage.local
      .remove(["token", "tokenExpiration"])
      .then(() => {
        console.log("Token and token expiration removed");
      })
      .catch((error: unknown) => {
        console.error("Error removing token and token expiration:", error);
      });
  };

  const getAccountFromIndex = (index: number): Account => {
    return HDWallet.fromMnemonic(seedPhrase!).deriveAccountAtIndex(index);
  };

  const setSeedPhrase = (seedPhrase: string): void => {
    setSeedPhraseState(seedPhrase);
    saveToBrowserStorage("seedPhrase", seedPhrase);
  };

  const setWallet = (wallet: string): void => {
    setWalletState(wallet);
    saveToBrowserStorage("wallet", wallet);
  };

  const setWalletList = (walletList: string[]): void => {
    setWalletListState(walletList);
    saveToBrowserStorage("walletList", walletList.join(","));
  };

  const setNodeList = (nodeList: string[]): void => {
    setNodeListState(nodeList);
    saveToBrowserStorage("nodeList", nodeList.join(","));
  };

  const setNodeNameList = (nodeNameList: string[]): void => {
    setNodeNameListState(nodeNameList);
    saveToBrowserStorage("nodeNameList", nodeNameList.join(","));
  };

  const setNameList = (nameList: string[]): void => {
    setNameListState(nameList);
    saveToBrowserStorage("nameList", nameList.join(","));
  };

  const setSelectedWalletIndex = (selectedWalletIndex: number): void => {
    setSelectedWalletIndexState(selectedWalletIndex);
    saveToBrowserStorage("selectedWalletIndex", selectedWalletIndex.toString());
  };

  const setSelectedNodeIndex = (selectedNodeIndex: number): void => {
    setSelectedNodeIndexState(selectedNodeIndex);
    saveToBrowserStorage("selectedNodeIndex", selectedNodeIndex.toString());
  };

  const setPassword = (password: string): void => {
    setPasswordState(password);
    saveToBrowserStorage("password", password);
  };

  const setName = (name: string): void => {
    setNameState(name);
    saveToBrowserStorage("name", name);
  };

  const setVisibleWalletList = (visibleWalletList: boolean[]): void => {
    setVisibleWalletListState(visibleWalletList);
    saveToBrowserStorage("visibleWalletList", visibleWalletList.join(","));
  };

  const clearWalletData = (): void => {
    setSeedPhraseState(null);
    setWalletState(null);
    setPasswordState(null);
    setNameState(null);
    browser.storage.local
      .remove(["seedPhrase", "wallet", "password", "name"])
      .then(() => {
        console.log("Seed phrase, wallet, password, and name removed");
      })
      .catch((error: unknown) => {
        console.error(
          "Error removing seed phrase, wallet, password, and name:",
          error,
        );
      });
  };

  useEffect(() => {
    loadFromChromeStorage("seedPhrase", setSeedPhraseState);
    loadFromChromeStorage("wallet", setWalletState);
    loadFromChromeStorage("walletList", (walletList) =>
      setWalletListState(walletList ? walletList.split(",") : []),
    );
    loadFromChromeStorage("nameList", (nameList) =>
      setNameListState(nameList ? nameList.split(",") : []),
    );
    loadFromChromeStorage("nodeList", (nodeList) =>
      setNodeListState(nodeList ? nodeList.split(",") : []),
    );
    loadFromChromeStorage("nodeNameList", (nodeNameList) =>
      setNodeNameListState(nodeNameList ? nodeNameList.split(",") : []),
    );
    loadFromChromeStorage("visibleWalletList", (visibleWalletList) => {
      const boolArray = visibleWalletList
        ? visibleWalletList.split(",").map((val) => val === "true")
        : [];
      setVisibleWalletListState(boolArray);
    });
    loadFromChromeStorage("selectedWalletIndex", (selectedWalletIndex) =>
      setSelectedWalletIndexState(
        selectedWalletIndex ? parseInt(selectedWalletIndex, 10) : 0,
      ),
    );
    loadFromChromeStorage("selectedNodeIndex", (selectedNodeIndex) =>
      setSelectedNodeIndexState(
        selectedNodeIndex ? parseInt(selectedNodeIndex, 10) : 0,
      ),
    );
    loadFromChromeStorage("password", setPasswordState);
    loadFromChromeStorage("name", setNameState);
    loadFromChromeStorage("token", setTokenState);
  }, [loadFromChromeStorage]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadFromChromeStorage("tokenExpiration", (expiration) => {
        const expirationTime = expiration ? parseInt(expiration, 10) : 0;
        if (Date.now() >= expirationTime) {
          clearToken();
        }
      });
    }, 1000 * 60);
    return () => clearInterval(interval);
  }, [loadFromChromeStorage]);

  return (
    <WalletContext.Provider
      value={{
        seedPhrase,
        wallet,
        password,
        name,
        token,
        walletList,
        nodeList,
        nodeNameList,
        nameList,
        selectedWalletIndex,
        selectedNodeIndex,
        visibleWalletList,
        tmpDestinationWallet,
        tmpAssetHash,
        tmpTokenAmount,
        tmpWartAmount,
        tmpLimitPrice,
        tmpPrecision,
        tmpCancelHeight,
        tmpCancelNonceId,
        tmpTokenName,
        tmpTransferType,
        tmpTradeType,
        tmpLiquidityType,
        inputWordsBackup,
        accountPath,
        setSeedPhrase,
        setWallet,
        setPassword,
        setName,
        setWalletList,
        setNodeList,
        setNodeNameList,
        setNameList,
        setVisibleWalletList,
        setSelectedWalletIndex,
        setSelectedNodeIndex,
        clearWalletData,
        setToken,
        clearToken,
        newWallet,
        addAccount,
        setWalletListState,
        setNodeListState,
        setNodeNameListState,
        setNameListState,
        setSelectedWalletIndexState,
        setSelectedNodeIndexState,
        setVisibleWalletListState,
        setTmpDestinationWalletState,
        setTmpAssetHashState,
        setTmpTokenAmountState,
        setTmpWartAmountState,
        setTmpLimitPriceState,
        setTmpPrecisionState,
        setTmpCancelHeightState,
        setTmpCancelNonceIdState,
        setTmpTokenNameState,
        setTmpTransferTypeState,
        refreshTokenExpiration,
        setTmpTradeTypeState,
        setTmpLiquidityTypeState,
        getAccountFromIndex,
        importWallet,
        setInputWordsBackup,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export default WalletContext;
