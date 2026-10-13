/**
 * Shape of the transaction payloads the node returns for history and mempool
 * endpoints.
 *
 * These mirror the node's `api::Block` body entries rather than the SDK's
 * transaction types, because the row components render raw block entries
 * straight from `/account/:addr/history/:beforeId` and `/account/:addr/mempool`
 * without going through a client. Every field is optional because the node
 * omits absent branches, and a given tx kind populates only its own.
 *
 * See `core/defi/src/node/api/glaze/glz_types.hpp` (`Block`, `ActionsByBlock`)
 * for the authoritative definitions.
 */

/** Common part of every signed transaction. */
export interface NodeTxSignedCommon {
  pinHeight?: number;
  nonceId?: number;
  originId?: number | string;
}

/** A monetary amount as the node renders it. */
export interface NodeTxAmount {
  str?: string;
  E8?: number | string;
}

/** Per-kind payload. Only the fields relevant to `type` are populated. */
export interface NodeTxData {
  /** wartTransfer, tokenTransfer */
  amount?: NodeTxAmount;
  /** tokenTransfer, liquidityDeposit, liquidityWithdrawal */
  asset?: { name?: string; hash?: string; decimals?: number };
  /** liquidityDeposit, liquidityWithdrawal */
  baseAsset?: { name?: string; hash?: string; decimals?: number };
  /** assetCreation */
  name?: string;
  /** limitSwap: which side of the order this entry is */
  buy?: boolean;
}

/** A single transaction as embedded in a block body or mempool entry. */
export interface NodeTx {
  hash?: string;
  data?: NodeTxData;
  signedCommon?: NodeTxSignedCommon;
}

/**
 * Mempool entries wrap the transaction one level deeper than blocks do, and
 * carry the transaction kind as a sibling `type` label rather than as the body
 * key the block form uses.
 *
 * See `api::glaze::MempoolEntry` in
 * `core/defi/src/node/api/glaze/glz_types.hpp:367`.
 */
export interface NodeMempoolEntry {
  transaction?: NodeTx;
  /** e.g. "wartTransfer", "limitSwap". */
  type: string;
  height?: number;
  confirmations?: number;
}

/** One block from `ActionsByBlock.perBlock`, as far as the UI reads it. */
export interface NodeHistoryBlock {
  height?: number;
  confirmations?: number;
  body?: Record<string, unknown>;
}

/** `/account/:addr/history/:beforeId` response payload. */
export interface ActionsByBlock {
  fromId: number;
  perBlock: NodeHistoryBlock[];
}

/** The node's transaction kinds, matching the `body` keys of a block. */
export const NODE_TX_TYPES = [
  "wartTransfer",
  "tokenTransfer",
  "assetCreation",
  "cancelation",
  "liquidityDeposit",
  "liquidityWithdrawal",
  "limitSwap",
  "reward",
  "match",
] as const;

export type NodeTxType = (typeof NODE_TX_TYPES)[number];