// Lever ATS Content Script - Updated for 2026
// Handles form filling specifically for jobs.lever.co

class LeverFormHandler {
  constructor() {
    this.filler = window.formAutoFiller;
    this.platform = 'lever';
    this.init();
  }

  async init() {
    await this.waitForLeverForm();
    console.log('Lever form handler initialized');
    this.reportStatus();
  }

  async waitForLeverForm() {
    try {
      await this.filler.waitForElement('.application-form, #application-form, .postings-form, .main-content', 15000);
      return true;
    } catch (error) {
      console.log('Lever form not found, might be job description page');
      return false;
    }
  }

  reportStatus() {
    chrome.runtime.sendMessage({
      type: 'PAGE_STATUS',
      data: {
        platform: 'lever',
        url: window.location.href,
        isApplicationPage: window.location.href.includes('/apply'),
        formFound: !!document.querySelector('.application-form, .postings-form, form')
      }
    });
  }

  // Updated field mappings for current Lever forms
  getFieldMappings() {
    return {
      fullName: [
        'input[name="name"]',
        'input[placeholder*="name" i]',
        '.application-question input[type="text"]'
      ],
      email: [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="email" i]'
      ],
      phone: [
        'input[name="phone"]',
        'input[type="tel"]',
        'input[placeholder*="phone" i]'
      ],
      location: [
        'input[name="location"]',
        'input[name*="location" i]',
        'input[placeholder*="location" i]',
        'input[placeholder*="city" i]'
      ],
      currentCompany: [
        'input[name="org"]',
        'input[name*="company" i]',
        'input[placeholder*="company" i]'
      ],
      linkedin: [
        'input[name="urls[LinkedIn]"]',
        'input[name*="linkedin" i]',
        'input[placeholder*="linkedin" i]'
      ],
      github: [
        'input[name="urls[GitHub]"]',
        'input[name*="github" i]',
        'input[placeholder*="github" i]'
      ],
      portfolio: [
        'input[name="urls[Portfolio]"]',
        'input[name*="portfolio" i]',
        'input[placeholder*="website" i]'
      ],
      resume: [
        'input[name="resume"]',
        'input[type="file"][accept*="pdf"]',
        '.resume-upload input[type="file"]',
        'input[type="file"]'
      ],
      coverLetter: [
        'input[name="coverLetter"]',
        '.cover-letter-upload input[type="file"]'
      ],
      comments: [
        'textarea[name="comments"]',
        'textarea[placeholder*="additional" i]'
      ]
    };
  }

  getAllQuestionBlocks() {
    const blocks = [];
    const selectors = [
      '.application-question',
      '.application-form .application-field',
      '[data-qa*="question"]',
      '.custom-question',
      '.postings-form > ul > li',
      'fieldset',
      '.application-form > div > div'
    ];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (!blocks.includes(el) && el.querySelector('label, .question-label, h3, legend')) {
          blocks.push(el);
        }
      });
    }
    return blocks;
  }

  getQuestionText(block) {
    const labelEl = block.querySelector('label, .question-label, h3, h4, legend, .field-label');
    return labelEl ? labelEl.textContent.trim().toLowerCase() : '';
  }

  findElement(selectors) {
    if (!Array.isArray(selectors)) selectors = [selectors];
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element && this.isVisible(element)) return element;
      } catch (e) {}
    }
    return null;
  }

  isVisible(element) {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  async fillForm(formData) {
    const mappings = this.getFieldMappings();
    const results = { filled: [], failed: [], skipped: [] };

    try {
      console.log('Starting Lever form fill with data:', Object.keys(formData));
      
      for (const [fieldName, value] of Object.entries(formData)) {
        if (!value || fieldName === 'customQuestions') {
          if (!value) results.skipped.push(fieldName);
          continue;
        }

        const selectors = mappings[fieldName];
        if (selectors) {
          const element = this.findElement(selectors);
          if (element) {
            const success = await this.fillField(element, value, fieldName);
            if (success) {
              results.filled.push(fieldName);
            } else {
              results.failed.push({ field: fieldName, reason: 'Failed to fill' });
            }
            await this.filler.sleep(100 + Math.random() * 100);
            continue;
          }
        }

        const found = await this.findAndFillByLabel(fieldName, value);
        if (found) {
          results.filled.push(fieldName);
        } else {
          results.skipped.push(fieldName);
        }
      }

      if (formData.customQuestions) {
        await this.handleCustomQuestions(formData.customQuestions, results);
      }

      await this.autoFillRemainingQuestions(formData, results);

      this.filler.showNotification(`Filled ${results.filled.length} fields`, 'success');
      return { success: true, results };

    } catch (error) {
      console.error('Error filling Lever form:', error);
      this.filler.showNotification('Error filling form: ' + error.message, 'error');
      return { success: false, error: error.message, results };
    }
  }

  async fillField(element, value, fieldName) {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase();

    try {
      console.log(`Filling ${fieldName}: ${tagName}[${inputType}]`);

      if (tagName === 'input') {
        if (inputType === 'file') {
          if (typeof value === 'object' && value.data) {
            return await this.filler.uploadFile(element, value.data, value.name, value.mimeType);
          }
          return false;
        } else if (inputType === 'checkbox') {
          await this.filler.checkCheckbox(element, value === true || value === 'yes');
          return true;
        } else if (inputType === 'radio') {
          return await this.selectRadioByValue(element.name, value);
        } else {
          await this.filler.typeText(element, value);
          return true;
        }
      } else if (tagName === 'textarea') {
        await this.filler.typeText(element, value, 30);
        return true;
      } else if (tagName === 'select') {
        return await this.filler.selectOption(element, value);
      }
      return false;
    } catch (error) {
      console.error(`Error filling field ${fieldName}:`, error);
      return false;
    }
  }

  async findAndFillByLabel(labelText, value) {
    const normalizedLabel = labelText.toLowerCase().replace(/[_-]/g, ' ');
    const labels = document.querySelectorAll('label');
    
    for (const label of labels) {
      const labelContent = label.textContent.toLowerCase();
      if (labelContent.includes(normalizedLabel)) {
        const forId = label.getAttribute('for');
        let input = forId ? document.getElementById(forId) : null;
        
        if (!input) input = label.querySelector('input, textarea, select');
        if (!input) {
          const parent = label.closest('.application-question, .field-container, .form-group, li');
          if (parent) input = parent.querySelector('input:not([type="hidden"]), textarea, select');
        }

        if (input && this.isVisible(input)) {
          return await this.fillField(input, value, labelText);
        }
      }
    }
    return false;
  }

  async selectRadioByValue(name, value) {
    const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
    const normalizedValue = String(value).toLowerCase();
    
    for (const radio of radios) {
      if (radio.value.toLowerCase() === normalizedValue) {
        await this.filler.clickElement(radio);
        return true;
      }
      
      const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`) || radio.parentElement;
      if (label && label.textContent.toLowerCase().includes(normalizedValue)) {
        await this.filler.clickElement(radio);
        return true;
      }
    }
    return false;
  }

  async selectCheckboxByLabel(container, values) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const normalizedValues = Array.isArray(values) ? values.map(v => v.toLowerCase()) : [String(values).toLowerCase()];
    let filled = false;
    
    for (const checkbox of checkboxes) {
      const label = checkbox.closest('label') || document.querySelector(`label[for="${checkbox.id}"]`) || checkbox.parentElement;
      if (label) {
        const labelText = label.textContent.toLowerCase();
        for (const val of normalizedValues) {
          if (labelText.includes(val) && !checkbox.checked) {
            await this.filler.clickElement(checkbox);
            filled = true;
          }
        }
      }
    }
    return filled;
  }

  async handleCustomQuestions(questions, results) {
    const questionBlocks = this.getAllQuestionBlocks();
    console.log(`Found ${questionBlocks.length} question blocks`);

    for (const block of questionBlocks) {
      const questionText = this.getQuestionText(block);
      if (!questionText) continue;

      for (const [question, answer] of Object.entries(questions)) {
        const normalizedQuestion = question.toLowerCase().replace(/[_-]/g, ' ');
        
        if (questionText.includes(normalizedQuestion) || normalizedQuestion.includes(questionText.slice(0, 20))) {
          const textInput = block.querySelector('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type])');
          const textarea = block.querySelector('textarea');
          const select = block.querySelector('select');
          const radios = block.querySelectorAll('input[type="radio"]');
          const checkboxes = block.querySelectorAll('input[type="checkbox"]');

          let success = false;

          if (radios.length > 0) {
            success = await this.selectRadioInBlock(block, answer);
          } else if (checkboxes.length > 0) {
            success = await this.selectCheckboxByLabel(block, answer);
          } else if (select) {
            success = await this.filler.selectOption(select, answer);
          } else if (textarea) {
            success = await this.fillField(textarea, answer, question);
          } else if (textInput) {
            success = await this.fillField(textInput, answer, question);
          }

          if (success) {
            results.filled.push(`custom:${question}`);
          } else {
            results.failed.push({ field: `custom:${question}`, reason: 'Failed to fill' });
          }
          break;
        }
      }
    }
  }

  async selectRadioInBlock(block, value) {
    const radios = block.querySelectorAll('input[type="radio"]');
    const normalizedValue = String(value).toLowerCase();
    
    for (const radio of radios) {
      const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`) || radio.parentElement;
      const labelText = label ? label.textContent.toLowerCase() : '';
      const radioValue = radio.value.toLowerCase();
      
      if (radioValue.includes(normalizedValue) || labelText.includes(normalizedValue) || normalizedValue.includes(labelText.trim())) {
        await this.filler.clickElement(radio);
        return true;
      }
    }
    
    for (const radio of radios) {
      const label = radio.closest('label') || radio.parentElement;
      const labelText = label ? label.textContent.toLowerCase() : '';
      const keywords = normalizedValue.split(/\s+/);
      const matches = keywords.filter(kw => labelText.includes(kw));
      
      if (matches.length >= Math.ceil(keywords.length / 2)) {
        await this.filler.clickElement(radio);
        return true;
      }
    }
    return false;
  }

  async autoFillRemainingQuestions(formData, results) {
    const questionBlocks = this.getAllQuestionBlocks();
    
    const defaultAnswers = {
      'notice period': formData.noticePeriod || '2 weeks',
      'start date': formData.startDate || 'Immediately',
      'ideal start': formData.startDate || 'Immediately',
      'salary': formData.expectedSalary || formData.salary || '$75,000 - $85,000',
      'expected salary': formData.expectedSalary || formData.salary || '$75,000 - $85,000',
      'salary range': formData.expectedSalary || formData.salary || '$75,000 - $85,000',
      'how did you hear': formData.hearAbout || 'Online Job Board',
      'hear about': formData.hearAbout || 'Online Job Board',
      'languages': formData.languages || 'English',
      'fluent': formData.languages || 'english',
      'visa': 'No, I am an American Citizen or Permanent Resident',
      'require a visa': 'No, I am an American Citizen or Permanent Resident',
      'sponsor': 'No',
      'authorized': 'Yes',
      'open to working': 'Yes',
      'coding language': formData.preferredLanguage || 'Python',
      'preferred coding': formData.preferredLanguage || 'Python',
      'python or r': formData.preferredLanguage || 'Python',
      'consent': 'Yes',
      'agree': 'Yes',
      'retain': 'Yes'
    };

    for (const block of questionBlocks) {
      const questionText = this.getQuestionText(block);
      if (!questionText) continue;

      const inputs = block.querySelectorAll('input:not([type="hidden"]), textarea, select');
      let isFilled = false;
      
      for (const input of inputs) {
        if (input.type === 'radio' || input.type === 'checkbox') {
          if (input.checked) isFilled = true;
        } else if (input.value && input.value.trim()) {
          isFilled = true;
        }
      }
      
      if (isFilled) continue;

      for (const [pattern, answer] of Object.entries(defaultAnswers)) {
        if (questionText.includes(pattern)) {
          const radios = block.querySelectorAll('input[type="radio"]');
          const checkboxes = block.querySelectorAll('input[type="checkbox"]');
          const textInput = block.querySelector('input[type="text"], input:not([type]), textarea');
          const select = block.querySelector('select');

          if (radios.length > 0) {
            await this.selectRadioInBlock(block, answer);
            results.filled.push(`auto:${pattern}`);
          } else if (checkboxes.length > 0) {
            await this.selectCheckboxByLabel(block, answer);
            results.filled.push(`auto:${pattern}`);
          } else if (select) {
            await this.filler.selectOption(select, answer);
            results.filled.push(`auto:${pattern}`);
          } else if (textInput) {
            await this.filler.typeText(textInput, String(answer));
            results.filled.push(`auto:${pattern}`);
          }
          break;
        }
      }
    }
  }

  async handleConsentCheckbox() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    
    for (const checkbox of checkboxes) {
      const container = checkbox.closest('label, .checkbox-container, div');
      if (container) {
        const text = container.textContent.toLowerCase();
        if ((text.includes('consent') || text.includes('agree') || text.includes('acknowledge') || text.includes('retain')) && !checkbox.checked) {
          await this.filler.clickElement(checkbox);
          return true;
        }
      }
    }
    return false;
  }

  async submitApplication() {
    try {
      await this.handleConsentCheckbox();
      await this.filler.sleep(500);

      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '.postings-btn-submit',
        '[data-qa="submit"]',
        'button.postings-btn'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = document.querySelector(selector);
        if (submitButton && this.isVisible(submitButton)) break;
      }

      if (!submitButton) {
        const buttons = document.querySelectorAll('button, input[type="button"]');
        for (const button of buttons) {
          const text = button.textContent.toLowerCase();
          if ((text.includes('submit') || text.includes('apply')) && this.isVisible(button)) {
            submitButton = button;
            break;
          }
        }
      }

      if (!submitButton) throw new Error('Submit button not found');

      const errors = document.querySelectorAll('.error:not(:empty), .error-message:not(:empty)');
      const visibleErrors = Array.from(errors).filter(e => this.isVisible(e) && e.textContent.trim());
      
      if (visibleErrors.length > 0) {
        return { success: false, error: 'Form has validation errors', errors: visibleErrors.map(e => e.textContent.trim()) };
      }

      console.log('Clicking submit button...');
      await this.filler.clickElement(submitButton);
      await this.filler.sleep(3000);

      const status = this.checkSubmissionStatus();
      
      if (status.success) {
        this.filler.showNotification('Application submitted successfully!', 'success');
      } else if (status.needsVerification) {
        this.filler.showNotification('Human verification required', 'warning');
      } else {
        this.filler.showNotification('Submission may have issues', 'error');
      }
      return status;

    } catch (error) {
      console.error('Error submitting application:', error);
      return { success: false, error: error.message };
    }
  }

  checkSubmissionStatus() {
    const successIndicators = ['.success-message', '.application-success', '[data-qa="application-success"]', '.thank-you', '.confirmation'];
    for (const selector of successIndicators) {
      const el = document.querySelector(selector);
      if (el && this.isVisible(el)) return { success: true, message: el.textContent };
    }

    if (window.location.href.includes('thank') || window.location.href.includes('success') || window.location.href.includes('confirm')) {
      return { success: true };
    }

    const captchaIndicators = ['iframe[src*="captcha"]', 'iframe[src*="recaptcha"]', 'iframe[src*="hcaptcha"]', '.g-recaptcha', '.h-captcha', '[data-sitekey]'];
    for (const selector of captchaIndicators) {
      const el = document.querySelector(selector);
      if (el && this.isVisible(el)) return { success: false, needsVerification: true, type: 'captcha' };
    }

    const errorIndicators = ['.error-message', '.form-error'];
    for (const selector of errorIndicators) {
      const el = document.querySelector(selector);
      if (el && this.isVisible(el) && el.textContent.trim()) return { success: false, error: el.textContent.trim() };
    }

    return { success: false, status: 'unknown' };
  }

  async navigateToApply() {
    const applySelectors = ['a.postings-btn', 'a[href*="/apply"]', '[data-qa="apply-button"]'];
    for (const selector of applySelectors) {
      const button = document.querySelector(selector);
      if (button && this.isVisible(button)) {
        await this.filler.clickElement(button);
        await this.filler.sleep(1000);
        return true;
      }
    }

    const links = document.querySelectorAll('a');
    for (const link of links) {
      if (link.textContent.toLowerCase().includes('apply') && link.href.includes('/apply')) {
        await this.filler.clickElement(link);
        await this.filler.sleep(1000);
        return true;
      }
    }
    return false;
  }

  getFormState() {
    const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
    let total = 0, filled = 0;

    for (const input of inputs) {
      if (!this.isVisible(input)) continue;
      total++;
      if (input.type === 'radio' || input.type === 'checkbox') {
        if (input.checked) filled++;
      } else if (input.value && input.value.trim()) {
        filled++;
      }
    }

    return {
      totalFields: total,
      filledFields: filled,
      percentComplete: total > 0 ? Math.round((filled / total) * 100) : 0,
      platform: this.platform,
      url: window.location.href,
      isApplicationPage: window.location.href.includes('/apply')
    };
  }
}

const leverHandler = new LeverFormHandler();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    console.log('Lever handler received message:', message.action);
    
    switch (message.action) {
      case 'FILL_FORM':
        return await leverHandler.fillForm(message.formData);
      case 'SUBMIT_APPLICATION':
        return await leverHandler.submitApplication();
      case 'NAVIGATE_TO_APPLY':
        return await leverHandler.navigateToApply();
      case 'GET_FORM_STATE':
        return leverHandler.getFormState();
      case 'UPLOAD_FILE':
        const mappings = leverHandler.getFieldMappings();
        const selectors = mappings[message.fileType] || mappings.resume;
        const fileInput = leverHandler.findElement(selectors);
        if (fileInput) {
          const success = await leverHandler.filler.uploadFile(fileInput, message.fileData, message.fileName, message.mimeType || 'application/pdf');
          return { success };
        }
        return { success: false, error: 'File input not found' };
      case 'HANDLE_CONSENT':
        return { success: await leverHandler.handleConsentCheckbox() };
      case 'CHECK_STATUS':
        return leverHandler.checkSubmissionStatus();
      default:
        return { handled: false };
    }
  };

  handler().then(sendResponse).catch(error => {
    console.error('Handler error:', error);
    sendResponse({ success: false, error: error.message });
  });
  return true;
});

console.log('Lever content script loaded for:', window.location.href);
