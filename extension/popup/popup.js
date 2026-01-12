// Resume Auto Apply Agent - Popup Script

class PopupController {
  constructor() {
    this.profile = {};
    this.resumeData = null;
    this.init();
  }

  async init() {
    await this.loadProfile();
    this.setupTabs();
    this.setupEventListeners();
    this.updateCurrentPageInfo();
  }

  // Load saved profile from Chrome storage
  async loadProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['userProfile', 'resumeData'], (result) => {
        this.profile = result.userProfile || {};
        this.resumeData = result.resumeData || null;
        this.populateForm();
        resolve();
      });
    });
  }

  // Populate form with saved profile data
  populateForm() {
    const fields = [
      'fullName', 'firstName', 'lastName', 'email', 'phone', 
      'location', 'linkedin', 'github', 'portfolio', 
      'currentCompany', 'currentTitle', 'yearsExperience'
    ];
    
    fields.forEach(field => {
      const element = document.getElementById(field);
      if (element && this.profile[field]) {
        element.value = this.profile[field];
      }
    });

    // Show resume file name if uploaded
    if (this.resumeData && this.resumeData.name) {
      document.getElementById('resumeFileName').textContent = '✅ ' + this.resumeData.name;
    }
  }

  // Setup tab switching
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

  // Setup all event listeners
  setupEventListeners() {
    // Save profile button
    document.getElementById('saveProfile').addEventListener('click', () => this.saveProfile());
    
    // Resume file upload
    document.getElementById('resumeFile').addEventListener('change', (e) => this.handleResumeUpload(e));
    
    // Fill form button
    document.getElementById('fillForm').addEventListener('click', () => this.fillForm());
    
    // Refresh status button
    document.getElementById('refreshStatus').addEventListener('click', () => this.updateCurrentPageInfo());
  }

  // Save profile to Chrome storage
  async saveProfile() {
    const fields = [
      'fullName', 'firstName', 'lastName', 'email', 'phone', 
      'location', 'linkedin', 'github', 'portfolio', 
      'currentCompany', 'currentTitle', 'yearsExperience'
    ];
    
    fields.forEach(field => {
      const element = document.getElementById(field);
      if (element) {
        this.profile[field] = element.value;
      }
    });

    // Auto-split full name if first/last not provided
    if (this.profile.fullName && (!this.profile.firstName || !this.profile.lastName)) {
      const parts = this.profile.fullName.split(' ');
      if (parts.length >= 2) {
        this.profile.firstName = this.profile.firstName || parts[0];
        this.profile.lastName = this.profile.lastName || parts.slice(1).join(' ');
      }
    }

    await chrome.storage.local.set({ userProfile: this.profile });
    this.showStatus('saveStatus', 'Profile saved successfully! ✅', 'success');
  }

  // Handle resume file upload
  async handleResumeUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 5MB for storage)
    if (file.size > 5 * 1024 * 1024) {
      this.showStatus('saveStatus', 'File too large. Max 5MB allowed.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      this.resumeData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
        uploadedAt: new Date().toISOString()
      };

      await chrome.storage.local.set({ resumeData: this.resumeData });
      document.getElementById('resumeFileName').textContent = '✅ ' + file.name;
      this.showStatus('saveStatus', 'Resume uploaded successfully! ✅', 'success');
    };

    reader.onerror = () => {
      this.showStatus('saveStatus', 'Error reading file. Please try again.', 'error');
    };

    reader.readAsDataURL(file);
  }

  // Update current page info
  async updateCurrentPageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab?.url) {
        // Update URL display
        const urlDisplay = document.getElementById('currentUrl');
        urlDisplay.textContent = tab.url.length > 60 
          ? tab.url.substring(0, 60) + '...' 
          : tab.url;
        urlDisplay.title = tab.url;

        // Detect platform
        const platform = this.detectPlatform(tab.url);
        document.getElementById('detectedPlatform').textContent = platform;
        document.getElementById('platformStatus').textContent = platform;
        
        // Update platform badge styling
        const platformBadge = document.getElementById('platformStatus');
        if (platform !== 'Unknown') {
          platformBadge.style.background = '#4ade80';
          platformBadge.style.color = '#064e3b';
        } else {
          platformBadge.style.background = '#fbbf24';
          platformBadge.style.color = '#78350f';
        }
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
      document.getElementById('currentUrl').textContent = 'Unable to detect page';
    }
  }

  // Detect ATS platform from URL
  detectPlatform(url) {
    if (/lever\.co/i.test(url)) return 'Lever';
    if (/greenhouse\.io/i.test(url)) return 'Greenhouse';
    if (/myworkdayjobs\.com/i.test(url)) return 'Workday';
    if (/glassdoor\./i.test(url)) return 'Glassdoor';
    if (/workday\.com/i.test(url)) return 'Workday';
    if (/icims\.com/i.test(url)) return 'iCIMS';
    if (/taleo\.net/i.test(url)) return 'Taleo';
    if (/successfactors/i.test(url)) return 'SuccessFactors';
    return 'Unknown';
  }

  // Fill form on current page
  async fillForm() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.id) {
        this.showStatus('fillStatus', 'No active tab found.', 'error');
        return;
      }

      // Check if profile has minimum required data
      if (!this.profile.email || !this.profile.fullName) {
        this.showStatus('fillStatus', 'Please fill in your profile first (Name & Email required).', 'error');
        return;
      }

      this.showStatus('fillStatus', 'Filling form...', 'info');

      // Send message to content script to fill the form
      chrome.tabs.sendMessage(tab.id, {
        action: 'FILL_FORM',
        profile: this.profile,
        resumeData: this.resumeData
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script might not be loaded yet
          this.showStatus('fillStatus', 'Please refresh the page and try again. The extension needs to load first.', 'error');
          return;
        }
        
        if (response?.success) {
          this.showStatus('fillStatus', `Form filled successfully! ✅ (${response.filledCount || 0} fields)`, 'success');
        } else {
          this.showStatus('fillStatus', response?.message || 'Form fill completed. Please review the fields.', 'info');
        }
      });

    } catch (error) {
      console.error('Error filling form:', error);
      this.showStatus('fillStatus', 'Error: ' + error.message, 'error');
    }
  }

  // Show status message
  showStatus(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message;
    element.className = 'status-message ' + type;
    element.style.display = 'block';

    // Auto-hide success/info messages after 3 seconds
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        element.style.display = 'none';
      }, 3000);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
