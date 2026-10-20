/** Mainnet or Testnet for the network currently on screen. */
export default function NetworkBadge({ mainnet }: { mainnet: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
        mainnet
          ? "border-[#FDB913]/75 bg-[#FDB913]/14 text-[#FDB913]"
          : "border-zinc-400/75 bg-zinc-700/65 text-zinc-200"
      }`}
    >
      {mainnet ? "Mainnet" : "Testnet"}
    </span>
  );
}
