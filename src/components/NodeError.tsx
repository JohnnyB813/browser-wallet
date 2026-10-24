import { useNavigate } from "react-router-dom";
import { isNodeFailure } from "../utils/nodeError";

/**
 * An error from the node, with a way out of it.
 *
 * When the failure is the node's fault the message carries a link to the
 * node picker, because picking a different node is the fix. When it is
 * not, the message stands alone: an invalid fee is not fixed by changing
 * nodes.
 */
export default function NodeError({
  message,
  to = "/select-node",
  linkLabel = "Change node",
  className = "text-xs text-red-300",
}: {
  message: string | null | undefined;
  /** The page the link goes to. */
  to?: string;
  linkLabel?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  if (!message) return null;

  return (
    <div className={className}>
      <p>{message}</p>
      {isNodeFailure(message) ? (
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
