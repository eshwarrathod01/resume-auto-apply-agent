// Resume Auto Apply Agent - Content Script
// Automatically fills job application forms on ATS platforms

(function() {
  'use strict';

  // Detect which platform we're on
  function detectPlatform() {
    const url = window.location.href.toLowerCase();
    if (url.includes('lever.co')) return 'lever';
    if (url.includes('greenhouse.io')) return 'greenhouse';
    if (url.includes('myworkdayjobs.com') || url.includes('workday')) return 'workday';
    if (url.includes('glassdoor.com')) return 'glassdoor';
    return 'unknown';
  }

  // Sleep helper
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Type text with human-like behavior
  async function typeText(element, text) {
    element.focus();
    element.value = '';
    
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(20 + Math.random() * 30);
    }
    
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Set value directly
  function setValue(element, value) {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Click element
  async function clickElement(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(100);
    element.click();
  }

  // Select dropdown option
  function selectOption(selectElement, value) {
    const options = selectElement.querySelectorAll('option');
    for (const option of options) {
      if (option.value.toLowerCase().includes(value.toLowerCase()) || 
          option.textContent.toLowerCase().includes(value.toLowerCase())) {
        selectElement.value = option.value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Select radio button by label text
  async function selectRadioByText(container, text) {
    const radios = container.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
      const label = radio.closest('label') || 
                    document.querySelector(`label[for="${radio.id}"]`) || 
                    radio.parentElement;
      if (label && label.textContent.toLowerCase().includes(text.toLowerCase())) {
        await clickElement(radio);
        return true;
      }
    }
    return false;
  }

  // Select checkbox by label text
  async function selectCheckboxByText(container, texts) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const textArr = Array.isArray(texts) ? texts : [texts];
    
    for (const checkbox of checkboxes) {
      const label = checkbox.closest('label') || 
                    document.querySelector(`label[for="${checkbox.id}"]`) || 
                    checkbox.parentElement;
      if (label) {
        for (const text of textArr) {
          if (label.textContent.toLowerCase().includes(text.toLowerCase()) && !checkbox.checked) {
            await clickElement(checkbox);
          }
        }
      }
    }
  }

  // Find question block by text
  function findQuestionByText(searchText) {
    const labels = document.querySelectorAll('label, h3, h4, legend, .question-text');
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(searchText.toLowerCase())) {
        return label.closest('li, fieldset, .application-question, .form-group, div');
      }
    }
    return null;
  }

  // Fill field by selector
  function fillBySelector(selector, value) {
    const element = document.querySelector(selector);
    if (element && value) {
      setValue(element, value);
      return true;
    }
    return false;
  }

  // Fill all basic fields
  async function fillBasicFields(profile) {
    const platform = detectPlatform();
    console.log(`🚀 Auto-filling ${platform} application...`);

    // Common field mappings for all platforms
    const fieldMappings = {
      // Lever
      'input[name="name"]': `${profile.firstName} ${profile.lastName}`,
      'input[name="email"]': profile.email,
      'input[name="phone"]': profile.phone,
      'input[name="location"]': profile.location,
      'input[name="org"]': profile.currentCompany,
      'input[name="urls[LinkedIn]"]': profile.linkedin,
      'input[name="urls[GitHub]"]': profile.github || profile.portfolio,
      'input[name="urls[Portfolio]"]': profile.portfolio,
      
      // Greenhouse
      '#first_name': profile.firstName,
      '#last_name': profile.lastName,
      '#email': profile.email,
      '#phone': profile.phone,
      'input[name="job_application[first_name]"]': profile.firstName,
      'input[name="job_application[last_name]"]': profile.lastName,
      'input[name="job_application[email]"]': profile.email,
      'input[name="job_application[phone]"]': profile.phone,
      
      // Workday
      'input[data-automation-id="firstName"]': profile.firstName,
      'input[data-automation-id="lastName"]': profile.lastName,
      'input[data-automation-id="email"]': profile.email,
      'input[data-automation-id="phone"]': profile.phone,
      
      // Glassdoor
      'input[name="firstName"]': profile.firstName,
      'input[name="lastName"]': profile.lastName,
      'input[name="emailAddress"]': profile.email,
      'input[name="phoneNumber"]': profile.phone,
      
      // Generic
      'input[type="email"]': profile.email,
      'input[type="tel"]': profile.phone,
      'input[placeholder*="email" i]': profile.email,
      'input[placeholder*="phone" i]': profile.phone,
      'input[placeholder*="linkedin" i]': profile.linkedin,
    };

    let filledCount = 0;

    for (const [selector, value] of Object.entries(fieldMappings)) {
      if (value && fillBySelector(selector, value)) {
        filledCount++;
        await sleep(50);
      }
    }

    return filledCount;
  }

  // Fill custom questions
  async function fillCustomQuestions(profile) {
    const defaultAnswers = {
      'notice period': profile.noticePeriod || '2 weeks',
      'start date': profile.startDate || 'Immediately',
      'ideal start': profile.startDate || 'Immediately',
      'salary': profile.expectedSalary || 'Negotiable',
      'expected salary': profile.expectedSalary || 'Negotiable',
      'salary range': profile.expectedSalary || 'Negotiable',
      'how did you hear': profile.hearAbout || 'Online Job Board',
      'hear about': profile.hearAbout || 'Online Job Board',
      'languages': 'english',
      'fluent': 'english',
      'visa': 'no',
      'require a visa': 'no',
      'sponsor': 'no',
      'authorized': 'yes',
      'legally authorized': 'yes',
      'open to working': 'yes',
      'willing to': 'yes',
      'coding language': profile.preferredLanguage || 'Python',
      'python or r': profile.preferredLanguage || 'Python',
      'consent': 'yes',
      'agree': 'yes',
      'retain': 'yes',
      'acknowledge': 'yes'
    };

    let filledCount = 0;

    for (const [pattern, answer] of Object.entries(defaultAnswers)) {
      const block = findQuestionByText(pattern);
      if (!block) continue;

      const radios = block.querySelectorAll('input[type="radio"]');
      const checkboxes = block.querySelectorAll('input[type="checkbox"]');
      const textInput = block.querySelector('input[type="text"], input:not([type]), textarea');
      const select = block.querySelector('select');

      // Check if already filled
      let isFilled = false;
      if (radios.length > 0) {
        isFilled = Array.from(radios).some(r => r.checked);
      } else if (textInput) {
        isFilled = textInput.value && textInput.value.trim();
      }
      
      if (isFilled) continue;

      if (radios.length > 0) {
        if (await selectRadioByText(block, answer)) filledCount++;
      } else if (checkboxes.length > 0) {
        await selectCheckboxByText(block, answer);
        filledCount++;
      } else if (select) {
        if (selectOption(select, answer)) filledCount++;
      } else if (textInput) {
        setValue(textInput, answer);
        filledCount++;
      }

      await sleep(100);
    }

    return filledCount;
  }

  // Handle consent checkboxes at the bottom
  async function handleConsent() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    let count = 0;
    
    for (const checkbox of checkboxes) {
      const container = checkbox.closest('label, div');
      if (container) {
        const text = container.textContent.toLowerCase();
        if ((text.includes('consent') || text.includes('agree') || 
             text.includes('acknowledge') || text.includes('confirm') ||
             text.includes('retain')) && !checkbox.checked) {
          await clickElement(checkbox);
          count++;
        }
      }
    }
    return count;
  }

  // Show notification overlay
  function showNotification(message, type = 'success') {
    const existing = document.querySelector('.auto-apply-notification');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = 'auto-apply-notification';
    div.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
      ${type === 'success' ? 'background: #10B981; color: white;' : 
        type === 'error' ? 'background: #EF4444; color: white;' :
        'background: #3B82F6; color: white;'}
    `;
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => div.remove(), 4000);
  }

  // Main fill function
  async function fillApplication(profile) {
    try {
      showNotification('🚀 Auto-filling application...', 'info');
      
      const basicCount = await fillBasicFields(profile);
      await sleep(300);
      
      const customCount = await fillCustomQuestions(profile);
      await sleep(200);
      
      const consentCount = await handleConsent();
      
      const total = basicCount + customCount + consentCount;
      showNotification(`✅ Filled ${total} fields! Please upload resume & review.`, 'success');
      
      return { success: true, filled: total };
    } catch (error) {
      console.error('Auto-fill error:', error);
      showNotification('❌ Error: ' + error.message, 'error');
      return { success: false, error: error.message };
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_APPLICATION') {
      fillApplication(message.profile).then(sendResponse);
      return true; // Keep channel open for async response
    }
    
    if (message.action === 'GET_PAGE_INFO') {
      sendResponse({
        platform: detectPlatform(),
        url: window.location.href,
        isApplicationPage: window.location.href.includes('/apply') || 
                          document.querySelector('form, input[type="file"]') !== null
      });
      return true;
    }
  });

  // Log when script loads
  console.log(`📋 Resume Auto Apply Agent loaded on ${detectPlatform()}`);
})();
