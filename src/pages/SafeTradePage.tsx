import { useEffect, useMemo, useState } from "react";
import safetradeMark from "../assets/safetrade-favicon.png";
import { Account, Address, NonceId, RoundedFee, Wart, type TransactionJson } from "warthog-ts";
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
import { ETH_USDC, ETH_USDT } from "../mobile-port/utils/ethTokens";
import { explainExchangeFailure } from "../mobile-port/utils/exchange/http";
import {
  SAFE_ROUTES,
  clearSafeTradeCredentials,
  keyHint,
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
  type SpotBalance,
} from "../mobile-port/utils/exchange/safetrade";
import { fetchBtcBalance, formatBtc, maxSendableBtc, sendBtc } from "../mobile-port/utils/networks/btc";
import { USDC_MINT, USDT_MINT } from "../mobile-port/utils/networks/chains";
import { fetchSolBalance, formatSol, maxSolPayment, sendSol } from "../mobile-port/utils/networks/solana";
import { sendSpl } from "../mobile-port/utils/networks/solswap";
import { formatUnits } from "../mobile-port/utils/networks/units";
import { readOneBalance } from "../mobile-port/utils/tokenBalances";
import type { WalletNode } from "../config/network";
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

function formatBalance(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const text = value.toFixed(8).replace(/\.?0+$/, "");
  return text || "0";
}

function balanceLine(rows: SpotBalance[], asset: string): string {
  const row = rows.find((item) => item.asset === asset);
  if (!row) return "0 free";
  const free = formatBalance(row.available);
  if (row.locked > 0) return `${free} free · ${formatBalance(row.locked)} locked`;
  return `${free} free`;
}

function freeLockedMessage(symbol: string, available: number, locked: number): string {
  if (locked > 0) {
    return `Only ${formatBalance(available)} ${symbol} free; ${formatBalance(locked)} locked in open orders.`;
  }
  return `Only ${formatBalance(available)} ${symbol} is free on SafeTrade.`;
}

type WalletHold = { text: string; max: string; failed: boolean };

/** On-chain amount this wallet can spend. Same read the swap panel uses. */
async function walletHold(
  route: SafeRoute,
  owners: { wart: string; eth: string; btc: string; sol: string },
  node: WalletNode | null | undefined,
): Promise<WalletHold> {
  if (route.chain === "wart") {
    if (!owners.wart || !node) return { text: "0", max: "", failed: false };
    const live = await fetchBalanceAndPin(node, owners.wart);
    const free = Number(live.available);
    const fee = Number(DEFAULT_FEE_WART);
    const max = Number.isFinite(free) && free > fee ? trimAmount(free - fee) : "";
    return { text: live.available || "0", max, failed: false };
  }
  if (route.chain === "bitcoin") {
    if (!owners.btc) return { text: "0", max: "", failed: false };
    const [balance, max] = await Promise.all([
      fetchBtcBalance(owners.btc),
      maxSendableBtc(owners.btc),
    ]);
    return { text: formatBtc(balance), max: max > 0n ? formatBtc(max) : "", failed: false };
  }
  if (route.chain === "solana") {
    if (!owners.sol) return { text: "0", max: "", failed: false };
    if (route.currency === "sol") {
      const [balance, max] = await Promise.all([
        fetchSolBalance(owners.sol),
        maxSolPayment(owners.sol),
      ]);
      return { text: formatSol(balance), max: max > 0n ? formatSol(max) : "", failed: false };
    }
    const mint = route.currency === "usdc" ? USDC_MINT : USDT_MINT;
    const raw = await readOneBalance("solana", owners.sol, { native: false, address: mint });
    const text = formatUnits(raw, route.decimals);
    return { text, max: raw > 0n ? text : "", failed: false };
  }
  if (!owners.eth) return { text: "0", max: "", failed: false };
  if (route.currency === "eth") {
    const raw = await readOneBalance("ethereum", owners.eth, { native: true, address: "native" });
    const text = formatUnits(raw, 18);
    return { text, max: raw > 0n ? text : "", failed: false };
  }
  const token = route.currency === "usdc" ? ETH_USDC : ETH_USDT;
  const raw = await readOneBalance("ethereum", owners.eth, { native: false, address: token });
  const text = formatUnits(raw, route.decimals);
  return { text, max: raw > 0n ? text : "", failed: false };
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
  const [rows, setRows] = useState<SpotBalance[] | null>(null);
  const [walletHolds, setWalletHolds] = useState<Record<string, WalletHold>>({});
  const [checkError, setCheckError] = useState("");
  const [checking, setChecking] = useState(false);
  const [price, setPrice] = useState(0);

  const balanceOf = (symbol: string): SpotBalance | undefined =>
    rows?.find((row) => row.asset === symbol);

  const selectedNode = wallet.selectedNode;
  const pay = SAFE_ROUTES.find((route) => route.id === payId) ?? routesOn(network)[0];
  const trading = panel === "swap" || panel === "limit";
  const receiveChoices = useMemo(() => {
    if (!trading || !pay) return routesOn(network);
    return marketPartners(pay.currency, network);
  }, [network, trading, pay]);
  const receive = receiveChoices.find((route) => route.id === receiveId) ?? receiveChoices.find((route) => route.id !== pay?.id) ?? receiveChoices[0];
  const pair = pay && receive ? safePair(pay.currency, receive.currency) : null;
  const mainnet = network !== "Warthog" || !isDefiNode(selectedNode);

  useEffect(() => {
    void loadSafeTradeCredentials().then(setCreds);
  }, []);

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
    if (panel !== "limit" || !creds || !pair || !rows) {
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
  }, [panel, creds, pair?.market.id, notice, rows]);

  const addressFor = (route: SafeRoute): string => {
    if (route.chain === "wart") return wallet.wallet || "";
    if (route.chain === "ethereum") return accounts?.ethAddress || "";
    if (route.chain === "bitcoin") return accounts?.btcAddress || "";
    return accounts?.solAddress || "";
  };

  useEffect(() => {
    let alive = true;
    const owners = {
      wart: wallet.wallet || "",
      eth: accounts?.ethAddress || "",
      btc: accounts?.btcAddress || "",
      sol: accounts?.solAddress || "",
    };
    void Promise.all(SAFE_ROUTES.map(async (route) => {
      try {
        const hold = await walletHold(route, owners, selectedNode);
        return [route.id, hold] as const;
      } catch {
        return [route.id, { text: "—", max: "", failed: true }] as const;
      }
    })).then((pairs) => {
      if (alive) setWalletHolds(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [wallet.wallet, accounts?.ethAddress, accounts?.btcAddress, accounts?.solAddress, selectedNode, notice]);

  const checkBalances = async () => {
    setChecking(true);
    setCheckError("");
    try {
      let next = creds;
      const typedKey = apiKey.trim();
      const typedSecret = secret.trim();
      if (typedKey || typedSecret) {
        if (!typedKey || !typedSecret) {
          throw new Error("Enter both the API key and the secret, then check again.");
        }
        next = { apiKey: typedKey, secret: typedSecret };
        await saveSafeTradeCredentials(next);
        setCreds(next);
        setApiKey("");
        setSecret("");
      }
      if (!next) throw new Error("Save a SafeTrade API key and secret first.");
      setRows(null);
      const balances = await safeBalances(next);
      setRows(balances);
    } catch (err) {
      setRows(null);
      setCheckError(explainExchangeFailure(err));
    } finally {
      setChecking(false);
    }
  };

  const forgetKey = async () => {
    setChecking(true);
    try {
      await clearSafeTradeCredentials();
      setCreds(null);
      setApiKey("");
      setSecret("");
      setRows(null);
      setCheckError("");
    } catch (err) {
      setCheckError(explainExchangeFailure(err));
    } finally {
      setChecking(false);
    }
  };

  const problem = (): string => {
    if (!rows) return "Check balances first.";
    const value = Number(amount);
    if (!pay || !(value > 0)) return "Enter an amount.";
    if (trading) {
      if (!pair) return "SafeTrade has no direct market for that pair.";
      const spot = balanceOf(pay.symbol);
      const available = spot?.available ?? 0;
      if (value > available) return freeLockedMessage(pay.symbol, available, spot?.locked ?? 0);
      if (panel === "limit" && !(Number(limitPrice) > 0)) return "Enter a limit price.";
      return "";
    }
    if (moveDir === "deposit") {
      if (!pay.canDeposit) return `${pay.symbol} cannot be deposited from this wallet.`;
      if (pay.chain === "wart" && isDefiNode(selectedNode)) return "WART deposits use the mainnet node.";
      if (!addressFor(pay) && pay.chain !== "wart") return "This wallet has no address on that network.";
      const held = walletHolds[pay.id];
      if (!held) return "Checking the wallet balance.";
      if (held.failed) return `${pay.network} ${pay.symbol} balance unavailable.`;
      if (held.text !== "—" && Number(amount) > Number(held.text) + 1e-9) {
        return `Only ${held.text} ${pay.symbol} is in this wallet.`;
      }
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
        const spot = balanceOf(pay.symbol);
        const available = spot?.available ?? 0;
        if (value > available) {
          flow.finish(false, "Insufficient free balance", freeLockedMessage(pay.symbol, available, spot?.locked ?? 0));
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
          try { setRows(await safeBalances(creds)); } catch { /* order already resting */ }
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
        try { setRows(await safeBalances(creds)); } catch { /* order already placed */ }
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
          if (pay.currency === "sol") {
            await sendSol(dest, amount.trim());
          } else if (pay.currency === "usdc" || pay.currency === "usdt") {
            await sendSpl({
              mint: pay.currency === "usdc" ? USDC_MINT : USDT_MINT,
              decimals: pay.decimals,
              toOwner: dest,
              amount: amount.trim(),
              symbol: pay.symbol,
            });
          } else {
            throw new Error(`This wallet cannot send ${pay.symbol} on Solana yet.`);
          }
        } else {
          await sendEthAsset(pay.currency === "eth" ? "ETH" : pay.currency === "usdc" ? "USDC" : "USDT", dest, amount.trim());
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
        try { setRows(await safeBalances(creds)); } catch { /* withdraw already submitted */ }
        flow.finish(true, "Withdraw submitted", sent);
      }
    } catch (err) {
      if (!submitted) flow.finish(false, "Could not finish", explainExchangeFailure(err));
    }
  };

  async function sendWart(to: string, wartAmount: string) {
    if (wallet.ledgerAccount) throw new Error("Ledger WART deposits use Send on the Warthog home.");
    if (!wallet.seedPhrase && !wallet.privateKey) throw new Error("Unlock the wallet before depositing WART.");
    const live = wallet.wallet && selectedNode ? await fetchBalanceAndPin(selectedNode, wallet.wallet) : null;
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
    await submitTransaction(wallet.nodeList, wallet.selectedNodeIndex, tx as TransactionJson);
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

  const held = pay ? walletHolds[pay.id] : undefined;
  const depositHint = !held
    ? "Available …"
    : held.failed
      ? "Balance unavailable"
      : `Available ${held.text} ${pay?.symbol ?? ""} in this wallet`;
  const walletRows = routesOn(network).flatMap((route) => {
    const row = walletHolds[route.id];
    if (!row || row.failed || !(Number(row.text) > 0)) return [];
    return [{ route, row }];
  });

  return (
    <div className="container space-y-3 pb-8">
      <Header title="SafeTrade" />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">SafeTrade</p>
        <NetworkBadge mainnet={mainnet} />
      </div>
      <p className="text-xs leading-relaxed text-white/50">
        Checks the WART/USDT account on safe.trade. The key stays in this browser.
        SafeTrade accepts the call only from a trusted IPv4.
      </p>
      <p className="text-xs text-white/70">
        {creds ? `Key on this device ${keyHint(creds.apiKey)}` : "No SafeTrade key saved in this browser yet."}
      </p>
      <div className="space-y-2">
        <input
          className={field}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={creds ? "Paste a new key to replace" : "SafeTrade API key"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={checking}
        />
        <input
          className={field}
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder={creds ? "Paste the secret with the new key" : "HMAC secret"}
          type="password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={checking}
        />
        <button
          type="button"
          className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-black disabled:opacity-60"
          onClick={() => void checkBalances()}
          disabled={checking}
        >
          {checking ? "Checking…" : apiKey.trim() || secret.trim() ? "Save and check balances" : "Check balances"}
        </button>
        {creds ? (
          <button
            type="button"
            className="text-xs text-white/50"
            onClick={() => { void forgetKey(); }}
            disabled={checking}
          >
            Remove saved key
          </button>
        ) : null}
      </div>
      {rows ? (
        <div className="space-y-1 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm">
          <p className="font-semibold text-white">SafeTrade accepted this address</p>
          <p className="pt-1 text-[10px] uppercase tracking-wide text-white/40">WART</p>
          <p className="text-white">{balanceLine(rows, "WART")}</p>
          <p className="pt-1 text-[10px] uppercase tracking-wide text-white/40">USDT</p>
          <p className="text-white">{balanceLine(rows, "USDT")}</p>
          {rows
            .filter((row) => row.asset !== "WART" && row.asset !== "USDT" && (row.available > 0 || row.locked > 0))
            .map((row) => (
              <p key={row.asset} className="text-xs text-white/60">
                {row.asset} {balanceLine([row], row.asset)}
              </p>
            ))}
        </div>
      ) : null}
      {checkError ? <p className="text-sm text-red-400">{checkError}</p> : null}
      <div className="rounded-lg border border-white/10 px-3 py-2">
        <p className="text-[10px] font-semibold tracking-[1.2px] text-zinc-500 uppercase">
          In this wallet · {network}
        </p>
        {walletRows.length === 0 ? (
          <p className="mt-1 text-xs text-zinc-500">
            {Object.keys(walletHolds).length === 0 ? "Checking wallet balances…" : `No token balance on ${network} yet.`}
          </p>
        ) : walletRows.map(({ route, row }) => (
          <button
            key={route.id}
            type="button"
            className="mt-1 flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setPayId(route.id)}
          >
            <span className="text-sm font-semibold text-white">{route.symbol}</span>
            <span className="font-mono text-sm text-zinc-200">{row.text}</span>
          </button>
        ))}
      </div>
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
          ? depositHint
          : !rows
            ? "Check balances first."
            : pay
              ? balanceLine(rows, pay.symbol)
              : "Check balances first."}
        onMax={panel === "move" && moveDir === "deposit"
          ? (pay && walletHolds[pay.id]?.max
            ? () => setAmount(walletHolds[pay.id].max)
            : undefined)
          : !pay || !rows
            ? undefined
            : (balanceOf(pay.symbol)?.available ?? 0) > 0
              ? () => setAmount(formatBalance(balanceOf(pay.symbol)?.available ?? 0))
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
        ctaDisabled={!rows || flow.busy}
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
