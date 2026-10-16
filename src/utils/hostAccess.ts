/**
 * Request optional host access for custom node URLs (user gesture).
 * Built-in hosts are already in manifest host_permissions.
 */
import browser from "webextension-polyfill";

function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

export async function hasHostPermission(url: string): Promise<boolean> {
  const origin = originPattern(url);
  if (!origin) return false;
  try {
    if (!browser.permissions?.contains) return true;
    return await browser.permissions.contains({ origins: [origin] });
  } catch {
    return true;
  }
}

/** Prompt for a custom origin. Must run from a user gesture. */
export async function ensureHostPermission(url: string): Promise<boolean> {
  const origin = originPattern(url);
  if (!origin) return false;
  try {
    if (!browser.permissions?.contains || !browser.permissions?.request) {
      return true;
    }
    if (await browser.permissions.contains({ origins: [origin] })) {
      return true;
    }
    return await browser.permissions.request({ origins: [origin] });
  } catch (err) {
    console.warn("[warthog] host permission request failed:", err);
    return false;
  }
}

export function hostPermissionError(url: string): string {
  return `This extension does not have permission to reach ${url}. Add the node again and allow access when Chrome asks.`;
}

/**
 * Page fetch, then the service worker if Brave blocks the tab.
 * The toolbar popup can call the node directly. A full tab often cannot:
 * an http node is mixed content there, and a Cache-Control header forces a
 * preflight the node does not answer. The worker is allowed to call the node.
 */
export async function privilegedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/failed to fetch|networkerror|load failed/i.test(message)) throw err;
    if (!browser.runtime?.sendMessage) throw err;
    const headers: Record<string, string> = {};
    new Headers(init.headers || {}).forEach((value, key) => {
      headers[key] = value;
    });
    const proxied = (await browser.runtime.sendMessage({
      action: "extensionFetch",
      url,
      method: init.method || "GET",
      headers,
      body: typeof init.body === "string" ? init.body : undefined,
    })) as { ok?: boolean; status?: number; text?: string; error?: string } | undefined;
    if (!proxied || proxied.error) {
      throw new Error(proxied?.error || message);
    }
    return new Response(proxied.text ?? "", {
      status: proxied.status ?? (proxied.ok ? 200 : 502),
    });
  }
}
