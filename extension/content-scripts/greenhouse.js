// Greenhouse ATS Content Script

class GreenhouseFormHandler {
  constructor() {
    this.filler = window.formAutoFiller;
    this.platform = 'greenhouse';
    this.init();
  }

  async init() {
    await this.filler.waitForElement('#application_form, .application-form, #application', 15000).catch(() => {});
    console.log('Greenhouse form handler initialized');
  }

  getFieldMappings() {
    return {
      firstName: ['#first_name', 'input[name="job_application[first_name]"]'],
      lastName: ['#last_name', 'input[name="job_application[last_name]"]'],
      email: ['#email', 'input[name="job_application[email]"]', 'input[type="email"]'],
      phone: ['#phone', 'input[name="job_application[phone]"]', 'input[type="tel"]'],
      location: ['#location', 'input[name="job_application[location]"]'],
      
      resume: ['#resume', 'input[name="job_application[resume]"]', 'input[data-source="paste"]'],
      coverLetter: ['#cover_letter', 'input[name="job_application[cover_letter]"]'],
      
      linkedin: ['input[name*="linkedin"]', '#job_application_answers_attributes_0_text_value'],
      website: ['input[name*="website"]', 'input[name*="portfolio"]'],
      
      // Greenhouse uses numbered custom questions
      currentCompany: ['#job_application_answers_attributes_1_text_value'],
      yearsExperience: ['#job_application_answers_attributes_2_text_value'],
      
      // Address fields
      address: ['#address', 'input[name*="address"]'],
      city: ['#city', 'input[name*="city"]'],
      state: ['#state', 'select[name*="state"]'],
      zip: ['#zip', 'input[name*="zip"]'],
      country: ['#country', 'select[name*="country"]']
    };
  }

  findElement(selectors) {
    if (!Array.isArray(selectors)) selectors = [selectors];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  async fillForm(formData) {
    const mappings = this.getFieldMappings();
    const results = { filled: [], failed: [], skipped: [] };

    try {
      // Handle standard fields
      for (const [fieldName, value] of Object.entries(formData)) {
        if (!value || fieldName === 'customQuestions') continue;

        const selectors = mappings[fieldName];
        if (!selectors) {
          const found = await this.findFieldByLabel(fieldName, value);
          if (!found) results.skipped.push(fieldName);
          else results.filled.push(fieldName);
          continue;
        }

        const element = this.findElement(selectors);
        if (!element) {
          results.failed.push({ field: fieldName, reason: 'Not found' });
          continue;
        }

        const success = await this.fillField(element, value, fieldName);
        if (success) results.filled.push(fieldName);
        else results.failed.push({ field: fieldName, reason: 'Fill failed' });

        await this.filler.sleep(100 + Math.random() * 100);
      }

      // Handle Greenhouse custom questions
      if (formData.customQuestions) {
        await this.handleCustomQuestions(formData.customQuestions, results);
      }

      // Handle any dropdowns
      await this.handleDropdowns(formData);

      return { success: true, results };
    } catch (error) {
      console.error('Greenhouse fill error:', error);
      return { success: false, error: error.message, results };
    }
  }

  async fillField(element, value, fieldName) {
    const tagName = element.tagName.toLowerCase();
    const inputType = element.type?.toLowerCase();

    try {
      if (tagName === 'input') {
        if (inputType === 'file') {
          if (typeof value === 'object' && value.data) {
            return await this.filler.uploadFile(element, value.data, value.name, value.mimeType);
          }
          // Handle Greenhouse's "paste" resume option
          const pasteArea = document.querySelector('.paste-area, [data-source="paste"]');
          if (pasteArea && typeof value === 'string') {
            await this.filler.typeText(pasteArea, value);
            return true;
          }
          return false;
        } else if (inputType === 'checkbox') {
          await this.filler.checkCheckbox(element, !!value);
          return true;
        } else if (inputType === 'radio') {
          await this.filler.selectRadio(element.name, value);
          return true;
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
      console.error(`Error filling ${fieldName}:`, error);
      return false;
    }
  }

  async findFieldByLabel(labelText, value) {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
        const forId = label.getAttribute('for');
        let input = forId ? document.getElementById(forId) : label.querySelector('input, textarea, select');
        if (input) {
          return await this.fillField(input, value, labelText);
        }
      }
    }
    return false;
  }

  async handleCustomQuestions(questions, results) {
    // Greenhouse custom questions are in fieldsets
    const questionSections = document.querySelectorAll('.field, .question-wrapper, fieldset');

    for (const section of questionSections) {
      const labelEl = section.querySelector('label, legend, .field-label');
      if (!labelEl) continue;
      
      const questionText = labelEl.textContent.toLowerCase();

      for (const [question, answer] of Object.entries(questions)) {
        if (questionText.includes(question.toLowerCase())) {
          const input = section.querySelector('input:not([type="hidden"]), textarea, select');
          if (input) {
            const success = await this.fillField(input, answer, question);
            if (success) results.filled.push(`custom:${question}`);
            else results.failed.push({ field: `custom:${question}`, reason: 'Fill failed' });
          }
        }
      }
    }
  }

  async handleDropdowns(formData) {
    // Greenhouse uses Select2 for some dropdowns
    const select2Dropdowns = document.querySelectorAll('.select2-container');
    
    for (const dropdown of select2Dropdowns) {
      const hiddenSelect = dropdown.previousElementSibling;
      if (!hiddenSelect || hiddenSelect.tagName !== 'SELECT') continue;
      
      const fieldName = hiddenSelect.name || hiddenSelect.id;
      let matchingValue = null;

      // Try to find matching form data
      for (const [key, value] of Object.entries(formData)) {
        if (fieldName.toLowerCase().includes(key.toLowerCase())) {
          matchingValue = value;
          break;
        }
      }

      if (matchingValue) {
        await this.filler.handleCustomDropdown(dropdown.parentElement, matchingValue);
        await this.filler.sleep(200);
      }
    }
  }

  async submitApplication() {
    try {
      const submitButton = document.querySelector(
        '#submit_app, button[type="submit"], input[type="submit"], .submit-application'
      );

      if (!submitButton) throw new Error('Submit button not found');

      // Check for errors
      const errors = document.querySelectorAll('.error, .field-error, .error-message');
      if (errors.length > 0) {
        return {
          success: false,
          error: 'Validation errors present',
          errors: Array.from(errors).map(e => e.textContent)
        };
      }

      await this.filler.clickElement(submitButton);
      await this.filler.sleep(3000);

      return this.filler.checkSubmissionStatus();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const greenhouseHandler = new GreenhouseFormHandler();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.action) {
      case 'FILL_FORM':
        return await greenhouseHandler.fillForm(message.formData);
      case 'SUBMIT_APPLICATION':
        return await greenhouseHandler.submitApplication();
      case 'UPLOAD_FILE':
        const mappings = greenhouseHandler.getFieldMappings();
        const fileInput = greenhouseHandler.findElement(mappings[message.fileType] || mappings.resume);
        if (fileInput) {
          const success = await greenhouseHandler.filler.uploadFile(
            fileInput, message.fileData, message.fileName, message.mimeType || 'application/pdf'
          );
          return { success };
        }
        return { success: false, error: 'File input not found' };
      default:
        return { handled: false };
    }
  };

  handler().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
  return true;
});

console.log('Greenhouse content script loaded');
