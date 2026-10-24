import { findBtcCredit, btcTxUrl, formatBtc } from "../mobile-port/utils/networks/btc";
import {
  ethTunnelStep,
  ethTxUrl,
  markEthMove,
  readEthInclusion,
  readEthMoves,
  readWithdrawalStage,
  withdrawalFields,
  type EthInclusion,
  type EthMove,
  type WithdrawalStage,
} from "../mobile-port/utils/networks/ethBridge";
import { fetchHemiBalance, hemiTxUrl, readHemiMined } from "../mobile-port/utils/networks/hemi";
import {
  formatLifi,
  lifiOutcome,
  lifiStep,
  markLifiMove,
  readLifiMoves,
  readLifiStatus,
  type LifiMove,
} from "../mobile-port/utils/networks/lifiSwap";
import { solTxUrl } from "../mobile-port/utils/networks/solana";
import {
  btcTunnelStep,
  markTunnelMove,
  readBtcConfirmations,
  readDepositAcknowledged,
  readTunnelMoves,
  readVault,
  type TunnelMove,
} from "../mobile-port/utils/networks/tunnel";
import { formatUnits } from "../mobile-port/utils/networks/units";

export type MoveAction = "" | "Mint" | "Prove" | "Finalize";

export type MoveCard = {
  id: string;
  txHash: string;
  title: string;
  meta: string;
  step: string;
  message: string;
  spinning: boolean;
  failed: boolean;
  action: MoveAction;
  href: string;
  link: string;
  btc?: TunnelMove;
  eth?: EthMove;
};

export type MoveFinish = {
  id: string;
  txHash: string;
  step: string;
  message: string;
  ok: boolean;
  /** When set, a closed sheet toasts this instead of staying quiet. */
  announce?: boolean;
  toastTitle?: string;
  toastMessage?: string;
};

function btcCard(
  row: TunnelMove,
  step: string,
  message: string,
  spinning: boolean,
  action: MoveAction,
): MoveCard {
  const deposit = row.direction === "to-hemi";
  return {
    id: row.id,
    txHash: row.txHash,
    title: deposit ? "Bitcoin → hemiBTC" : "hemiBTC → Bitcoin",
    meta: `${formatBtc(BigInt(row.netSats || "0"))} after the vault fee`,
    step,
    message,
    spinning,
    failed: false,
    action,
    href: deposit ? btcTxUrl(row.txHash) : hemiTxUrl(row.txHash),
    link: "Transaction",
    btc: row,
  };
}

/** Open Bitcoin tunnel rows, plus any move this pass marked minted or paid. */
export async function loadBtcProgress(hemiAddress: string): Promise<{ cards: MoveCard[]; finished: MoveFinish[] }> {
  const rows = (await readTunnelMoves(hemiAddress)).map((row) => ({ ...row }));
  const open = rows.filter((row) => row.status === "broadcast");
  if (open.length === 0) return { cards: [], finished: [] };
  let stateAddress = "";
  let need = 6;
  try {
    const vault = await readVault();
    stateAddress = vault.stateAddress;
    if (vault.confirmations > 0) need = vault.confirmations;
  } catch {
    stateAddress = "";
  }
  const finished: MoveFinish[] = [];
  const confs: Record<string, number | null> = {};
  const acked: Record<string, boolean | undefined> = {};
  const mined: Record<string, boolean | null> = {};
  await Promise.all(open.map(async (row) => {
    if (row.direction === "to-hemi") {
      if (stateAddress) {
        try {
          const known = await readDepositAcknowledged(stateAddress, row.txHash);
          if (known) {
            row.status = "minted";
            acked[row.id] = true;
            await markTunnelMove(row.id, "minted");
            const named = btcTunnelStep(row, { confirmations: null, acknowledged: true, mined: undefined, need });
            finished.push({ id: row.id, txHash: row.txHash, step: named.step, message: named.message, ok: true, announce: true });
            return;
          }
          acked[row.id] = false;
        } catch {
          acked[row.id] = undefined;
        }
      }
      try {
        confs[row.id] = await readBtcConfirmations(row.txHash);
      } catch {
        confs[row.id] = null;
      }
      return;
    }
    try {
      const included = await readHemiMined(row.txHash);
      mined[row.id] = included;
      if (!included) return;
      const paid = await findBtcCredit(row.btcAddress, row.createdAt, BigInt(row.netSats || "0"));
      if (paid) {
        row.status = "paid";
        await markTunnelMove(row.id, "paid");
        const named = btcTunnelStep(row, { confirmations: null, acknowledged: undefined, mined: true, need });
        finished.push({ id: row.id, txHash: row.txHash, step: named.step, message: named.message, ok: true, announce: true });
      }
    } catch {
      mined[row.id] = null;
    }
  }));
  const cards = open
    .filter((row) => row.status === "broadcast")
    .slice(0, 5)
    .map((row) => {
      const named = btcTunnelStep(row, {
        confirmations: confs[row.id],
        acknowledged: acked[row.id],
        mined: mined[row.id],
        need,
      });
      const got = confs[row.id];
      const canMint = row.direction === "to-hemi" && got != null && got >= need && acked[row.id] === false;
      return btcCard(row, named.step, named.message, named.spinning, canMint ? "Mint" : "");
    });
  return { cards, finished };
}

function ethCard(row: EthMove, named: ReturnType<typeof ethTunnelStep>, action: MoveAction): MoveCard {
  const toHemi = row.direction === "to-hemi";
  return {
    id: row.id,
    txHash: row.txHash,
    title: toHemi ? "ETH → Hemi" : "Hemi → ETH",
    meta: `${formatUnits(BigInt(row.amountWei || "0"), 18)} ETH`,
    step: named.step,
    message: named.message,
    spinning: named.spinning,
    failed: named.failed,
    action,
    href: toHemi ? ethTxUrl(row.txHash) : hemiTxUrl(row.txHash),
    link: "Transaction",
    eth: row,
  };
}

/** Open ETH tunnel rows. Marks credited, proven, and finalized the way the phone tunnel does. */
export async function loadEthProgress(address: string): Promise<{ cards: MoveCard[]; finished: MoveFinish[] }> {
  const rows = (await readEthMoves(address)).map((row) => ({ ...row }));
  const finished: MoveFinish[] = [];
  let hemi: bigint | null = null;
  try {
    hemi = await fetchHemiBalance(address);
  } catch {
    hemi = null;
  }
  if (hemi != null) {
    for (const row of rows) {
      if (row.direction !== "to-hemi" || row.status === "credited" || !row.hemiWeiBefore) continue;
      if (hemi >= BigInt(row.hemiWeiBefore) + BigInt(row.amountWei)) {
        row.status = "credited";
        await markEthMove(row.id, "credited");
        const named = ethTunnelStep(row, undefined, undefined);
        finished.push({ id: row.id, txHash: row.txHash, step: named.step, message: named.message, ok: true, announce: true });
      }
    }
  }
  const withdrawals = rows.filter((row) => row.direction === "to-ethereum" && row.withdrawal && row.l2Block != null && row.status !== "finalized");
  const stages: Record<string, WithdrawalStage | "error"> = {};
  await Promise.all(withdrawals.map(async (row) => {
    const fields = withdrawalFields(row);
    if (!fields || row.l2Block == null) {
      stages[row.id] = "error";
      return;
    }
    try {
      const stage = await readWithdrawalStage(fields, row.l2Block);
      stages[row.id] = stage;
      if (stage.kind === "finalized" && row.status !== "finalized") {
        row.status = "finalized";
        await markEthMove(row.id, "finalized");
        const named = ethTunnelStep(row, undefined, stage);
        finished.push({ id: row.id, txHash: row.txHash, step: named.step, message: named.message, ok: true, announce: true });
      } else if ((stage.kind === "waiting-finality" || stage.kind === "ready-to-finalize") && row.status === "submitted") {
        row.status = "proven";
        await markEthMove(row.id, "proven");
      }
    } catch {
      stages[row.id] = "error";
    }
  }));
  const deposits = rows.filter((row) => row.direction === "to-hemi" && row.status === "submitted");
  const inclusions: Record<string, EthInclusion | "error"> = {};
  await Promise.all(deposits.map(async (row) => {
    try {
      inclusions[row.id] = await readEthInclusion(row.txHash);
    } catch {
      inclusions[row.id] = "error";
    }
  }));
  const cards = rows
    .filter((row) => {
      if (finished.some((item) => item.id === row.id)) return false;
      if (row.direction === "to-hemi") return row.status !== "credited";
      if (row.status === "finalized") return false;
      const stage = stages[row.id];
      if (stage && stage !== "error" && stage.kind === "finalized") return false;
      return true;
    })
    .slice(0, 5)
    .map((row) => {
      const toHemi = row.direction === "to-hemi";
      const stage = stages[row.id];
      const named = toHemi
        ? ethTunnelStep(row, inclusions[row.id], undefined)
        : ethTunnelStep(row, undefined, stage);
      let action: MoveAction = "";
      if (!toHemi && stage && stage !== "error" && stage.kind === "ready-to-prove") action = "Prove";
      if (!toHemi && stage && stage !== "error" && stage.kind === "ready-to-finalize") action = "Finalize";
      return ethCard(row, named, action);
    });
  return { cards, finished };
}

function lifiCard(move: LifiMove, step: string, message: string): MoveCard {
  const toBtc = move.direction === "sol-to-btc";
  return {
    id: move.id,
    txHash: move.txHash,
    title: toBtc ? "SOL → BTC" : "BTC → SOL",
    meta: move.toolLabel,
    step,
    message,
    spinning: true,
    failed: false,
    action: "",
    href: move.fromChain === "sol" ? solTxUrl(move.txHash) : btcTxUrl(move.txHash),
    link: "Transaction",
  };
}

/** Open SOL ↔ BTC swaps. Marks done, refunded, and failed once LI.FI says so. */
export async function loadLifiProgress(solAddress: string, btcAddress: string): Promise<{ cards: MoveCard[]; finished: MoveFinish[] }> {
  let rows: LifiMove[] = [];
  try {
    rows = await readLifiMoves(solAddress, btcAddress);
  } catch {
    return { cards: [], finished: [] };
  }
  const open = rows.filter((row) => row.status === "submitted").slice(0, 5);
  const cards: MoveCard[] = [];
  const finished: MoveFinish[] = [];
  for (const move of open) {
    const status = await readLifiStatus(move);
    const outcome = lifiOutcome(status);
    const view = lifiStep(status, move.toolLabel);
    if (outcome === "pending") {
      cards.push(lifiCard(move, view.step, view.eta));
      continue;
    }
    await markLifiMove(move.id, outcome);
    const receive = move.direction === "sol-to-btc" ? "BTC" : "SOL";
    finished.push({
      id: move.id,
      txHash: move.txHash,
      step: view.step,
      message: view.eta,
      ok: outcome !== "failed",
      announce: true,
      toastTitle: outcome === "done" ? "Swap paid out" : outcome === "refunded" ? "Swap refunded" : "Swap failed",
      toastMessage: outcome === "done"
        ? `${formatLifi(BigInt(move.expectedOut || "0"), receive)} is on its way to this wallet.`
        : outcome === "refunded"
          ? "The deposit was sent back."
          : "LI.FI marked this swap failed.",
    });
  }
  return { cards, finished };
}
