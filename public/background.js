const CHAIN_ID = '0x539';

const ERRORS = {
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'Unauthorized - please connect first' },
  CHAIN_NOT_FOUND: { code: 4900, message: 'Chain not found' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
};

class WarthogBackground {
  constructor() {
    this.connections = new Map();
    this.pendingRequest = null;
    this.approvalWindowId = null;
    this.pendingPopupPromise = null;
    this.setupMessageListener();
    this.setupWindowListeners();
  }

  setupWindowListeners() {
    browser.action.onClicked.addListener(async (tab) => {
      console.log('Extension icon clicked');
      await this.focusOrCreatePopup('index.html');
    });

    browser.windows.onRemoved.addListener((windowId) => {
      if (windowId === this.approvalWindowId) {
        console.log('Popup window closed, clearing approvalWindowId');
        this.approvalWindowId = null;
        if (this.pendingRequest) {
          console.log('Clearing pendingRequest due to popup close');
          if (this.pendingRequest.reject) {
            this.pendingRequest.reject(ERRORS.USER_REJECTED);
          }
          this.pendingRequest = null;
        }
        browser.storage.local.remove('pendingApproval');
      }
    });
  }

  setupMessageListener() {
    console.log('setupMessageListener registered');
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('background received message', { message, tabId: sender.tab?.id, url: sender.url });
      const tabId = sender.tab?.id;
      const url = sender.url || '';
      const origin = this.extractOrigin(url);

      if (message.action === 'approvalResult') {
        console.log('handling approvalResult:', message.payload);
        this.handleApprovalResult(message.payload);
        sendResponse({ success: true });
        return;
      }

      if (message.action === 'getPendingApproval') {
        console.log('handling getPendingApproval');
        this.handleGetPendingApproval();
        sendResponse({ success: true });
        return;
      }

      if (message.action === 'approveRequest') {
        console.log('handling approveRequest');
        this.handleApproveRequest(message.payload);
        sendResponse({ success: true });
        return;
      }

      if (message.action === 'rejectRequest') {
        console.log('handling rejectRequest');
        this.handleRejectRequest();
        sendResponse({ success: true });
        return;
      }

      if (message.action) {
        this.handleMessage(message, origin, tabId);
      }

      sendResponse({ success: true });
      return true;
    });
  }

  extractOrigin(url) {
    try {
      return new URL(url).origin;
    } catch {
      return 'unknown';
    }
  }

  async findExistingPopup() {
    console.log('findExistingPopup called, approvalWindowId:', this.approvalWindowId);
    if (this.approvalWindowId) {
      try {
        const win = await browser.windows.get(this.approvalWindowId);
        console.log('browser.windows.get result:', win);
        if (win && win.id) {
          console.log('Found popup by approvalWindowId:', this.approvalWindowId);
          return win;
        }
      } catch (e) {
        console.log('Window get failed, clearing approvalWindowId');
        this.approvalWindowId = null;
      }
    }

    await new Promise(r => setTimeout(r, 50));
    const wins = await browser.windows.getAll({ windowTypes: ['popup'] });
    console.log('All popup windows:', wins.map(w => ({ id: w.id, url: w.url })));
    const extensionUrl = browser.runtime.getURL('');
    for (const win of wins) {
      if (win.url && win.url.startsWith(extensionUrl)) {
        console.log('Found existing extension popup by URL scan:', win.id);
        this.approvalWindowId = win.id;
        return win;
      }
    }
    console.log('No existing popup found');
    return null;
  }

  async focusOrCreatePopup(url) {
    console.log('focusOrCreatePopup called with url:', url, 'pendingPopupPromise:', !!this.pendingPopupPromise);
    if (this.pendingPopupPromise) {
      console.log('Returning existing pendingPopupPromise');
      return this.pendingPopupPromise;
    }

    const existing = await this.findExistingPopup();
    if (existing) {
      this.approvalWindowId = existing.id;
      console.log('Found existing popup, focusing:', existing.id);
      await browser.windows.update(existing.id, { focused: true });
      return existing;
    }
    console.log('No existing popup, creating new');
    const width = 400;
    const height = 600;
    this.pendingPopupPromise = browser.windows.create({
      url,
      type: 'popup',
      width,
      height,
      top: Math.floor((window.screen.availHeight - height) / 2),
      left: Math.floor((window.screen.availWidth - width) / 2),
    }).then((win) => {
      this.approvalWindowId = win?.id || null;
      return win;
    }).finally(() => {
      this.pendingPopupPromise = null;
    });
    return this.pendingPopupPromise;
  }

  handleMessage(message, origin, tabId) {
    const { action, payload, id } = message;

    switch (action) {
      case 'requestAccounts':
        this.handleRequestAccounts(origin, tabId, id);
        break;
      case 'sendTransaction':
      case 'transferWart':
        this.handleSendTransaction(payload, origin, tabId, id);
        break;
      case 'openSendPage':
        this.handleOpenSendPage(payload, origin, tabId, id);
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
      case 'getPendingApproval':
        this.handleGetPendingApproval(tabId, id);
        break;
      case 'approveRequest':
        this.handleApproveRequest(payload, tabId, id);
        break;
      case 'rejectRequest':
        this.handleRejectRequest(tabId, id);
        break;
    }
  }

  async handleRequestAccounts(origin, tabId, requestId) {
    console.log('handleRequestAccounts called', { origin, tabId, requestId });
    if (this.pendingRequest && this.pendingRequest.origin === origin) {
      console.log('Duplicate request from same origin, rejecting');
      this.sendResponse(tabId, requestId, { success: false, error: ERRORS.USER_REJECTED });
      return;
    }
    try {
      const result = await this.requestApproval({
        requestId,
        action: 'requestAccounts',
        origin,
        tabId,
      });
      console.log('requestApproval resolved', result);

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

  async handleSendTransaction(payload, origin, tabId, requestId) {
    if (this.pendingRequest && this.pendingRequest.origin === origin) {
      console.log('Duplicate transaction request from same origin, rejecting');
      this.sendResponse(tabId, requestId, { success: false, error: ERRORS.USER_REJECTED });
      return;
    }
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

async handleOpenSendPage(payload, origin, tabId, requestId) {
    console.log('handleOpenSendPage called', { origin, tabId, payload });

    this.pendingApprovalParams = {
      action: 'sendTo',
      origin: origin,
      to: payload.to,
      tabId: tabId,
      requestId: requestId,
    };
    await browser.storage.local.set({ pendingApproval: JSON.stringify(this.pendingApprovalParams) });

    const popupUrl = 'index.html';
    this.focusOrCreatePopup(popupUrl)
      .then((win) => {
        if (tabId !== undefined) {
          browser.tabs.sendMessage(tabId, { type: 'WARTHOG_PROVIDER_RESPONSE', requestId, success: true, data: { pending: true } });
        }
      })
      .catch((error) => {
        console.error('Failed to open send page:', error);
      });
  }

  handleGetAccounts(origin, tabId, requestId) {
    const connection = this.connections.get(origin);
    const accounts = connection?.accounts || [];
    this.sendResponse(tabId, requestId, { success: true, data: { accounts } });
  }

  handleGetChainId(tabId, requestId) {
    this.sendResponse(tabId, requestId, { success: true, data: { chainId: CHAIN_ID } });
  }

  handleDisconnect(origin, tabId, requestId) {
    this.connections.delete(origin);
    this.sendResponse(tabId, requestId, { success: true, data: {} });
  }

  handleGetPendingApproval() {
    console.log('handleGetPendingApproval, pendingApprovalParams:', this.pendingApprovalParams);
    // Store in browser storage so popup can access it
    if (this.pendingApprovalParams) {
      browser.storage.local.set({ pendingApproval: JSON.stringify(this.pendingApprovalParams) });
    } else {
      browser.storage.local.remove('pendingApproval');
    }
    return this.pendingApprovalParams || null;
  }

  handleApproveRequest(payload) {
    console.log('handleApproveRequest called', payload);
    if (this.pendingRequest && this.pendingRequest.resolve) {
      const { accounts } = payload;
      if (this.pendingRequest.action === 'requestAccounts' && accounts) {
        this.pendingRequest.resolve({ accounts });
      } else if (payload.txHash) {
        this.pendingRequest.resolve({ txHash: payload.txHash });
      } else {
        this.pendingRequest.resolve({ accounts: [] });
      }
    }
    this.pendingRequest = null;
    this.pendingApprovalParams = null;
    browser.storage.local.remove('pendingApproval');
  }

  handleRejectRequest() {
    console.log('handleRejectRequest called');
    if (this.pendingRequest && this.pendingRequest.reject) {
      this.pendingRequest.reject(ERRORS.USER_REJECTED);
    }
    this.pendingRequest = null;
    this.pendingApprovalParams = null;
  }

  handleApprovalResult(payload) {
    console.log('handleApprovalResult called', payload);
    console.log('pendingRequest was', this.pendingRequest);
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

requestApproval(data) {
    return new Promise((resolve, reject) => {
      this.pendingRequest = {
        ...data,
        resolve,
        reject,
      };

      this.pendingApprovalParams = {
        action: data.action,
        origin: data.origin,
        to: data.to,
        amount: data.amount,
        from: data.from,
      };

      browser.storage.local.set({ pendingApproval: JSON.stringify(this.pendingApprovalParams) });

      const popupUrl = 'index.html';

      this.focusOrCreatePopup(popupUrl)
        .then((win) => {
          this.approvalWindowId = win?.id || null;
          if (data.tabId !== undefined) {
            browser.tabs.sendMessage(data.tabId, { type: 'WARTHOG_PROVIDER_RESPONSE', requestId: data.requestId, success: true, data: { pending: true, message: 'Popup opened' } });
          }
        })
        .catch((error) => {
          console.error('Failed to open approval window:', error);
          reject(ERRORS.INTERNAL_ERROR);
        });
    });
  }

  sendToTab(tabId, action, data) {
    if (tabId === undefined) return;
    browser.tabs
      .sendMessage(tabId, { type: 'WARTHOG_PROVIDER_EVENT', action, data })
      .catch(() => {});
  }

  sendResponse(tabId, requestId, response) {
    console.log('sendResponse called', { tabId, requestId, response });
    if (tabId === undefined) {
      console.log('sendResponse: tabId is undefined, cannot send');
      return;
    }
    browser.tabs
      .sendMessage(tabId, { type: 'WARTHOG_PROVIDER_RESPONSE', requestId, success: response.success, data: response.data, error: response.error })
      .then(() => console.log('sendMessage sent successfully'))
      .catch((e) => console.error('sendMessage failed', e));
  }
}

new WarthogBackground();
