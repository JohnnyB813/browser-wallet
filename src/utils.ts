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
  type WarthogApiVersion,
} from "warthog-ts";
import { isDefiNode } from "./utils/nodes";

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
 * Which `/chain/head` payload shape a node returns.
 *
 * V1 (core/master, core/dev) flattens the ChainHead fields to the top level;
 * V2 (core/defi) nests them under `chainHead`. The two are not
 * interchangeable, so the client is told which to expect rather than sniffing.
 *
 * TODO(nodes-version-field): this still infers the generation from the node URL
 * via isDefiNode, which guesses on "localhost" and a ":3002" substring. Replace
 * with an explicit `version` field on each node entry and a one-time
 * `/chain/head` probe for user-added nodes.
 */
const apiVersionForNode = (nodeUrl: string | null | undefined): WarthogApiVersion =>
  isDefiNode(nodeUrl) ? "v2" : "v1";

/**
 * The client for a node, one per node family.
 *
 * The family decides more than the chain head shape: it decides the amount
 * field a transfer carries, so a legacy node needs the legacy client.
 */
const createApi = (nodeUrl: string): AnyWarthogApi =>
  apiVersionForNode(nodeUrl) === "v2"
    ? new WarthogDeFiApi(nodeUrl)
    : new WarthogLegacyApi(nodeUrl);

const createTransactionContext = async (
  nodeList: string[],
  selectedNodeIndex: number,
  fee: RoundedFee,
  nonce: NonceId,
): Promise<AnyTransactionContext> => {
  const nodeUrl = nodeList[selectedNodeIndex];
  const api = createApi(nodeUrl);
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
  nodeList: string[],
  selectedNodeIndex: number,
  tx: TransactionJson,
): Promise<string> => {
  const nodeUrl = nodeList[selectedNodeIndex];
  const api = createApi(nodeUrl);
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
  apiVersionForNode,
  createApi,
  createTransactionContext,
  requireDeFiContext,
  submitTransaction,
};