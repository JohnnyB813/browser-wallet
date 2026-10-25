/**
 * How a node's version is written on the card.
 *
 * The node reports a version and a commit. The commit is the hash the node
 * was built from, but only when the build knew it: a build without a
 * checkout reports "unknown", and an older build reports the version
 * string there instead, because the fallback it used was the version.
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
  if (!hash || hash === dotted || hash === "unknown") return `v${dotted}`;
  return `v${dotted} (${hash})`;
}
