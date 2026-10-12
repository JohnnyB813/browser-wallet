// Entry point for the bundled background script.
//
// The background logic in `public/background.js` uses a bare `browser.*`
// global. Firefox provides that natively, but Chrome only has `chrome.*` —
// without the polyfill the script throws `browser is not defined` on the first
// line that touches the API and the service worker never starts.
//
// Importing `webextension-polyfill` first installs the `browser` global in
// Chrome; in Firefox it detects the native global and leaves it alone.
// esbuild bundles the result into a single IIFE, which both Chrome (as a
// classic service worker) and Firefox (as an event page) can load directly.
import 'webextension-polyfill';
import '../public/background.js';