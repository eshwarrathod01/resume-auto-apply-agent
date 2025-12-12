// API Routes
const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const ApplicationService = require('../services/applicationService');

const applicationService = new ApplicationService();

// Get server status
router.get('/status', (req, res) => {
  res.json({
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Submit a job application
router.post('/apply', async (req, res) => {
  try {
    const { jobUrl, profile, options } = req.body;

    if (!jobUrl) {
      return res.status(400).json({ error: 'Job URL is required' });
    }

    if (!profile) {
      return res.status(400).json({ error: 'Profile data is required' });
    }

    logger.info(`Starting application for: ${jobUrl}`);

    const result = await applicationService.applyToJob(jobUrl, profile, options);

    res.json({
      success: result.success,
      result
    });

  } catch (error) {
    logger.error('Apply error:', error);
    res.status(500).json({
      error: 'Application failed',
      message: error.message
    });
  }
});

// Get application history
router.get('/history', (req, res) => {
  const history = applicationService.getApplicationHistory();
  res.json({ applications: history });
});

// Detect platform from URL
router.post('/detect-platform', (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const platform = applicationService.detectPlatform(url);
  res.json({ platform });
});

// Test connection endpoint for extension
router.get('/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

module.exports = router;
