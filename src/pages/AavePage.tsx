import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Header from "../components/Header";
import SpendConfirm, { useSpendFlow } from "../components/SpendConfirm";
import { useChainAccounts } from "../chains/useChainAccounts";
import {
  AAVE_MAIN_SPOKE,
  MIN_SAFE_HEALTH_FACTOR,
  formatHealth,
  healthAfterBorrow,
  healthAfterRepay,
  healthAfterWithdraw,
  healthToNumber,
  loadAaveMarket,
  maxSafeBorrow,
  maxSafeWithdraw,
  parseAaveAmount,
  planBorrow,
  planRepay,
  planSupply,
  planWithdraw,
  rateToPercent,
  runAaveSteps,
  usdOf,
  type AaveMarket,
  type AaveReserveState,
  type AaveStep,
} from "../mobile-port/utils/aaveV4";
import { explainEthError } from "../mobile-port/utils/ethChain";
import { formatRawAmount } from "../mobile-port/utils/ethHoldings";

const field = "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-primary";
const chip = "swap-chip-btn";
const chipOn = "swap-chip-btn swap-chip-btn--active";

type Action = "supply" | "borrow" | "repay" | "withdraw";

type Pending = {
  title: string;
  steps: AaveStep[];
  rows: { label: string; value: string }[];
  doneTitle: string;
  doneMessage: string;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function usd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

function amountText(raw: bigint, decimals: number, places = 6): string {
  return formatRawAmount(raw, decimals, places);
}

function healthColor(wad: bigint | null): string {
  const n = healthToNumber(wad);
  if (n == null || !Number.isFinite(n)) return "text-white";
  if (n < 1.2) return "text-red-400";
  if (n < MIN_SAFE_HEALTH_FACTOR) return "text-amber-300";
  return "text-emerald-300";
}

function explainAave(error: unknown): string {
  const base = explainEthError(error);
  if (/unknown custom error/i.test(base)) {
    return "Aave rejected this transaction (a protocol limit or the health factor was hit). Nothing was sent. Try a smaller amount.";
  }
  if (/bridged amount/i.test(base)) {
    return "Leave some ETH for the Ethereum network fee. The amount you send is on top of gas.";
  }
  return base;
}

export default function AavePage() {
  const { accounts } = useChainAccounts();
  const flow = useSpendFlow();
  const owner = accounts?.ethAddress || "";

  const [market, setMarket] = useState<AaveMarket | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<Action>("supply");
  const [reserveId, setReserveId] = useState(1);
  const [amount, setAmount] = useState("");
  const [maxMode, setMaxMode] = useState(false);
  const [unwrap, setUnwrap] = useState(true);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [planning, setPlanning] = useState(false);

  const refresh = useCallback(async () => {
    if (!owner) return;
    setLoading(true);
    setLoadError("");
    try {
      setMarket(await loadAaveMarket(owner));
    } catch (err) {
      setLoadError(explainAave(err));
    } finally {
      setLoading(false);
    }
  }, [owner]);

  useEffect(() => {
    setMarket(null);
    void refresh();
  }, [refresh]);

  const weth = market?.reserves.find((row) => row.symbol === "WETH");
  const collateral = useMemo(
    () => (market?.reserves ?? []).filter((row) => row.role === "collateral"),
    [market],
  );
  const selected: AaveReserveState | undefined = action === "supply" || action === "withdraw"
    ? collateral.find((row) => row.id === reserveId) ?? collateral[0]
    : weth;

  const priceDecimals = market?.priceDecimals ?? 8;
  const account = market?.account;
  const collateralUsd = account ? Number(account.totalCollateralValue / 10n ** 18n) / 10 ** priceDecimals : 0;
  const debtUsd = account ? Number(account.totalDebtValueRay / 10n ** 45n) / 10 ** priceDecimals : 0;

  const parsed = useMemo((): bigint | null => {
    if (!selected || !amount.trim()) return null;
    try {
      return parseAaveAmount(amount, selected.decimals);
    } catch {
      return null;
    }
  }, [selected, amount]);

  const projected = useMemo((): { text: string; wad: bigint | null } | null => {
    if (!market || !weth || !selected || parsed == null) return null;
    if (action === "borrow") {
      const wad = healthAfterBorrow(market, weth, parsed);
      return { text: formatHealth(wad), wad };
    }
    if (action === "repay") {
      const sent = parsed > weth.debt ? weth.debt : parsed;
      const wad = healthAfterRepay(market, weth, sent);
      return { text: formatHealth(wad), wad };
    }
    if (action === "withdraw") {
      const wad = healthAfterWithdraw(market, selected, parsed);
      return { text: formatHealth(wad), wad };
    }
    return null;
  }, [market, weth, selected, parsed, action]);

  const room = (): string => {
    if (!selected) return "";
    if (action === "supply") return `In wallet ${amountText(selected.walletBalance, selected.decimals)} ${selected.symbol}`;
    if (action === "withdraw") {
      return `Supplied ${amountText(selected.supplied, selected.decimals)} ${selected.symbol} · safe to withdraw ${market ? amountText(maxSafeWithdraw(market, selected), selected.decimals) : "…"}`;
    }
    if (action === "borrow" && market && weth) {
      return `Safe to borrow now ${amountText(maxSafeBorrow(market, weth), 18)} WETH (keeps health factor ≥ ${MIN_SAFE_HEALTH_FACTOR.toFixed(1)})`;
    }
    if (action === "repay" && weth) {
      return `Debt ${amountText(weth.debt, 18, 8)} WETH · wallet ETH ${market ? amountText(market.ethBalance, 18) : "…"}`;
    }
    return "";
  };

  const onMax = (): void => {
    if (!selected || !market || !weth) return;
    let raw = 0n;
    let full = false;
    if (action === "supply") raw = selected.walletBalance;
    else if (action === "withdraw") {
      raw = maxSafeWithdraw(market, selected);
      full = raw >= selected.supplied;
    } else if (action === "borrow") raw = maxSafeBorrow(market, weth);
    else {
      raw = weth.debt;
      full = true;
    }
    setAmount(raw > 0n ? ethers.formatUnits(raw, selected.decimals) : "");
    setMaxMode(full);
  };

  const review = async () => {
    setError("");
    setNotice("");
    if (!market || !weth || !selected || !owner) return;
    if (!ack) {
      setError("Tick the box to confirm you understand the liquidation risk.");
      return;
    }
    let raw: bigint;
    try {
      raw = parseAaveAmount(amount, selected.decimals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enter an amount.");
      return;
    }
    setPlanning(true);
    try {
      const sym = selected.symbol;
      const shown = `${amount.trim()} ${sym}`;
      let steps: AaveStep[];
      let rows: { label: string; value: string }[];
      let title: string;
      let doneMessage: string;
      if (action === "supply") {
        steps = await planSupply(owner, selected, raw);
        title = "Confirm supply";
        rows = [
          { label: "Supply", value: shown },
          { label: "Collateral", value: `${sym} will be enabled as collateral` },
          { label: "Collateral factor", value: `${(selected.collateralFactorBps / 100).toFixed(0)}%` },
        ];
        doneMessage = `${shown} supplied to Aave v4.`;
      } else if (action === "borrow") {
        steps = planBorrow(owner, market, weth, raw, unwrap);
        title = "Confirm borrow";
        rows = [
          { label: "Borrow", value: `${amount.trim()} WETH${unwrap ? " (unwrapped to ETH)" : ""}` },
          { label: "Health factor after", value: formatHealth(healthAfterBorrow(market, weth, raw)) },
          { label: "Variable rate", value: `~${rateToPercent(weth.drawnRateRay)} APR + ${(market.account.riskPremiumBps / 100).toFixed(2)}% risk premium` },
        ];
        doneMessage = `${amount.trim()} WETH borrowed${unwrap ? " and unwrapped to ETH" : ""}.`;
      } else if (action === "repay") {
        const full = maxMode || raw >= weth.debt;
        steps = await planRepay(owner, market, weth, raw > weth.debt ? weth.debt : raw, full);
        title = "Confirm repayment";
        rows = [
          { label: "Repay", value: full ? `All WETH debt (~${amountText(weth.debt, 18, 8)} WETH)` : `${amount.trim()} WETH` },
          { label: "Health factor after", value: formatHealth(healthAfterRepay(market, weth, full ? weth.debt : raw)) },
          { label: "Paid from", value: "WETH in this wallet. ETH is wrapped first if needed." },
        ];
        doneMessage = full ? "WETH debt repaid." : `${amount.trim()} WETH repaid.`;
      } else {
        const full = maxMode || raw >= selected.supplied;
        steps = planWithdraw(owner, market, selected, raw, full);
        title = "Confirm withdrawal";
        rows = [
          { label: "Withdraw", value: full ? `All ${sym} (${amountText(selected.supplied, selected.decimals)})` : shown },
          { label: "Health factor after", value: formatHealth(healthAfterWithdraw(market, selected, full ? selected.supplied : raw)) },
        ];
        doneMessage = `${shown} withdrawn from Aave v4.`;
      }
      rows.push(
        { label: "Transactions", value: `${steps.length}: ${steps.map((step) => step.label).join(" → ")}` },
        { label: "Contract", value: `Aave v4 Main Spoke ${shortAddress(AAVE_MAIN_SPOKE)}` },
        { label: "Network fee", value: "Paid in ETH for every transaction above. Estimated when each one is sent." },
      );
      setPending({ title, steps, rows, doneTitle: title.replace("Confirm", "Done:"), doneMessage });
    } catch (err) {
      setError(explainAave(err));
    } finally {
      setPlanning(false);
    }
  };

  const submit = async () => {
    if (!pending) return;
    flow.begin("Waiting for the wallet to sign…");
    let sent = 0;
    try {
      await runAaveSteps(pending.steps, (label, index, total) => {
        sent = index - 1;
        flow.setStep(`Step ${index} of ${total}: ${label}`);
      });
      sent = pending.steps.length;
      setNotice(pending.doneMessage);
      flow.finish(true, "Done", pending.doneMessage);
      setAmount("");
      setMaxMode(false);
      void refresh();
    } catch (err) {
      const done = sent > 0 ? ` ${sent} earlier step${sent === 1 ? "" : "s"} already went through. Check your position before retrying.` : "";
      flow.finish(false, "Could not finish", `${explainAave(err)}${done}`);
      void refresh();
    }
  };

  const hfNow = account?.healthFactorWad ?? null;

  return (
    <div className="container space-y-3 pb-8">
      <Header title="Aave v4" />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Borrow ETH on Aave v4</p>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
          Ethereum mainnet
        </span>
      </div>
      <p className="text-xs leading-relaxed text-white/50">
        Supply collateral to the Aave v4 Main Spoke ({shortAddress(AAVE_MAIN_SPOKE)}) and borrow WETH against it.
        Signing uses this wallet&apos;s Ethereum account. Only the assets listed below are shown; anything else
        you hold on this Spoke still counts in the health factor.
      </p>

      <div className="space-y-1 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
        <p className="font-semibold">Read before you borrow</p>
        <p>
          If the health factor falls below 1.00 your collateral can be liquidated, with a penalty. Prices move, interest
          accrues every block, and your rate can change. This wallet blocks a borrow or withdrawal that would leave the
          health factor under {MIN_SAFE_HEALTH_FACTOR.toFixed(1)}, but staying safe afterwards is up to you.
        </p>
        <p>
          Amounts offered are conservative: the largest borrow keeps the health factor at {MIN_SAFE_HEALTH_FACTOR.toFixed(1)}
          {" "}and uses at most 90% of the remaining borrow cap or pool liquidity. Every step is a separate Ethereum
          transaction and pays gas. This integration has not been tested with real funds, so start with a small amount.
        </p>
      </div>

      {!owner ? (
        <p className="text-sm text-white/70">
          This wallet has no Ethereum account. Aave needs the account derived from the recovery phrase or an added Nano Ethereum account.
        </p>
      ) : (
        <>
          <div className="space-y-1 rounded-lg border border-white/10 p-3 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-zinc-500">Your Aave v4 position</p>
              <button type="button" className="text-xs text-primary" onClick={() => void refresh()} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
            {loadError ? <p className="text-xs text-red-400">{loadError}</p> : null}
            {market && account ? (
              <>
                <div className="flex justify-between"><span className="text-white/60">Collateral value</span><span className="font-mono text-white">{usd(collateralUsd)}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Debt</span><span className="font-mono text-white">{usd(debtUsd)}</span></div>
                <div className="flex justify-between">
                  <span className="text-white/60">Health factor</span>
                  <span className={`font-mono font-semibold ${healthColor(hfNow)}`}>{formatHealth(hfNow)}</span>
                </div>
                {weth ? (
                  <div className="flex justify-between">
                    <span className="text-white/60">WETH borrow rate</span>
                    <span className="font-mono text-white">
                      ~{rateToPercent(weth.drawnRateRay)} APR{account.riskPremiumBps > 0 ? ` + ${(account.riskPremiumBps / 100).toFixed(2)}% premium` : ""}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between"><span className="text-white/60">ETH in wallet</span><span className="font-mono text-white">{amountText(market.ethBalance, 18)}</span></div>
                {market.skipped.length > 0 ? (
                  <p className="text-xs text-amber-300">Aave no longer lists {market.skipped.join(", ")} at the expected id, so it is hidden.</p>
                ) : null}
              </>
            ) : !loadError ? <p className="text-xs text-zinc-500">Reading Aave…</p> : null}
          </div>

          {market ? (
            <div className="space-y-1 rounded-lg border border-white/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-zinc-500">Collateral · wallet · supplied</p>
              {collateral.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => {
                    setReserveId(row.id);
                    if (action !== "supply" && action !== "withdraw") setAction("supply");
                    setAmount("");
                    setMaxMode(false);
                  }}
                >
                  <span className="text-sm font-semibold text-white">
                    {row.symbol}
                    <span className="ml-1 text-[10px] font-normal text-white/40">LTV {(row.collateralFactorBps / 100).toFixed(0)}%</span>
                  </span>
                  <span className="font-mono text-xs text-zinc-300">
                    {amountText(row.walletBalance, row.decimals, 4)} · {amountText(row.supplied, row.decimals, 4)}
                    {row.supplied > 0n ? (row.enabledAsCollateral ? " ✓" : " (not collateral)") : ""}
                    {" "}≈ {usd(usdOf(row.supplied, row.price, row.decimals, priceDecimals))}
                  </span>
                </button>
              ))}
              {weth ? (
                <p className="pt-1 text-xs text-white/50">
                  WETH debt {amountText(weth.debt, 18, 6)} · borrow room {weth.borrowRoom === ethers.MaxUint256 ? "no cap" : `${amountText(weth.borrowRoom, 18, 2)} WETH`}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-white/10 p-3">
            <div className="flex flex-wrap gap-2">
              {(["supply", "borrow", "repay", "withdraw"] as Action[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={action === id ? chipOn : chip}
                  onClick={() => {
                    setAction(id);
                    setAmount("");
                    setMaxMode(false);
                    setError("");
                  }}
                >
                  {id === "supply" ? "Supply" : id === "borrow" ? "Borrow ETH" : id === "repay" ? "Repay" : "Withdraw"}
                </button>
              ))}
            </div>
            {action === "supply" || action === "withdraw" ? (
              <select
                className={field}
                value={selected?.id ?? ""}
                onChange={(event) => { setReserveId(Number(event.target.value)); setAmount(""); setMaxMode(false); }}
              >
                {collateral.map((row) => <option key={row.id} value={row.id}>{row.symbol}</option>)}
              </select>
            ) : (
              <p className="text-xs text-white/60">{action === "borrow" ? "Borrow WETH (can be unwrapped to ETH)" : "Repay WETH debt"}</p>
            )}
            <div className="flex gap-2">
              <input
                className={field}
                value={amount}
                onChange={(event) => { setAmount(event.target.value.replace(/[^0-9.]/g, "")); setMaxMode(false); }}
                placeholder={`Amount of ${action === "borrow" || action === "repay" ? "WETH" : selected?.symbol ?? ""}`}
                inputMode="decimal"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="button" className={chip} onClick={onMax}>Max</button>
            </div>
            <p className="text-xs text-white/50">{room()}</p>
            {action === "borrow" ? (
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" checked={unwrap} onChange={(event) => setUnwrap(event.target.checked)} />
                Unwrap to ETH after borrowing (one extra transaction)
              </label>
            ) : null}
            {projected && action !== "supply" ? (
              <p className="text-xs text-white/70">
                Health factor after:{" "}
                <span className={`font-mono font-semibold ${healthColor(projected.wad)}`}>{projected.text}</span>
                {action === "borrow" && (healthToNumber(projected.wad) ?? Infinity) < MIN_SAFE_HEALTH_FACTOR ? (
                  <span className="text-red-400"> — below {MIN_SAFE_HEALTH_FACTOR.toFixed(1)}, blocked</span>
                ) : null}
              </p>
            ) : null}
            <label className="flex items-start gap-2 text-xs text-white/70">
              <input type="checkbox" className="mt-0.5" checked={ack} onChange={(event) => setAck(event.target.checked)} />
              I understand my collateral can be liquidated and that this has not been tested with real funds.
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {notice ? <p className="text-sm text-emerald-300">{notice}</p> : null}
            <button
              type="button"
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-black disabled:opacity-60"
              disabled={!market || planning || flow.busy || !amount.trim()}
              onClick={() => void review()}
            >
              {planning ? "Checking…" : action === "supply" ? "Review supply" : action === "borrow" ? "Review borrow" : action === "repay" ? "Review repayment" : "Review withdrawal"}
            </button>
          </div>
        </>
      )}

      <SpendConfirm
        open={pending != null}
        title={pending?.title ?? ""}
        rows={pending?.rows ?? []}
        confirmLabel="Confirm and sign"
        busy={flow.busy}
        step={flow.step}
        outcome={flow.outcome}
        onCancel={() => {
          flow.close();
          setPending(null);
        }}
        onConfirm={() => { void submit(); }}
      />
    </div>
  );
}
