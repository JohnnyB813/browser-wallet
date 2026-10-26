/** Opaque session id. The wallet password never goes into storage. */
const OPAQUE_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newSessionToken(kind: "session" | "ledger" = "session"): string {
  const id = crypto.randomUUID();
  return kind === "ledger" ? `ledger-${id}` : id;
}

/** True for a random session id. Older tokens embedded the password. */
export function isOpaqueSessionToken(token: string): boolean {
  return OPAQUE_TOKEN.test(token);
}
