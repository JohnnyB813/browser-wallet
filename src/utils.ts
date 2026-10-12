import { Price, TokenDecimals, WarthogApi, RoundedFee, NonceId, TransactionContext, TransactionJson } from "warthog-ts";

const formatWalletAddress = (
  address: string,
  startLength: number = 10,
  endLength: number = 10,
): string => {
  return `${address.slice(0, startLength)}....${address.slice(-endLength)}`;
};

const addressToSeed = (addr: string) => parseInt(addr.slice(0, 8), 16);

const formatAddress = (address: string, length: number = 8): string => {
  if (!address || address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
};

const parsePriceInput = (value: string): Price | null => {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return null;
  return Price.fromNumberDecimals(num, new TokenDecimals(4), false);
};

const createApi = (nodeUrl: string): WarthogApi => new WarthogApi(nodeUrl);

const createTransactionContext = async (
  nodeList: string[],
  selectedNodeIndex: number,
  fee: RoundedFee,
  nonce: NonceId,
): Promise<TransactionContext> => {
  const api = new WarthogApi(nodeList[selectedNodeIndex]);
  return api.createTransactionContext(fee, nonce);
};

const submitTransaction = async (
  nodeList: string[],
  selectedNodeIndex: number,
  tx: TransactionJson,
): Promise<string> => {
  const api = new WarthogApi(nodeList[selectedNodeIndex]);
  const result = await api.submitTransaction(tx);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data.txHash;
};

export {
  formatWalletAddress,
  addressToSeed,
  formatAddress,
  parsePriceInput,
  createApi,
  createTransactionContext,
  submitTransaction,
};