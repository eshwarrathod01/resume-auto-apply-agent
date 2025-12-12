// Profile Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CryptoJS = require('crypto-js');
const { logger } = require('../utils/logger');

// Configure file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT'));
    }
  }
});

// In-memory profile storage (replace with database in production)
let userProfile = null;

// Encryption key (should be from environment in production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32chars!';

// Encrypt sensitive data
function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
}

// Decrypt sensitive data
function decryptData(encryptedData) {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

// Get profile
router.get('/', (req, res) => {
  if (!userProfile) {
    return res.json({ profile: null });
  }

  // Return profile without sensitive encryption details
  res.json({ profile: userProfile });
});

// Create/Update profile
router.post('/', (req, res) => {
  const profileData = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    fullName: req.body.fullName || `${req.body.firstName} ${req.body.lastName}`,
    email: req.body.email,
    phone: req.body.phone,
    location: req.body.location,
    linkedin: req.body.linkedin,
    github: req.body.github,
    portfolio: req.body.portfolio,
    twitter: req.body.twitter,
    currentCompany: req.body.currentCompany,
    currentTitle: req.body.currentTitle,
    yearsExperience: req.body.yearsExperience,
    
    // Work authorization
    workAuthorized: req.body.workAuthorized,
    requiresSponsorship: req.body.requiresSponsorship,
    
    // Preferences
    desiredSalary: req.body.desiredSalary,
    startDate: req.body.startDate,
    workType: req.body.workType, // remote, hybrid, onsite
    
    // Custom answers for common questions
    customAnswers: req.body.customAnswers || {},
    
    updatedAt: new Date().toISOString()
  };

  // Encrypt sensitive data before storing
  userProfile = {
    ...profileData,
    encryptedData: encryptData({
      email: profileData.email,
      phone: profileData.phone
    })
  };

  logger.info('Profile updated');
  res.json({ profile: userProfile, message: 'Profile saved successfully' });
});

// Upload resume
router.post('/resume', upload.single('resume'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!userProfile) {
    userProfile = {};
  }

  userProfile.resume = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
    mimeType: req.file.mimetype,
    uploadedAt: new Date().toISOString()
  };

  logger.info(`Resume uploaded: ${req.file.originalname}`);
  res.json({
    message: 'Resume uploaded successfully',
    resume: userProfile.resume
  });
});

// Upload cover letter
router.post('/cover-letter', upload.single('coverLetter'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!userProfile) {
    userProfile = {};
  }

  userProfile.coverLetter = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    path: req.file.path,
    size: req.file.size,
    mimeType: req.file.mimetype,
    uploadedAt: new Date().toISOString()
  };

  logger.info(`Cover letter uploaded: ${req.file.originalname}`);
  res.json({
    message: 'Cover letter uploaded successfully',
    coverLetter: userProfile.coverLetter
  });
});

// Get resume file
router.get('/resume/download', (req, res) => {
  if (!userProfile?.resume?.path) {
    return res.status(404).json({ error: 'No resume on file' });
  }

  res.download(userProfile.resume.path, userProfile.resume.originalName);
});

// Delete resume
router.delete('/resume', (req, res) => {
  if (userProfile?.resume?.path) {
    try {
      fs.unlinkSync(userProfile.resume.path);
    } catch (error) {
      logger.error('Error deleting resume file:', error);
    }
    delete userProfile.resume;
  }

  res.json({ message: 'Resume deleted' });
});

// Add custom answer template
router.post('/custom-answers', (req, res) => {
  if (!userProfile) {
    userProfile = {};
  }

  if (!userProfile.customAnswers) {
    userProfile.customAnswers = {};
  }

  const { question, answer } = req.body;
  userProfile.customAnswers[question] = answer;

  res.json({
    message: 'Custom answer saved',
    customAnswers: userProfile.customAnswers
  });
});

// Get custom answers
router.get('/custom-answers', (req, res) => {
  res.json({
    customAnswers: userProfile?.customAnswers || {}
  });
});

// Delete profile
router.delete('/', (req, res) => {
  // Delete uploaded files
  if (userProfile?.resume?.path) {
    try { fs.unlinkSync(userProfile.resume.path); } catch (e) {}
  }
  if (userProfile?.coverLetter?.path) {
    try { fs.unlinkSync(userProfile.coverLetter.path); } catch (e) {}
  }

  userProfile = null;
  logger.info('Profile deleted');
  res.json({ message: 'Profile deleted' });
});

// Export profile data (for backup)
router.get('/export', (req, res) => {
  if (!userProfile) {
    return res.status(404).json({ error: 'No profile found' });
  }

  // Remove file paths from export
  const exportData = { ...userProfile };
  if (exportData.resume) {
    delete exportData.resume.path;
  }
  if (exportData.coverLetter) {
    delete exportData.coverLetter.path;
  }

  res.json(exportData);
});

module.exports = router;
