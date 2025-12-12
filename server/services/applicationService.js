// Application Service - Core business logic for job applications
const { chromium } = require('playwright');
const axios = require('axios');
const { logger } = require('../utils/logger');
const CaptchaSolver = require('../utils/captchaSolver');

class ApplicationService {
  constructor() {
    this.browser = null;
    this.captchaSolver = new CaptchaSolver();
    this.applications = []; // In-memory store, replace with database in production
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
        slowMo: parseInt(process.env.SLOW_MO) || 50,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  async createPage() {
    const browser = await this.initBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    // Add stealth scripts
    await context.addInitScript(() => {
      // Override navigator properties
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      
      // Override chrome property
      window.chrome = { runtime: {} };
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });

    return await context.newPage();
  }

  // Apply to a job using Playwright (fallback when extension can't handle)
  async applyToJob(jobUrl, profileData, options = {}) {
    const page = await this.createPage();
    const result = {
      success: false,
      jobUrl,
      timestamp: new Date().toISOString(),
      steps: []
    };

    try {
      // Navigate to job page
      await page.goto(jobUrl, { waitUntil: 'networkidle' });
      result.steps.push({ action: 'navigate', status: 'success' });

      // Detect platform
      const platform = this.detectPlatform(jobUrl);
      result.platform = platform;

      // Handle based on platform
      switch (platform) {
        case 'lever':
          await this.handleLeverApplication(page, profileData, result);
          break;
        case 'greenhouse':
          await this.handleGreenhouseApplication(page, profileData, result);
          break;
        case 'workday':
          await this.handleWorkdayApplication(page, profileData, result);
          break;
        default:
          await this.handleGenericApplication(page, profileData, result);
      }

      result.success = true;

    } catch (error) {
      logger.error('Application error:', error);
      result.error = error.message;
      result.steps.push({ action: 'error', error: error.message });
    } finally {
      await page.close();
    }

    // Record application
    this.applications.push(result);
    return result;
  }

  detectPlatform(url) {
    if (/lever\.co/.test(url)) return 'lever';
    if (/greenhouse\.io/.test(url)) return 'greenhouse';
    if (/myworkdayjobs\.com/.test(url)) return 'workday';
    if (/glassdoor\.com/.test(url)) return 'glassdoor';
    return 'generic';
  }

  async handleLeverApplication(page, profile, result) {
    // Wait for form to load
    await page.waitForSelector('.application-form, #application-form', { timeout: 10000 });
    result.steps.push({ action: 'form_loaded', status: 'success' });

    // Fill basic fields
    const fieldMappings = [
      { selector: 'input[name="name"]', value: profile.fullName || `${profile.firstName} ${profile.lastName}` },
      { selector: 'input[name="email"]', value: profile.email },
      { selector: 'input[name="phone"]', value: profile.phone },
      { selector: 'input[name="org"]', value: profile.currentCompany },
      { selector: 'input[name="urls[LinkedIn]"]', value: profile.linkedin },
      { selector: 'input[name="urls[GitHub]"]', value: profile.github },
      { selector: 'input[name="urls[Portfolio]"]', value: profile.portfolio }
    ];

    for (const field of fieldMappings) {
      try {
        const element = await page.$(field.selector);
        if (element && field.value) {
          await element.fill(field.value);
          result.steps.push({ action: 'fill', field: field.selector, status: 'success' });
        }
      } catch (error) {
        result.steps.push({ action: 'fill', field: field.selector, status: 'failed', error: error.message });
      }
    }

    // Handle resume upload
    if (profile.resumePath) {
      try {
        const fileInput = await page.$('input[name="resume"], input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(profile.resumePath);
          result.steps.push({ action: 'upload_resume', status: 'success' });
        }
      } catch (error) {
        result.steps.push({ action: 'upload_resume', status: 'failed', error: error.message });
      }
    }

    // Check for CAPTCHA
    const hasCaptcha = await this.detectCaptcha(page);
    if (hasCaptcha) {
      result.steps.push({ action: 'captcha_detected', status: 'pending' });
      // CAPTCHA handling will be done via extension
      return;
    }

    // Submit if auto-submit is enabled
    if (profile.autoSubmit) {
      await this.submitForm(page, result);
    }
  }

  async handleGreenhouseApplication(page, profile, result) {
    await page.waitForSelector('#application_form, .application-form', { timeout: 10000 });
    result.steps.push({ action: 'form_loaded', status: 'success' });

    const fieldMappings = [
      { selector: '#first_name, input[name="job_application[first_name]"]', value: profile.firstName },
      { selector: '#last_name, input[name="job_application[last_name]"]', value: profile.lastName },
      { selector: '#email, input[name="job_application[email]"]', value: profile.email },
      { selector: '#phone, input[name="job_application[phone]"]', value: profile.phone }
    ];

    for (const field of fieldMappings) {
      try {
        const element = await page.$(field.selector);
        if (element && field.value) {
          await element.fill(field.value);
          result.steps.push({ action: 'fill', field: field.selector, status: 'success' });
        }
      } catch (error) {
        result.steps.push({ action: 'fill', field: field.selector, status: 'failed' });
      }
    }

    if (profile.resumePath) {
      try {
        const fileInput = await page.$('#resume, input[name="job_application[resume]"]');
        if (fileInput) {
          await fileInput.setInputFiles(profile.resumePath);
          result.steps.push({ action: 'upload_resume', status: 'success' });
        }
      } catch (error) {
        result.steps.push({ action: 'upload_resume', status: 'failed' });
      }
    }
  }

  async handleWorkdayApplication(page, profile, result) {
    // Workday requires more complex handling due to dynamic content
    await page.waitForTimeout(3000); // Wait for dynamic content
    
    // Look for common Workday fields
    const fieldMappings = [
      { selector: '[data-automation-id="email"]', value: profile.email },
      { selector: '[data-automation-id="legalNameSection_firstName"]', value: profile.firstName },
      { selector: '[data-automation-id="legalNameSection_lastName"]', value: profile.lastName },
      { selector: '[data-automation-id="phone-number"]', value: profile.phone }
    ];

    for (const field of fieldMappings) {
      try {
        const element = await page.$(field.selector);
        if (element && field.value) {
          await element.click();
          await element.fill(field.value);
          result.steps.push({ action: 'fill', field: field.selector, status: 'success' });
        }
      } catch (error) {
        result.steps.push({ action: 'fill', field: field.selector, status: 'failed' });
      }
    }
  }

  async handleGenericApplication(page, profile, result) {
    // Try to find common form fields
    const commonSelectors = {
      firstName: ['input[name*="first"]', 'input[id*="first"]', 'input[placeholder*="First"]'],
      lastName: ['input[name*="last"]', 'input[id*="last"]', 'input[placeholder*="Last"]'],
      email: ['input[type="email"]', 'input[name*="email"]', 'input[id*="email"]'],
      phone: ['input[type="tel"]', 'input[name*="phone"]', 'input[id*="phone"]']
    };

    for (const [fieldName, selectors] of Object.entries(commonSelectors)) {
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element && profile[fieldName]) {
            await element.fill(profile[fieldName]);
            result.steps.push({ action: 'fill', field: fieldName, status: 'success' });
            break;
          }
        } catch {
          continue;
        }
      }
    }
  }

  async detectCaptcha(page) {
    const captchaSelectors = [
      '.g-recaptcha',
      '[data-sitekey]',
      '.h-captcha',
      '.cf-turnstile',
      'iframe[src*="recaptcha"]',
      'iframe[src*="hcaptcha"]'
    ];

    for (const selector of captchaSelectors) {
      const element = await page.$(selector);
      if (element) return true;
    }

    return false;
  }

  async submitForm(page, result) {
    try {
      const submitButton = await page.$('button[type="submit"], input[type="submit"], .submit-application');
      if (submitButton) {
        await submitButton.click();
        await page.waitForTimeout(3000);
        result.steps.push({ action: 'submit', status: 'success' });
      }
    } catch (error) {
      result.steps.push({ action: 'submit', status: 'failed', error: error.message });
    }
  }

  async solveCaptcha(captchaData) {
    try {
      return await this.captchaSolver.solve(captchaData);
    } catch (error) {
      logger.error('CAPTCHA solving failed:', error);
      return null;
    }
  }

  async recordSubmission(data) {
    this.applications.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    logger.info('Application recorded:', data.url);
  }

  getApplicationHistory() {
    return this.applications;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = ApplicationService;
