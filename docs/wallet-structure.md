# Wallet navigation and account model

The authenticated shell lives in `src/components/WalletLayout.tsx`.

- `AppHeader.tsx`: select an account, then a network. The address is derived,
  not selected separately. Copy and Receive always use that network's address.
- Wallet: holdings, tracked assets, Send and Receive.
- Trade: native swaps, liquidity and asset creation, plus supported integrations.
- Activity: network-specific history, pending Warthog transactions and open orders.
- Settings: account names, encrypted backups, authentication, nodes, display,
  hardware-wallet preferences, auto-lock and connected sites.

`src/config/walletNetworks.ts` defines supported networks and capabilities.
Both navigation and route guards use this registry. Switching account or network
returns to Wallet and unmounts the previous form so a transaction review cannot
silently become a review for another account.

## Derivation

Account index `i` selects one address per network:

| Network | Path |
| --- | --- |
| Warthog Mainnet and DeFi Testnet | Existing Warthog path type, index `i` |
| Ethereum and Hemi | `m/44'/60'/0'/0/i` |
| Bitcoin | `m/84'/0'/0'/0/i` |
| Solana | `m/44'/501'/i'/0'` |

Account 0 keeps its existing addresses. Other-chain addresses for accounts 1+
are different from older extension versions, which always displayed index 0.
Funds previously sent to that shared address remain accessible through account 0.
Ethereum and Hemi share a key; the two Warthog networks also share a key.
Private-key imports and Warthog Ledger sessions offer only Warthog networks.

The software account switch first unlocks the signing worker with the selected
key, then changes the visible account. Other-chain signers use the same account
index through `mobile-port/utils/sessionVault.ts`. Only `ChainSessionSync` owns
that shared session; unmounting a holdings screen must not clear it.

Public account preferences are stored by the seed's first Warthog address.
Unlock validates every restored address against the seed before using the list.
Legacy comma-separated names are read, but new names use JSON. Network and node
choices survive unlock. New encrypted backups include the Warthog path type.

## Verification

```sh
bun test tests
npm run lint
npm run build
npm run build:firefox
```

Browser checks should use a disposable wallet, never a funded seed: add an
account with a comma in its name, compare addresses across networks, lock and
unlock, check saved nodes, and review each transaction flow before any broadcast.
Hardware signing and WebAuthn require separate device/browser checks.
