// Popup Script for Resume Auto Apply Agent

class PopupController {
  constructor() {
    this.profile = {};
    this.settings = {};
    this.logs = [];
    this.init();
  }

  async init() {
    await this.loadStoredData();
    this.setupTabs();
    this.setupEventListeners();
    this.updateConnectionStatus();
    this.updateCurrentPageInfo();
  }

  async loadStoredData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['userProfile', 'settings', 'logs', 'resumeData', 'coverLetterData'], (result) => {
        this.profile = result.userProfile || {};
        this.settings = result.settings || {
          serverUrl: 'http://localhost:3000',
          wsUrl: 'ws://localhost:3001',
          autoFill: true,
          autoSubmit: false,
          notifySuccess: true
        };
        this.logs = result.logs || [];
        this.resumeData = result.resumeData || null;
        this.coverLetterData = result.coverLetterData || null;
        
        this.populateForm();
        this.renderLogs();
        resolve();
      });
    });
  }

  populateForm() {
    // Profile fields
    const profileFields = ['fullName', 'firstName', 'lastName', 'email', 'phone', 'location', 
                          'linkedin', 'github', 'portfolio', 'currentCompany'];
    
    profileFields.forEach(field => {
      const element = document.getElementById(field);
      if (element && this.profile[field]) {
        element.value = this.profile[field];
      }
    });

    // Settings
    document.getElementById('serverUrl').value = this.settings.serverUrl || 'http://localhost:3000';
    document.getElementById('wsUrl').value = this.settings.wsUrl || 'ws://localhost:3001';
    document.getElementById('autoFill').checked = this.settings.autoFill !== false;
    document.getElementById('autoSubmit').checked = this.settings.autoSubmit === true;
    document.getElementById('notifySuccess').checked = this.settings.notifySuccess !== false;

    // File names
    if (this.resumeData) {
      document.getElementById('resumeFileName').textContent = this.resumeData.name;
    }
    if (this.coverLetterData) {
      document.getElementById('coverLetterFileName').textContent = this.coverLetterData.name;
    }
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${targetTab}-tab`).classList.add('active');
      });
    });
  }

  setupEventListeners() {
    // Profile
    document.getElementById('saveProfile').addEventListener('click', () => this.saveProfile());
    document.getElementById('resumeFile').addEventListener('change', (e) => this.handleFileUpload(e, 'resume'));
    document.getElementById('coverLetterFile').addEventListener('change', (e) => this.handleFileUpload(e, 'coverLetter'));

    // Apply
    document.getElementById('useCurrentUrl').addEventListener('click', () => this.useCurrentUrl());
    document.getElementById('detectFields').addEventListener('click', () => this.detectFields());
    document.getElementById('fillForm').addEventListener('click', () => this.fillForm());
    document.getElementById('submitApplication').addEventListener('click', () => this.submitApplication());

    // Settings
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    document.getElementById('connectServer').addEventListener('click', () => this.connectToServer());
    document.getElementById('clearData').addEventListener('click', () => this.clearAllData());

    // Logs
    document.getElementById('clearLogs').addEventListener('click', () => this.clearLogs());
  }

  async saveProfile() {
    const profileFields = ['fullName', 'firstName', 'lastName', 'email', 'phone', 'location',
                          'linkedin', 'github', 'portfolio', 'currentCompany'];
    
    profileFields.forEach(field => {
      const element = document.getElementById(field);
      if (element) {
        this.profile[field] = element.value;
      }
    });

    await chrome.storage.local.set({ userProfile: this.profile });
    this.addLog('Profile saved successfully', 'success');
    this.showNotification('Profile saved!');
  }

  async handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64
      };

      if (type === 'resume') {
        this.resumeData = fileData;
        document.getElementById('resumeFileName').textContent = file.name;
        await chrome.storage.local.set({ resumeData: fileData });
      } else {
        this.coverLetterData = fileData;
        document.getElementById('coverLetterFileName').textContent = file.name;
        await chrome.storage.local.set({ coverLetterData: fileData });
      }

      this.addLog(`${type === 'resume' ? 'Resume' : 'Cover letter'} uploaded: ${file.name}`, 'success');
    };

    reader.readAsDataURL(file);
  }

  async useCurrentUrl() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      document.getElementById('jobUrl').value = tab.url;
    }
  }

  async updateCurrentPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        document.getElementById('currentUrl').textContent = tab.url.substring(0, 50) + (tab.url.length > 50 ? '...' : '');
        
        const platform = this.detectPlatform(tab.url);
        const badge = document.getElementById('platformBadge');
        badge.textContent = platform;
        badge.style.background = platform !== 'unknown' ? '#4361ee' : '#666';
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }

  detectPlatform(url) {
    if (/lever\.co/.test(url)) return 'Lever';
    if (/greenhouse\.io/.test(url)) return 'Greenhouse';
    if (/myworkdayjobs\.com/.test(url)) return 'Workday';
    if (/glassdoor\.com/.test(url)) return 'Glassdoor';
    return 'Unknown';
  }

  async detectFields() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_FORM_FIELDS' });
      
      const fieldsList = document.getElementById('fieldsList');
      fieldsList.innerHTML = '';
      
      if (response?.fields?.length > 0) {
        response.fields.forEach(field => {
          const li = document.createElement('li');
          li.innerHTML = `<strong>${field.label || field.name}</strong> (${field.type})${field.required ? ' *' : ''}`;
          fieldsList.appendChild(li);
        });
        this.addLog(`Detected ${response.fields.length} fields`, 'info');
      } else {
        fieldsList.innerHTML = '<li>No fields detected</li>';
        this.addLog('No form fields detected', 'warning');
      }
    } catch (error) {
      this.addLog(`Error detecting fields: ${error.message}`, 'error');
    }
  }

  async fillForm() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const platform = this.detectPlatform(tab.url).toLowerCase();
      
      const formData = {
        ...this.profile,
        resume: this.resumeData ? {
          data: this.resumeData.data,
          name: this.resumeData.name,
          mimeType: this.resumeData.type
        } : null,
        coverLetter: this.coverLetterData ? {
          data: this.coverLetterData.data,
          name: this.coverLetterData.name,
          mimeType: this.coverLetterData.type
        } : null
      };

      this.updateStatus('Filling form...', 'info');
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'FILL_FORM',
        formData,
        platform
      });

      if (response?.success) {
        this.updateStatus(`Filled ${response.results?.filled?.length || 0} fields`, 'success');
        this.addLog(`Form filled: ${response.results?.filled?.length || 0} fields`, 'success');
      } else {
        this.updateStatus('Fill failed: ' + (response?.error || 'Unknown error'), 'error');
        this.addLog('Form fill failed: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      this.updateStatus('Error: ' + error.message, 'error');
      this.addLog('Fill error: ' + error.message, 'error');
    }
  }

  async submitApplication() {
    const confirmed = confirm('Are you sure you want to submit this application?');
    if (!confirmed) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      this.updateStatus('Submitting application...', 'info');
      
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'SUBMIT_APPLICATION'
      });

      if (response?.success) {
        this.updateStatus('Application submitted successfully!', 'success');
        this.addLog('Application submitted successfully', 'success');
      } else {
        this.updateStatus('Submission failed: ' + (response?.error || 'Unknown error'), 'error');
        this.addLog('Submission failed: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      this.updateStatus('Error: ' + error.message, 'error');
      this.addLog('Submit error: ' + error.message, 'error');
    }
  }

  updateStatus(message, type = 'info') {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = 'status-message ' + type;
  }

  async saveSettings() {
    this.settings = {
      serverUrl: document.getElementById('serverUrl').value,
      wsUrl: document.getElementById('wsUrl').value,
      autoFill: document.getElementById('autoFill').checked,
      autoSubmit: document.getElementById('autoSubmit').checked,
      notifySuccess: document.getElementById('notifySuccess').checked
    };

    await chrome.storage.local.set({ settings: this.settings });
    this.addLog('Settings saved', 'success');
    this.showNotification('Settings saved!');
  }

  async connectToServer() {
    try {
      chrome.runtime.sendMessage({ action: 'CONNECT_SERVER' }, (response) => {
        if (response?.success) {
          this.addLog('Connected to server', 'success');
          this.updateConnectionStatus(true);
        }
      });
    } catch (error) {
      this.addLog('Failed to connect: ' + error.message, 'error');
    }
  }

  updateConnectionStatus(connected = false) {
    const statusEl = document.getElementById('connectionStatus');
    if (connected) {
      statusEl.classList.add('connected');
      statusEl.querySelector('.status-text').textContent = 'Connected';
    } else {
      statusEl.classList.remove('connected');
      statusEl.querySelector('.status-text').textContent = 'Disconnected';
    }
  }

  async clearAllData() {
    const confirmed = confirm('Are you sure you want to clear all data? This cannot be undone.');
    if (!confirmed) return;

    await chrome.storage.local.clear();
    this.profile = {};
    this.settings = {};
    this.logs = [];
    this.resumeData = null;
    this.coverLetterData = null;
    
    this.populateForm();
    this.renderLogs();
    this.addLog('All data cleared', 'warning');
  }

  addLog(message, type = 'info') {
    const log = {
      time: new Date().toLocaleTimeString(),
      message,
      type
    };
    
    this.logs.unshift(log);
    if (this.logs.length > 100) this.logs.pop();
    
    chrome.storage.local.set({ logs: this.logs });
    this.renderLogs();
  }

  renderLogs() {
    const container = document.getElementById('logsContainer');
    
    if (this.logs.length === 0) {
      container.innerHTML = '<p class="log-empty">No activity yet</p>';
      return;
    }

    container.innerHTML = this.logs.map(log => `
      <div class="log-entry ${log.type}">
        <span class="log-time">${log.time}</span>
        ${log.message}
      </div>
    `).join('');
  }

  clearLogs() {
    this.logs = [];
    chrome.storage.local.set({ logs: [] });
    this.renderLogs();
  }

  showNotification(message) {
    // Simple visual feedback
    const btn = document.activeElement;
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ ' + message;
      setTimeout(() => {
        btn.textContent = originalText;
      }, 1500);
    }
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
