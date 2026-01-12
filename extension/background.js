// Background Service Worker for Resume Auto Apply Agent
// This runs in the background and handles extension lifecycle events

// Extension Installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Resume Auto Apply Agent installed', details.reason);
  
  if (details.reason === 'install') {
    // Set default profile on first install
    chrome.storage.local.set({
      userProfile: {},
      resumeData: null,
      applicationHistory: []
    });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action);

  switch (message.action) {
    case 'GET_PROFILE':
      chrome.storage.local.get(['userProfile', 'resumeData'], (result) => {
        sendResponse({
          success: true,
          profile: result.userProfile || {},
          resumeData: result.resumeData || null
        });
      });
      return true; // Required for async response

    case 'SAVE_PROFILE':
      chrome.storage.local.set({ userProfile: message.profile }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'LOG_APPLICATION':
      // Log application attempt
      chrome.storage.local.get(['applicationHistory'], (result) => {
        const history = result.applicationHistory || [];
        history.unshift({
          url: message.url,
          platform: message.platform,
          timestamp: new Date().toISOString(),
          status: message.status
        });
        // Keep only last 100 applications
        const trimmedHistory = history.slice(0, 100);
        chrome.storage.local.set({ applicationHistory: trimmedHistory }, () => {
          sendResponse({ success: true });
        });
      });
      return true;

    case 'GET_HISTORY':
      chrome.storage.local.get(['applicationHistory'], (result) => {
        sendResponse({
          success: true,
          history: result.applicationHistory || []
        });
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Handle keyboard shortcut commands
chrome.commands?.onCommand?.addListener((command) => {
  if (command === 'fill-form') {
    // Get active tab and trigger form fill
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.storage.local.get(['userProfile', 'resumeData'], (result) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'FILL_FORM',
            profile: result.userProfile || {},
            resumeData: result.resumeData || null
          });
        });
      }
    });
  }
});

// Optional: Context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: 'autoFillForm',
    title: 'Auto-Fill Application Form',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://*.lever.co/*',
      '*://*.greenhouse.io/*',
      '*://*.myworkdayjobs.com/*',
      '*://*.glassdoor.com/*',
      '*://*.glassdoor.co.uk/*'
    ]
  });
});

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
  if (info.menuItemId === 'autoFillForm' && tab?.id) {
    chrome.storage.local.get(['userProfile', 'resumeData'], (result) => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'FILL_FORM',
        profile: result.userProfile || {},
        resumeData: result.resumeData || null
      });
    });
  }
});

console.log('Resume Auto Apply Agent background script loaded');
