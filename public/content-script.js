(function() {
  var PROVIDER_OBJECT = '__WARTHOG_PROVIDER__';

  if (window[PROVIDER_OBJECT]) {
    return;
  }

  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message && message.type === 'WARTHOG_PROVIDER_EVENT') {
      window.postMessage({
        type: 'WARTHOG_EVENT',
        action: message.action,
        data: message.data
      }, '*');
    }
    if (message && message.type === 'WARTHOG_PROVIDER_RESPONSE') {
      window.postMessage({
        type: 'CONTENT_TO_WARTHOG',
        requestId: message.requestId,
        success: message.success,
        data: message.data,
        error: message.error
      }, '*');
    }
    return false;
  });

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'WARTHOG_TO_CONTENT') return;

    var message = event.data;

    browser.runtime.sendMessage({
      id: message.requestId,
      action: message.action,
      payload: message.payload
    }, function(response) {
    });
  });

  var providerCode = function() {
    if (window.__WARTHOG_INJECTED__) return;
    window.__WARTHOG_INJECTED__ = true;

    var pendingRequests = new Map();
    var requestIdCounter = 0;
    var listeners = {};
    var connectionState = {
      accounts: [],
      chainId: '0x539',
      connected: false
    };

    function getNextRequestId() {
      requestIdCounter++;
      return requestIdCounter;
    }

    function sendMessage(action, payload) {
      return new Promise(function(resolve, reject) {
        var id = getNextRequestId();
        var timeout = setTimeout(function() {
          pendingRequests.delete(id);
          reject({ code: -32603, message: 'Request timeout' });
        }, 120000);

        pendingRequests.set(id, { resolve: resolve, reject: reject, timeout: timeout });

        window.postMessage({
          type: 'WARTHOG_TO_CONTENT',
          requestId: id,
          action: action,
          payload: payload
        }, '*');
      });
    }

    function WarthogProvider() {}

    WarthogProvider.prototype.request = function(args) {
      var method = args.method;
      var params = args.params;

      switch (method) {
        case 'requestAccounts':
          return this.requestAccounts();
        case 'accounts':
          return Promise.resolve(connectionState.accounts);
        case 'chainId':
          return Promise.resolve(connectionState.chainId);
        case 'disconnect':
          return this.disconnect();
        case 'sendTransaction':
        case 'transferWart':
          return this.sendTransaction(params);
        case 'openSendPage':
          return this.openSendPage(params);
        default:
          return Promise.reject({ code: -32601, message: 'Method not found' });
      }
    };

    WarthogProvider.prototype.requestAccounts = function() {
      var self = this;
      return sendMessage('requestAccounts').then(function(result) {
        var accounts = result && result.accounts ? result.accounts : [];
        connectionState.accounts = accounts;
        connectionState.connected = accounts.length > 0;
        return accounts;
      });
    };

    WarthogProvider.prototype.disconnect = function() {
      var self = this;
      return sendMessage('disconnect').then(function() {
        connectionState.accounts = [];
        connectionState.connected = false;
        self.emit('accountsChanged', []);
      });
    };

    WarthogProvider.prototype.sendTransaction = function(params) {
      if (!connectionState.connected || connectionState.accounts.length === 0) {
        return Promise.reject({ code: 4100, message: 'Unauthorized' });
      }
      return sendMessage('sendTransaction', params).then(function(result) {
        return result && result.txHash ? result.txHash : '';
      });
    };

    WarthogProvider.prototype.openSendPage = function(params) {
      return sendMessage('openSendPage', params).then(function(result) {
        return result || {};
      });
    };

    WarthogProvider.prototype.isConnected = function() {
      return connectionState.connected && connectionState.accounts.length > 0;
    };

    WarthogProvider.prototype.on = function(event, handler) {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(handler);
      return function() {
        var handlers = listeners[event];
        if (handlers) {
          var index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      };
    };

    WarthogProvider.prototype.emit = function(event) {
      var args = Array.prototype.slice.call(arguments, 1);
      var handlers = listeners[event];
      if (handlers) {
        handlers.forEach(function(handler) {
          try {
            handler.apply(null, args);
          } catch (error) {
            console.error('Error in ' + event + ' handler:', error);
          }
        });
      }
    };

    window.addEventListener('message', function(event) {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'CONTENT_TO_WARTHOG') return;

      var message = event.data;
      var requestId = message.requestId;

      if (pendingRequests.has(requestId)) {
        var pending = pendingRequests.get(requestId);
        clearTimeout(pending.timeout);
        pendingRequests.delete(requestId);
        if (message.success && message.data) {
          pending.resolve(message.data);
        } else if (message.error) {
          pending.reject(message.error);
        } else {
          pending.reject({ code: -32603, message: 'Unknown error' });
        }
      }
    });

    window.addEventListener('message', function(event) {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'WARTHOG_EVENT') return;

      var message = event.data;
      if (message.action === 'accountsChanged') {
        connectionState.accounts = message.data || [];
        connectionState.connected = (message.data && message.data.length > 0);
      } else if (message.action === 'chainChanged') {
        connectionState.chainId = message.data;
      }
      if (message.action && listeners[message.action]) {
        listeners[message.action].forEach(function(handler) {
          try {
            handler(message.data);
          } catch (error) {
            console.error('Error in ' + message.action + ' handler:', error);
          }
        });
      }
    });

    window.warthog = new WarthogProvider();

    sendMessage('getConnectionState').then(function(result) {
      if (result && result.accounts) {
        connectionState.accounts = result.accounts;
        connectionState.connected = result.connected;
      }
    }).catch(function() {});
  };

  var script = document.createElement('script');
  script.textContent = '(' + providerCode.toString() + ')()';
  (document.head || document.documentElement).appendChild(script);

  window[PROVIDER_OBJECT] = true;
})();
