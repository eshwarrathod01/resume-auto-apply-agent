// Application Routes
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { logger } = require('../utils/logger');

// In-memory storage (replace with database in production)
let applications = [];

// Validation middleware
const validateApplication = [
  body('jobUrl').isURL().withMessage('Valid job URL is required'),
  body('status').isIn(['pending', 'submitted', 'success', 'failed']).optional(),
  body('platform').isString().optional()
];

// Create new application record
router.post('/', validateApplication, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const application = {
    id: Date.now().toString(),
    jobUrl: req.body.jobUrl,
    status: req.body.status || 'pending',
    platform: req.body.platform,
    company: req.body.company,
    position: req.body.position,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [],
    notes: req.body.notes || ''
  };

  applications.push(application);
  logger.info(`Application created: ${application.id}`);

  res.status(201).json(application);
});

// Get all applications
router.get('/', (req, res) => {
  const { status, platform, limit = 50, offset = 0 } = req.query;
  
  let filtered = [...applications];

  if (status) {
    filtered = filtered.filter(app => app.status === status);
  }

  if (platform) {
    filtered = filtered.filter(app => app.platform === platform);
  }

  // Sort by newest first
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Paginate
  const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

  res.json({
    total: filtered.length,
    offset: parseInt(offset),
    limit: parseInt(limit),
    applications: paginated
  });
});

// Get single application
router.get('/:id', (req, res) => {
  const application = applications.find(app => app.id === req.params.id);
  
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  res.json(application);
});

// Update application
router.patch('/:id', (req, res) => {
  const index = applications.findIndex(app => app.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Application not found' });
  }

  applications[index] = {
    ...applications[index],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  logger.info(`Application updated: ${req.params.id}`);
  res.json(applications[index]);
});

// Delete application
router.delete('/:id', (req, res) => {
  const index = applications.findIndex(app => app.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Application not found' });
  }

  applications.splice(index, 1);
  logger.info(`Application deleted: ${req.params.id}`);

  res.json({ message: 'Application deleted' });
});

// Add step to application
router.post('/:id/steps', (req, res) => {
  const application = applications.find(app => app.id === req.params.id);
  
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }

  const step = {
    action: req.body.action,
    status: req.body.status,
    timestamp: new Date().toISOString(),
    details: req.body.details
  };

  application.steps.push(step);
  application.updatedAt = new Date().toISOString();

  res.json(application);
});

// Get statistics
router.get('/stats/summary', (req, res) => {
  const stats = {
    total: applications.length,
    byStatus: {
      pending: applications.filter(app => app.status === 'pending').length,
      submitted: applications.filter(app => app.status === 'submitted').length,
      success: applications.filter(app => app.status === 'success').length,
      failed: applications.filter(app => app.status === 'failed').length
    },
    byPlatform: {}
  };

  applications.forEach(app => {
    if (app.platform) {
      stats.byPlatform[app.platform] = (stats.byPlatform[app.platform] || 0) + 1;
    }
  });

  res.json(stats);
});

module.exports = router;
