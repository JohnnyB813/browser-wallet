import { isDefiNode } from "./nodes";
import type { WalletNode } from "../config/network";

/**
 * The endpoint a node family serves its version on.
 *
 * The payload is the same either way: five flat fields. Only the path
 * differs, and the family is on the node record, so nothing is guessed
 * from the address.
 */
export function nodeVersionPath(node: WalletNode): string {
  return isDefiNode(node) ? "version" : "tools/version";
}

/**
 * How a node's version is written on the card.
 *
 * The node reports a version and a commit. The commit is the hash the node
 * was built from, but only when it was built from a checkout: a release
 * build has no git information, so the field holds the version string
 * instead. Showing that would read `v0.8.20 (0.8.20)`, which says the
 * same thing twice.
 *
 * So the hash is shown only when it says something the version does not.
 */
export function formatNodeVersion(
  version: string | null | undefined,
  commit: string | null | undefined,
): string {
  const dotted = String(version ?? "").trim();
  if (!dotted) return "";
  const hash = String(commit ?? "").trim();
  if (!hash || hash === dotted) return `v${dotted}`;
  return `v${dotted} (${hash})`;
}
