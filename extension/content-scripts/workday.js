// Workday ATS Content Script

class WorkdayFormHandler {
  constructor() {
    this.filler = window.formAutoFiller;
    this.platform = 'workday';
    this.init();
  }

  async init() {
    // Workday uses a lot of dynamic loading
    await this.filler.sleep(2000);
    console.log('Workday form handler initialized');
  }

  // Workday uses data-automation-id attributes
  getFieldMappings() {
    return {
      email: ['[data-automation-id="email"]', 'input[aria-label*="Email"]'],
      password: ['[data-automation-id="password"]', 'input[type="password"]'],
      firstName: ['[data-automation-id="legalNameSection_firstName"]', 'input[aria-label*="First Name"]'],
      lastName: ['[data-automation-id="legalNameSection_lastName"]', 'input[aria-label*="Last Name"]'],
      phone: ['[data-automation-id="phone-number"]', 'input[aria-label*="Phone"]'],
      address: ['[data-automation-id="addressSection_addressLine1"]', 'input[aria-label*="Address"]'],
      city: ['[data-automation-id="addressSection_city"]'],
      state: ['[data-automation-id="addressSection_countryRegion"]'],
      postalCode: ['[data-automation-id="addressSection_postalCode"]'],
      country: ['[data-automation-id="addressSection_country"]'],
      
      resume: ['[data-automation-id="file-upload-input-ref"]', 'input[type="file"]'],
      
      // Work Experience
      jobTitle: ['[data-automation-id="jobTitle"]'],
      company: ['[data-automation-id="company"]'],
      startDate: ['[data-automation-id="startDate"]'],
      endDate: ['[data-automation-id="endDate"]'],
      
      // Education
      school: ['[data-automation-id="school"]'],
      degree: ['[data-automation-id="degree"]'],
      fieldOfStudy: ['[data-automation-id="fieldOfStudy"]'],
      
      // Links
      linkedin: ['[data-automation-id="linkedinQuestion"]', 'input[aria-label*="LinkedIn"]'],
      website: ['[data-automation-id="websiteQuestion"]']
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
      // Wait for Workday's dynamic content
      await this.waitForWorkdayForm();

      const mappings = this.getFieldMappings();

      for (const [fieldName, value] of Object.entries(formData)) {
        if (!value || fieldName === 'customQuestions' || fieldName === 'workExperience' || fieldName === 'education') {
          continue;
        }

        const selectors = mappings[fieldName];
        if (!selectors) {
          const found = await this.findByAriaLabel(fieldName, value);
          if (found) results.filled.push(fieldName);
          else results.skipped.push(fieldName);
          continue;
        }

        const element = this.findElement(selectors);
        if (!element) {
          results.failed.push({ field: fieldName, reason: 'Not found' });
          continue;
        }

        const success = await this.fillWorkdayField(element, value, fieldName);
        if (success) results.filled.push(fieldName);
        else results.failed.push({ field: fieldName, reason: 'Fill failed' });

        await this.filler.sleep(150);
      }

      // Handle work experience sections
      if (formData.workExperience) {
        await this.fillWorkExperience(formData.workExperience, results);
      }

      // Handle education sections
      if (formData.education) {
        await this.fillEducation(formData.education, results);
      }

      // Handle custom questions
      if (formData.customQuestions) {
        await this.handleCustomQuestions(formData.customQuestions, results);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Workday fill error:', error);
      return { success: false, error: error.message, results };
    }
  }

  async waitForWorkdayForm() {
    // Workday loads content dynamically
    const selectors = [
      '[data-automation-id="jobPostingPage"]',
      '[data-automation-id="applyManually"]',
      '.css-1dbjc4n' // Common Workday container
    ];

    for (const selector of selectors) {
      try {
        await this.filler.waitForElement(selector, 5000);
        return;
      } catch {
        continue;
      }
    }
  }

  async fillWorkdayField(element, value, fieldName) {
    const tagName = element.tagName.toLowerCase();
    
    try {
      // Workday uses custom inputs
      const isWorkdayInput = element.closest('[data-automation-id]');
      
      if (tagName === 'input') {
        if (element.type === 'file') {
          if (typeof value === 'object' && value.data) {
            return await this.filler.uploadFile(element, value.data, value.name, value.mimeType);
          }
          return false;
        } else if (element.type === 'checkbox') {
          await this.filler.checkCheckbox(element, !!value);
          return true;
        } else {
          // Workday inputs need special handling
          element.focus();
          await this.filler.sleep(100);
          
          // Clear existing value
          element.value = '';
          element.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Type new value
          await this.filler.typeText(element, value);
          return true;
        }
      } else if (tagName === 'textarea') {
        await this.filler.typeText(element, value, 30);
        return true;
      } else if (element.getAttribute('role') === 'combobox' || element.closest('[data-automation-id*="dropdown"]')) {
        return await this.handleWorkdayDropdown(element, value);
      }

      // Try clicking and typing for custom Workday components
      await this.filler.clickElement(element);
      await this.filler.sleep(100);
      
      const inputInside = element.querySelector('input, textarea');
      if (inputInside) {
        await this.filler.typeText(inputInside, value);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error filling Workday field ${fieldName}:`, error);
      return false;
    }
  }

  async handleWorkdayDropdown(element, value) {
    try {
      // Click to open dropdown
      await this.filler.clickElement(element);
      await this.filler.sleep(300);

      // Look for dropdown options
      const options = document.querySelectorAll('[data-automation-id*="promptOption"], [role="option"], .css-1dbjc4n[data-automation-id]');
      
      for (const option of options) {
        if (option.textContent.toLowerCase().includes(value.toLowerCase())) {
          await this.filler.clickElement(option);
          return true;
        }
      }

      // Try typing to filter
      const searchInput = document.querySelector('[data-automation-id*="searchBox"] input, [role="combobox"] input');
      if (searchInput) {
        await this.filler.typeText(searchInput, value);
        await this.filler.sleep(500);
        
        // Click first matching option
        const filteredOption = document.querySelector('[data-automation-id*="promptOption"], [role="option"]');
        if (filteredOption) {
          await this.filler.clickElement(filteredOption);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Dropdown handling error:', error);
      return false;
    }
  }

  async findByAriaLabel(labelText, value) {
    const elements = document.querySelectorAll(`[aria-label*="${labelText}" i], input[placeholder*="${labelText}" i]`);
    for (const element of elements) {
      if (await this.fillWorkdayField(element, value, labelText)) {
        return true;
      }
    }
    return false;
  }

  async fillWorkExperience(experiences, results) {
    for (const exp of experiences) {
      // Click "Add Work Experience" if needed
      const addButton = document.querySelector('[data-automation-id="Add Work Experience"], button[aria-label*="Add Work"]');
      if (addButton) {
        await this.filler.clickElement(addButton);
        await this.filler.sleep(500);
      }

      // Fill experience fields
      const fields = [
        ['jobTitle', exp.title],
        ['company', exp.company],
        ['startDate', exp.startDate],
        ['endDate', exp.endDate]
      ];

      for (const [field, value] of fields) {
        if (value) {
          const element = this.findElement(this.getFieldMappings()[field]);
          if (element) {
            await this.fillWorkdayField(element, value, field);
            await this.filler.sleep(100);
          }
        }
      }
    }
  }

  async fillEducation(educations, results) {
    for (const edu of educations) {
      const addButton = document.querySelector('[data-automation-id="Add Education"], button[aria-label*="Add Education"]');
      if (addButton) {
        await this.filler.clickElement(addButton);
        await this.filler.sleep(500);
      }

      const fields = [
        ['school', edu.school],
        ['degree', edu.degree],
        ['fieldOfStudy', edu.fieldOfStudy]
      ];

      for (const [field, value] of fields) {
        if (value) {
          const element = this.findElement(this.getFieldMappings()[field]);
          if (element) {
            await this.fillWorkdayField(element, value, field);
            await this.filler.sleep(100);
          }
        }
      }
    }
  }

  async handleCustomQuestions(questions, results) {
    // Find question containers
    const questionSections = document.querySelectorAll('[data-automation-id*="question"], .question-container');

    for (const section of questionSections) {
      const labelEl = section.querySelector('label, [data-automation-id*="label"]');
      if (!labelEl) continue;

      const questionText = labelEl.textContent.toLowerCase();

      for (const [question, answer] of Object.entries(questions)) {
        if (questionText.includes(question.toLowerCase())) {
          const input = section.querySelector('input, textarea, [role="combobox"]');
          if (input) {
            await this.fillWorkdayField(input, answer, question);
            results.filled.push(`custom:${question}`);
          }
        }
      }
    }
  }

  async submitApplication() {
    try {
      // Workday has multiple submit buttons
      const submitSelectors = [
        '[data-automation-id="bottom-navigation-next-button"]',
        '[data-automation-id="submit"]',
        'button[type="submit"]',
        '[aria-label="Submit"]'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = document.querySelector(selector);
        if (submitButton) break;
      }

      if (!submitButton) throw new Error('Submit button not found');

      await this.filler.clickElement(submitButton);
      await this.filler.sleep(3000);

      return this.filler.checkSubmissionStatus();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Navigate through Workday's multi-page application
  async navigateNext() {
    const nextButton = document.querySelector('[data-automation-id="bottom-navigation-next-button"]');
    if (nextButton) {
      await this.filler.clickElement(nextButton);
      await this.filler.sleep(1000);
      return true;
    }
    return false;
  }
}

const workdayHandler = new WorkdayFormHandler();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = async () => {
    switch (message.action) {
      case 'FILL_FORM':
        return await workdayHandler.fillForm(message.formData);
      case 'SUBMIT_APPLICATION':
        return await workdayHandler.submitApplication();
      case 'NAVIGATE_NEXT':
        return { success: await workdayHandler.navigateNext() };
      case 'UPLOAD_FILE':
        const fileInput = workdayHandler.findElement(workdayHandler.getFieldMappings().resume);
        if (fileInput) {
          const success = await workdayHandler.filler.uploadFile(
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

console.log('Workday content script loaded');
