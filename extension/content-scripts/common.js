// Common Content Script - Shared utilities for all ATS platforms

class FormAutoFiller {
  constructor() {
    this.platform = this.detectPlatform();
    this.formData = null;
    this.isReady = false;
  }

  detectPlatform() {
    const url = window.location.href;
    if (/lever\.co/.test(url)) return 'lever';
    if (/greenhouse\.io/.test(url)) return 'greenhouse';
    if (/myworkdayjobs\.com/.test(url)) return 'workday';
    if (/glassdoor\.com/.test(url)) return 'glassdoor';
    return 'unknown';
  }

  // Wait for element to appear
  async waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
          return;
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
          return;
        }
        
        requestAnimationFrame(checkElement);
      };
      
      checkElement();
    });
  }

  // Simulate human-like typing
  async typeText(element, text, delay = 50) {
    element.focus();
    element.value = '';
    
    // Dispatch events to trigger any listeners
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      
      // Random delay to simulate human typing
      await this.sleep(delay + Math.random() * 30);
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Set value directly with events
  setValue(element, value) {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Click element with human-like behavior
  async clickElement(element, delay = 100) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(delay);
    
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
    await this.sleep(50);
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  }

  // Select dropdown option
  async selectOption(selectElement, value) {
    selectElement.focus();
    
    // Try to find option by value or text
    const options = selectElement.querySelectorAll('option');
    let targetOption = null;
    
    for (const option of options) {
      if (option.value === value || option.textContent.toLowerCase().includes(value.toLowerCase())) {
        targetOption = option;
        break;
      }
    }
    
    if (targetOption) {
      selectElement.value = targetOption.value;
      selectElement.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    
    return false;
  }

  // Handle custom dropdowns (React/Vue styled)
  async handleCustomDropdown(container, value) {
    // Click to open dropdown
    const trigger = container.querySelector('[role="combobox"], [role="listbox"], .select-trigger, button');
    if (trigger) {
      await this.clickElement(trigger);
      await this.sleep(200);
    }

    // Find and click option
    const options = document.querySelectorAll('[role="option"], .dropdown-item, .option');
    for (const option of options) {
      if (option.textContent.toLowerCase().includes(value.toLowerCase())) {
        await this.clickElement(option);
        return true;
      }
    }
    
    return false;
  }

  // Check checkbox
  async checkCheckbox(checkbox, shouldBeChecked = true) {
    if (checkbox.checked !== shouldBeChecked) {
      await this.clickElement(checkbox);
    }
  }

  // Handle radio buttons
  async selectRadio(name, value) {
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    for (const radio of radios) {
      const label = radio.parentElement?.textContent || radio.nextElementSibling?.textContent || '';
      if (radio.value === value || label.toLowerCase().includes(value.toLowerCase())) {
        await this.clickElement(radio);
        return true;
      }
    }
    return false;
  }

  // Upload file to input
  async uploadFile(input, fileData, fileName, mimeType) {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // Create File object
      const file = new File([blob], fileName, { type: mimeType });
      
      // Create DataTransfer and add file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Set files on input
      input.files = dataTransfer.files;
      
      // Dispatch events
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      return true;
    } catch (error) {
      console.error('Error uploading file:', error);
      return false;
    }
  }

  // Detect CAPTCHA on page
  detectCaptcha() {
    const captchaIndicators = [
      // reCAPTCHA
      { selector: '.g-recaptcha', type: 'recaptcha-v2' },
      { selector: '[data-sitekey]', type: 'recaptcha-v2' },
      { selector: '.grecaptcha-badge', type: 'recaptcha-v3' },
      // hCaptcha
      { selector: '.h-captcha', type: 'hcaptcha' },
      { selector: '[data-hcaptcha-sitekey]', type: 'hcaptcha' },
      // Cloudflare Turnstile
      { selector: '.cf-turnstile', type: 'turnstile' },
      // Generic challenge
      { selector: '[class*="captcha"]', type: 'unknown' },
      { selector: '#captcha', type: 'unknown' }
    ];

    for (const indicator of captchaIndicators) {
      const element = document.querySelector(indicator.selector);
      if (element) {
        const siteKey = element.getAttribute('data-sitekey') || 
                       element.getAttribute('data-hcaptcha-sitekey') || '';
        return {
          detected: true,
          type: indicator.type,
          siteKey,
          element
        };
      }
    }

    return { detected: false };
  }

  // Check if form submission was successful
  checkSubmissionStatus() {
    const successIndicators = [
      'thank you',
      'application received',
      'successfully submitted',
      'application submitted',
      'we have received your application',
      'confirmation'
    ];

    const pageText = document.body.innerText.toLowerCase();
    const isSuccess = successIndicators.some(indicator => pageText.includes(indicator));

    // Check for error messages
    const errorIndicators = [
      'error',
      'failed',
      'please correct',
      'required field',
      'invalid'
    ];
    
    const hasErrors = document.querySelectorAll('.error, .error-message, [class*="error"]').length > 0;

    return {
      success: isSuccess && !hasErrors,
      hasErrors,
      url: window.location.href
    };
  }

  // Get all form fields on page
  getFormFields() {
    const fields = [];
    
    // Text inputs
    document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"]').forEach(input => {
      fields.push({
        type: 'text',
        name: input.name || input.id,
        label: this.getFieldLabel(input),
        element: input,
        required: input.required
      });
    });

    // Textareas
    document.querySelectorAll('textarea').forEach(textarea => {
      fields.push({
        type: 'textarea',
        name: textarea.name || textarea.id,
        label: this.getFieldLabel(textarea),
        element: textarea,
        required: textarea.required
      });
    });

    // Selects
    document.querySelectorAll('select').forEach(select => {
      const options = Array.from(select.options).map(opt => ({
        value: opt.value,
        text: opt.textContent
      }));
      fields.push({
        type: 'select',
        name: select.name || select.id,
        label: this.getFieldLabel(select),
        element: select,
        options,
        required: select.required
      });
    });

    // File inputs
    document.querySelectorAll('input[type="file"]').forEach(input => {
      fields.push({
        type: 'file',
        name: input.name || input.id,
        label: this.getFieldLabel(input),
        element: input,
        accept: input.accept,
        required: input.required
      });
    });

    // Checkboxes
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      fields.push({
        type: 'checkbox',
        name: checkbox.name || checkbox.id,
        label: this.getFieldLabel(checkbox),
        element: checkbox,
        required: checkbox.required
      });
    });

    // Radio buttons
    const radioGroups = {};
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      const name = radio.name;
      if (!radioGroups[name]) {
        radioGroups[name] = {
          type: 'radio',
          name,
          label: this.getFieldLabel(radio),
          options: [],
          required: radio.required
        };
      }
      radioGroups[name].options.push({
        value: radio.value,
        label: this.getFieldLabel(radio)
      });
    });
    fields.push(...Object.values(radioGroups));

    return fields;
  }

  // Get label for form field
  getFieldLabel(element) {
    // Check for associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.replace(element.value, '').trim();
    }

    // Check aria-label
    if (element.getAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    // Check placeholder
    if (element.placeholder) {
      return element.placeholder;
    }

    // Check preceding sibling text
    const prevSibling = element.previousElementSibling;
    if (prevSibling && (prevSibling.tagName === 'LABEL' || prevSibling.tagName === 'SPAN')) {
      return prevSibling.textContent.trim();
    }

    return element.name || element.id || '';
  }

  // Sleep utility
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Show overlay notification
  showNotification(message, type = 'info') {
    const existing = document.querySelector('.auto-apply-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `auto-apply-notification auto-apply-${type}`;
    notification.innerHTML = `
      <span class="auto-apply-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
      <span class="auto-apply-message">${message}</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 5000);
  }
}

// Create global instance
window.formAutoFiller = new FormAutoFiller();

// Message listener for background script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    const filler = window.formAutoFiller;

    switch (message.action) {
      case 'PAGE_READY':
        sendResponse({ 
          ready: true, 
          platform: filler.platform,
          fields: filler.getFormFields().map(f => ({
            type: f.type,
            name: f.name,
            label: f.label,
            required: f.required
          }))
        });
        break;

      case 'CHECK_STATUS':
        sendResponse(filler.checkSubmissionStatus());
        break;

      case 'HANDLE_CAPTCHA':
        const captchaInfo = filler.detectCaptcha();
        sendResponse({
          captchaDetected: captchaInfo.detected,
          captchaType: captchaInfo.type,
          siteKey: captchaInfo.siteKey,
          pageUrl: window.location.href,
          solved: false
        });
        break;

      case 'GET_FORM_FIELDS':
        sendResponse({
          success: true,
          fields: filler.getFormFields().map(f => ({
            type: f.type,
            name: f.name,
            label: f.label,
            required: f.required,
            options: f.options
          }))
        });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  };

  handler().catch(error => {
    sendResponse({ success: false, error: error.message });
  });

  return true; // Keep channel open for async response
});

console.log('Resume Auto Apply Agent - Common content script loaded');
