/**
 * The pending update of the card.
 *
 * The card shows what a node says about the balance. That read takes time,
 * and the card says so while it runs. An update belongs to the node it was
 * started for: the node URL carries the network with it, because a node
 * belongs to one family.
 */

/**
 * Whether an update should be started for this node.
 *
 * An update that is already running for the node is not started again. The
 * node URL carries the network with it, so this one comparison covers both
 * the same network and the same node: toggling back to a node that is
 * still being read does not queue a second read of it.
 *
 * A different node starts an update, even on the same network, because the
 * running read is about the other node.
 */
export function shouldStartUpdate(
  nodeUrl: string | null | undefined,
  pendingNodeUrl: string | null | undefined,
): boolean {
  const wanted = String(nodeUrl ?? "").trim();
  if (!wanted) return false;
  const pending = String(pendingNodeUrl ?? "").trim();
  if (!pending) return true;
  return pending !== wanted;
}
