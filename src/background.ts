import browser from 'webextension-polyfill';
import {
  CHAIN_ID,
  ERRORS,
} from './provider/messages';
import type { Runtime } from 'webextension-polyfill/namespaces/runtime';

interface PendingRequest {
  requestId?: number;
  action: string;
  origin: string;
  tabId?: number;
  to?: string;
  amount?: string;
  from?: string;
  resolve: (data: { txHash?: string; accounts?: string[] }) => void;
  reject: (error: { code: number; message: string }) => void;
}

interface ApprovalData {
  approved: boolean;
  txHash?: string;
  error?: string;
  accounts?: string[];
}

interface ContentMessage {
  id?: number;
  action: string;
  payload?: Record<string, unknown>;
}

/** Runtime narrowing for messages arriving from the content-script trust boundary. */
function isContentMessage(value: unknown): value is ContentMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { action?: unknown }).action === "string"
  );
}

class WarthogBackground {
  private connections: Map<string, { accounts: string[]; chainId: string }> = new Map();
  private pendingRequest: PendingRequest | null = null;
  private approvalWindowId: number | null = null;

  constructor() {
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    browser.runtime.onMessage.addListener((
      message: unknown,
      sender: Runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ): true => {
      const tabId = sender.tab?.id;
      const url = sender.url || '';
      const origin = this.extractOrigin(url);

      // `message` arrives as `unknown`: the listener is a trust boundary, since
      // any content script or other extension page can post to it. Narrow it
      // before reading fields rather than casting.
      if (!isContentMessage(message)) {
        sendResponse({ success: false, error: 'Malformed message' });
        return true;
      }

      // Handle approval result from popup
      if (message.action === 'approvalResult') {
        this.handleApprovalResult(message.payload as unknown as ApprovalData);
        return true;
      }

      // Handle requests from content script
      if (message.action) {
        this.handleMessage(message, origin, tabId);
      }

      sendResponse({ success: true });
      return true;
    });
  }

  private extractOrigin(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch {
      return 'unknown';
    }
  }

  private handleMessage(message: ContentMessage, origin: string, tabId?: number): void {
    const { action, payload, id } = message;

    switch (action) {
      case 'requestAccounts':
        this.handleRequestAccounts(origin, tabId, id);
        break;

      case 'sendTransaction':
      case 'transferWart':
        this.handleSendTransaction(payload as { to: string; amount: string }, origin, tabId, id);
        break;

      case 'getAccounts':
        this.handleGetAccounts(origin, tabId, id);
        break;

      case 'getChainId':
        this.handleGetChainId(tabId, id);
        break;

      case 'disconnect':
        this.handleDisconnect(origin, tabId, id);
        break;

      case 'getConnectionState':
        this.handleGetConnectionState(origin, tabId, id);
        break;

      default:
        break;
    }
  }

  private async handleRequestAccounts(origin: string, tabId?: number, requestId?: number): Promise<void> {
    try {
      const result = await this.requestApproval({
        requestId,
        action: 'requestAccounts',
        origin,
        tabId,
      });

      if (result.accounts && result.accounts.length > 0) {
        this.connections.set(origin, {
          accounts: result.accounts,
          chainId: CHAIN_ID,
        });
        this.sendToTab(tabId, 'accountsChanged', result.accounts);
        this.sendResponse(tabId, requestId, { success: true, data: { accounts: result.accounts } });
      }
    } catch (error) {
      console.error('Request accounts error:', error);
    }
  }

  private async handleSendTransaction(
    payload: { to: string; amount: string },
    origin: string,
    tabId?: number,
    requestId?: number
  ): Promise<void> {
    const connection = this.connections.get(origin);
    if (!connection || connection.accounts.length === 0) {
      this.sendResponse(tabId, requestId, { success: false, error: ERRORS.UNAUTHORIZED });
      return;
    }

    try {
      const result = await this.requestApproval({
        requestId,
        action: 'sendTransaction',
        origin,
        tabId,
        to: payload.to,
        amount: payload.amount,
        from: connection.accounts[0],
      });

      if (result.txHash) {
        this.sendResponse(tabId, requestId, { success: true, data: { txHash: result.txHash } });
      } else {
        this.sendResponse(tabId, requestId, { success: false, error: ERRORS.USER_REJECTED });
      }
    } catch {
      this.sendResponse(tabId, requestId, { success: false, error: ERRORS.USER_REJECTED });
    }
  }

  private handleGetAccounts(origin: string, tabId?: number, requestId?: number): void {
    const connection = this.connections.get(origin);
    const accounts = connection?.accounts || [];
    this.sendResponse(tabId, requestId, { success: true, data: { accounts } });
  }

  private handleGetChainId(tabId?: number, requestId?: number): void {
    this.sendResponse(tabId, requestId, { success: true, data: { chainId: CHAIN_ID } });
  }

  private handleDisconnect(origin: string, tabId?: number, requestId?: number): void {
    this.connections.delete(origin);
    this.sendResponse(tabId, requestId, { success: true, data: {} });
  }

  private handleGetConnectionState(origin: string, tabId?: number, requestId?: number): void {
    const connection = this.connections.get(origin);
    const accounts = connection?.accounts || [];
    this.sendResponse(tabId, requestId, { success: true, data: { accounts, connected: accounts.length > 0 } });
  }

  private handleApprovalResult(payload: ApprovalData): void {
    if (!this.pendingRequest) return;

    const { approved, txHash, accounts } = payload;

    if (this.pendingRequest.resolve) {
      if (approved) {
        if (this.pendingRequest.action === 'requestAccounts' && accounts) {
          this.pendingRequest.resolve({ accounts });
        } else if (txHash) {
          this.pendingRequest.resolve({ txHash });
        } else {
          this.pendingRequest.resolve({ accounts: [] });
        }
      } else {
        this.pendingRequest.reject(ERRORS.USER_REJECTED);
      }
    }

    this.pendingRequest = null;
    if (this.approvalWindowId) {
      browser.windows.remove(this.approvalWindowId).catch(() => {});
      this.approvalWindowId = null;
    }
  }

  private requestApproval(data: {
    requestId?: number;
    action: string;
    origin: string;
    tabId?: number;
    to?: string;
    amount?: string;
    from?: string;
  }): Promise<{ txHash?: string; accounts?: string[] }> {
    return new Promise((resolve, reject) => {
      this.pendingRequest = {
        ...data,
        resolve,
        reject,
      };

      const params = new URLSearchParams({
        approval: 'true',
        action: data.action,
        origin: data.origin,
        ...(data.to && { to: data.to }),
        ...(data.amount && { amount: data.amount }),
        ...(data.from && { from: data.from }),
      });

      const popupUrl = `index.html?${params.toString()}`;
      const width = 400;
      const height = 600;

      browser.windows
        .create({
          url: popupUrl,
          type: 'popup',
          width,
          height,
          top: Math.floor((window.screen.availHeight - height) / 2),
          left: Math.floor((window.screen.availWidth - width) / 2),
        })
        .then((win) => {
          this.approvalWindowId = win?.id || null;
        })
        .catch((error) => {
          console.error('Failed to open approval window:', error);
          reject(ERRORS.INTERNAL_ERROR);
        });
    });
  }

  private sendToTab(tabId: number | undefined, action: string, data: unknown): void {
    if (tabId === undefined) return;
    browser.tabs
      .sendMessage(tabId, { type: 'WARTHOG_PROVIDER_EVENT', action, data })
      .catch(() => {});
  }

  private sendResponse(
    tabId: number | undefined,
    requestId: number | undefined,
    response: { success: boolean; data?: unknown; error?: { code: number; message: string } }
  ): void {
    if (tabId === undefined) return;
    browser.tabs
      .sendMessage(tabId, { type: 'WARTHOG_PROVIDER_RESPONSE', requestId, success: response.success, data: response.data, error: response.error })
      .catch(() => {});
  }
}

new WarthogBackground();
