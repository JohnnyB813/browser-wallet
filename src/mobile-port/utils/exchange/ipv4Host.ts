import browser from 'webextension-polyfill';
import { ExchangeError, explainBody } from './http';

const HOST = 'com.warthog.safetrade';

type HostResponse = {
  status?: number;
  body?: string;
  error?: string;
};

/**
 * Signed SafeTrade calls cannot use the browser stack. It prefers IPv6 for
 * safe.trade, and SafeTrade cannot store an IPv6 allowlist entry. The native
 * host repeats the call with curl -4.
 */
export async function requestSafeTradeIpv4(
  pathAndQuery: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
): Promise<unknown> {
  const splitAt = pathAndQuery.indexOf('?');
  const path = splitAt === -1 ? pathAndQuery : pathAndQuery.slice(0, splitAt);
  const search = splitAt === -1 ? '' : pathAndQuery.slice(splitAt);
  let response: HostResponse | undefined;
  try {
    response = await browser.runtime.sendNativeMessage(HOST, {
      method,
      path,
      search,
      headers,
      body: body ?? null,
    }) as HostResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'The SafeTrade IPv4 forwarder failed.';
    throw new ExchangeError(message, 0, null);
  }
  if (!response || typeof response !== 'object') {
    throw new ExchangeError('The SafeTrade IPv4 forwarder failed.', 0, null);
  }
  if (response.error) {
    throw new ExchangeError(response.error, 0, null);
  }
  const status = Number(response.status ?? 0);
  const text = typeof response.body === 'string' ? response.body : '';
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (status < 200 || status >= 300) {
    throw new ExchangeError(explainBody(parsed, status), status || 0, parsed);
  }
  return parsed;
}
