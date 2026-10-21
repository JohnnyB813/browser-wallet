import { useEffect, useMemo, useState } from "react";
import safetradeMark from "../assets/safetrade-favicon.png";
import { Account, Address, NonceId, RoundedFee, Wart } from "warthog-ts";
import Header from "../components/Header";
import NetworkBadge from "../components/chains/NetworkBadge";
import SpendConfirm, { useSpendFlow } from "../components/SpendConfirm";
import SwapStyleCard from "../components/SwapStyleCard";
import useWallet from "../hooks/useWallet";
import { createTransactionContext, submitTransaction } from "../utils";
import { amountExceedsAvailable, insufficientFreeBalanceMessage } from "../utils/balanceBreakdown";
import { isDefiNode } from "../utils/nodes";
import { fetchBalanceAndPin } from "../utils/warthogNode";
import { deriveAccountAtIndex } from "../utils/walletKeys";
import { DEFAULT_FEE_WART } from "../config";
import { sendEthAsset } from "../mobile-port/utils/ethChain";
import { explainExchangeFailure } from "../mobile-port/utils/exchange/http";
import {
  SAFE_ROUTES,
  clearSafeTradeCredentials,
  loadSafeTradeCredentials,
  safeBalances,
  safeCancelOrder,
  safeDepositAddress,
  safeLimitOrder,
  safeOpenOrders,
  safePair,
  safePublicNetwork,
  safeSwap,
  safeTicker,
  safeWaitOrder,
  safeWithdrawCoin,
  saveSafeTradeCredentials,
  type SafeOrder,
  type SafeRoute,
  type SafeTradeCredentials,
} from "../mobile-port/utils/exchange/safetrade";
import { sendBtc } from "../mobile-port/utils/networks/btc";
import { sendSol } from "../mobile-port/utils/networks/solana";
import { useChainAccounts } from "../chains/useChainAccounts";

const field = "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-primary";
const chip = "swap-chip-btn";
const chipOn = "swap-chip-btn swap-chip-btn--active";

const NETWORKS = ["Warthog", "Ethereum", "Bitcoin", "Solana"] as const;

function routesOn(network: string): SafeRoute[] {
  return SAFE_ROUTES.filter((route) => route.network === network);
}

function routeForCurrency(currency: string, preferNetwork: string): SafeRoute | undefined {
  const rows = SAFE_ROUTES.filter((route) => route.currency === currency);
  return rows.find((route) => route.network === preferNetwork) ?? rows[0];
}

/** One row per currency that has a direct SafeTrade market with `currency`. */
function marketPartners(currency: string, preferNetwork: string): SafeRoute[] {
  const seen = new Set<string>();
  const out: SafeRoute[] = [];
  for (const row of SAFE_ROUTES) {
    if (row.currency === currency || seen.has(row.currency)) continue;
    if (!safePair(currency, row.currency)) continue;
    const pick = routeForCurrency(row.currency, preferNetwork);
    if (!pick) continue;
    seen.add(row.currency);
    out.push(pick);
  }
  return out;
}

function trimAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

export default function SafeTradePage() {
  const wallet = useWallet();
  const { accounts } = useChainAccounts();
  const flow = useSpendFlow();
  const [creds, setCreds] = useState<SafeTradeCredentials | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [panel, setPanel] = useState<"swap" | "limit" | "move">("swap");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>("Ethereum");
  const [payId, setPayId] = useState("usdt:erc20_key");
  const [receiveId, setReceiveId] = useState("wart:wart-key");
  const [moveDir, setMoveDir] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [orders, setOrders] = useState<SafeOrder[]>([]);
  const [emailCode, setEmailCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [free, setFree] = useState<Record<string, number>>({});
  const [price, setPrice] = useState(0);

  const nodeUrl = wallet.selectedNodeUrl || wallet.nodeList[wallet.selectedNodeIndex] || "";
  const pay = SAFE_ROUTES.find((route) => route.id === payId) ?? routesOn(network)[0];
  const trading = panel === "swap" || panel === "limit";
  const receiveChoices = useMemo(() => {
    if (!trading || !pay) return routesOn(network);
    return marketPartners(pay.currency, network);
  }, [network, trading, pay]);
  const receive = receiveChoices.find((route) => route.id === receiveId) ?? receiveChoices.find((route) => route.id !== pay?.id) ?? receiveChoices[0];
  const pair = pay && receive ? safePair(pay.currency, receive.currency) : null;
  const mainnet = network !== "Warthog" || !isDefiNode(nodeUrl);

  useEffect(() => {
    void loadSafeTradeCredentials().then(setCreds);
  }, []);

  useEffect(() => {
    if (!creds) return;
    void safeBalances(creds).then((rows) => {
      const next: Record<string, number> = {};
      rows.forEach((row) => { next[row.asset] = row.available; });
      setFree(next);
    }).catch(() => undefined);
  }, [creds, notice]);

  useEffect(() => {
    if (!trading || !pay) return;
    const partners = marketPartners(pay.currency, network);
    if (!partners.some((route) => route.id === receiveId)) {
      const next = partners[0];
      if (next) setReceiveId(next.id);
    }
  }, [trading, pay, network, receiveId]);

  useEffect(() => {
    if (!trading || !pair) {
      setPrice(0);
      return undefined;
    }
    let alive = true;
    void safeTicker(pair.market.id).then((ticker) => {
      if (!alive) return;
      const last = Number(ticker.last) || 0;
      setPrice(last);
      if (panel === "limit") setLimitPrice(last > 0 ? String(last) : "");
    }).catch(() => {
      if (alive) setPrice(0);
    });
    return () => {
      alive = false;
    };
  }, [trading, panel, pair?.market.id]);

  useEffect(() => {
    if (panel !== "limit" || !creds || !pair) {
      setOrders([]);
      return undefined;
    }
    let alive = true;
    const load = () => {
      void safeOpenOrders(creds, pair.market.id)
        .then((rows) => { if (alive) setOrders(rows); })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [panel, creds, pair?.market.id, notice]);

  const addressFor = (route: SafeRoute): string => {
    if (route.chain === "wart") return wallet.wallet || "";
    if (route.chain === "ethereum") return accounts?.ethAddress || "";
    if (route.chain === "bitcoin") return accounts?.btcAddress || "";
    return accounts?.solAddress || "";
  };

  const saveKeys = async () => {
    const next = { apiKey: apiKey.trim(), secret: secret.trim() };
    if (!next.apiKey || !next.secret) {
      setError("Enter the API key and secret.");
      return;
    }
    await saveSafeTradeCredentials(next);
    setCreds(next);
    setApiKey("");
    setSecret("");
    setError("");
  };

  const problem = (): string => {
    const value = Number(amount);
    if (!pay || !(value > 0)) return "Enter an amount.";
    if (trading) {
      if (!pair) return "SafeTrade has no direct market for that pair.";
      const available = free[pay.symbol] ?? 0;
      if (value > available) return `Only ${available} ${pay.symbol} is free on SafeTrade.`;
      if (panel === "limit" && !(Number(limitPrice) > 0)) return "Enter a limit price.";
      return "";
    }
    if (moveDir === "deposit") {
      if (!pay.canDeposit) return `${pay.symbol} cannot be deposited from this wallet.`;
      if (pay.chain === "wart" && isDefiNode(nodeUrl)) return "WART deposits use the mainnet node.";
      if (!addressFor(pay) && pay.chain !== "wart") return "This wallet has no address on that network.";
      return "";
    }
    if (!addressFor(pay)) return "This wallet has no address to withdraw to.";
    return "";
  };

  const submit = async () => {
    if (!creds || !pay) return;
    const value = Number(amount);
    flow.begin(panel === "limit"
      ? "Placing the limit order…"
      : panel === "swap"
        ? "Placing the SafeTrade order…"
        : moveDir === "deposit" ? "Sending the deposit…" : "Submitting the withdrawal…");
    let submitted = false;
    try {
      if (trading) {
        if (!pair) throw new Error("SafeTrade has no direct market for that pair.");
        const available = free[pay.symbol] ?? 0;
        if (value > available) {
          flow.finish(false, "Insufficient free balance", `Only ${available} ${pay.symbol} is free on SafeTrade.`);
          return;
        }
        if (panel === "limit") {
          const price = Number(limitPrice);
          const base = pair.side === "sell" ? value : value / price;
          flow.setStep("Resting the order on SafeTrade…");
          const order = await safeLimitOrder(creds, { market: pair.market, side: pair.side, amount: base, price });
          const done = `Limit ${pair.side} resting at ${order.price || price} ${pair.market.quote.toUpperCase()}.`;
          setNotice(done);
          submitted = true;
          flow.finish(true, "Limit placed", done);
          return;
        }
        flow.setStep("Waiting for SafeTrade to fill the order…");
        const order = await safeSwap(creds, { ...pair, amount: value });
        const finished = order.id ? await safeWaitOrder(creds, order.id) : order;
        const done = finished.filled > 0
          ? `Filled ${finished.filled} ${pair.market.base.toUpperCase()}.`
          : "The order is placed. It may still be filling.";
        setNotice(done);
        submitted = true;
        flow.finish(true, finished.filled > 0 ? "Swapped" : "Order placed", done);
        return;
      }
      if (moveDir === "deposit") {
        const limits = await safePublicNetwork(pay.currency, pay.blockchainKey);
        if (limits && !limits.depositEnabled) throw new Error("SafeTrade has deposits turned off for this coin.");
        const dest = await safeDepositAddress(creds, pay.currency, pay.blockchainKey);
        if (pay.chain === "wart") {
          await sendWart(dest, amount.trim());
        } else if (pay.chain === "bitcoin") {
          await sendBtc(dest, amount.trim());
        } else if (pay.chain === "solana") {
          await sendSol(dest, amount.trim());
        } else {
          await sendEthAsset(pay.currency === "eth" ? "ETH" : "USDT", dest, amount.trim());
        }
        const sent = `${amount.trim()} ${pay.symbol} sent to SafeTrade.`;
        setNotice(sent);
        submitted = true;
        flow.finish(true, "Deposit sent", sent);
        return;
      }
      const result = await safeWithdrawCoin(creds, {
        currency: pay.currency,
        blockchainKey: pay.blockchainKey,
        min: pay.minWithdraw,
        fee: pay.fee,
        decimals: pay.decimals,
        bookLabel: pay.symbol,
      }, {
        amount: value,
        address: addressFor(pay),
        emailCode,
        otpCode,
      });
      if ("needCode" in result && result.needCode) {
        flow.finish(false, "Code needed", result.message);
        return;
      }
      if ("id" in result) {
        setEmailCode("");
        const sent = `Withdraw ${result.amount} ${pay.symbol} submitted.`;
        setNotice(sent);
        submitted = true;
        flow.finish(true, "Withdraw submitted", sent);
      }
    } catch (err) {
      if (!submitted) flow.finish(false, "Could not finish", explainExchangeFailure(err));
    }
  };

  async function sendWart(to: string, wartAmount: string) {
    if (wallet.ledgerAccount) throw new Error("Ledger WART deposits use Send on the Warthog home.");
    if (!wallet.seedPhrase && !wallet.privateKey) throw new Error("Unlock the wallet before depositing WART.");
    const live = wallet.wallet ? await fetchBalanceAndPin(nodeUrl, wallet.wallet) : null;
    if (live && amountExceedsAvailable(wartAmount, live.available)) {
      throw new Error(insufficientFreeBalanceMessage({
        available: live.available,
        locked: live.locked,
        unit: "WART",
      }));
    }
    const account = wallet.seedPhrase
      ? Account.fromPrivateKeyHex(deriveAccountAtIndex(wallet.seedPhrase, wallet.pathType, wallet.selectedWalletIndex).privateKey)
      : Account.fromPrivateKeyHex(wallet.privateKey || "");
    const fee = RoundedFee.fromE8(BigInt(Math.round(parseFloat(DEFAULT_FEE_WART) * 1e8)), false);
    if (!fee) throw new Error("Invalid fee.");
    const context = await createTransactionContext(wallet.nodeList, wallet.selectedNodeIndex, fee, NonceId.random());
    const toAddr = Address.fromHex(to);
    const parsed = Wart.parse(wartAmount);
    if (!toAddr || !parsed) throw new Error("SafeTrade returned an address this wallet cannot pay.");
    const tx = context.transferWart(account, toAddr, parsed);
    await submitTransaction(wallet.nodeList, wallet.selectedNodeIndex, tx);
  }

  const safeReceiveText = (): string => {
    const value = Number(amount);
    if (!(value > 0)) return "0";
    if (trading) {
      const px = panel === "limit" ? Number(limitPrice) : price;
      if (!(px > 0) || !pair) return "0";
      const out = pair.side === "sell" ? value * px : value / px;
      return trimAmount(out);
    }
    if (moveDir === "withdraw") return trimAmount(Math.max(0, value - (pay?.fee ?? 0)));
    return trimAmount(value);
  };

  return (
    <div className="container space-y-3 pb-8">
      <Header title="SafeTrade" />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">SafeTrade</p>
        <NetworkBadge mainnet={mainnet} />
      </div>
      {!creds ? (
        <div className="space-y-2">
          <input className={field} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="API key" />
          <input className={field} value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="Secret" type="password" />
          <button type="button" className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-black" onClick={() => void saveKeys()}>
            Save API key
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="text-xs text-white/50"
          onClick={() => { void clearSafeTradeCredentials().then(() => setCreds(null)); }}
        >
          Remove saved API key
        </button>
      )}
      <SwapStyleCard
        title={panel === "limit" ? "Limit" : panel === "swap" ? "Swap" : moveDir === "deposit" ? "Deposit" : "Withdraw"}
        subtitle={trading
          ? (pair ? `${pair.market.base.toUpperCase()}/${pair.market.quote.toUpperCase()}` : "No direct market")
          : `${pay?.symbol ?? ""} · ${network}`}
        spotLabel="Price"
        spotValue={trading && price > 0 ? String(price) : undefined}
        mark={<img src={safetradeMark} alt="SafeTrade" className="h-6 w-6" />}
        toolbar={(
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={panel === "swap" ? chipOn : chip} onClick={() => setPanel("swap")}>Swap</button>
            <button type="button" className={panel === "limit" ? chipOn : chip} onClick={() => setPanel("limit")}>Limit</button>
            <button
              type="button"
              className={panel === "move" && moveDir === "deposit" ? chipOn : chip}
              onClick={() => { setPanel("move"); setMoveDir("deposit"); }}
            >
              Deposit
            </button>
            <button
              type="button"
              className={panel === "move" && moveDir === "withdraw" ? chipOn : chip}
              onClick={() => { setPanel("move"); setMoveDir("withdraw"); }}
            >
              Withdraw
            </button>
            <select
              className="swap-chip-btn bg-zinc-900"
              value={network}
              onChange={(event) => {
                const next = event.target.value as (typeof NETWORKS)[number];
                setNetwork(next);
                const first = routesOn(next)[0];
                if (first) setPayId(first.id);
              }}
            >
              {NETWORKS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
        payHint={panel === "move" && moveDir === "deposit"
          ? "From this wallet"
          : <>Available <span className="text-zinc-300 tabular-nums">{free[pay?.symbol ?? ""] ?? 0}</span> {pay?.symbol} on SafeTrade</>}
        onMax={panel === "move" && moveDir === "deposit"
          ? undefined
          : pay && (free[pay.symbol] ?? 0) > 0
            ? () => setAmount(String(free[pay.symbol]))
            : undefined}
        amount={amount}
        onAmount={setAmount}
        paySymbol={pay?.symbol ?? "—"}
        payChoices={routesOn(network).map((route) => ({ id: route.id, symbol: route.symbol, mark: route.symbol }))}
        payValue={pay?.id ?? ""}
        onPay={(id) => {
          const next = SAFE_ROUTES.find((route) => route.id === id);
          setPayId(id);
          if (next && trading) setNetwork(next.network as (typeof NETWORKS)[number]);
        }}
        receiveHint={trading ? "Estimate · before the trading fee" : moveDir === "deposit" ? "On SafeTrade" : "In this wallet · after the fee"}
        receiveAmount={safeReceiveText()}
        receiveSymbol={trading ? (receive?.symbol ?? "—") : (pay?.symbol ?? "—")}
        receiveChoices={trading
          ? receiveChoices.map((route) => ({
            id: route.id,
            symbol: route.symbol,
            mark: route.symbol,
          }))
          : undefined}
        receiveValue={receive?.id ?? ""}
        onReceive={trading ? setReceiveId : undefined}
        onFlip={trading && pay && receive ? () => {
          setPayId(receive.id);
          setReceiveId(pay.id);
          setNetwork(receive.network as (typeof NETWORKS)[number]);
        } : panel === "move" ? () => setMoveDir((dir) => (dir === "deposit" ? "withdraw" : "deposit")) : undefined}
        extra={panel === "limit" ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className={field}
                value={limitPrice}
                onChange={(event) => setLimitPrice(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="Limit price"
                inputMode="decimal"
              />
              <button
                type="button"
                className={chip}
                onClick={() => { if (price > 0) setLimitPrice(String(price)); }}
              >
                Last
              </button>
            </div>
            {orders.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Open on this market</p>
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-2 text-xs text-zinc-300">
                    <span>{order.side} {order.origin} @ {order.price}</span>
                    <button type="button" className="text-primary" onClick={() => {
                      if (!creds || !pair) return;
                      void safeCancelOrder(creds, order.id)
                        .then(() => setNotice("Order canceled."))
                        .catch((err: unknown) => setError(explainExchangeFailure(err)));
                    }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : panel === "move" && moveDir === "withdraw" ? (
          <div className="grid grid-cols-2 gap-2">
            <input className={field} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} placeholder="Email code" />
            <input className={field} value={otpCode} onChange={(event) => setOtpCode(event.target.value)} placeholder="2FA code" inputMode="numeric" />
          </div>
        ) : null}
        summary={trading && pay && receive && !pair ? (
          <p>SafeTrade has no {pay.symbol}/{receive.symbol} market.</p>
        ) : undefined}
        error={error}
        hint={notice || (panel === "limit"
          ? "A limit rests at the price you type until it fills or you cancel it."
          : panel === "swap"
            ? "The swap stays on SafeTrade until you withdraw."
            : "Deposit sends from this wallet. Withdraw pays back to this wallet.")}
        cta={panel === "limit" ? "Review limit" : panel === "swap" ? "Review swap" : moveDir === "deposit" ? "Review deposit" : "Review withdraw"}
        ctaDisabled={!creds || flow.busy}
        onCta={() => {
          const issue = problem();
          setError(issue);
          if (!issue) setOpen(true);
        }}
      />
      <SpendConfirm
        open={open}
        title={panel === "limit" ? "Confirm limit" : panel === "swap" ? "Confirm swap" : moveDir === "deposit" ? "Confirm deposit" : "Confirm withdraw"}
        rows={trading ? [
          { label: "You pay", value: `${amount.trim() || "—"} ${pay?.symbol ?? ""}` },
          { label: "You receive", value: `${safeReceiveText()} ${receive?.symbol ?? ""}` },
          { label: "Market", value: pair ? `${pair.market.base}/${pair.market.quote}` : "No direct market" },
          ...(panel === "limit" ? [{ label: "Limit price", value: limitPrice || "—" }] : []),
          { label: "Network", value: network },
        ] : [
          { label: moveDir === "deposit" ? "Deposit" : "Withdraw", value: `${amount.trim() || "—"} ${pay?.symbol ?? ""}` },
          { label: "Network", value: network },
          { label: moveDir === "deposit" ? "From this wallet" : "To", value: pay ? addressFor(pay) || "—" : "—" },
        ]}
        confirmLabel={panel === "limit" ? "Place limit" : panel === "swap" ? "Confirm and swap" : moveDir === "deposit" ? "Confirm deposit" : "Confirm withdraw"}
        busy={flow.busy}
        step={flow.step}
        outcome={flow.outcome}
        onCancel={() => {
          flow.close(() => setAmount(""));
          setOpen(false);
        }}
        onConfirm={() => { void submit(); }}
      />
    </div>
  );
}
