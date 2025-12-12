// Platform Configuration - Specific settings for each ATS platform

const platformConfigs = {
  lever: {
    name: 'Lever',
    patterns: [/jobs\.lever\.co/, /lever\.co\/.*\/apply/],
    selectors: {
      form: '.application-form, #application-form',
      firstName: 'input[name="name"]',
      email: 'input[name="email"]',
      phone: 'input[name="phone"]',
      linkedin: 'input[name="urls[LinkedIn]"]',
      github: 'input[name="urls[GitHub]"]',
      portfolio: 'input[name="urls[Portfolio]"]',
      resume: 'input[name="resume"]',
      coverLetter: 'input[name="coverLetter"]',
      submit: 'button[type="submit"], .postings-btn-submit'
    },
    fieldMappings: {
      name: ['fullName', 'name'],
      org: ['currentCompany', 'company'],
      'urls[LinkedIn]': ['linkedin', 'linkedinUrl'],
      'urls[GitHub]': ['github', 'githubUrl'],
      'urls[Portfolio]': ['portfolio', 'website']
    },
    customQuestions: {
      // Map common question patterns to profile fields
      'how did you hear': 'howDidYouHear',
      'years of experience': 'yearsExperience',
      'salary': 'desiredSalary',
      'authorized to work': 'workAuthorized',
      'visa sponsorship': 'requiresSponsorship',
      'start date': 'startDate'
    },
    submitDelay: 1000,
    requiresLogin: false
  },

  greenhouse: {
    name: 'Greenhouse',
    patterns: [/greenhouse\.io/, /boards\.greenhouse\.io/],
    selectors: {
      form: '#application_form, .application-form',
      firstName: '#first_name, input[name="job_application[first_name]"]',
      lastName: '#last_name, input[name="job_application[last_name]"]',
      email: '#email, input[name="job_application[email]"]',
      phone: '#phone, input[name="job_application[phone]"]',
      resume: '#resume, input[name="job_application[resume]"]',
      coverLetter: '#cover_letter',
      submit: '#submit_app, button[type="submit"]'
    },
    fieldMappings: {
      first_name: ['firstName'],
      last_name: ['lastName'],
      email: ['email'],
      phone: ['phone']
    },
    customQuestions: {
      'linkedin': 'linkedin',
      'github': 'github',
      'website': 'portfolio'
    },
    submitDelay: 1500,
    requiresLogin: false,
    notes: 'Greenhouse uses Select2 for some dropdowns'
  },

  workday: {
    name: 'Workday',
    patterns: [/myworkdayjobs\.com/, /workday\.com.*careers/],
    selectors: {
      form: '[data-automation-id="jobPostingPage"]',
      email: '[data-automation-id="email"]',
      firstName: '[data-automation-id="legalNameSection_firstName"]',
      lastName: '[data-automation-id="legalNameSection_lastName"]',
      phone: '[data-automation-id="phone-number"]',
      resume: '[data-automation-id="file-upload-input-ref"]',
      submit: '[data-automation-id="bottom-navigation-next-button"]'
    },
    fieldMappings: {
      'legalNameSection_firstName': ['firstName'],
      'legalNameSection_lastName': ['lastName'],
      'email': ['email'],
      'phone-number': ['phone']
    },
    customQuestions: {},
    submitDelay: 2000,
    requiresLogin: true,
    multiPage: true,
    notes: 'Workday has multi-page applications with dynamic content'
  },

  glassdoor: {
    name: 'Glassdoor',
    patterns: [/glassdoor\.com.*jobs/, /glassdoor\.com.*apply/],
    selectors: {
      form: '.application-form, #apply-form',
      firstName: 'input[name="firstName"]',
      lastName: 'input[name="lastName"]',
      email: 'input[name="email"]',
      phone: 'input[name="phone"]',
      resume: 'input[name="resume"], #resume-upload',
      submit: 'button[type="submit"], .apply-button'
    },
    fieldMappings: {
      firstName: ['firstName'],
      lastName: ['lastName'],
      email: ['email'],
      phone: ['phone']
    },
    submitDelay: 1500,
    requiresLogin: true
  },

  smartrecruiters: {
    name: 'SmartRecruiters',
    patterns: [/smartrecruiters\.com/, /jobs\.smartrecruiters\.com/],
    selectors: {
      form: '.application-form',
      firstName: 'input[name="firstName"]',
      lastName: 'input[name="lastName"]',
      email: 'input[type="email"]',
      phone: 'input[type="tel"]',
      resume: 'input[type="file"]',
      submit: 'button[type="submit"]'
    },
    submitDelay: 1500,
    requiresLogin: false
  },

  icims: {
    name: 'iCIMS',
    patterns: [/icims\.com/, /careers-.*\.icims\.com/],
    selectors: {
      form: '#application',
      firstName: '#FirstName',
      lastName: '#LastName',
      email: '#Email',
      phone: '#Phone',
      resume: '#Resume',
      submit: '#submit'
    },
    submitDelay: 2000,
    requiresLogin: false
  },

  taleo: {
    name: 'Taleo',
    patterns: [/taleo\.net/, /jobs\.taleo/],
    selectors: {
      form: '#requisitionApplicationForm',
      firstName: '#FirstName',
      lastName: '#LastName',
      email: '#Email',
      phone: '#Phone',
      resume: '#AttachedResumeUpload',
      submit: '#SubmitButton'
    },
    submitDelay: 2000,
    requiresLogin: true,
    notes: 'Taleo often requires account creation'
  }
};

// Common custom question patterns and their field mappings
const commonQuestionMappings = {
  // Work authorization
  'authorized to work': 'workAuthorized',
  'legally authorized': 'workAuthorized',
  'work eligibility': 'workAuthorized',
  'right to work': 'workAuthorized',
  
  // Visa/Sponsorship
  'visa sponsorship': 'requiresSponsorship',
  'require sponsorship': 'requiresSponsorship',
  'immigration sponsorship': 'requiresSponsorship',
  'work visa': 'requiresSponsorship',
  
  // Experience
  'years of experience': 'yearsExperience',
  'how many years': 'yearsExperience',
  'experience in': 'yearsExperience',
  
  // Salary
  'salary expectation': 'desiredSalary',
  'compensation expectation': 'desiredSalary',
  'salary requirement': 'desiredSalary',
  'expected salary': 'desiredSalary',
  
  // Start date
  'start date': 'startDate',
  'when can you start': 'startDate',
  'available to start': 'startDate',
  'earliest start': 'startDate',
  
  // Source
  'how did you hear': 'howDidYouHear',
  'where did you find': 'howDidYouHear',
  'referral source': 'howDidYouHear',
  
  // Location
  'willing to relocate': 'willingToRelocate',
  'open to relocation': 'willingToRelocate',
  'work location': 'workLocation',
  
  // Education
  'highest degree': 'highestDegree',
  'education level': 'highestDegree',
  
  // Gender/Demographics (optional)
  'gender': 'gender',
  'veteran status': 'veteranStatus',
  'disability': 'disabilityStatus'
};

// Default answers for common questions
const defaultAnswers = {
  workAuthorized: 'Yes',
  requiresSponsorship: 'No',
  howDidYouHear: 'Job Board',
  willingToRelocate: 'Yes',
  gender: 'Prefer not to say',
  veteranStatus: 'I am not a protected veteran',
  disabilityStatus: 'I do not wish to answer'
};

function getPlatformConfig(url) {
  for (const [key, config] of Object.entries(platformConfigs)) {
    if (config.patterns.some(pattern => pattern.test(url))) {
      return { platform: key, config };
    }
  }
  return { platform: 'unknown', config: null };
}

function mapQuestionToField(questionText) {
  const lowerQuestion = questionText.toLowerCase();
  
  for (const [pattern, field] of Object.entries(commonQuestionMappings)) {
    if (lowerQuestion.includes(pattern)) {
      return field;
    }
  }
  
  return null;
}

module.exports = {
  platformConfigs,
  commonQuestionMappings,
  defaultAnswers,
  getPlatformConfig,
  mapQuestionToField
};
