// Lever ATS Content Script
// Handles form filling specifically for jobs.lever.co

class LeverFormHandler {
  constructor() {
    this.filler = window.formAutoFiller;
    this.platform = 'lever';
    this.init();
  }

  async init() {
    // Wait for page to be fully loaded
    await this.waitForLeverForm();
    console.log('Lever form handler initialized');
  }

  async waitForLeverForm() {
    try {
      // Wait for the main application form container
      await this.filler.waitForElement('.application-form, #application-form, [data-qa="application-form"]', 15000);
      return true;
    } catch (error) {
      console.log('Lever form not found, might be job description page');
      return false;
    }
  }

  // Map common field names to Lever field selectors
  getFieldMappings() {
    return {
      // Personal Info
      firstName: ['input[name="name"]', 'input[name="cards[0][field0]"]', '#first-name-input'],
      lastName: ['input[name="cards[0][field1]"]', '#last-name-input'],
      fullName: ['input[name="name"]', 'input[placeholder*="name" i]'],
      email: ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="email" i]'],
      phone: ['input[name="phone"]', 'input[type="tel"]', 'input[placeholder*="phone" i]'],
      
      // Location
      location: ['input[name="location"]', 'input[placeholder*="location" i]', 'input[placeholder*="city" i]'],
      currentCompany: ['input[name="org"]', 'input[placeholder*="company" i]', 'input[placeholder*="organization" i]'],
      
      // URLs
      linkedin: ['input[name="urls[LinkedIn]"]', 'input[placeholder*="linkedin" i]'],
      github: ['input[name="urls[GitHub]"]', 'input[placeholder*="github" i]'],
      portfolio: ['input[name="urls[Portfolio]"]', 'input[placeholder*="portfolio" i]', 'input[placeholder*="website" i]'],
      twitter: ['input[name="urls[Twitter]"]', 'input[placeholder*="twitter" i]'],
      other: ['input[name="urls[Other]"]'],
      
      // Files
      resume: ['input[name="resume"]', 'input[type="file"][accept*="pdf"]', '.resume-upload input[type="file"]'],
      coverLetter: ['input[name="coverLetter"]', '.cover-letter-upload input[type="file"]'],
      
      // Additional
      comments: ['textarea[name="comments"]', 'textarea[placeholder*="additional" i]'],
      
      // Common questions
      howDidYouHear: ['select[name*="how"]', 'select[name*="source"]'],
      yearsExperience: ['input[name*="experience"]', 'select[name*="experience"]'],
      salary: ['input[name*="salary"]', 'input[placeholder*="salary" i]'],
      startDate: ['input[name*="start"]', 'input[type="date"]'],
      sponsorship: ['input[name*="sponsor"]', 'select[name*="sponsor"]'],
      authorized: ['input[name*="authorized"]', 'select[name*="authorized"]']
    };
  }

  // Find element by trying multiple selectors
  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  // Fill the Lever application form
  async fillForm(formData) {
    const mappings = this.getFieldMappings();
    const results = { filled: [], failed: [], skipped: [] };

    try {
      // Fill each field from formData
      for (const [fieldName, value] of Object.entries(formData)) {
        if (!value) {
          results.skipped.push(fieldName);
          continue;
        }

        const selectors = mappings[fieldName];
        if (!selectors) {
          // Try to find field by label or placeholder
          const found = await this.findFieldByLabel(fieldName, value);
          if (found) {
            results.filled.push(fieldName);
          } else {
            results.skipped.push(fieldName);
          }
          continue;
        }

        const element = this.findElement(selectors);
        if (!element) {
          results.failed.push({ field: fieldName, reason: 'Element not found' });
          continue;
        }

        // Fill based on element type
        const success = await this.fillField(element, value, fieldName);
        if (success) {
          results.filled.push(fieldName);
        } else {
          results.failed.push({ field: fieldName, reason: 'Failed to fill' });
        }

        // Small delay between fields
        await this.filler.sleep(100 + Math.random() * 100);
      }

      // Handle any custom questions
      if (formData.customQuestions) {
        await this.handleCustomQuestions(formData.customQuestions, results);
      }

      this.filler.showNotification(`Filled ${results.filled.length} fields`, 'success');
      return { success: true, results };

    } catch (error) {
      console.error('Error filling Lever form:', error);
      this.filler.showNotification('Error filling form', 'error');
      return { success: false, error: error.message, results };
    }
  }

  // Fill individual field based on type
  async fillField(element, value, fieldName) {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase();

    try {
      if (tagName === 'input') {
        if (inputType === 'file') {
          // Handle file upload
          if (typeof value === 'object' && value.data) {
            return await this.filler.uploadFile(element, value.data, value.name, value.mimeType);
          }
          return false;
        } else if (inputType === 'checkbox') {
          await this.filler.checkCheckbox(element, value === true || value === 'yes');
          return true;
        } else if (inputType === 'radio') {
          await this.filler.selectRadio(element.name, value);
          return true;
        } else {
          // Text, email, tel, url, etc.
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

  // Find field by its label text
  async findFieldByLabel(labelText, value) {
    const labels = document.querySelectorAll('label');
    
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
        // Find associated input
        const forId = label.getAttribute('for');
        let input = null;
        
        if (forId) {
          input = document.getElementById(forId);
        } else {
          input = label.querySelector('input, textarea, select');
        }

        if (input) {
          return await this.fillField(input, value, labelText);
        }
      }
    }

    return false;
  }

  // Handle custom questions (Lever's additional questions)
  async handleCustomQuestions(questions, results) {
    // Find all question containers
    const questionContainers = document.querySelectorAll('.application-question, [data-qa*="question"], .custom-question');

    for (const container of questionContainers) {
      const questionText = container.querySelector('label, .question-text, h3, h4')?.textContent?.toLowerCase() || '';
      
      for (const [question, answer] of Object.entries(questions)) {
        if (questionText.includes(question.toLowerCase())) {
          const input = container.querySelector('input, textarea, select');
          if (input) {
            const success = await this.fillField(input, answer, question);
            if (success) {
              results.filled.push(`custom:${question}`);
            } else {
              results.failed.push({ field: `custom:${question}`, reason: 'Failed to fill' });
            }
          }
          break;
        }
      }
    }
  }

  // Handle Lever's multi-step form (if applicable)
  async handleMultiStepForm() {
    const steps = document.querySelectorAll('.form-step, .application-step');
    if (steps.length <= 1) return;

    for (let i = 0; i < steps.length; i++) {
      const nextButton = document.querySelector('.next-step, [data-qa="next"], button[type="button"]:not([type="submit"])');
      if (nextButton && !nextButton.disabled) {
        await this.filler.clickElement(nextButton);
        await this.filler.sleep(500);
      }
    }
  }

  // Submit the application
  async submitApplication() {
    try {
      // Look for submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        '.postings-btn-submit',
        '[data-qa="submit"]',
        'button:contains("Submit")',
        'button:contains("Apply")'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = document.querySelector(selector);
        if (submitButton) break;
      }

      // If not found by selector, try by text
      if (!submitButton) {
        const buttons = document.querySelectorAll('button');
        for (const button of buttons) {
          const text = button.textContent.toLowerCase();
          if (text.includes('submit') || text.includes('apply')) {
            submitButton = button;
            break;
          }
        }
      }

      if (!submitButton) {
        throw new Error('Submit button not found');
      }

      // Check for any validation errors before submitting
      const errors = document.querySelectorAll('.error, .error-message, [class*="error"]:not([class*="no-error"])');
      if (errors.length > 0) {
        return {
          success: false,
          error: 'Form has validation errors',
          errors: Array.from(errors).map(e => e.textContent)
        };
      }

      // Click submit
      await this.filler.clickElement(submitButton);
      
      // Wait for response
      await this.filler.sleep(3000);

      // Check submission status
      const status = this.filler.checkSubmissionStatus();
      
      if (status.success) {
        this.filler.showNotification('Application submitted successfully!', 'success');
      } else {
        this.filler.showNotification('Submission may have issues', 'error');
      }

      return status;

    } catch (error) {
      console.error('Error submitting application:', error);
      return { success: false, error: error.message };
    }
  }

  // Navigate to apply page from job listing
  async navigateToApply() {
    const applyButton = document.querySelector('a.postings-btn, [data-qa="apply-button"], a[href*="apply"]');
    if (applyButton) {
      await this.filler.clickElement(applyButton);
      await this.filler.sleep(1000);
      return true;
    }
    return false;
  }

  // Get current form state
  getFormState() {
    const fields = this.filler.getFormFields();
    const filled = fields.filter(f => {
      if (f.element.value) return true;
      if (f.element.checked) return true;
      return false;
    });

    return {
      totalFields: fields.length,
      filledFields: filled.length,
      platform: this.platform,
      url: window.location.href
    };
  }
}

// Initialize Lever handler
const leverHandler = new LeverFormHandler();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
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
          const success = await leverHandler.filler.uploadFile(
            fileInput,
            message.fileData,
            message.fileName,
            message.mimeType || 'application/pdf'
          );
          return { success };
        }
        return { success: false, error: 'File input not found' };

      default:
        // Pass to common handler
        return { handled: false };
    }
  };

  handler().then(sendResponse).catch(error => {
    sendResponse({ success: false, error: error.message });
  });

  return true;
});

console.log('Lever content script loaded for:', window.location.href);
