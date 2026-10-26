/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENCRYPTION_KEY: string;
  readonly VITE_APP_EXPLORER_URL?: string;
  readonly VITE_APP_COINGECKO_API_URL?: string;
  readonly VITE_WARTHOG_INDEXER_URL?: string;
}
