# Browser extension restructure: changes and bug fixes

This report covers the browser-wallet restructuring performed in this working
tree. It describes implementation changes, not a published release.

All changes are confined to `browser-wallet/`. No other hub repository was
modified. No release version was bumped, and nothing was committed or pushed.
Paths below are relative to the `browser-wallet/` repository root.

For a shorter architectural reference, see [wallet-structure.md](wallet-structure.md).

## 1. Why the extension was restructured

The previous interface mixed account management, network selection, balances,
trading and settings:

- The header displayed an account but did not let the user switch accounts.
  Clicking it opened Receive without an explicit Receive label.
- Chain selection and the Warthog mainnet/testnet switch were separate controls
  inside the balance card.
- A selected Warthog account did not change the other chains' address index.
- The gear menu mixed account settings, node selection, SafeTrade and locking.
- Several features existed in duplicate or only inside an unreachable DeFi hub.
- Settings were spread across multiple screens rather than one entry point.

The new organizing rule is:

```text
Choose account
  -> Choose network
    -> Derive that account's one address on that network
      -> Show features supported by that network
```

There is no separate address selector.

## 2. New interface structure

### Global header

The header is shared by authenticated screens:

1. Account selector, with a link to account management.
2. Lock and Settings buttons.
3. One network selector, followed by the shortened address, Copy and Receive/QR.

Selecting another account through the header switches the signing key before
updating the visible account. Selecting another account or network through the
header returns to Wallet. The main content is also keyed by account index and
network so old forms and reviews are unmounted when that context changes.

### Main navigation

| Category | Contents |
| --- | --- |
| Wallet | Balances, Send, Receive, Swap shortcut where supported, other-chain holdings, and Warthog tracked assets/search/charts on the DeFi testnet. |
| Trade | Swap, liquidity and asset creation where supported. Integrations contains Aave on Ethereum and SafeTrade on Warthog Mainnet. |
| Activity | Warthog history and pending transactions, DeFi open orders, or the selected other chain's activity. |
| Settings | Account/security, encrypted backups, private-key and recovery-phrase access, auto-lock, Warthog nodes, number formatting/colors, Ledger preferences and connected sites. |

Trade and Settings are no longer entries hidden inside unrelated menus.
Liquidity has its own category entry instead of being duplicated between a
standalone flow and a Pool tab in Swap.

### Network capabilities and route guards

`src/config/walletNetworks.ts` defines six network entries:

- Warthog Mainnet
- Warthog DeFi Testnet
- Ethereum
- Bitcoin
- Hemi
- Solana

Each entry declares supported actions. Trade menus and route guards consult that
registry. A direct link to an unsupported feature shows an explanation instead of
displaying a transaction form for a different network.

Private-key imports and Warthog Ledger sessions expose only Warthog networks.
The multi-chain addresses require a software recovery phrase.

## 3. Account addresses and migration implications

Account index `i` now controls both address display and software signing:

| Network | Derivation path |
| --- | --- |
| Warthog, hardened path type | `m/44'/2070'/0'/0/i` |
| Warthog, legacy path type | `m/44'/2070'/0/0/i` |
| Ethereum and Hemi | `m/44'/60'/0'/0/i` |
| Bitcoin | `m/84'/0'/0'/0/i` |
| Solana | `m/44'/501'/i'/0'` |

**Important compatibility change:** account 0 retains its existing addresses.
Accounts 1 and above now have distinct non-Warthog addresses. Older extension
versions displayed index 0 on those chains regardless of the Warthog account.
Funds previously sent to that shared address remain accessible through account 0.
This change does not move funds on-chain.

Ethereum and Hemi intentionally share an address/key for a given account.
Warthog Mainnet and DeFi Testnet also intentionally share an address/key.
One address per account per network does not imply different address strings on
every network.

## 4. Persistence and signing changes

- Public account preferences are stored under a key based on the first Warthog
  address of the seed/path, rather than an editable account name.
- Preferences contain the account addresses, names, visibility, selected index
  and Warthog derivation path type. They do not contain private keys or phrases.
- Unlock validates the restored address list against the unlocked seed before
  accepting it. An old global account list is migrated only if it belongs to
  that seed and path.
- New account-name lists use JSON. Legacy comma-separated lists are still read.
  This cannot reconstruct a name already split by an older version, but it
  prevents new comma-containing names from being corrupted.
- Unlock no longer replaces custom nodes, node selections and the active
  Warthog network with defaults.
- New encrypted backups include the Warthog path type. Password/passkey unlock
  and passkey handoffs propagate that path information.
- The other-chain session includes the selected account index. Address
  derivation and the ported software signers use the same index.
- `ChainSessionSync` is the sole hook owner of the shared other-chain session;
  unmounting a holdings screen does not independently clear it.
- Locking explicitly clears the shared other-chain signing session.
- Shared DeFi signing checks the expected address before building a transaction.
  The Warthog send review likewise verifies the worker's address.

## 5. Bugs fixed

| Problem | Fix |
| --- | --- |
| Per-page From dropdowns could change the displayed account without switching the signing worker's key. | Removed those selectors from the active transaction flows. Account switching uses `switchActiveAccount`; sender summaries are read-only. |
| Warthog send signing reconstructed an account from React's seed phrase using the SDK's default derivation behavior. That could fail when the phrase was unavailable or use the wrong path. | Send review obtains the active key from the signing worker and checks its address against the selected account. |
| Other-chain addresses and signers effectively stayed at account index 0. | Both public address derivation and default signer derivation follow the selected account index. |
| Unlock reset added accounts and names. | Restore and validate seed-scoped account preferences before activating the selected account. |
| Unlock reset custom nodes and network selection. | Preserve existing configuration; seed default nodes only when needed and persist the active Warthog network explicitly. |
| Account names containing commas broke the stored name list. | Write JSON lists and retain legacy read support. |
| Adding a testnet node could select it as mainnet because it was not yet present in the current React render's node list. | Pass the new node's declared network explicitly when selecting it. This was found during browser testing. |
| Choosing a token could silently switch the Warthog network. | Asset selection changes the selected asset only. Testnet asset selection is exposed on the testnet. |
| Receive always used the Warthog address, even when viewing another chain. | Receive, its QR code and Copy all use the selected account/network address. |
| Home History/Pending could remain Warthog-specific while another chain was selected. | Activity uses the selected chain's activity component; Warthog-only tabs are not shown on other chains. |
| Software dApp transaction approval had no corresponding signing branch in the active Home handler. | Added software WART signing/submission through the unlocked account helper. Approval also checks the requested sender and requires a Warthog network. |
| A zero-decimal token could be treated as an eight-decimal token during send confirmation because of a truthiness fallback. | Preserve `tmpPrecision` directly, including zero. |
| Pending rows offered cancellation indiscriminately. | Offer cancellation for limit swaps when the selected network supports orders and the session is not a Warthog Ledger session. |
| Another account could become active between a DeFi request starting and its signing step. | The shared signing helper rejects an unexpected active address. |
| The balance card's Refresh action could depend on an unrelated Warthog refresh while viewing another chain. | Other-chain refresh updates holdings independently. |
| Warthog balance polling continued unnecessarily while viewing other-chain screens. | Restrict that polling to the Warthog Wallet view. Balance polling is 15 seconds; price polling is 60 seconds. |
| Testnet WART could be shown with a mainnet USD valuation. | Show the native WART USD estimate only on mainnet. |
| Trade's overview initially highlighted Wallet during the restructure. | Include the `/trade` overview itself in the Trade navigation-category match. |
| Defining route sets as new component functions inside App could remount their contents on App rerenders. | Render route element trees directly rather than using those nested component definitions. |

The table includes both pre-existing defects and integration issues caught and
corrected while implementing the restructure. It is not a full security audit.

## 6. New or consolidated functionality

### Wallet and trading

- Added an explicit Receive action.
- Moved useful tracked-asset functionality out of the removed DeFi hub into a
  Wallet component: search/browse, track/untrack, balances, charts, Send and Trade.
- Reused the existing Market/Limit/Pool engine instead of keeping multiple
  liquidity implementations. Swap presents Market/Limit; Liquidity uses pool
  mode and lists positions for tracked assets.
- Added an Activity open-orders component. Its cancellation action and pending
  limit-swap cancellation lead to the same review screen.
- Consolidated asset creation into one form with a confirmation step.
- Retained other-chain sending, swaps/bridges, Aave and SafeTrade implementations;
  their navigation placement changed.

### Settings and security controls

- Replaced the account-details page's automatic/debounced rename with an explicit
  Save name action.
- Grouped named-wallet saving, encrypted-file backup and passkey/2FA registration
  in Account and security.
- Added recovery-phrase reveal alongside explicitly labeled Warthog private-key
  reveal. These use the existing unlocked-worker export mechanism.
- Added auto-lock choices of 1, 5, 15, 30 or 60 minutes.
- Made existing number-formatting and color controls reachable in Settings.
- Added a connected-sites list and Disconnect action.

### Connected-site implementation detail

The running background entry imports `public/background.js`.
`src/background.ts` is not the background implementation used by this build and
was not modified for this feature.

The new background messages list grants and revoke a selected origin. They wait
for existing connection restoration, restrict administration to extension-page
sender URLs, persist revocation and notify matching tabs with an empty account
list. Revocation also rejects a pending request for that origin when present.

## 7. File-by-file inventory

### Added files

| File | Purpose |
| --- | --- |
| `src/components/AppHeader.tsx` | Shared account/network controls, address copy, Receive, Lock and Settings. |
| `src/components/WalletLayout.tsx` | Authenticated layout, bottom navigation, route guards and account/network content boundary. |
| `src/components/SenderSummary.tsx` | Read-only sender display in transaction/approval reviews. |
| `src/components/WatchedAssets.tsx` | Wallet asset search, tracking, balances, charts and shortcuts. |
| `src/components/OpenOrders.tsx` | Open-order display and entry into cancellation review. |
| `src/config/walletNetworks.ts` | Network IDs, labels, chains and capability registry. |
| `src/pages/Trade.tsx` | Trade overview and network-specific integrations. |
| `src/pages/Settings.tsx` | Consolidated settings entry point and controls. |
| `src/pages/CreateAsset.tsx` | Consolidated asset-creation form and confirmation. |
| `src/styles/wallet-layout.css` | Shared header, content, navigation, action and menu styling. |
| `src/utils/accountPreferences.ts` | Public preference type, root-address storage key and legacy/JSON name-list parsing. |
| `src/utils/watchedAssets.ts` | Shared tracked-asset storage helpers. |
| `tests/account-networks.test.ts` | Derivation, signer-index, session-clear, capability and preference regression tests. |
| `tests/connected-sites.test.ts` | Tests against the actual background script for listing, revoking and denying website administration. |
| `docs/wallet-structure.md` | Short architectural reference and verification commands. |
| `docs/extension-restructure-report.md` | This detailed report. |

### Modified files

| File | Main changes |
| --- | --- |
| `public/background.js` | Connected-site administration and revocation behavior. |
| `src/App.tsx` | New layout/routes, redirects for replaced flows, fallback routing and single chain-session sync owner. |
| `src/chains/useChainAccounts.ts` | Account-index derivation, network registry adapter, selected-network address and optional session synchronization. |
| `src/components/PendingTxRow.tsx` | Optional cancellation action, limited to limit swaps. |
| `src/components/SwapDexPanel.tsx` | Separate pool-only presentation from Market/Limit tabs. |
| `src/components/chains/ChainHoldings.tsx` | Removed duplicate inline address, Send, Activity and Tunnel controls; retained holdings and token management. |
| `src/context/WalletContext.tsx` | Preference restoration/migration, persistence, selected signer/session index, network persistence, node-selection fix and path propagation. Removed the unused synchronous account-reconstruction helper. |
| `src/main.tsx` | Loads the new layout stylesheet. |
| `src/mobile-port/utils/evmAddress.ts` | Account-index-aware Ethereum/Hemi key and address derivation with index validation. |
| `src/mobile-port/utils/networks/derive.ts` | Account-index-aware Bitcoin/Solana key and address derivation with index validation. |
| `src/mobile-port/utils/sessionVault.ts` | Keeps the selected software account index with the in-memory chain session. |
| `src/pages/AccountDetails.tsx` | Focused rename, encrypted-backup and authentication screen; removed duplicate QR and Ledger settings. |
| `src/pages/CancelOrderStep2.tsx` | Shared cancellation review for an order hash or pending order's pin-height/nonce target. |
| `src/pages/Home.tsx` | Wallet/Activity views, relocated assets/orders, contextual actions, approval fixes and scoped polling. |
| `src/pages/ManageAccounts.tsx` | Safe switching, busy/error handling and clearer Add account wording. |
| `src/pages/ReceivePage.tsx` | Network-specific address, QR and copy behavior. |
| `src/pages/SecureSetup.tsx` | Keeps the initial account name synchronized and includes path type in encrypted downloads. |
| `src/pages/SelectNode.tsx` | Selects new nodes with their declared network. |
| `src/pages/SendPage.tsx` | Consolidated Warthog transfer form, no local account selector, asset prefill, validation and other-chain dispatch. |
| `src/pages/Sendstep2.tsx` | Read-only sender, worker-key/address verification, zero-decimal handling and removal of seed-prefix debug logging. |
| `src/pages/ShowPrivateKey.tsx` | Recovery-phrase mode, explicit Warthog-key labeling, responsive secret display and Settings return path. |
| `src/pages/SwapPage.tsx` | Shared Swap/Liquidity host, tracked-asset positions and legacy Pool URL redirect. |
| `src/utils.ts` | Transaction submission accepts both legacy and DeFi transaction JSON types. |
| `src/utils/defiClient.ts` | Expected-address signing guard and a shared cancellation-target submission helper. |
| `src/utils/passkeyHandoff.ts` | Path type can travel through toolbar unlock handoff. |
| `src/utils/signingBridge.ts` | Configurable auto-lock and optional expected-address verification. |
| `src/utils/warthogWalletCrypto.ts` | Optional path type in encrypted wallet payloads and serialization. |
| `tsconfig.app.json` | Restricts application compilation to `src`; Bun tests run separately. |

### Removed files

These were replaced, duplicated or not connected to the active interface.
Removing them does not mean the corresponding current capability was removed.

| Group | Files |
| --- | --- |
| Old DeFi hub and duplicate transaction flows | `src/pages/DefiHub.tsx`, `TradePage.tsx`, `TradeStep2.tsx`, `LiquidityPage.tsx`, `LiquidityStep2.tsx`, `CreateTokenPage.tsx`, `CreateTokenStep2.tsx`, `CancelOrderPage.tsx`. All names after the first are also under `src/pages/`. |
| Unused approval screen | `src/pages/ApprovalPage.tsx`. The active approval handling remains in Home. |
| Old onboarding/import screens | `src/pages/intro.tsx`, `RecoveryPhase.tsx`, `validate.tsx`, `validateIntro.tsx`, `SetPassword.tsx`, `importPage.tsx`, `ImportPrivateKey.tsx`. All names after the first are also under `src/pages/`. The active first-run flow remains `startedPage.tsx` and `SecureSetup.tsx`. |
| Superseded header/selectors | `src/components/ProfileHeader.tsx`, `src/components/UserDropdown.tsx`, `src/components/chains/ChainPicker.tsx`. |
| Unused UI components | `src/components/ActionButtons.tsx`, `Balance.tsx`, `HistoryTxRow.tsx`, `NetworkDropdown.tsx`, `TokenItem.tsx`, `WalletInfo.tsx`. All names after the first are also under `src/components/`. |

Old DeFi/trade/liquidity/create/cancel route entry points that were explicitly
replaced have redirects in `App.tsx`. Old onboarding pages are no longer separate
flows; unknown unauthenticated routes fall back to the saved-wallet login screen.

## 8. Verification performed

### Automated regression tests

`bun test tests`: **11 tests passed, 0 failed**.

Coverage includes:

- Account-0 compatibility with the original chain paths.
- Distinct addresses for multiple software accounts.
- Default signing derivation following the selected account index.
- Clearing the shared phrase/index on lock-session cleanup.
- Rejection of invalid chain derivation indexes.
- Network capability declarations.
- JSON names containing commas and legacy-list parsing.
- Preference-key separation by root address/path.
- Connected-site listing, durable revocation/tab notification and rejection of
  administration messages from website content-script sender URLs.

### Build and lint

- `npm run build`: passed for Chromium.
- `npm run build:firefox`: passed for Firefox.
- `npm run lint`: no errors; six existing warnings remain.
- `git diff --check`: passed.

Builds still report bundle-size and mixed static/dynamic import warnings. This
work did not attempt a bundle-splitting or repository-wide lint cleanup.

### Chromium extension smoke checks

Loaded the built extension in a disposable browser profile with a public test
seed and mocked HTTP responses. No real transaction was broadcast.

Checks included:

- Six networks available for a software seed wallet.
- Account creation with a comma-containing name.
- Different Ethereum addresses for accounts 0 and 1, with stable addresses when
  switching back.
- Receive displaying the full address of the selected network.
- Network-specific Trade entries and Activity tabs.
- Settings rendering and connected-sites empty state.
- Adding a custom testnet node.
- Lock, full page reload and password unlock, preserving accounts, names,
  selected network and the custom node.
- Opening Warthog send review with only the global account/network selectors.
- Switching account from that review returning to Wallet.
- A direct Aave route being blocked on Warthog Mainnet.

The smoke-check script and screenshots were temporary tooling under
`/tmp/opencode/wallet-ui-check/`, not a checked-in Playwright test suite.

## 9. Limits and remaining manual checks

- Ledger device connection/signing and WebAuthn/passkey/2FA browser prompts were
  not exercised with actual hardware/authenticators.
- Live sends, swaps, liquidity changes, asset creation, order cancellation,
  bridges, Aave and SafeTrade operations were not broadcast or executed.
- Firefox was built successfully, but its interactive UI was not smoke-tested.
- Liquidity-position discovery is limited to tracked assets, as explained by
  the screen. It is not a universal scan of every possible pool.
- The removed hub was not copied feature-for-feature. For example, its
  drag-to-reorder tracked-asset controls and raw asset-lookup presentation were
  not recreated. Useful wallet/trading capabilities were moved into focused
  screens instead.
- Network capability checks are navigation/context guards, not proof that a
  particular RPC endpoint is healthy or an external integration is available.
- Account names, account visibility and custom nodes remain local preferences;
  they are not included as a complete settings backup in the encrypted wallet
  file.
- Changes remain uncommitted and unpublished. Reload the relevant unpacked build
  to review them before deciding on a release.
