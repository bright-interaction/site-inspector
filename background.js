// Site Inspector — Background Service Worker
// Captures HTTP response headers for every tab and stores them for analysis

const headerStore = {};

// Listen for response headers on all requests
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    // Only capture main_frame (the page itself, not subresources)
    if (details.type !== 'main_frame') return;

    const headers = {};
    const rawHeaders = []; // Keep raw array for duplicate detection
    const duplicateHeaders = {};

    for (const h of details.responseHeaders || []) {
      const key = h.name.toLowerCase();
      rawHeaders.push({ name: key, value: h.value });

      if (headers[key] !== undefined) {
        // Track duplicates
        if (!duplicateHeaders[key]) duplicateHeaders[key] = [headers[key]];
        duplicateHeaders[key].push(h.value);
      }
      headers[key] = h.value;
    }

    // Merge — preserve existing domData if content script already sent it
    const existing = headerStore[details.tabId];
    headerStore[details.tabId] = {
      url: details.url,
      statusCode: details.statusCode,
      headers,
      rawHeaders,
      duplicateHeaders,
      timestamp: Date.now(),
      domData: existing?.domData || null,
    };
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders', 'extraHeaders']
);

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  delete headerStore[tabId];
});

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_HEADERS') {
    const data = headerStore[message.tabId] || null;
    sendResponse({ headers: data });
    return true;
  }

  if (message.type === 'CONTENT_SCRIPT_DATA') {
    const tabId = sender.tab?.id;
    if (tabId) {
      const existing = headerStore[tabId];
      if (existing) {
        existing.domData = message.data;
      } else {
        headerStore[tabId] = {
          url: sender.tab.url,
          headers: {},
          rawHeaders: [],
          duplicateHeaders: {},
          timestamp: Date.now(),
          domData: message.data,
        };
      }
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_ALL_DATA') {
    const data = headerStore[message.tabId] || null;
    sendResponse({ data });
    return true;
  }

  // Set badge on extension icon
  if (message.type === 'SET_BADGE') {
    const { text, color, tabId } = message;
    chrome.action.setBadgeText({ text: text || '', tabId });
    chrome.action.setBadgeBackgroundColor({ color: color || '#64748b', tabId });
    sendResponse({ ok: true });
    return true;
  }

  // Store scan history
  if (message.type === 'SAVE_SCAN') {
    chrome.storage.local.get(['scanHistory'], (result) => {
      const history = result.scanHistory || {};
      const hostname = message.hostname;
      if (!history[hostname]) history[hostname] = [];
      history[hostname].push({
        date: new Date().toISOString(),
        grades: message.grades,
        scores: message.scores,
      });
      // Keep last 10 scans per domain
      if (history[hostname].length > 10) history[hostname] = history[hostname].slice(-10);
      chrome.storage.local.set({ scanHistory: history });
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'GET_SCAN_HISTORY') {
    chrome.storage.local.get(['scanHistory'], (result) => {
      const history = result.scanHistory || {};
      sendResponse({ history: history[message.hostname] || [] });
    });
    return true;
  }
});
