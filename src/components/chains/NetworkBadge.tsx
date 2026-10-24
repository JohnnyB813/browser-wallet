import type { NodeNetwork } from "../../config/network";

/**
 * The network the wallet is on.
 *
 * With a handler this is a button that moves the wallet to the other
 * family. Without one it is a plain label, for the screens that only ever
 * show one network.
 */
export default function NetworkBadge({
  network,
  onSwitch,
  title,
}: {
  network: NodeNetwork;
  onSwitch?: () => void;
  title?: string;
}) {
  const mainnet = network === "mainnet";
  const className = `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
    mainnet
      ? "border-[#FDB913]/75 bg-[#FDB913]/14 text-[#FDB913]"
      : "border-zinc-400/75 bg-zinc-700/65 text-zinc-200"
  }`;

  const label = mainnet ? "Mainnet" : "Testnet";

  if (!onSwitch) {
    return <span className={className}>{label}</span>;
  }

  return (
    <button
      type="button"
      onClick={onSwitch}
      title={title ?? `Switch to ${mainnet ? "the DeFi testnet" : "mainnet"}`}
      aria-label={`${label}. Switch network`}
      className={`${className} transition-opacity cursor-pointer hover:opacity-80`}
    >
      {label}
    </button>
  );
}
