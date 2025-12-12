# ATS Platform Configuration Guide

This guide explains how to configure the agent for different ATS platforms and customize form handling.

## Platform-Specific Configuration

### Lever (jobs.lever.co)

**URL Patterns:**
- `https://jobs.lever.co/company/job-id`
- `https://jobs.lever.co/company/job-id/apply`

**Field Mapping:**
```javascript
{
  fullName: 'input[name="name"]',
  email: 'input[name="email"]',
  phone: 'input[name="phone"]',
  currentCompany: 'input[name="org"]',
  linkedin: 'input[name="urls[LinkedIn]"]',
  github: 'input[name="urls[GitHub]"]',
  portfolio: 'input[name="urls[Portfolio]"]',
  resume: 'input[name="resume"]'
}
```

**Notes:**
- Lever combines first and last name into a single "name" field
- Social URLs are optional but commonly requested
- Resume upload supports PDF, DOC, DOCX

**Example: Applying to Ekimetrics (your target job)**

URL: `https://jobs.lever.co/ekimetrics/d9d64766-3d42-4ba9-94d4-f74cdaf20065`

```javascript
// Profile data structure for this application
const profileData = {
  fullName: "John Doe",
  email: "john@example.com",
  phone: "+1-555-123-4567",
  currentCompany: "Tech Corp",
  linkedin: "https://linkedin.com/in/johndoe",
  github: "https://github.com/johndoe",
  portfolio: "https://johndoe.com",
  resume: {
    data: "base64-encoded-pdf-data",
    name: "John_Doe_Resume.pdf",
    mimeType: "application/pdf"
  }
};
```

### Greenhouse

**URL Patterns:**
- `https://boards.greenhouse.io/company/jobs/123456`
- `https://company.greenhouse.io/jobs/123456`

**Field Mapping:**
```javascript
{
  firstName: '#first_name',
  lastName: '#last_name',
  email: '#email',
  phone: '#phone',
  resume: '#resume',
  coverLetter: '#cover_letter'
}
```

**Notes:**
- Greenhouse uses separate first/last name fields
- Uses Select2 for dropdown fields
- Custom questions are in numbered format: `#job_application_answers_attributes_0_text_value`

**Handling Custom Questions:**
```javascript
const customQuestions = {
  "How did you hear about us?": "LinkedIn",
  "Years of experience": "5+",
  "Are you authorized to work?": "Yes"
};
```

### Workday

**URL Patterns:**
- `https://company.wd5.myworkdayjobs.com/en-US/External/job/Location/Job-Title_R123456`

**Field Mapping:**
```javascript
{
  email: '[data-automation-id="email"]',
  firstName: '[data-automation-id="legalNameSection_firstName"]',
  lastName: '[data-automation-id="legalNameSection_lastName"]',
  phone: '[data-automation-id="phone-number"]',
  address: '[data-automation-id="addressSection_addressLine1"]',
  city: '[data-automation-id="addressSection_city"]',
  resume: '[data-automation-id="file-upload-input-ref"]'
}
```

**Notes:**
- Workday has multi-page applications
- Requires account creation for most companies
- Uses `data-automation-id` attributes for field identification
- Dynamic content loading requires extra wait times

**Multi-Page Navigation:**
```javascript
// Use the next button to navigate between pages
const nextButton = '[data-automation-id="bottom-navigation-next-button"]';
```

### Glassdoor

**URL Patterns:**
- `https://www.glassdoor.com/job-listing/*/apply`
- `https://www.glassdoor.com/partner/jobListing.htm?*`

**Field Mapping:**
```javascript
{
  firstName: 'input[name="firstName"]',
  lastName: 'input[name="lastName"]',
  email: 'input[name="email"]',
  phone: 'input[name="phone"]',
  resume: '#resume-upload'
}
```

**Notes:**
- Glassdoor often redirects to company ATS
- Quick Apply feature may have simplified forms
- Requires Glassdoor account for some applications

## Custom Question Handling

### Common Question Patterns

The agent automatically recognizes and fills these common questions:

| Question Pattern | Profile Field |
|-----------------|---------------|
| "authorized to work" | `workAuthorized` |
| "visa sponsorship" | `requiresSponsorship` |
| "years of experience" | `yearsExperience` |
| "salary expectation" | `desiredSalary` |
| "start date" | `startDate` |
| "how did you hear" | `howDidYouHear` |
| "willing to relocate" | `willingToRelocate` |

### Adding Custom Answers

In the extension popup (Profile tab) or via API:

```javascript
// Via API
POST /api/profile/custom-answers
{
  "question": "Why are you interested in this role?",
  "answer": "I am passionate about data science and..."
}

// In profile
const profile = {
  // ... basic fields
  customAnswers: {
    "Why are you interested": "Your answer here",
    "Describe a challenging project": "Detailed description..."
  }
};
```

### Default Answers

Configure default answers for common questions:

```javascript
// In server/config/platforms.js
const defaultAnswers = {
  workAuthorized: 'Yes',
  requiresSponsorship: 'No',
  howDidYouHear: 'Job Board',
  willingToRelocate: 'Yes',
  // EEO/Demographic questions
  gender: 'Prefer not to say',
  veteranStatus: 'I am not a protected veteran',
  disabilityStatus: 'I do not wish to answer'
};
```

## Adding New Platform Support

### 1. Create Content Script

Create `extension/content-scripts/newplatform.js`:

```javascript
class NewPlatformFormHandler {
  constructor() {
    this.filler = window.formAutoFiller;
    this.platform = 'newplatform';
    this.init();
  }

  async init() {
    await this.filler.waitForElement('.application-form', 15000);
    console.log('NewPlatform form handler initialized');
  }

  getFieldMappings() {
    return {
      firstName: ['#first-name', 'input[name="firstName"]'],
      lastName: ['#last-name', 'input[name="lastName"]'],
      email: ['#email', 'input[type="email"]'],
      // ... add more mappings
    };
  }

  async fillForm(formData) {
    // Implementation
  }

  async submitApplication() {
    // Implementation
  }
}

// Initialize and set up message listener
const handler = new NewPlatformFormHandler();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages
});
```

### 2. Update Manifest

Add to `extension/manifest.json`:

```json
{
  "content_scripts": [
    {
      "matches": ["https://*.newplatform.com/*"],
      "js": ["content-scripts/newplatform.js"],
      "css": ["styles/overlay.css"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": [
    "https://*.newplatform.com/*"
  ]
}
```

### 3. Add Server Configuration

Add to `server/config/platforms.js`:

```javascript
newplatform: {
  name: 'NewPlatform',
  patterns: [/newplatform\.com/],
  selectors: {
    form: '.application-form',
    firstName: '#first-name',
    // ... more selectors
  },
  submitDelay: 1500,
  requiresLogin: false
}
```

## Testing Configuration

### Test Mode

Enable test mode to preview actions without submitting:

```javascript
// In extension settings
const settings = {
  autoSubmit: false,  // Never auto-submit
  testMode: true      // Log actions without executing
};
```

### Debug Logging

Enable verbose logging:

```javascript
// In content script
console.debug('Field detected:', fieldInfo);
console.debug('Value to fill:', value);
```

### Manual Testing Steps

1. Navigate to job application page
2. Open browser DevTools (F12)
3. Click extension icon → "Detect Fields"
4. Verify all fields are detected
5. Click "Fill Form"
6. Inspect filled values in DevTools
7. Manually verify before submitting

## Troubleshooting

### Field Not Detected

1. Check if selector matches element
2. Wait for dynamic content to load
3. Try alternative selectors

```javascript
// Debug: Find all inputs on page
document.querySelectorAll('input, textarea, select').forEach(el => {
  console.log({
    tag: el.tagName,
    name: el.name,
    id: el.id,
    type: el.type,
    placeholder: el.placeholder
  });
});
```

### Field Not Filling

1. Check for custom input components (React, Vue)
2. Verify event dispatching
3. Add delays for animations

```javascript
// Force event triggering
element.dispatchEvent(new Event('input', { bubbles: true }));
element.dispatchEvent(new Event('change', { bubbles: true }));
```

### Platform Blocks Automation

1. Add random delays between actions
2. Use realistic typing speeds
3. Move mouse naturally
4. Consider using browser extension mode exclusively
