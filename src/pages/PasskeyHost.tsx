/**
 * Passkey step that survives the toolbar popup closing.
 * Chrome destroys the dropdown when the passkey prompt opens, so Google can
 * store the credential while this extension never gets to save the wallet.
 */
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import useWallet from "../hooks/useWallet";
import { clearPasskeyWaiting, paintPasskeyWaiting } from "../utils/passkeyUi";

function PasskeyHost() {
  const { resumePasskeyHandoff, finishPasskeyInToolbar } = useWallet();
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const confirm = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    try {
      await paintPasskeyWaiting(setWaiting);
      await resumePasskeyHandoff();
      const returned = await finishPasskeyInToolbar();
      if (returned) {
        window.close();
        return;
      }
      navigate("/home", { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Passkey failed";
      setError(
        /cancel|not allowed|abort/i.test(msg)
          ? "Passkey cancelled. You can try again in this window, or close it and use a password."
          : msg,
      );
    } finally {
      busyRef.current = false;
      clearPasskeyWaiting(setWaiting);
    }
  };

  return (
    <div className="container min-h-screen flex flex-col py-4">
      <div className="flex justify-center items-center pt-1 pb-3">
        <img
          src="/fullLogo.png"
          alt="WARTHOG NETWORK"
          className="max-h-24 object-contain"
        />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-white/40 text-[11px] uppercase tracking-wide">
          Passkey
        </p>
        <h1 className="text-white text-xl font-semibold">Confirm passkey</h1>
        <p className="text-white/55 text-xs leading-relaxed">
          Choose Google Password Manager or this device. When the prompt
          finishes, the wallet opens again under the toolbar icon. Proton Pass
          cannot store a passkey for a browser extension.
        </p>
        {error && (
          <p className="text-red-400 text-sm" role="alert">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          className="w-full"
          disabled={waiting}
          onClick={() => void confirm()}
        >
          {waiting ? "Waiting for passkey…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

export default PasskeyHost;
