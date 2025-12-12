// Background Service Worker for Resume Auto Apply Agent
// Handles communication between server and content scripts

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3001';

let websocket = null;
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Initialize WebSocket connection to server
function initWebSocket() {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log('Connected to server via WebSocket');
      connectionAttempts = 0;
      
      // Register this extension instance with the server
      websocket.send(JSON.stringify({
        type: 'REGISTER_EXTENSION',
        data: {
          extensionId: chrome.runtime.id,
          timestamp: Date.now()
        }
      }));
    };

    websocket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await handleServerMessage(message);
      } catch (error) {
        console.error('Error handling server message:', error);
      }
    };

    websocket.onclose = () => {
      console.log('WebSocket connection closed');
      attemptReconnect();
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    attemptReconnect();
  }
}

function attemptReconnect() {
  if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
    connectionAttempts++;
    console.log(`Attempting to reconnect (${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    setTimeout(initWebSocket, RECONNECT_DELAY);
  } else {
    console.error('Max reconnection attempts reached');
  }
}

// Handle messages from the server
async function handleServerMessage(message) {
  const { type, data, taskId } = message;

  switch (type) {
    case 'FILL_FORM':
      await handleFillForm(data, taskId);
      break;
    case 'SUBMIT_APPLICATION':
      await handleSubmitApplication(data, taskId);
      break;
    case 'UPLOAD_FILE':
      await handleFileUpload(data, taskId);
      break;
    case 'SOLVE_CAPTCHA':
      await handleCaptcha(data, taskId);
      break;
    case 'CHECK_STATUS':
      await handleCheckStatus(data, taskId);
      break;
    case 'NAVIGATE':
      await handleNavigate(data, taskId);
      break;
    default:
      console.warn('Unknown message type:', type);
  }
}

// Navigate to a URL
async function handleNavigate(data, taskId) {
  try {
    const { url } = data;
    const tab = await chrome.tabs.create({ url, active: true });
    
    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: true,
      data: { tabId: tab.id }
    });
  } catch (error) {
    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: false,
      error: error.message
    });
  }
}

// Fill form fields via content script
async function handleFillForm(data, taskId) {
  try {
    const { tabId, formData, platform } = data;
    
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'FILL_FORM',
      formData,
      platform
    });

    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: response.success,
      data: response
    });
  } catch (error) {
    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: false,
      error: error.message
    });
  }
}

// Submit application
async function handleSubmitApplication(data, taskId) {
  try {
    const { tabId } = data;
    
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'SUBMIT_APPLICATION'
    });

    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: response.success,
      data: response
    });
  } catch (error) {
    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: false,
      error: error.message
    });
  }
}

// Handle file upload (resume/cover letter)
async function handleFileUpload(data, taskId) {
  try {
    const { tabId, fileType, fileData, fileName } = data;
    
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'UPLOAD_FILE',
      fileType,
      fileData,
      fileName
    });

    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: response.success,
      data: response
    });
  } catch (error) {
    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: false,
      error: error.message
    });
  }
}

// Handle CAPTCHA challenges
async function handleCaptcha(data, taskId) {
  try {
    const { tabId, captchaType } = data;
    
    // Send message to content script to detect and handle captcha
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'HANDLE_CAPTCHA',
      captchaType
    });

    // If captcha detected, we may need human intervention or external service
    if (response.captchaDetected && !response.solved) {
      // Notify server that human intervention is needed
      sendToServer({
        type: 'CAPTCHA_DETECTED',
        taskId,
        data: {
          captchaType: response.captchaType,
          siteKey: response.siteKey,
          pageUrl: response.pageUrl
        }
      });
    } else {
      sendToServer({
        type: 'TASK_RESULT',
        taskId,
        success: response.success,
        data: response
      });
    }
  } catch (error) {
    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: false,
      error: error.message
    });
  }
}

// Check page status
async function handleCheckStatus(data, taskId) {
  try {
    const { tabId } = data;
    
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'CHECK_STATUS'
    });

    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: true,
      data: response
    });
  } catch (error) {
    sendToServer({
      type: 'TASK_RESULT',
      taskId,
      success: false,
      error: error.message
    });
  }
}

// Send message to server
function sendToServer(message) {
  if (websocket && websocket.readyState === WebSocket.OPEN) {
    websocket.send(JSON.stringify(message));
  } else {
    console.error('WebSocket not connected, queuing message');
    // Could implement message queue here
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'FORWARD_TO_SERVER') {
    sendToServer({
      type: message.type,
      data: {
        ...message.data,
        tabId: sender.tab?.id,
        url: sender.tab?.url
      }
    });
    sendResponse({ success: true });
  } else if (message.action === 'GET_USER_PROFILE') {
    chrome.storage.local.get(['userProfile'], (result) => {
      sendResponse({ profile: result.userProfile || null });
    });
    return true; // Keep channel open for async response
  } else if (message.action === 'CONNECT_SERVER') {
    initWebSocket();
    sendResponse({ success: true });
  }
  return true;
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Resume Auto Apply Agent installed');
  
  // Set default settings
  chrome.storage.local.set({
    settings: {
      autoFill: true,
      autoSubmit: false,
      notifyOnSuccess: true,
      serverUrl: SERVER_URL,
      wsUrl: WS_URL
    }
  });
});

// Initialize WebSocket on startup
chrome.runtime.onStartup.addListener(() => {
  initWebSocket();
});

// Handle tab updates to detect ATS pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const atsPatterns = [
      /jobs\.lever\.co/,
      /greenhouse\.io/,
      /myworkdayjobs\.com/,
      /glassdoor\.com.*jobs/
    ];

    const isAtsPage = atsPatterns.some(pattern => pattern.test(tab.url));
    
    if (isAtsPage) {
      // Notify content script that page is ready
      chrome.tabs.sendMessage(tabId, { action: 'PAGE_READY' }).catch(() => {
        // Content script may not be loaded yet, ignore
      });

      // Notify server about detected ATS page
      sendToServer({
        type: 'ATS_PAGE_DETECTED',
        data: {
          tabId,
          url: tab.url,
          platform: detectPlatform(tab.url)
        }
      });
    }
  }
});

// Detect ATS platform from URL
function detectPlatform(url) {
  if (/lever\.co/.test(url)) return 'lever';
  if (/greenhouse\.io/.test(url)) return 'greenhouse';
  if (/myworkdayjobs\.com/.test(url)) return 'workday';
  if (/glassdoor\.com/.test(url)) return 'glassdoor';
  return 'unknown';
}

// Periodic health check
chrome.alarms.create('healthCheck', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'healthCheck') {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      initWebSocket();
    }
  }
});

// Initialize connection
initWebSocket();
