import { useNavigate } from "react-router-dom";
import { isNodeFailure } from "../utils/nodeError";

/**
 * An error from the node, with a way out of it.
 *
 * When the failure is the node's fault the message carries a link to the
 * node picker, because picking a different node is the fix. When it is
 * not, the message stands alone: an invalid fee is not fixed by changing
 * nodes.
 *
 * A link can also be forced, for the messages that are about the node
 * rather than about a failed request.
 */
export default function NodeError({
  message,
  to = "/select-node",
  linkLabel = "Change node",
  alwaysLink = false,
  className = "text-xs text-red-300",
}: {
  message: string | null | undefined;
  /** The page the link goes to. */
  to?: string;
  linkLabel?: string;
  /** Show the link whatever the message is. */
  alwaysLink?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  if (!message) return null;

  return (
    <div className={className}>
      <p>{message}</p>
      {alwaysLink || isNodeFailure(message) ? (
        <button
          type="button"
          className="mt-0.5 underline"
          onClick={() => navigate(to)}
        >
          {linkLabel}
        </button>
      ) : null}
    </div>
  );
}
