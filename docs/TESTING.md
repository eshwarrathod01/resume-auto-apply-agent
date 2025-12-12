# Testing Guide

This document covers testing the Resume Auto Apply Agent, including specific tests for the target Lever job application.

## Test Setup

### Prerequisites

1. Server running locally
2. Chrome extension loaded
3. Test profile configured

### Start Test Environment

```bash
# Terminal 1: Start server
npm start

# Terminal 2: Watch logs
tail -f logs/app.log
```

## Test Cases

### 1. Basic Connection Test

**Test:** Verify extension connects to server

**Steps:**
1. Open Chrome
2. Click extension icon
3. Go to Settings tab
4. Click "Connect to Server"

**Expected:**
- Status indicator shows "Connected"
- Server logs show "Extension registered"

### 2. Profile Save Test

**Test:** Verify profile saves correctly

**Steps:**
1. Click extension icon
2. Fill in profile fields:
   - Full Name: Test User
   - Email: test@example.com
   - Phone: +1-555-123-4567
3. Click "Save Profile"

**Expected:**
- Notification "Profile saved!"
- Profile persists after closing popup

### 3. Resume Upload Test

**Test:** Verify resume uploads and stores correctly

**Steps:**
1. Click extension icon
2. In Profile tab, click "Upload Resume"
3. Select a PDF file
4. Click "Save Profile"

**Expected:**
- File name appears below upload area
- Resume persists after closing popup

## Lever Job Application Test

### Target URL
`https://jobs.lever.co/ekimetrics/d9d64766-3d42-4ba9-94d4-f74cdaf20065`

### Test 1: Page Detection

**Steps:**
1. Navigate to the job URL
2. Observe extension behavior

**Expected:**
- Extension icon may show activity
- Server logs: "ATS_PAGE_DETECTED" with platform "lever"

### Test 2: Field Detection

**Steps:**
1. Navigate to job URL
2. Click "Apply" button on job page
3. Wait for application form to load
4. Click extension icon
5. Go to Apply tab
6. Click "Detect Fields"

**Expected Fields:**
- Name (text input)
- Email (email input)
- Phone (tel input)
- Current Company (text input)
- LinkedIn URL (url input)
- GitHub URL (url input)
- Portfolio URL (url input)
- Resume (file input)
- Additional questions

### Test 3: Form Filling

**Pre-requisites:** Profile configured with test data

**Steps:**
1. On Lever application form
2. Click extension icon
3. Click "Fill Form"

**Expected:**
- All mapped fields fill automatically
- Notification shows "Filled X fields"
- Visual confirmation of filled fields

**Verification:**
```javascript
// In browser console
document.querySelector('input[name="name"]').value; // Should show name
document.querySelector('input[name="email"]').value; // Should show email
```

### Test 4: Resume Upload (via Extension)

**Steps:**
1. Ensure resume is uploaded in extension profile
2. On Lever form, click "Fill Form"
3. Check resume field

**Expected:**
- Resume file appears attached to form

### Test 5: Manual Submit (Do NOT auto-submit in test)

**Steps:**
1. After form is filled
2. Review all fields
3. DO NOT click submit (this is a real job)

**Notes:**
- Auto-submit is disabled by default
- Always review before submitting real applications

## API Testing

### Health Check

```bash
curl http://localhost:3000/health
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### Profile API

```bash
# Create profile
curl -X POST http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "phone": "+1-555-123-4567"
  }'

# Get profile
curl http://localhost:3000/api/profile
```

### Application API

```bash
# Submit application (server-side Playwright)
curl -X POST http://localhost:3000/api/apply \
  -H "Content-Type: application/json" \
  -d '{
    "jobUrl": "https://jobs.lever.co/ekimetrics/d9d64766-3d42-4ba9-94d4-f74cdaf20065",
    "profile": {
      "fullName": "Test User",
      "email": "test@example.com",
      "phone": "+1-555-123-4567"
    },
    "options": {
      "autoSubmit": false
    }
  }'
```

## WebSocket Testing

### Connection Test

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.send(JSON.stringify({
  type: 'REGISTER_EXTENSION',
  data: { extensionId: 'test-client' }
}));
```

Expected: Registration success message

## CAPTCHA Handling Test

### Detection Test

**Steps:**
1. Navigate to a page with CAPTCHA (e.g., create test page)
2. Click extension icon
3. Observe logs

**Expected:**
- CAPTCHA detection logged
- If service configured, solution attempted

### Manual Test Page

Create `test-captcha.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://www.google.com/recaptcha/api.js"></script>
</head>
<body>
  <form>
    <div class="g-recaptcha" data-sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"></div>
    <button type="submit">Submit</button>
  </form>
</body>
</html>
```

## Error Handling Tests

### Network Error

**Steps:**
1. Stop server
2. Try to use extension

**Expected:**
- Connection status shows "Disconnected"
- Retry attempts logged
- User-friendly error message

### Invalid Profile

**Steps:**
1. Clear profile
2. Navigate to job page
3. Click "Fill Form"

**Expected:**
- Error message about missing profile data

### Platform Not Supported

**Steps:**
1. Navigate to unsupported ATS URL
2. Click "Detect Fields"

**Expected:**
- Platform shown as "Unknown"
- Generic detection attempted

## Performance Tests

### Form Fill Speed

**Measure:**
- Time from click to completion
- Target: < 5 seconds for standard form

### Memory Usage

```javascript
// Check extension memory
chrome.system.memory.getInfo(info => console.log(info));
```

### Concurrent Connections

Test multiple browser windows connecting to same server.

## Test Results Template

```markdown
## Test Run: [Date]

### Environment
- Chrome Version: [version]
- Node.js Version: [version]
- OS: [os]

### Results

| Test | Status | Notes |
|------|--------|-------|
| Connection | ✅ | Connected in 1.2s |
| Profile Save | ✅ | All fields saved |
| Resume Upload | ✅ | PDF uploaded |
| Lever Detection | ✅ | All fields detected |
| Lever Fill | ✅ | 7/8 fields filled |
| CAPTCHA Detection | ⚠️ | None on test page |

### Issues Found
1. [Issue description]
2. [Issue description]

### Notes
- [Additional observations]
```

## Continuous Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

## Security Testing

### Input Validation

Test with malicious inputs:
```javascript
const maliciousInputs = [
  '<script>alert("xss")</script>',
  '"; DROP TABLE users; --',
  '../../../etc/passwd'
];
```

### Rate Limiting

```bash
# Test rate limit (should fail after 10 requests)
for i in {1..15}; do
  curl http://localhost:3000/api/status
done
```

Expected: 429 Too Many Requests after limit

## Debugging Tips

### Extension Console

1. Go to `chrome://extensions/`
2. Click "Service Worker" under extension
3. View console logs

### Content Script Console

1. Open DevTools on target page (F12)
2. Check Console tab
3. Filter by "Resume Auto Apply"

### Server Logs

```bash
# Real-time logs
tail -f logs/app.log

# Error logs only
tail -f logs/error.log

# Filter by level
grep "ERROR" logs/app.log
```
