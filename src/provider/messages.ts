export interface WarthogProviderRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface RequestAccountsResult {
  accounts: string[];
}

export interface ChainIdResult {
  chainId: string;
}

export interface SendTransactionResult {
  txHash: string;
}

export interface ErrorResult {
  code: number;
  message: string;
}

export type ProviderRequest =
  | { method: 'requestAccounts' }
  | { method: 'accounts' }
  | { method: 'chainId' }
  | { method: 'disconnect' }
  | { method: 'sendTransaction'; params: { to: string; amount: string } }
  | { method: 'transferWart'; params: { to: string; amount: string } };

export type ProviderResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: number; message: string } };

export interface ConnectionState {
  accounts: string[];
  chainId: string;
  connected: boolean;
}

export interface PendingRequest {
  action: string;
  origin: string;
  tabId?: number;
  to?: string;
  amount?: string;
  from?: string;
  resolve: (data: { txHash?: string; accounts?: string[] }) => void;
  reject: (error: { code: number; message: string }) => void;
}

export interface ApprovalData {
  approved: boolean;
  txHash?: string;
  error?: string;
  accounts?: string[];
}

export const CHAIN_ID = '0x539'; // 1337 in hex

export const ERRORS = {
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'Unauthorized - please connect first' },
  CHAIN_NOT_FOUND: { code: 4900, message: 'Chain not found' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
};
