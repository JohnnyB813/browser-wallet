import { useEffect, useMemo, useState } from "react";
import { Account, Address, NonceId, RoundedFee, Wart } from "warthog-ts";
import Header from "../components/Header";
import NetworkBadge from "../components/chains/NetworkBadge";
import SpendConfirm, { useSpendFlow } from "../components/SpendConfirm";
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
  safeDepositAddress,
  safePair,
  safePublicNetwork,
  safeSwap,
  safeWaitOrder,
  safeWithdrawCoin,
  saveSafeTradeCredentials,
  type SafeRoute,
  type SafeTradeCredentials,
} from "../mobile-port/utils/exchange/safetrade";
import { sendBtc } from "../mobile-port/utils/networks/btc";
import { sendSol } from "../mobile-port/utils/networks/solana";
import { useChainAccounts } from "../chains/useChainAccounts";

const field = "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-primary";
const chip = "rounded-full border border-white/15 px-3 py-1 text-xs text-white";
const chipOn = "rounded-full border border-primary bg-primary/15 px-3 py-1 text-xs text-primary";

const NETWORKS = ["Warthog", "Ethereum", "Bitcoin", "Solana"] as const;

function routesOn(network: string): SafeRoute[] {
  return SAFE_ROUTES.filter((route) => route.network === network);
}

export default function SafeTradePage() {
  const wallet = useWallet();
  const { accounts } = useChainAccounts();
  const flow = useSpendFlow();
  const [creds, setCreds] = useState<SafeTradeCredentials | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [panel, setPanel] = useState<"swap" | "move">("swap");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>("Ethereum");
  const [payId, setPayId] = useState("usdt:erc20_key");
  const [receiveId, setReceiveId] = useState("wart:wart-key");
  const [moveDir, setMoveDir] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [free, setFree] = useState<Record<string, number>>({});

  const nodeUrl = wallet.selectedNodeUrl || wallet.nodeList[wallet.selectedNodeIndex] || "";
  const pay = SAFE_ROUTES.find((route) => route.id === payId) ?? routesOn(network)[0];
  const receiveChoices = useMemo(() => {
    const local = routesOn(network);
    if (panel === "move" || !pay) return local;
    const extra = SAFE_ROUTES.filter((route) => route.id !== pay.id && safePair(pay.currency, route.currency));
    const seen = new Set<string>();
    return [...local, ...extra].filter((route) => {
      if (seen.has(route.id)) return false;
      seen.add(route.id);
      return true;
    });
  }, [network, panel, pay]);
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
    if (panel === "swap") {
      if (!pair) return "No direct market.";
      const available = free[pay.symbol] ?? 0;
      if (value > available) return `Only ${available} ${pay.symbol} is free on SafeTrade.`;
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
    flow.begin(panel === "swap" ? "Placing the SafeTrade order…" : moveDir === "deposit" ? "Sending the deposit…" : "Submitting the withdrawal…");
    let submitted = false;
    try {
      if (panel === "swap") {
        if (!pair) throw new Error("No direct market.");
        const available = free[pay.symbol] ?? 0;
        if (value > available) {
          flow.finish(false, "Insufficient free balance", `Only ${available} ${pay.symbol} is free on SafeTrade.`);
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" className={panel === "swap" ? chipOn : chip} onClick={() => setPanel("swap")}>Swap</button>
          <button type="button" className={panel === "move" ? chipOn : chip} onClick={() => setPanel("move")}>Move</button>
        </div>
        <select
          className="rounded-full border border-white/15 bg-black px-3 py-1 text-xs text-white"
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
      {panel === "move" ? (
        <div className="flex gap-2">
          <button type="button" className={moveDir === "deposit" ? chipOn : chip} onClick={() => setMoveDir("deposit")}>Deposit</button>
          <button type="button" className={moveDir === "withdraw" ? chipOn : chip} onClick={() => setMoveDir("withdraw")}>Withdraw</button>
        </div>
      ) : null}
      <div className={panel === "swap" ? "grid grid-cols-2 gap-2" : ""}>
        <select className={field} value={pay?.id ?? ""} onChange={(event) => {
          const next = SAFE_ROUTES.find((route) => route.id === event.target.value);
          setPayId(event.target.value);
          if (next && panel === "swap") setNetwork(next.network as (typeof NETWORKS)[number]);
        }}>
          {(panel === "swap" ? routesOn(network) : routesOn(network)).map((route) => (
            <option key={route.id} value={route.id}>{route.symbol}</option>
          ))}
        </select>
        {panel === "swap" ? (
          <select className={field} value={receive?.id ?? ""} onChange={(event) => setReceiveId(event.target.value)}>
            {receiveChoices.filter((route) => route.id !== pay?.id).map((route) => (
              <option key={route.id} value={route.id}>{route.symbol} · {route.network}</option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="flex gap-2">
        <input className={field} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" inputMode="decimal" />
        {panel === "swap" ? (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-white/20 px-3 text-sm text-white"
            onClick={() => {
              if (!pay || !receive) return;
              setPayId(receive.id);
              setReceiveId(pay.id);
              setNetwork(receive.network as (typeof NETWORKS)[number]);
            }}
          >
            Flip
          </button>
        ) : null}
      </div>
      {panel === "move" && moveDir === "withdraw" ? (
        <div className="grid grid-cols-2 gap-2">
          <input className={field} value={emailCode} onChange={(event) => setEmailCode(event.target.value)} placeholder="Email code" />
          <input className={field} value={otpCode} onChange={(event) => setOtpCode(event.target.value)} placeholder="2FA code" inputMode="numeric" />
        </div>
      ) : null}
      <p className="text-xs text-white/50">
        {pay ? `Free on SafeTrade: ${free[pay.symbol] ?? 0} ${pay.symbol}` : ""}
        {panel === "swap" && pay && receive && !pair ? " No direct market." : ""}
      </p>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {notice ? <p className="text-xs text-emerald-300">{notice}</p> : null}
      <button
        type="button"
        className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-black disabled:opacity-50"
        disabled={!creds || flow.busy}
        onClick={() => {
          const issue = problem();
          setError(issue);
          if (!issue) setOpen(true);
        }}
      >
        {panel === "swap" ? "Review swap" : moveDir === "deposit" ? "Review deposit" : "Review withdraw"}
      </button>
      <SpendConfirm
        open={open}
        title={panel === "swap" ? "Confirm swap" : moveDir === "deposit" ? "Confirm deposit" : "Confirm withdraw"}
        rows={panel === "swap" ? [
          { label: "You pay", value: `${amount.trim() || "—"} ${pay?.symbol ?? ""}` },
          { label: "You receive", value: receive?.symbol ?? "—" },
          { label: "Network", value: network },
          { label: "Market", value: pair ? `${pair.market.base}/${pair.market.quote}` : "No direct market" },
        ] : [
          { label: moveDir === "deposit" ? "Deposit" : "Withdraw", value: `${amount.trim() || "—"} ${pay?.symbol ?? ""}` },
          { label: "Network", value: network },
          { label: moveDir === "deposit" ? "From this wallet" : "To", value: pay ? addressFor(pay) || "—" : "—" },
        ]}
        confirmLabel={panel === "swap" ? "Confirm and swap" : moveDir === "deposit" ? "Confirm deposit" : "Confirm withdraw"}
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
