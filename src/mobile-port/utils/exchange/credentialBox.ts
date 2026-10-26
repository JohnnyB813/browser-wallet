/**
 * AES-GCM box for third-party API secrets.
 *
 * The key is a non-extractable CryptoKey in IndexedDB. The ciphertext in
 * localStorage is not the secret, and the key cannot be exported by script.
 */

const DB_NAME = "warthog-credential-box";
const STORE = "keys";
const KEY_ID = "exchange";

export type SecretSeal = { v: 1; iv: string; ct: string };

export function isSecretSeal(value: unknown): value is SecretSeal {
  if (!value || typeof value !== "object") return false;
  const seal = value as Partial<SecretSeal>;
  return seal.v === 1 && typeof seal.iv === "string" && typeof seal.ct === "string";
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin);
}

function b64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the credential store"));
  });
}

function idbGet(db: IDBDatabase): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY_ID);
    request.onsuccess = () => resolve(request.result as CryptoKey | undefined);
    request.onerror = () => reject(request.error ?? new Error("Could not read the credential key"));
  });
}

function idbPut(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(key, KEY_ID);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not store the credential key"));
  });
}

async function boxKey(): Promise<CryptoKey> {
  const db = await openDb();
  try {
    const existing = await idbGet(db);
    if (existing) return existing;
    const created = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    await idbPut(db, created);
    return created;
  } finally {
    db.close();
  }
}

export async function sealSecret(plain: string): Promise<SecretSeal> {
  const key = await boxKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  return { v: 1, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ciphertext)) };
}

export async function openSecret(seal: SecretSeal): Promise<string> {
  const key = await boxKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(seal.iv) },
    key,
    b64ToBytes(seal.ct),
  );
  return new TextDecoder().decode(plain);
}
