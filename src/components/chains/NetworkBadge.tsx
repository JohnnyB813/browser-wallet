/** Mainnet or Testnet for the network currently on screen. */
export default function NetworkBadge({ mainnet }: { mainnet: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        mainnet ? "bg-primary/20 text-primary" : "bg-sky-400/15 text-sky-200"
      }`}
    >
      {mainnet ? "Mainnet" : "Testnet"}
    </span>
  );
}
