import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import SpendConfirm, { useSpendFlow } from "../components/SpendConfirm";
import SwapStyleCard from "../components/SwapStyleCard";
import { CHAIN_LABEL, useChainAccounts, type BrowserChain } from "../chains/useChainAccounts";
import {
  executeSushiPair,
  quoteSushiPair,
  type SushiLeg,
  type SushiPairQuote,
} from "../mobile-port/utils/ethChain";
import { ETH_WETH } from "../mobile-port/utils/ethTokens";
import { explainChainError } from "../mobile-port/utils/networks/http";
import {
  executeHemiSushi,
  quoteHemiSushiPair,
  type HemiSushiLeg,
  type HemiSushiQuote,
} from "../mobile-port/utils/networks/hemiSushi";
import { executeStargate, quoteStargate, type StargateQuote } from "../mobile-port/utils/networks/stargate";
import {
  executeSwap,
  quoteSwapAssets,
  type SwapAsset,
  type SwapQuote,
} from "../mobile-port/utils/networks/solswap";
import { WSOL_MINT } from "../mobile-port/utils/networks/chains";
import {
  BRIDGE_ETH,
  BRIDGE_SOL,
  bridgeAssets,
  executeJupBridge,
  formatBridgeAmount,
  quoteJupBridge,
  type JupBridgeAsset,
  type JupBridgeRoute,
} from "../mobile-port/utils/networks/jupBridge";
import {
  executeLifiSwap,
  formatLifi,
  formatLifiWait,
  listLifiRoutes,
  quoteLifiSwap,
  saveLifiMove,
  type LifiAsset,
  type LifiRoute,
} from "../mobile-port/utils/networks/lifiSwap";
import { depositToHemi, fetchHemiBtcBalance, mintHemiDeposit, readTunnelMoves, withdrawToBitcoin, type TunnelMove } from "../mobile-port/utils/networks/tunnel";
import { fetchHemiBalance } from "../mobile-port/utils/networks/hemi";
import { fetchBtcBalance } from "../mobile-port/utils/networks/btc";
import {
  depositEth,
  finalizeWithdrawal,
  readL1Eth,
  markEthMove,
  proveWithdrawal,
  readEthMoves,
  readWithdrawalStage,
  saveEthMove,
  stageError,
  storedWithdrawal,
  withdrawEth,
  withdrawalFields,
  type EthMove,
} from "../mobile-port/utils/networks/ethBridge";
import { formatUnits, parseUnits } from "../mobile-port/utils/networks/units";
import { readOneBalance } from "../mobile-port/utils/tokenBalances";
import { defaultsFor, type WalletToken } from "../mobile-port/utils/walletTokens";

const chip = "swap-chip-btn";
const chipOn = "swap-chip-btn swap-chip-btn--active";

type Chain = Exclude<BrowserChain, "wart">;

function sushiLeg(token: WalletToken): SushiLeg {
  return {
    symbol: token.symbol,
    address: token.native ? ETH_WETH : token.address,
    decimals: token.decimals,
    native: token.native,
  };
}

function hemiLeg(token: WalletToken): HemiSushiLeg {
  return {
    symbol: token.symbol,
    address: token.native ? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" : token.address,
    decimals: token.decimals,
    native: token.native,
  };
}

function solAsset(token: WalletToken): SwapAsset {
  return {
    symbol: token.symbol,
    mint: token.native ? WSOL_MINT : token.address,
    decimals: token.decimals,
    native: token.native,
  };
}

type Draft =
  | { kind: "sushi"; quote: SushiPairQuote; text: string }
  | { kind: "hemi-sushi"; quote: HemiSushiQuote; text: string }
  | { kind: "stargate"; quote: StargateQuote; text: string }
  | { kind: "sol"; quote: SwapQuote; text: string }
  | { kind: "bridge"; route: JupBridgeRoute; text: string }
  | { kind: "lifi"; route: LifiRoute; from: LifiAsset; to: LifiAsset; amountIn: bigint; text: string }
  | { kind: "btc"; direction: "to-hemi" | "to-bitcoin"; amount: string; text: string }
  | { kind: "eth"; direction: "deposit" | "withdraw"; amount: bigint; text: string };

export default function ChainSwap({ chain }: { chain: Chain }) {
  const { accounts } = useChainAccounts();
  const flow = useSpendFlow();
  const location = useLocation();
  const requested = (location.state as { mode?: string } | null)?.mode;
  const [mode, setMode] = useState<"swap" | "tunnel">(
    requested === "tunnel" || chain === "bitcoin" ? "tunnel" : "swap",
  );
  const [amount, setAmount] = useState("");
  const [payId, setPayId] = useState("");
  const [receiveId, setReceiveId] = useState("");
  const [venue, setVenue] = useState<"stargate" | "sushi">("sushi");
  const [target, setTarget] = useState("");
  const [direction, setDirection] = useState("deposit");
  const [slippage, setSlippage] = useState(100);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [btcMoves, setBtcMoves] = useState<TunnelMove[]>([]);
  const [ethMoves, setEthMoves] = useState<EthMove[]>([]);
  const [available, setAvailable] = useState<{ raw: bigint; decimals: number } | null>(null);

  const eth = accounts?.ethAddress ?? "";
  const btc = accounts?.btcAddress ?? "";
  const sol = accounts?.solAddress ?? "";

  useEffect(() => {
    if (!eth) return;
    void readTunnelMoves(eth).then(setBtcMoves).catch(() => undefined);
    void readEthMoves(eth).then(setEthMoves).catch(() => undefined);
  }, [eth]);

  const tokens = chain === "bitcoin" ? [] : defaultsFor(chain === "solana" ? "solana" : chain);
  const pay = tokens.find((token) => token.id === payId) ?? tokens[0];
  const receive = tokens.find((token) => token.id === receiveId && token.id !== pay?.id) ?? tokens.find((token) => token.id !== pay?.id);
  const tunnelChoices: [string, string][] =
    chain === "ethereum"
      ? [["hemi", "Hemi"], ["solana", "Solana"]]
      : chain === "hemi"
        ? [["btc", "Bitcoin"], ["eth", "ETH"]]
        : chain === "solana"
          ? [["bitcoin", "Bitcoin"], ["ethereum", "Ethereum"]]
          : [["hemi", "Hemi"]];
  const activeTarget = target || tunnelChoices[0][0];

  useEffect(() => {
    let alive = true;
    setAvailable(null);
    async function loadPayBalance(): Promise<{ raw: bigint; decimals: number } | null> {
      const btcTunnel = chain === "bitcoin" || (chain === "hemi" && mode === "tunnel" && activeTarget !== "eth");
      if (btcTunnel) {
        if (direction === "withdraw") {
          if (!eth) return null;
          return { raw: await fetchHemiBtcBalance(eth), decimals: 8 };
        }
        if (!btc) return null;
        return { raw: await fetchBtcBalance(btc), decimals: 8 };
      }
      const ethTunnel =
        (chain === "ethereum" && mode === "tunnel" && activeTarget !== "solana") ||
        (chain === "hemi" && mode === "tunnel") ||
        (chain === "hemi" && mode === "swap" && venue === "stargate");
      if (ethTunnel) {
        if (!eth) return null;
        const fromHemi = direction === "withdraw";
        return {
          raw: fromHemi ? await fetchHemiBalance(eth) : await readL1Eth(eth),
          decimals: 18,
        };
      }
      if (payId === "bridge:eth") {
        if (!eth) return null;
        return { raw: await readL1Eth(eth), decimals: 18 };
      }
      if (!pay) return null;
      const owner = pay.network === "solana" ? sol : eth;
      if (!owner) return null;
      return { raw: await readOneBalance(pay.network, owner, pay), decimals: pay.decimals };
    }
    void loadPayBalance().then((row) => {
      if (alive) setAvailable(row);
    }).catch(() => {
      if (alive) setAvailable(null);
    });
    return () => {
      alive = false;
    };
  }, [chain, mode, venue, activeTarget, direction, payId, pay, eth, btc, sol]);

  useEffect(() => {
    setDraft(null);
    if (!accounts || !amount.trim()) return undefined;
    let alive = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        setQuoting(true);
        setError("");
        try {
          const next = await buildDraft();
          if (alive) setDraft(next);
        } catch (err) {
          if (alive) {
            setDraft(null);
            setError(explainChainError(err));
          }
        } finally {
          if (alive) setQuoting(false);
        }
      })();
    }, 450);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // buildDraft closes over the form fields listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, payId, receiveId, mode, venue, target, direction, slippage, chain, eth, btc, sol]);

  async function buildDraft(): Promise<Draft> {
    if (chain === "bitcoin" || (chain === "hemi" && mode === "tunnel" && target !== "eth")) {
      const way = direction === "withdraw" ? "to-bitcoin" : "to-hemi";
      return { kind: "btc", direction: way, amount: amount.trim(), text: way === "to-hemi" ? "Deposit BTC into the Hemi vault" : "Withdraw hemiBTC to Bitcoin" };
    }
    if ((chain === "ethereum" && mode === "tunnel" && target !== "solana") || (chain === "hemi" && mode === "tunnel")) {
      const way = direction === "withdraw" ? "withdraw" : "deposit";
      return {
        kind: "eth",
        direction: way,
        amount: parseUnits(amount.trim(), 18, "ETH"),
        text: way === "deposit" ? "Deposit ETH to Hemi" : "Withdraw ETH to Ethereum",
      };
    }
    if (chain === "hemi" && venue === "stargate") {
      const way = direction === "withdraw" ? "to-ethereum" : "to-hemi";
      const quote = await quoteStargate(way, eth, parseUnits(amount.trim(), 18, "ETH"));
      return { kind: "stargate", quote, text: `${formatUnits(quote.amountOut, 18)} ETH via Stargate` };
    }
    if (chain === "ethereum" && mode === "swap") {
      if (!pay || !receive) throw new Error("Choose two assets.");
      const quote = await quoteSushiPair(sushiLeg(pay), sushiLeg(receive), parseUnits(amount.trim(), pay.decimals, pay.symbol), slippage);
      return { kind: "sushi", quote, text: `${formatUnits(quote.amountOut, receive.decimals)} ${receive.symbol} on SushiSwap` };
    }
    if (chain === "hemi" && venue === "sushi") {
      if (!pay || !receive) throw new Error("Choose two assets.");
      const quote = await quoteHemiSushiPair(hemiLeg(pay), hemiLeg(receive), parseUnits(amount.trim(), pay.decimals, pay.symbol), slippage, eth);
      return { kind: "hemi-sushi", quote, text: `${formatUnits(quote.amountOut, receive.decimals)} ${receive.symbol} on Hemi Sushi` };
    }
    if (chain === "solana" && mode === "tunnel" && target === "ethereum") {
      return bridgeDraft();
    }
    if (chain === "ethereum" && mode === "tunnel" && target === "solana") {
      return bridgeDraft();
    }
    if (chain === "solana" && mode === "swap" && (payId === "bridge:eth" || receiveId === "bridge:eth")) {
      return bridgeDraft();
    }
    if (chain === "solana" && mode === "swap") {
      if (!pay || !receive) throw new Error("Choose two assets.");
      const quote = await quoteSwapAssets(solAsset(pay), solAsset(receive), parseUnits(amount.trim(), pay.decimals, pay.symbol), slippage);
      return { kind: "sol", quote, text: `${quote.outText} ${receive.symbol} on Jupiter` };
    }
    const from: LifiAsset = direction === "withdraw" ? "BTC" : "SOL";
    const to: LifiAsset = from === "SOL" ? "BTC" : "SOL";
    const decimals = from === "SOL" ? 9 : 8;
    const amountIn = parseUnits(amount.trim(), decimals, from);
    const routes = await listLifiRoutes({
      from,
      to,
      amountIn,
      fromAddress: from === "SOL" ? sol : btc,
      toAddress: to === "SOL" ? sol : btc,
    });
    const route = routes[0];
    return {
      kind: "lifi",
      route,
      from,
      to,
      amountIn,
      text: `${formatLifi(route.expectedOut, to)} ${to} · ${route.toolLabel} · ${formatLifiWait(route.seconds)}`,
    };
  }

  async function bridgeDraft(): Promise<Draft> {
    const ethSide = bridgeAssets("ethereum");
    const solSide = bridgeAssets("solana");
    let payAsset: JupBridgeAsset = BRIDGE_ETH;
    let receiveAsset: JupBridgeAsset = BRIDGE_SOL;
    if (chain === "solana" && mode === "swap") {
      payAsset = payId === "bridge:eth" ? BRIDGE_ETH : BRIDGE_SOL;
      receiveAsset = payId === "bridge:eth" ? BRIDGE_SOL : BRIDGE_ETH;
    } else if (chain === "solana") {
      payAsset = direction === "withdraw" ? (solSide.find((asset) => asset.symbol === pay?.symbol) ?? BRIDGE_SOL) : (ethSide.find((asset) => asset.symbol === pay?.symbol) ?? BRIDGE_ETH);
      receiveAsset = payAsset.chain === "solana"
        ? (ethSide.find((asset) => asset.symbol === payAsset.symbol) ?? BRIDGE_ETH)
        : (solSide.find((asset) => asset.symbol === payAsset.symbol) ?? BRIDGE_SOL);
    } else {
      payAsset = direction === "withdraw" ? (solSide.find((asset) => asset.symbol === "SOL") ?? BRIDGE_SOL) : (ethSide.find((asset) => asset.symbol === (pay?.symbol ?? "ETH")) ?? BRIDGE_ETH);
      receiveAsset = payAsset.chain === "ethereum"
        ? (solSide.find((asset) => asset.symbol === (payAsset.symbol === "ETH" ? "SOL" : payAsset.symbol)) ?? BRIDGE_SOL)
        : (ethSide.find((asset) => asset.symbol === "ETH") ?? BRIDGE_ETH);
    }
    const routes = await quoteJupBridge({
      pay: payAsset,
      receive: receiveAsset,
      amountIn: parseUnits(amount.trim(), payAsset.decimals, payAsset.symbol),
      ethAddress: eth,
      solAddress: sol,
      slippageBps: slippage,
    });
    const route = routes[0];
    return {
      kind: "bridge",
      route,
      text: `${formatBridgeAmount(route.expectedOut, route.receive.decimals)} ${route.receive.symbol} · ${route.label}`,
    };
  }

  const submit = async () => {
    if (!draft || !accounts) return;
    flow.begin("Submitting…");
    let submitted = false;
    try {
      if (draft.kind === "sushi") {
        flow.setStep("Sending the swap…");
        const sent = await executeSushiPair(draft.quote, (text) => flow.setStep(text));
        submitted = true;
        flow.finish(true, "Swapped", `${draft.quote.pay.symbol} for ${draft.quote.receive.symbol} is confirmed. ${sent.hash.slice(0, 12)}…`);
        return;
      }
      if (draft.kind === "hemi-sushi") {
        flow.setStep("Waiting for Hemi to confirm…");
        const hash = await executeHemiSushi(draft.quote, eth);
        submitted = true;
        flow.finish(true, "Swapped", `${draft.quote.pay.symbol} for ${draft.quote.receive.symbol} is confirmed on Hemi. ${hash.slice(0, 12)}…`);
        return;
      }
      if (draft.kind === "stargate") {
        const hash = await executeStargate(draft.quote, eth);
        submitted = true;
        flow.finish(true, "Sent", `Stargate accepted the ETH. ${hash.slice(0, 12)}…`);
        return;
      }
      if (draft.kind === "sol") {
        flow.setStep("Waiting for Solana to confirm…");
        const sent = await executeSwap(sol, draft.quote.raw);
        submitted = true;
        flow.finish(true, "Swapped", `Jupiter confirmed the swap. ${sent.signature.slice(0, 12)}…`);
        return;
      }
      if (draft.kind === "bridge") {
        const hash = await executeJupBridge(draft.route, eth, sol);
        submitted = true;
        flow.finish(true, "Bridge sent", `${draft.route.label}. ${hash.slice(0, 12)}…`);
        return;
      }
      if (draft.kind === "lifi") {
        const fresh = await quoteLifiSwap({
          from: draft.from,
          to: draft.to,
          amountIn: draft.amountIn,
          fromAddress: draft.from === "SOL" ? sol : btc,
          toAddress: draft.to === "SOL" ? sol : btc,
          tool: draft.route.tool,
        });
        if (fresh.minOut < draft.route.minOut) throw new Error("The quote moved. Review it again.");
        const hash = await executeLifiSwap(fresh, draft.from === "SOL" ? sol : btc);
        await saveLifiMove({
          id: hash,
          direction: draft.from === "SOL" ? "sol-to-btc" : "btc-to-sol",
          createdAt: Date.now(),
          amountIn: draft.amountIn.toString(),
          expectedOut: fresh.expectedOut.toString(),
          from: draft.from === "SOL" ? sol : btc,
          to: draft.to === "SOL" ? sol : btc,
          txHash: hash,
          tool: fresh.tool,
          toolLabel: fresh.toolLabel,
          fromChain: draft.from === "SOL" ? "sol" : "btc",
          toChain: draft.to === "SOL" ? "sol" : "btc",
          status: "submitted",
        });
        submitted = true;
        flow.finish(true, "Swap sent", `${fresh.toolLabel} accepted it. ${hash.slice(0, 12)}…`);
        return;
      }
      if (draft.kind === "btc") {
        if (draft.direction === "to-hemi") {
          const sent = await depositToHemi(eth, draft.amount);
          submitted = true;
          flow.finish(true, "Deposit submitted", sent.txid.slice(0, 18));
        } else {
          const sent = await withdrawToBitcoin(btc, draft.amount, eth);
          submitted = true;
          flow.finish(true, "Withdrawal submitted", sent.hash.slice(0, 18));
        }
        setBtcMoves(await readTunnelMoves(eth));
        return;
      }
      if (draft.direction === "deposit") {
        const hash = await depositEth(eth, eth, draft.amount);
        await saveEthMove({
          id: hash,
          direction: "to-hemi",
          createdAt: Date.now(),
          amountWei: draft.amount.toString(),
          from: eth,
          to: eth,
          txHash: hash,
          status: "submitted",
        });
        submitted = true;
        flow.finish(true, "Deposit submitted", hash.slice(0, 18));
      } else {
        const sent = await withdrawEth(eth, eth, draft.amount);
        await saveEthMove({
          id: sent.hash,
          direction: "to-ethereum",
          createdAt: Date.now(),
          amountWei: draft.amount.toString(),
          from: eth,
          to: eth,
          txHash: sent.hash,
          l2Block: sent.l2Block,
          withdrawal: storedWithdrawal(sent.withdrawal, sent.withdrawalHash),
          status: "submitted",
        });
        submitted = true;
        flow.finish(true, "Withdrawal submitted", sent.hash.slice(0, 18));
      }
      setEthMoves(await readEthMoves(eth));
    } catch (err) {
      if (!submitted) flow.finish(false, "Could not finish", explainChainError(err));
    }
  };

  const continueEth = async (move: EthMove) => {
    const fields = withdrawalFields(move);
    if (!fields || move.l2Block == null) {
      setError("This deposit does not need a second signature.");
      return;
    }
    flow.begin("Checking the withdrawal…");
    setOpen(true);
    try {
      const stage = await readWithdrawalStage(fields, move.l2Block);
      if (stage.kind === "ready-to-prove") {
        flow.setStep("Proving the withdrawal on Ethereum…");
        const hash = await proveWithdrawal(fields, stage.output);
        await markEthMove(move.id, "proven");
        flow.finish(true, "Proof sent", hash.slice(0, 18));
      } else if (stage.kind === "ready-to-finalize") {
        flow.setStep("Finalizing the withdrawal on Ethereum…");
        const hash = await finalizeWithdrawal(fields);
        await markEthMove(move.id, "finalized");
        flow.finish(true, "Finalized", hash.slice(0, 18));
      } else {
        flow.finish(false, "Not ready", stageError(stage));
      }
      setEthMoves(await readEthMoves(eth));
    } catch (err) {
      flow.finish(false, "Tunnel failed", explainChainError(err));
    }
  };

  const mint = async (move: TunnelMove) => {
    flow.begin("Minting hemiBTC…");
    setOpen(true);
    try {
      const sent = await mintHemiDeposit(move);
      flow.finish(true, sent.already ? "Already minted" : "Mint sent", sent.hash.slice(0, 18));
      setBtcMoves(await readTunnelMoves(eth));
    } catch (err) {
      flow.finish(false, "Mint failed", explainChainError(err));
    }
  };

  if (!accounts) {
    return (
      <div className="container">
        <Header title="Swap" />
        <p className="text-sm text-white/70">These networks need the recovery phrase. A private-key import stays on Warthog.</p>
      </div>
    );
  }

  const showSwap = chain !== "bitcoin";
  const picks = showTokenPick();
  const payChoices = picks ? tokenChoices("pay") : undefined;
  const receiveChoices = picks ? tokenChoices("receive") : undefined;
  const paySymbol = payChoices?.find((choice) => choice.id === (payId || pay?.id))?.symbol
    || pay?.symbol
    || (chain === "bitcoin" || (chain === "hemi" && mode === "tunnel" && activeTarget !== "eth")
      ? (direction === "withdraw" ? "hemiBTC" : "BTC")
      : "ETH");
  const receiveSymbol = receiveChoices?.find((choice) => choice.id === (receiveId || receive?.id))?.symbol
    || receive?.symbol
    || (paySymbol === "BTC" ? "hemiBTC" : paySymbol === "hemiBTC" ? "BTC" : paySymbol);
  const usesSlippage =
    (mode === "swap" && chain !== "bitcoin" && !(chain === "hemi" && venue === "stargate")) ||
    (mode === "tunnel" && (
      (chain === "ethereum" && activeTarget === "solana") ||
      (chain === "solana" && activeTarget === "ethereum")
    ));

  return (
    <div className="container space-y-3 pb-8">
      <Header title={CHAIN_LABEL[chain]} />
      <SwapStyleCard
        title={mode === "swap" ? "Swap" : "Tunnel"}
        subtitle={`${paySymbol} → ${receiveSymbol}`}
        toolbar={(
          <div className="flex flex-wrap items-center gap-2">
            {showSwap ? (
              <button type="button" className={mode === "swap" ? chipOn : chip} onClick={() => setMode("swap")}>Swap</button>
            ) : null}
            <button type="button" className={mode === "tunnel" ? chipOn : chip} onClick={() => setMode("tunnel")}>Tunnel</button>
            {mode === "tunnel"
              ? tunnelChoices.map(([id, label]) => (
                <button key={id} type="button" className={activeTarget === id ? chipOn : chip} onClick={() => setTarget(id)}>{label}</button>
              ))
              : null}
            {chain === "hemi" && mode === "swap" ? (
              <>
                <button type="button" className={venue === "sushi" ? chipOn : chip} onClick={() => setVenue("sushi")}>Sushi</button>
                <button type="button" className={venue === "stargate" ? chipOn : chip} onClick={() => setVenue("stargate")}>Stargate</button>
              </>
            ) : null}
          </div>
        )}
        payHint={available ? <>Available <span className="text-zinc-300 tabular-nums">{formatUnits(available.raw, available.decimals)}</span> {paySymbol}</> : "Available …"}
        onMax={available && available.raw > 0n ? () => setAmount(formatUnits(available.raw, available.decimals)) : undefined}
        amount={amount}
        onAmount={setAmount}
        paySymbol={paySymbol}
        payChoices={payChoices}
        payValue={payId || pay?.id || ""}
        onPay={picks ? setPayId : undefined}
        receiveHint={usesSlippage ? `Estimate · ${slippage / 100}% slip` : "Estimate"}
        receiveAmount={quoting ? "…" : receiveFigure()}
        receiveSymbol={receiveSymbol}
        receiveChoices={receiveChoices}
        receiveValue={receiveId || receive?.id || ""}
        onReceive={picks ? setReceiveId : undefined}
        onFlip={flipLegs}
        extra={usesSlippage ? (
          <div className="flex gap-2">
            {[50, 100, 300].map((bps) => (
              <button key={bps} type="button" className={slippage === bps ? chipOn : chip} onClick={() => setSlippage(bps)}>
                {bps / 100}%
              </button>
            ))}
          </div>
        ) : null}
        summary={(
          <>
            <div className="flex justify-between gap-3">
              <span>Route</span>
              <span className="text-zinc-400 text-right">{draft?.text || (quoting ? "Quoting…" : "Enter an amount")}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Network</span>
              <span className="text-zinc-400">{CHAIN_LABEL[chain]}</span>
            </div>
          </>
        )}
        error={error}
        hint={mode === "swap"
          ? "A market swap. The amount you receive is an estimate until you confirm."
          : "A tunnel moves the same coin to the other network."}
        cta={mode === "swap" ? "Review swap" : "Review tunnel"}
        ctaDisabled={!draft || quoting || flow.busy}
        onCta={() => setOpen(true)}
      />

      {btcMoves.length > 0 && (chain === "bitcoin" || chain === "hemi") ? (
        <MoveList title="Bitcoin tunnel" rows={btcMoves.map((move) => ({
          id: move.id,
          text: `${move.direction === "to-hemi" ? "Deposit" : "Withdraw"} · ${move.status}`,
          action: move.direction === "to-hemi" && move.status === "broadcast" ? "Mint" : "",
          run: () => void mint(move),
        }))} />
      ) : null}
      {ethMoves.length > 0 && (chain === "ethereum" || chain === "hemi") ? (
        <MoveList title="ETH tunnel" rows={ethMoves.map((move) => ({
          id: move.id,
          text: `${move.direction === "to-hemi" ? "Deposit" : "Withdraw"} · ${move.status}`,
          action: move.direction === "to-ethereum" && move.status !== "finalized" ? "Continue" : "",
          run: () => void continueEth(move),
        }))} />
      ) : null}

      <SpendConfirm
        open={open}
        title={mode === "swap" ? "Confirm swap" : "Confirm tunnel"}
        rows={[
          { label: "You pay", value: `${amount.trim() || "—"}` },
          { label: "You receive", value: draft?.text || "—" },
          { label: "Network", value: CHAIN_LABEL[chain] },
        ]}
        confirmLabel={mode === "swap" ? "Confirm and swap" : "Confirm and send"}
        busy={flow.busy}
        step={flow.step}
        outcome={flow.outcome}
        onCancel={() => {
          flow.close(() => setAmount(""));
          setOpen(false);
          setDraft(null);
        }}
        onConfirm={() => { void submit(); }}
      />
    </div>
  );

  function showTokenPick(): boolean {
    if (mode === "tunnel") {
      if (chain === "ethereum" && activeTarget === "solana") return true;
      if (chain === "solana" && activeTarget === "ethereum") return true;
      return false;
    }
    if (chain === "hemi" && venue === "stargate") return false;
    return chain === "ethereum" || chain === "hemi" || chain === "solana";
  }

  function tokenChoices(role: "pay" | "receive") {
    const list = [...tokens];
    if (chain === "solana" && mode === "swap") {
      list.unshift({
        id: "bridge:eth",
        network: "solana",
        symbol: "ETH",
        name: "Ether on Ethereum",
        decimals: 18,
        address: "native",
        native: true,
      });
    }
    return list
      .filter((token) => role === "pay" || token.id !== (pay?.id ?? ""))
      .map((token) => ({ id: token.id, symbol: token.symbol }));
  }

  function flipLegs() {
    if (payId === "bridge:eth" || receiveId === "bridge:eth") {
      const nextPay = payId === "bridge:eth" ? (receive?.id || "") : "bridge:eth";
      const nextReceive = receiveId === "bridge:eth" ? payId : "bridge:eth";
      setPayId(nextPay);
      setReceiveId(nextReceive);
      return;
    }
    if (picks && pay && receive) {
      setPayId(receive.id);
      setReceiveId(pay.id);
      return;
    }
    setDirection((current) => (current === "withdraw" ? "deposit" : "withdraw"));
  }

  function receiveFigure(): string {
    if (!draft) return "0";
    if (draft.kind === "sushi" || draft.kind === "hemi-sushi") {
      return formatUnits(draft.quote.amountOut, receive?.decimals ?? draft.quote.receive.decimals);
    }
    if (draft.kind === "stargate") return formatUnits(draft.quote.amountOut, 18);
    if (draft.kind === "sol") return draft.quote.outText;
    if (draft.kind === "bridge") return formatBridgeAmount(draft.route.expectedOut, draft.route.receive.decimals);
    if (draft.kind === "lifi") return formatLifi(draft.route.expectedOut, draft.to);
    return amount.trim() || "0";
  }
}

function MoveList({
  title,
  rows,
}: {
  title: string;
  rows: { id: string; text: string; action: string; run: () => void }[];
}) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-white/40">{title}</p>
      <div className="space-y-2">
        {rows.slice(0, 5).map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-2">
            <p className="text-xs text-white/80">{row.text}</p>
            {row.action ? (
              <button type="button" className="text-xs text-primary" onClick={row.run}>{row.action}</button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
