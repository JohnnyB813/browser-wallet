/**
 * The browser the wallet runs in, for the copy that names it. Firefox is the
 * only browser here that is not a Chromium one.
 */
export function isFirefoxBrowser(): boolean {
  try {
    return navigator.userAgent.includes("Firefox");
  } catch {
    return false;
  }
}

/**
 * The name of the browser, for the copy that names it. The fallback is what
 * the Chromium builds say today.
 */
export function hostBrowserName(fallback = "Brave"): string {
  return isFirefoxBrowser() ? "Firefox" : fallback;
}
