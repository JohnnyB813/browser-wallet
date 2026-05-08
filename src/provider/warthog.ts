import { CHAIN_ID, ERRORS } from './messages';

type EventHandler = (...args: unknown[]) => void;
type Unsubscribe = () => void;

class WarthogProvider {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private connectionState = {
    accounts: [] as string[],
    chainId: CHAIN_ID,
    connected: false,
  };

  constructor() {
    window.warthog = this;
    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (event.data.type !== 'WARTHOG_PROVIDER_MESSAGE') return;

      const { action, data } = event.data;
      this.handleResponse(action, data);
    });
  }

  private handleResponse(action: string, data: unknown): void {
    switch (action) {
      case 'accountsChanged':
        this.connectionState.accounts = data as string[];
        this.emit('accountsChanged', data);
        break;
      case 'chainChanged':
        this.connectionState.chainId = data as string;
        this.emit('chainChanged', data);
        break;
    }
  }

  private sendMessage(action: string, payload?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(ERRORS.INTERNAL_ERROR);
      }, 30000);

      const responseHandler = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data.type !== 'WARTHOG_PROVIDER_RESPONSE') return;
        if (event.data.action !== action) return;

        clearTimeout(timeout);
        window.removeEventListener('message', responseHandler);

        const response = event.data;
        if (response.success) {
          resolve(response.data);
        } else {
          reject(response.error);
        }
      };

      window.addEventListener('message', responseHandler);

      window.postMessage(
        {
          type: 'WARTHOG_PROVIDER_MESSAGE',
          action,
          payload,
        },
        '*'
      );

      setTimeout(() => {
        window.removeEventListener('message', responseHandler);
      }, 30000);
    });
  }

  async request(args: { method: string; params?: Record<string, unknown> }): Promise<unknown> {
    const { method, params } = args;

    switch (method) {
      case 'requestAccounts':
        return this.requestAccounts();
      case 'accounts':
        return this.getAccounts();
      case 'chainId':
        return this.getChainId();
      case 'disconnect':
        return this.disconnect();
      case 'sendTransaction':
      case 'transferWart':
        return this.sendTransaction(params as { to: string; amount: string });
      default:
        throw ERRORS.METHOD_NOT_FOUND;
    }
  }

  private async requestAccounts(): Promise<string[]> {
    const result = await this.sendMessage('requestAccounts') as { accounts: string[] };
    this.connectionState.accounts = result.accounts;
    this.connectionState.connected = result.accounts.length > 0;
    return result.accounts;
  }

  private async getAccounts(): Promise<string[]> {
    return this.connectionState.accounts;
  }

  private async getChainId(): Promise<string> {
    return this.connectionState.chainId;
  }

  private async disconnect(): Promise<void> {
    this.connectionState.accounts = [];
    this.connectionState.connected = false;
    this.emit('accountsChanged', []);
  }

  private async sendTransaction(params: { to: string; amount: string }): Promise<string> {
    if (!this.connectionState.connected || this.connectionState.accounts.length === 0) {
      throw ERRORS.UNAUTHORIZED;
    }
    const result = await this.sendMessage('sendTransaction', params) as { txHash: string };
    return result.txHash;
  }

  on(event: string, handler: EventHandler): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.removeListener(event, handler);
  }

  removeListener(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.connectionState.connected && this.connectionState.accounts.length > 0;
  }
}

if (!window.warthog) {
  new WarthogProvider();
}

declare global {
  interface Window {
    warthog?: WarthogProvider;
  }
}

export {};