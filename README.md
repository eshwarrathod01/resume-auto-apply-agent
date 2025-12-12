# Resume Auto Apply Agent

An automated job application system with a Chrome extension and server-side backend for submitting applications on ATS platforms like Lever, Greenhouse, Workday, and Glassdoor.

## Features

- 🚀 **Automated Form Filling**: Automatically fills job application forms with your profile data
- 🔌 **Chrome Extension**: Browser extension for direct interaction with ATS pages
- 🖥️ **Server Backend**: Node.js server with WebSocket communication for real-time control
- 🛡️ **CAPTCHA Handling**: Integration with CAPTCHA solving services (2captcha, AntiCaptcha)
- 📄 **Resume Upload**: Automatic resume and cover letter attachment
- 🔒 **Security**: Encrypted storage of sensitive data, rate limiting, secure communication
- 📊 **Application Tracking**: Track all submitted applications with status updates

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Lever | ✅ Full Support | Including jobs.lever.co |
| Greenhouse | ✅ Full Support | All Greenhouse job boards |
| Workday | ✅ Full Support | Multi-page applications |
| Glassdoor | ✅ Full Support | Quick apply supported |
| SmartRecruiters | 🔄 Beta | Basic support |
| iCIMS | 🔄 Beta | Basic support |
| Taleo | 🔄 Beta | Requires account creation |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Popup UI  │  │  Background │  │  Content Scripts    │  │
│  │             │  │   Service   │  │  (Lever, Greenhouse │  │
│  │  - Profile  │  │   Worker    │  │   Workday, etc.)    │  │
│  │  - Apply    │  │             │  │                     │  │
│  │  - Settings │  │  WebSocket  │  │  - Form Detection   │  │
│  │  - Logs     │  │  Client     │  │  - Auto Fill        │  │
│  └─────────────┘  └──────┬──────┘  │  - CAPTCHA Detect   │  │
│                          │         └─────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │ WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Server Backend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Express   │  │  WebSocket  │  │    Application      │  │
│  │   REST API  │  │   Server    │  │    Service          │  │
│  │             │  │             │  │                     │  │
│  │  - Profile  │  │  - Tasks    │  │  - Playwright       │  │
│  │  - Apply    │  │  - Events   │  │  - CAPTCHA Solver   │  │
│  │  - History  │  │  - Status   │  │  - Form Handler     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Chrome browser
- npm or yarn

### Installation

1. **Clone and install dependencies:**

```bash
cd "Resume Auto Apply Agent"
npm install
```

2. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start the server:**

```bash
npm start
```

4. **Load the Chrome extension:**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

### Usage

1. Click the extension icon in Chrome
2. Fill in your profile information (Profile tab)
3. Upload your resume
4. Navigate to a job application page
5. Click "Detect Fields" to see what the agent found
6. Click "Fill Form" to auto-fill your information
7. Review the filled form
8. Click "Submit" or manually submit

## Configuration

### Server Configuration (.env)

```env
# Server
PORT=3000
WS_PORT=3001
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-character-key

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=10
RATE_LIMIT_WINDOW_MS=60000

# CAPTCHA Service (optional)
CAPTCHA_SERVICE=2captcha
CAPTCHA_API_KEY=your-api-key

# Playwright
HEADLESS=true
SLOW_MO=50
```

### Extension Settings

Access through the extension popup → Settings tab:

- **Server URL**: Backend server address
- **WebSocket URL**: Real-time communication endpoint
- **Auto-fill**: Automatically fill forms when detected
- **Auto-submit**: Submit applications automatically (use with caution)

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/status` | API status |
| POST | `/api/apply` | Submit job application |
| GET | `/api/history` | Get application history |
| POST | `/api/profile` | Save user profile |
| GET | `/api/profile` | Get user profile |
| POST | `/api/profile/resume` | Upload resume |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `REGISTER_EXTENSION` | Client → Server | Register extension instance |
| `FILL_FORM` | Server → Client | Command to fill form |
| `SUBMIT_APPLICATION` | Server → Client | Command to submit |
| `CAPTCHA_DETECTED` | Client → Server | CAPTCHA found on page |
| `TASK_RESULT` | Client → Server | Result of task execution |

## CAPTCHA Handling

The agent supports multiple approaches for handling CAPTCHAs:

### 1. Manual Solving
When a CAPTCHA is detected, you'll be notified to solve it manually.

### 2. External Services
Configure a CAPTCHA solving service:

- **2captcha**: Set `CAPTCHA_SERVICE=2captcha` and provide API key
- **AntiCaptcha**: Set `CAPTCHA_SERVICE=anticaptcha`
- **CapSolver**: Set `CAPTCHA_SERVICE=capsolver`

### 3. Browser Extension Approach
The Chrome extension can handle CAPTCHAs that appear during form filling, as it runs in a real browser context with full JavaScript support.

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed EC2 deployment instructions.

### Quick EC2 Setup

```bash
# On EC2 instance
sudo apt update
sudo apt install -y nodejs npm

# Clone project
git clone <repository-url>
cd resume-auto-apply-agent

# Install and start
npm install
npm start
```

## Security Considerations

- 🔐 Personal data is encrypted before storage
- 🚦 Rate limiting prevents abuse
- 🔒 Helmet.js secures HTTP headers
- 🛡️ Input validation on all endpoints
- 📝 All actions are logged for audit

## Troubleshooting

### Extension not connecting

1. Check server is running
2. Verify WebSocket URL in settings
3. Check browser console for errors

### Form not filling correctly

1. Try "Detect Fields" first
2. Check if platform is supported
3. Verify profile data is complete

### CAPTCHA blocking

1. Solve manually if no service configured
2. Check CAPTCHA service API key
3. Consider using browser extension mode

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Submit pull request

## License

MIT License - see LICENSE file

## Disclaimer

This tool is for educational purposes. Use responsibly and in compliance with the terms of service of the platforms you're applying to. The authors are not responsible for any misuse or consequences of using this software.
