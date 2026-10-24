/**
 * True when the failure is the node's fault, not the user's.
 *
 * A node that answers 502, or is not reachable, is a node to change. An
 * invalid fee or a bad address is not, and offering to change the node for
 * those would send the user down the wrong path.
 *
 * The match is anchored on the node's own wording. The browser's network
 * errors say "failed to fetch" as well, and those come from other hosts
 * too: SafeTrade's API, for one, where a different node is not the fix.
 */
export function isNodeFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  const text = message.trim().toLowerCase();
  // The node answered with an error status, or with a non-zero error code.
  if (/^node http \d+/.test(text)) return true;
  if (text.startsWith("node error code")) return true;
  // The node's own asset search could not reach it.
  if (text.startsWith("network error fetching assets")) return true;
  // A gateway in front of a node that is down answers with HTML.
  if (text.startsWith("node returned html instead of json")) return true;
  return false;
}
