// CAPTCHA Solver Utility
// Integrates with external CAPTCHA solving services

const axios = require('axios');
const { logger } = require('./logger');

class CaptchaSolver {
  constructor() {
    this.apiKey = process.env.CAPTCHA_API_KEY;
    this.service = process.env.CAPTCHA_SERVICE || '2captcha';
    this.baseUrls = {
      '2captcha': 'https://2captcha.com',
      'anticaptcha': 'https://api.anti-captcha.com',
      'capsolver': 'https://api.capsolver.com'
    };
  }

  async solve(captchaData) {
    const { type, siteKey, pageUrl } = captchaData;

    if (!this.apiKey) {
      logger.warn('No CAPTCHA API key configured');
      return null;
    }

    switch (type) {
      case 'recaptcha-v2':
        return await this.solveRecaptchaV2(siteKey, pageUrl);
      case 'recaptcha-v3':
        return await this.solveRecaptchaV3(siteKey, pageUrl);
      case 'hcaptcha':
        return await this.solveHCaptcha(siteKey, pageUrl);
      case 'turnstile':
        return await this.solveTurnstile(siteKey, pageUrl);
      default:
        logger.warn(`Unknown CAPTCHA type: ${type}`);
        return null;
    }
  }

  async solveRecaptchaV2(siteKey, pageUrl) {
    if (this.service === '2captcha') {
      return await this.solve2CaptchaRecaptchaV2(siteKey, pageUrl);
    } else if (this.service === 'anticaptcha') {
      return await this.solveAntiCaptchaRecaptchaV2(siteKey, pageUrl);
    }
    return null;
  }

  async solve2CaptchaRecaptchaV2(siteKey, pageUrl) {
    try {
      // Submit CAPTCHA
      const submitResponse = await axios.get(`${this.baseUrls['2captcha']}/in.php`, {
        params: {
          key: this.apiKey,
          method: 'userrecaptcha',
          googlekey: siteKey,
          pageurl: pageUrl,
          json: 1
        }
      });

      if (submitResponse.data.status !== 1) {
        throw new Error(submitResponse.data.request);
      }

      const captchaId = submitResponse.data.request;
      logger.info(`CAPTCHA submitted, ID: ${captchaId}`);

      // Poll for result
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max

      while (attempts < maxAttempts) {
        await this.sleep(2000);
        
        const resultResponse = await axios.get(`${this.baseUrls['2captcha']}/res.php`, {
          params: {
            key: this.apiKey,
            action: 'get',
            id: captchaId,
            json: 1
          }
        });

        if (resultResponse.data.status === 1) {
          logger.info('CAPTCHA solved successfully');
          return resultResponse.data.request;
        }

        if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(resultResponse.data.request);
        }

        attempts++;
      }

      throw new Error('CAPTCHA solving timeout');

    } catch (error) {
      logger.error('2captcha error:', error.message);
      return null;
    }
  }

  async solveAntiCaptchaRecaptchaV2(siteKey, pageUrl) {
    try {
      // Create task
      const createResponse = await axios.post(`${this.baseUrls['anticaptcha']}/createTask`, {
        clientKey: this.apiKey,
        task: {
          type: 'RecaptchaV2TaskProxyless',
          websiteURL: pageUrl,
          websiteKey: siteKey
        }
      });

      if (createResponse.data.errorId !== 0) {
        throw new Error(createResponse.data.errorDescription);
      }

      const taskId = createResponse.data.taskId;
      logger.info(`AntiCaptcha task created: ${taskId}`);

      // Poll for result
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await this.sleep(2000);

        const resultResponse = await axios.post(`${this.baseUrls['anticaptcha']}/getTaskResult`, {
          clientKey: this.apiKey,
          taskId
        });

        if (resultResponse.data.status === 'ready') {
          logger.info('AntiCaptcha solved successfully');
          return resultResponse.data.solution.gRecaptchaResponse;
        }

        if (resultResponse.data.errorId !== 0) {
          throw new Error(resultResponse.data.errorDescription);
        }

        attempts++;
      }

      throw new Error('AntiCaptcha timeout');

    } catch (error) {
      logger.error('AntiCaptcha error:', error.message);
      return null;
    }
  }

  async solveRecaptchaV3(siteKey, pageUrl, action = 'submit', minScore = 0.7) {
    if (this.service === '2captcha') {
      try {
        const submitResponse = await axios.get(`${this.baseUrls['2captcha']}/in.php`, {
          params: {
            key: this.apiKey,
            method: 'userrecaptcha',
            googlekey: siteKey,
            pageurl: pageUrl,
            version: 'v3',
            action,
            min_score: minScore,
            json: 1
          }
        });

        if (submitResponse.data.status !== 1) {
          throw new Error(submitResponse.data.request);
        }

        const captchaId = submitResponse.data.request;

        let attempts = 0;
        while (attempts < 60) {
          await this.sleep(2000);

          const resultResponse = await axios.get(`${this.baseUrls['2captcha']}/res.php`, {
            params: {
              key: this.apiKey,
              action: 'get',
              id: captchaId,
              json: 1
            }
          });

          if (resultResponse.data.status === 1) {
            return resultResponse.data.request;
          }

          if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
            throw new Error(resultResponse.data.request);
          }

          attempts++;
        }

      } catch (error) {
        logger.error('reCAPTCHA v3 error:', error.message);
        return null;
      }
    }
    return null;
  }

  async solveHCaptcha(siteKey, pageUrl) {
    if (this.service === '2captcha') {
      try {
        const submitResponse = await axios.get(`${this.baseUrls['2captcha']}/in.php`, {
          params: {
            key: this.apiKey,
            method: 'hcaptcha',
            sitekey: siteKey,
            pageurl: pageUrl,
            json: 1
          }
        });

        if (submitResponse.data.status !== 1) {
          throw new Error(submitResponse.data.request);
        }

        const captchaId = submitResponse.data.request;

        let attempts = 0;
        while (attempts < 60) {
          await this.sleep(2000);

          const resultResponse = await axios.get(`${this.baseUrls['2captcha']}/res.php`, {
            params: {
              key: this.apiKey,
              action: 'get',
              id: captchaId,
              json: 1
            }
          });

          if (resultResponse.data.status === 1) {
            return resultResponse.data.request;
          }

          if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
            throw new Error(resultResponse.data.request);
          }

          attempts++;
        }

      } catch (error) {
        logger.error('hCaptcha error:', error.message);
        return null;
      }
    }
    return null;
  }

  async solveTurnstile(siteKey, pageUrl) {
    if (this.service === '2captcha') {
      try {
        const submitResponse = await axios.get(`${this.baseUrls['2captcha']}/in.php`, {
          params: {
            key: this.apiKey,
            method: 'turnstile',
            sitekey: siteKey,
            pageurl: pageUrl,
            json: 1
          }
        });

        if (submitResponse.data.status !== 1) {
          throw new Error(submitResponse.data.request);
        }

        const captchaId = submitResponse.data.request;

        let attempts = 0;
        while (attempts < 60) {
          await this.sleep(2000);

          const resultResponse = await axios.get(`${this.baseUrls['2captcha']}/res.php`, {
            params: {
              key: this.apiKey,
              action: 'get',
              id: captchaId,
              json: 1
            }
          });

          if (resultResponse.data.status === 1) {
            return resultResponse.data.request;
          }

          if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
            throw new Error(resultResponse.data.request);
          }

          attempts++;
        }

      } catch (error) {
        logger.error('Turnstile error:', error.message);
        return null;
      }
    }
    return null;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get balance from CAPTCHA service
  async getBalance() {
    if (this.service === '2captcha') {
      try {
        const response = await axios.get(`${this.baseUrls['2captcha']}/res.php`, {
          params: {
            key: this.apiKey,
            action: 'getbalance',
            json: 1
          }
        });
        return response.data.request;
      } catch (error) {
        logger.error('Balance check error:', error.message);
        return null;
      }
    }
    return null;
  }
}

module.exports = CaptchaSolver;
