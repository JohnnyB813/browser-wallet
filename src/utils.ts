import {
  Price,
  TokenDecimals,
  WarthogDeFiApi,
  WarthogDeFiTransactionContext,
  WarthogLegacyApi,
  RoundedFee,
  NonceId,
  type AnyTransactionContext,
  type AnyWarthogApi,
  type TransactionJson,
} from "warthog-ts";
import type { WalletNode } from "./config/network";

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

/**
 * The client for a node, one per node family.
 *
 * The family decides more than the chain head shape: it decides the amount
 * field a transfer carries, so a legacy node needs the legacy client. It is
 * part of the node record, so nothing is inferred from the URL.
 */
const createApi = (node: WalletNode | undefined): AnyWarthogApi => {
  // The wallet can be on a family that has no node, so the index is -1 and
  // this is undefined. Say so, rather than failing on the property read.
  if (!node) {
    throw new Error("No node is configured for this network. Pick another node.");
  }
  return node.network === "defi-testnet"
    ? new WarthogDeFiApi(node.url)
    : new WarthogLegacyApi(node.url);
};

const createTransactionContext = async (
  nodeList: WalletNode[],
  selectedNodeIndex: number,
  fee: RoundedFee,
  nonce: NonceId,
): Promise<AnyTransactionContext> => {
  const node = nodeList[selectedNodeIndex];
  const api = createApi(node);
  return api.createTransactionContext(fee, nonce);
};

/**
 * A context for the DeFi node, with the builders only it has.
 *
 * The DeFi pages need them, and they only make sense against a DeFi node.
 */
const requireDeFiContext = (
  context: AnyTransactionContext,
): WarthogDeFiTransactionContext => {
  if (!(context instanceof WarthogDeFiTransactionContext)) {
    throw new Error("This transaction needs a DeFi node");
  }
  return context;
};

const submitTransaction = async (
  nodeList: WalletNode[],
  selectedNodeIndex: number,
  tx: TransactionJson,
): Promise<string> => {
  const node = nodeList[selectedNodeIndex];
  const api = createApi(node);
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
  requireDeFiContext,
  submitTransaction,
};