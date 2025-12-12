// Glassdoor Content Script

class GlassdoorFormHandler {
  constructor() {
    this.filler = window.formAutoFiller;
    this.platform = 'glassdoor';
    this.init();
  }

  async init() {
    await this.filler.sleep(1000);
    console.log('Glassdoor form handler initialized');
  }

  getFieldMappings() {
    return {
      firstName: ['input[name="firstName"]', '#firstName', 'input[aria-label*="First"]'],
      lastName: ['input[name="lastName"]', '#lastName', 'input[aria-label*="Last"]'],
      email: ['input[name="email"]', '#email', 'input[type="email"]'],
      phone: ['input[name="phone"]', '#phone', 'input[type="tel"]'],
      
      resume: ['input[name="resume"]', 'input[type="file"]', '#resume-upload'],
      coverLetter: ['input[name="coverLetter"]', '#coverLetter'],
      
      linkedin: ['input[name="linkedinUrl"]', 'input[placeholder*="LinkedIn"]'],
      currentCompany: ['input[name="currentCompany"]'],
      currentTitle: ['input[name="currentTitle"]'],
      
      // Location
      city: ['input[name="city"]'],
      state: ['select[name="state"]'],
      country: ['select[name="country"]']
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
    const results = { filled: [], failed: [], skipped: [] };

    try {
      const mappings = this.getFieldMappings();

      for (const [fieldName, value] of Object.entries(formData)) {
        if (!value || fieldName === 'customQuestions') continue;

        const selectors = mappings[fieldName];
        if (!selectors) {
          const found = await this.findFieldByLabel(fieldName, value);
          if (found) results.filled.push(fieldName);
          else results.skipped.push(fieldName);
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

        await this.filler.sleep(100);
      }

      if (formData.customQuestions) {
        await this.handleCustomQuestions(formData.customQuestions, results);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Glassdoor fill error:', error);
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
          return false;
        } else if (inputType === 'checkbox') {
          await this.filler.checkCheckbox(element, !!value);
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
    const questionSections = document.querySelectorAll('.question, .form-group, fieldset');

    for (const section of questionSections) {
      const labelEl = section.querySelector('label, legend, .question-text');
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

  async submitApplication() {
    try {
      const submitButton = document.querySelector(
        'button[type="submit"], input[type="submit"], .apply-button, [data-test="apply-button"]'
      );

      if (!submitButton) throw new Error('Submit button not found');

      await this.filler.clickElement(submitButton);
      await this.filler.sleep(3000);

      return this.filler.checkSubmissionStatus();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const glassdoorHandler = new GlassdoorFormHandler();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.action) {
      case 'FILL_FORM':
        return await glassdoorHandler.fillForm(message.formData);
      case 'SUBMIT_APPLICATION':
        return await glassdoorHandler.submitApplication();
      case 'UPLOAD_FILE':
        const fileInput = glassdoorHandler.findElement(glassdoorHandler.getFieldMappings().resume);
        if (fileInput) {
          const success = await glassdoorHandler.filler.uploadFile(
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

console.log('Glassdoor content script loaded');
