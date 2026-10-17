import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import type { HistoryActivity } from "../components/TransactionHistoryPanel";

function isActivity(value: unknown): value is HistoryActivity {
  if (!value || typeof value !== "object") return false;
  const row = value as HistoryActivity;
  return typeof row.action === "string" || typeof row.amount === "string";
}

function ActivityDetailPage() {
  const location = useLocation();
  const item = isActivity(location.state) ? location.state : null;

  if (!item) {
    return (
      <div className="container min-h-screen">
        <Header title="Activity" />
        <p className="text-white/50 text-sm mt-4">Open a transaction from History.</p>
      </div>
    );
  }

  const rows: Array<[string, string]> = [
    ["When", item.date],
    ["Action", item.action],
    ["Amount", item.amount],
    item.usdAmount ? ["Value", item.usdAmount] : null,
    item.description ? ["Detail", item.description] : null,
    item.assetName ? ["Asset", item.assetName] : null,
    item.fee ? ["Fee", item.fee] : null,
    item.fromAddress ? ["From", item.fromAddress] : null,
    item.toAddress ? ["To", item.toAddress] : null,
    item.height != null ? ["Block", String(item.height)] : null,
    item.confirmations != null ? ["Confirmations", String(item.confirmations)] : null,
    item.txHash ? ["Transaction", item.txHash] : null,
  ].filter((row): row is [string, string] => Boolean(row?.[1]));

  return (
    <div className="container min-h-screen">
      <Header title={item.action || "Activity"} />
      <div className="mt-2 flex flex-col gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <span className="text-white/45 text-xs shrink-0">{label}</span>
            <span className="text-white text-xs text-right break-all">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityDetailPage;
