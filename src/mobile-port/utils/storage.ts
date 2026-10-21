import CryptoJS from 'crypto-js';

const SAFE_STORE_KEY = /^[A-Za-z0-9._-]+$/;

function toSecureStoreKey(key: string): string {
  const raw = String(key ?? '');
  if (SAFE_STORE_KEY.test(raw)) return raw;
  const digest = CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex).slice(0, 32);
  const stem = raw.replace(/[^A-Za-z0-9._-]+/g, '').slice(0, 24);
  return `${stem || 'key'}.${digest}`;
}

/** Same key names as the phone app, stored in this browser profile. */
export const storage = {
  async setItemAsync(key: string, value: string): Promise<void> {
    localStorage.setItem(toSecureStoreKey(key), value);
  },
  async getItemAsync(key: string): Promise<string | null> {
    return localStorage.getItem(toSecureStoreKey(key));
  },
  async deleteItemAsync(key: string): Promise<void> {
    localStorage.removeItem(toSecureStoreKey(key));
  },
};
