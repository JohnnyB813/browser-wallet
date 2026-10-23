import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ethers } from "ethers";
import Header from "../components/Header";
import SpendConfirm, { useSpendFlow } from "../components/SpendConfirm";
import TokenMark from "../components/chains/TokenMark";
import { useChainAccounts } from "../chains/useChainAccounts";
import {
  AAVE_MAIN_SPOKE,
  MIN_SAFE_HEALTH_FACTOR,
  WETH_RESERVE_ID,
  formatHealth,
  healthAfterBorrow,
  healthAfterRepay,
  healthAfterWithdraw,
  healthToNumber,
  loadAaveMarket,
  maxSafeBorrow,
  maxSafeWithdraw,
  maxWrappableEth,
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

/** Key of the supply source that wraps plain ETH into WETH. Other keys are reserve ids. */
const ETH_KEY = "eth";

type Pending = {
  title: string;
  steps: AaveStep[];
  rows: { label: string; value: string; icon?: string }[];
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

function roomText(row: AaveReserveState): string {
  return row.borrowRoom === ethers.MaxUint256 ? "no cap" : `${amountText(row.borrowRoom, row.decimals, 2)} ${row.symbol}`;
}

function healthBadge(wad: bigint | null): { label: string; cls: string } {
  const n = healthToNumber(wad);
  if (n == null || !Number.isFinite(n)) return { label: "No debt", cls: "bg-white/10 text-white/70" };
  if (n < 1.2) return { label: "At risk", cls: "bg-red-400/15 text-red-300" };
  if (n < MIN_SAFE_HEALTH_FACTOR) return { label: "Caution", cls: "bg-amber-400/15 text-amber-300" };
  return { label: "Healthy", cls: "bg-emerald-400/15 text-emerald-300" };
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[1.2px] text-zinc-400">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Icon, symbol and a right-aligned value. Used for every asset row so columns line up. */
function AssetRow({
  symbol,
  sub,
  value,
  onClick,
}: {
  symbol: string;
  sub?: string;
  value: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <TokenMark symbol={symbol} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-white">{symbol}</span>
        {sub ? <span className="block text-[11px] leading-tight text-white/40">{sub}</span> : null}
      </span>
      <span className="text-right font-mono text-xs leading-tight text-zinc-200">{value}</span>
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left";
  return onClick ? (
    <button type="button" className={`${cls} hover:bg-white/5`} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
      <p className={`font-mono text-sm ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export default function AavePage() {
  const { accounts } = useChainAccounts();
  const flow = useSpendFlow();
  const owner = accounts?.ethAddress || "";

  const [market, setMarket] = useState<AaveMarket | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<Action>("supply");
  const [assetKey, setAssetKey] = useState<string>(ETH_KEY);
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

  const weth = market?.reserves.find((row) => row.id === WETH_RESERVE_ID);
  const supplyList = useMemo(
    () => (market?.reserves ?? []).filter((row) => row.collateral && row.collateralFactorBps > 0 && !row.frozen && !row.paused),
    [market],
  );
  const collateralList = useMemo(
    () => (market?.reserves ?? []).filter((row) => row.collateral && (row.collateralFactorBps > 0 || row.supplied > 0n)),
    [market],
  );
  const borrowList = useMemo(() => (market?.reserves ?? []).filter((row) => row.canBorrow), [market]);
  const debtList = useMemo(() => (market?.reserves ?? []).filter((row) => row.debt > 0n), [market]);

  /** Assets the picker offers for the current action. */
  const choices = useMemo((): { key: string; symbol: string; sub: string }[] => {
    if (action === "supply") {
      return [
        ...(weth ? [{ key: ETH_KEY, symbol: "ETH", sub: "wraps to WETH" }] : []),
        ...supplyList.map((row) => ({ key: String(row.id), symbol: row.symbol, sub: `LTV ${(row.collateralFactorBps / 100).toFixed(0)}%` })),
      ];
    }
    if (action === "withdraw") {
      return collateralList.map((row) => ({ key: String(row.id), symbol: row.symbol, sub: `${amountText(row.supplied, row.decimals, 4)} supplied` }));
    }
    if (action === "borrow") {
      return borrowList.map((row) => ({ key: String(row.id), symbol: row.symbol, sub: `~${rateToPercent(row.drawnRateRay)} APR${row.id === WETH_RESERVE_ID ? " · or ETH" : ""}` }));
    }
    return debtList.map((row) => ({ key: String(row.id), symbol: row.symbol, sub: `owe ${amountText(row.debt, row.decimals, 4)}` }));
  }, [action, weth, supplyList, collateralList, borrowList, debtList]);

  const activeKey = choices.some((c) => c.key === assetKey) ? assetKey : choices[0]?.key ?? "";
  const fromEth = action === "supply" && activeKey === ETH_KEY;
  const selected: AaveReserveState | undefined = market?.reserves.find(
    (row) => String(row.id) === (fromEth ? String(WETH_RESERVE_ID) : activeKey),
  );
  const isWeth = selected?.id === WETH_RESERVE_ID;

  const priceDecimals = market?.priceDecimals ?? 8;
  const account = market?.account;
  const collateralUsd = account ? Number(account.totalCollateralValue / 10n ** 18n) / 10 ** priceDecimals : 0;
  const debtUsd = account ? Number(account.totalDebtValueRay / 10n ** 45n) / 10 ** priceDecimals : 0;
  const symbolShown = fromEth ? "ETH" : selected?.symbol ?? "";

  const parsed = useMemo((): bigint | null => {
    if (!selected || !amount.trim()) return null;
    try {
      return parseAaveAmount(amount, selected.decimals);
    } catch {
      return null;
    }
  }, [selected, amount]);

  const projected = useMemo((): { text: string; wad: bigint | null } | null => {
    if (!market || !selected || parsed == null) return null;
    if (action === "borrow") {
      const wad = healthAfterBorrow(market, selected, parsed);
      return { text: formatHealth(wad), wad };
    }
    if (action === "repay") {
      const sent = parsed > selected.debt ? selected.debt : parsed;
      const wad = healthAfterRepay(market, selected, sent);
      return { text: formatHealth(wad), wad };
    }
    if (action === "withdraw") {
      const wad = healthAfterWithdraw(market, selected, parsed);
      return { text: formatHealth(wad), wad };
    }
    return null;
  }, [market, selected, parsed, action]);

  const room = (): string => {
    if (!selected || !market) return "";
    if (action === "supply") {
      if (fromEth) {
        return `ETH in wallet ${amountText(market.ethBalance, 18)} · keeps ${amountText(market.ethGasReserve, 18, 4)} ETH for gas · most you can supply ${amountText(maxWrappableEth(market), 18)}`;
      }
      return `In wallet ${amountText(selected.walletBalance, selected.decimals)} ${selected.symbol} · supply room ${selected.supplyRoom === ethers.MaxUint256 ? "no cap" : amountText(selected.supplyRoom, selected.decimals, 2)}`;
    }
    if (action === "withdraw") {
      return `Supplied ${amountText(selected.supplied, selected.decimals)} ${selected.symbol} · safe to withdraw ${amountText(maxSafeWithdraw(market, selected), selected.decimals)}`;
    }
    if (action === "borrow") {
      return `Safe to borrow now ${amountText(maxSafeBorrow(market, selected), selected.decimals)} ${selected.symbol} (keeps health factor ≥ ${MIN_SAFE_HEALTH_FACTOR.toFixed(1)}) · room under Aave's limits ${roomText(selected)}`;
    }
    const base = `Debt ${amountText(selected.debt, selected.decimals, 8)} ${selected.symbol} · in wallet ${amountText(selected.walletBalance, selected.decimals)}`;
    return isWeth ? `${base} · ETH ${amountText(market.ethBalance, 18)} can be wrapped to cover a shortfall` : base;
  };

  const onMax = (): void => {
    if (!selected || !market) return;
    let raw = 0n;
    let full = false;
    if (action === "supply") raw = fromEth ? maxWrappableEth(market) : selected.walletBalance;
    else if (action === "withdraw") {
      raw = maxSafeWithdraw(market, selected);
      full = raw >= selected.supplied;
    } else if (action === "borrow") raw = maxSafeBorrow(market, selected);
    else {
      raw = selected.debt;
      full = true;
    }
    setAmount(raw > 0n ? ethers.formatUnits(raw, selected.decimals) : "");
    setMaxMode(full);
  };

  const review = async () => {
    setError("");
    setNotice("");
    if (!market || !selected || !owner) return;
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
      const typed = amount.trim();
      let steps: AaveStep[];
      let rows: { label: string; value: string; icon?: string }[];
      let title: string;
      let doneMessage: string;
      if (action === "supply") {
        steps = await planSupply(owner, market, selected, raw, fromEth);
        title = "Confirm supply";
        rows = [
          { label: "Supply", icon: fromEth ? "ETH" : sym, value: fromEth ? `${typed} ETH (wrapped to WETH, then supplied as WETH)` : `${typed} ${sym}` },
          { label: "Collateral", value: `${sym} will be enabled as collateral` },
          { label: "Collateral factor", value: `${(selected.collateralFactorBps / 100).toFixed(0)}%` },
        ];
        doneMessage = `${typed} ${fromEth ? "ETH" : sym} supplied to Aave v4${fromEth ? " as WETH" : ""}.`;
      } else if (action === "borrow") {
        const toEth = unwrap && isWeth;
        steps = planBorrow(owner, market, selected, raw, toEth);
        title = "Confirm borrow";
        rows = [
          { label: "Borrow", icon: toEth ? "ETH" : sym, value: `${typed} ${sym}${toEth ? " (unwrapped to ETH)" : ""}` },
          { label: "Health factor after", value: formatHealth(healthAfterBorrow(market, selected, raw)) },
          { label: "Variable rate", value: `~${rateToPercent(selected.drawnRateRay)} APR + ${(market.account.riskPremiumBps / 100).toFixed(2)}% risk premium` },
        ];
        doneMessage = `${typed} ${sym} borrowed${toEth ? " and unwrapped to ETH" : ""}.`;
      } else if (action === "repay") {
        const full = maxMode || raw >= selected.debt;
        steps = await planRepay(owner, market, selected, raw > selected.debt ? selected.debt : raw, full);
        title = "Confirm repayment";
        rows = [
          { label: "Repay", icon: sym, value: full ? `All ${sym} debt (~${amountText(selected.debt, selected.decimals, 8)} ${sym})` : `${typed} ${sym}` },
          { label: "Health factor after", value: formatHealth(healthAfterRepay(market, selected, full ? selected.debt : raw)) },
          { label: "Paid from", value: isWeth ? "WETH in this wallet. ETH is wrapped first if needed." : `${sym} in this wallet` },
        ];
        doneMessage = full ? `${sym} debt repaid.` : `${typed} ${sym} repaid.`;
      } else {
        const full = maxMode || raw >= selected.supplied;
        const toEth = unwrap && isWeth;
        steps = planWithdraw(owner, market, selected, raw, full, toEth);
        title = "Confirm withdrawal";
        rows = [
          { label: "Withdraw", icon: toEth ? "ETH" : sym, value: `${full ? `All ${sym} (${amountText(selected.supplied, selected.decimals)})` : `${typed} ${sym}`}${toEth ? " (unwrapped to ETH)" : ""}` },
          { label: "Health factor after", value: formatHealth(healthAfterWithdraw(market, selected, full ? selected.supplied : raw)) },
        ];
        doneMessage = `${typed} ${sym} withdrawn from Aave v4${toEth ? " and unwrapped to ETH" : ""}.`;
      }
      rows.push(
        { label: "Transactions", value: `${steps.length}: ${steps.map((step) => step.label).join(" → ")}` },
        { label: "Contract", value: `Aave v4 Main Spoke ${shortAddress(AAVE_MAIN_SPOKE)}` },
        { label: "Network fee", value: "Paid in ETH for every transaction above. Estimated when each one is sent." },
      );
      setPending({ title, steps, rows, doneMessage });
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

  const pickAction = (id: Action): void => {
    setAction(id);
    setAssetKey("");
    setAmount("");
    setMaxMode(false);
    setError("");
  };

  const hfNow = account?.healthFactorWad ?? null;
  const amountPlaceholder = `Amount of ${symbolShown}`;
  const badge = healthBadge(hfNow);
  const verb = action === "supply" ? "supply" : action === "borrow" ? "borrow" : action === "repay" ? "repayment" : "withdrawal";
  const ctaLabel = planning
    ? "Checking…"
    : flow.busy
      ? "Working…"
      : !market
        ? loadError ? "Aave unavailable" : "Loading Aave…"
        : !selected
          ? action === "repay" ? "No debt to repay" : "Nothing to choose"
          : !amount.trim()
            ? "Enter an amount"
            : `Review ${verb}`;
  const ctaDisabled = !market || !selected || planning || flow.busy || !amount.trim();

  return (
    <div className="container space-y-3 pb-8">
      <Header title="Aave v4" />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Borrow on Aave v4</p>
        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
          Ethereum mainnet
        </span>
      </div>
      <p className="text-xs leading-relaxed text-white/50">
        Supply collateral to the Aave v4 Main Spoke ({shortAddress(AAVE_MAIN_SPOKE)}) and borrow against it.
        Signing uses this wallet&apos;s Ethereum account. Only the assets listed below are shown; anything else
        you hold on this Spoke still counts in the health factor.
      </p>
      <p className="text-xs leading-relaxed text-white/70">
        Aave holds WETH, a 1:1 wrapped version of ETH, so this wallet wraps your ETH for you when you supply it,
        and unwraps back to ETH when you borrow or withdraw WETH if you leave that option on.
      </p>

      <div className="space-y-1 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
        <p className="font-semibold">Read before you borrow</p>
        <p>
          If the health factor falls below 1.00 your collateral can be liquidated, with a penalty. Prices move, interest
          accrues every block, and your rate can change. Borrowing a volatile asset (WETH, WBTC, cbBTC) against other
          collateral adds price risk both ways. This wallet blocks a borrow or withdrawal that would leave the
          health factor under {MIN_SAFE_HEALTH_FACTOR.toFixed(1)}, but staying safe afterwards is up to you.
        </p>
        <p>
          Amounts offered are conservative: the largest borrow keeps the health factor at {MIN_SAFE_HEALTH_FACTOR.toFixed(1)}
          {" "}and uses at most 90% of the remaining borrow cap or pool liquidity. Every step is a separate Ethereum
          transaction and pays gas. This integration has not been tested with real funds, so start with a small amount.
        </p>
      </div>

      {!owner ? (
        <p className="rounded-xl border border-white/10 p-3 text-sm text-white/70">
          This wallet has no Ethereum account. Aave needs the account derived from the recovery phrase or an added Nano Ethereum account.
        </p>
      ) : (
        <>
          <Section
            title="Your position"
            right={(
              <button type="button" className="text-xs text-primary disabled:opacity-50" onClick={() => void refresh()} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
            )}
          >
            {loadError ? (
              <div className="space-y-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3">
                <p className="text-xs text-red-300">{loadError}</p>
                <button type="button" className="text-xs font-semibold text-primary" onClick={() => void refresh()}>Try again</button>
              </div>
            ) : null}
            {market && account ? (
              <>
                <div className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Health factor</p>
                    <p className={`font-mono text-2xl font-semibold leading-tight ${healthColor(hfNow)}`}>{formatHealth(hfNow)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Collateral" value={usd(collateralUsd)} />
                  <Stat label="Debt" value={usd(debtUsd)} />
                  <Stat label="ETH in wallet" value={amountText(market.ethBalance, 18)} />
                  <Stat label="WETH in wallet" value={weth ? amountText(weth.walletBalance, 18) : "—"} />
                </div>
                {account.riskPremiumBps > 0 ? (
                  <p className="text-xs text-white/50">Risk premium on borrows: +{(account.riskPremiumBps / 100).toFixed(2)}%</p>
                ) : null}
                {debtList.length > 0 ? (
                  <div className="space-y-0.5 pt-1">
                    <p className="text-[10px] uppercase tracking-wide text-white/40">Borrowed</p>
                    {debtList.map((row) => (
                      <AssetRow
                        key={row.id}
                        symbol={row.symbol}
                        sub={`~${rateToPercent(row.drawnRateRay)} APR`}
                        value={amountText(row.debt, row.decimals, 6)}
                      />
                    ))}
                  </div>
                ) : null}
                {market.skipped.length > 0 ? (
                  <p className="text-xs text-amber-300">Aave no longer lists {market.skipped.join(", ")} at the expected id, so it is hidden.</p>
                ) : null}
              </>
            ) : !loadError ? (
              <div className="space-y-2" aria-busy="true">
                <div className="h-14 animate-pulse rounded-lg bg-white/5" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 animate-pulse rounded-lg bg-white/5" />
                  <div className="h-12 animate-pulse rounded-lg bg-white/5" />
                </div>
                <p className="text-xs text-zinc-500">Reading Aave…</p>
              </div>
            ) : null}
          </Section>

          {market ? (
            <Section title="Collateral" right={<span className="text-[10px] text-white/40">wallet · supplied</span>}>
              {collateralList.map((row) => (
                <AssetRow
                  key={row.id}
                  symbol={row.symbol}
                  sub={`LTV ${(row.collateralFactorBps / 100).toFixed(0)}%${row.supplied > 0n ? (row.enabledAsCollateral ? " · collateral on" : " · collateral off") : ""}`}
                  value={(
                    <>
                      <span className="block">{amountText(row.walletBalance, row.decimals, 4)} · {amountText(row.supplied, row.decimals, 4)}</span>
                      <span className="block text-[10px] text-white/40">≈ {usd(usdOf(row.supplied, row.price, row.decimals, priceDecimals))}</span>
                    </>
                  )}
                  onClick={() => {
                    setAction(action === "withdraw" ? "withdraw" : "supply");
                    setAssetKey(String(row.id));
                    setAmount("");
                    setMaxMode(false);
                  }}
                />
              ))}
            </Section>
          ) : null}

          {market ? (
            <Section title="Borrow markets" right={<span className="text-[10px] text-white/40">rate · room</span>}>
              {borrowList.map((row) => (
                <AssetRow
                  key={row.id}
                  symbol={row.symbol}
                  value={`~${rateToPercent(row.drawnRateRay)} APR · ${roomText(row)}`}
                  onClick={() => {
                    setAction("borrow");
                    setAssetKey(String(row.id));
                    setAmount("");
                    setMaxMode(false);
                  }}
                />
              ))}
            </Section>
          ) : null}

          <Section title="Action">
            <div className="flex flex-wrap gap-2">
              {(["supply", "borrow", "repay", "withdraw"] as Action[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={action === id ? chipOn : chip}
                  onClick={() => pickAction(id)}
                >
                  {id === "supply" ? "Supply" : id === "borrow" ? "Borrow" : id === "repay" ? "Repay" : "Withdraw"}
                </button>
              ))}
            </div>
            {choices.length > 0 ? (
              <div className="grid grid-cols-2 gap-2" role="listbox" aria-label="Asset">
                {choices.map((choice) => (
                  <button
                    key={choice.key}
                    type="button"
                    role="option"
                    aria-selected={choice.key === activeKey}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${
                      choice.key === activeKey ? "border-primary bg-primary/10" : "border-white/10 bg-black/20"
                    }`}
                    onClick={() => { setAssetKey(choice.key); setAmount(""); setMaxMode(false); }}
                  >
                    <TokenMark symbol={choice.symbol} size={22} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight text-white">{choice.symbol}</span>
                      <span className="block truncate text-[10px] leading-tight text-white/40">{choice.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/60">
                {!market ? "Loading assets…" : action === "repay" ? "You have no debt on this Spoke." : "Nothing available yet."}
              </p>
            )}
            <div className="flex items-center gap-2">
              {symbolShown ? <TokenMark symbol={symbolShown} size={24} /> : null}
              <input
                className={field}
                value={amount}
                onChange={(event) => { setAmount(event.target.value.replace(/[^0-9.]/g, "")); setMaxMode(false); }}
                placeholder={amountPlaceholder}
                inputMode="decimal"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="button" className={chip} onClick={onMax} disabled={!selected || !market}>Max</button>
            </div>
            <p className="text-xs leading-relaxed text-white/50">{room()}</p>
            {(action === "borrow" || action === "withdraw") && isWeth ? (
              <label className="flex items-center gap-2 text-xs text-white/70">
                <input type="checkbox" checked={unwrap} onChange={(event) => setUnwrap(event.target.checked)} />
                Unwrap to ETH after {action === "borrow" ? "borrowing" : "withdrawing"} (one extra transaction)
              </label>
            ) : null}
            {projected && action !== "supply" ? (
              <p className="text-xs text-white/70">
                Health factor after:{" "}
                <span className={`font-mono font-semibold ${healthColor(projected.wad)}`}>{projected.text}</span>
                {(action === "borrow" || action === "withdraw")
                  && projected.wad != null
                  && (healthToNumber(projected.wad) ?? Infinity) < MIN_SAFE_HEALTH_FACTOR ? (
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
              disabled={ctaDisabled}
              onClick={() => void review()}
            >
              {ctaLabel}
            </button>
          </Section>
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
