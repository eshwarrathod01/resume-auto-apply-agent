# EC2 Deployment Guide

This guide covers deploying the Resume Auto Apply Agent to AWS EC2.

## Prerequisites

- AWS Account
- EC2 instance (Ubuntu 22.04 recommended)
- SSH access to the instance
- Domain name (optional, for HTTPS)

## Instance Setup

### 1. Launch EC2 Instance

1. Go to AWS EC2 Console
2. Click "Launch Instance"
3. Select **Ubuntu Server 22.04 LTS**
4. Choose instance type: **t2.medium** or higher (for Playwright)
5. Configure security group:

```
Inbound Rules:
- SSH (22) - Your IP
- HTTP (3000) - 0.0.0.0/0 or specific IPs
- WebSocket (3001) - 0.0.0.0/0 or specific IPs
- HTTPS (443) - Optional, if using SSL
```

6. Create or select key pair
7. Launch instance

### 2. Connect to Instance

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 3. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be 18+
npm --version

# Install Playwright dependencies
sudo apt install -y \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0

# Install additional tools
sudo apt install -y git nginx certbot python3-certbot-nginx
```

### 4. Clone and Setup Project

```bash
# Clone repository
cd /home/ubuntu
git clone <your-repository-url> resume-auto-apply-agent
cd resume-auto-apply-agent

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Create logs directory
mkdir -p logs uploads

# Setup environment
cp .env.example .env
nano .env
```

### 5. Configure Environment

Edit `.env` file:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0
WS_PORT=3001
NODE_ENV=production

# Security - CHANGE THESE!
JWT_SECRET=generate-a-strong-random-key
ENCRYPTION_KEY=generate-32-character-key-here!

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Playwright
HEADLESS=true
SLOW_MO=0

# CAPTCHA (if using)
CAPTCHA_SERVICE=2captcha
CAPTCHA_API_KEY=your-api-key

# Logging
LOG_LEVEL=info
```

Generate secure keys:
```bash
# Generate JWT secret
openssl rand -hex 32

# Generate encryption key (32 characters)
openssl rand -hex 16
```

### 6. Setup Process Manager (PM2)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application
pm2 start server/index.js --name resume-agent

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command it outputs

# Check status
pm2 status
pm2 logs resume-agent
```

### 7. Configure Nginx Reverse Proxy

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/resume-agent
```

Add this configuration:

```nginx
# HTTP API Server
server {
    listen 80;
    server_name your-domain.com;  # or use EC2 public IP

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

# WebSocket Server
server {
    listen 81;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/resume-agent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 8. SSL Certificate (Optional but Recommended)

```bash
# For domain name
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Updating Chrome Extension

Update the extension to point to your EC2 server:

1. Edit `extension/background.js`:
```javascript
const SERVER_URL = 'http://your-ec2-ip:3000';
const WS_URL = 'ws://your-ec2-ip:3001';
```

Or for HTTPS:
```javascript
const SERVER_URL = 'https://your-domain.com';
const WS_URL = 'wss://your-domain.com:81';
```

2. Reload the extension in Chrome

## Monitoring

### View Logs

```bash
# PM2 logs
pm2 logs resume-agent

# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log
```

### Monitor Resources

```bash
# PM2 monitoring
pm2 monit

# System resources
htop
```

### Health Check

```bash
# API health
curl http://localhost:3000/health

# From external
curl http://your-ec2-ip:3000/health
```

## Troubleshooting

### Application won't start

```bash
# Check PM2 status
pm2 status
pm2 logs resume-agent --lines 100

# Check for port conflicts
sudo lsof -i :3000
sudo lsof -i :3001
```

### WebSocket connection fails

1. Check security group allows port 3001
2. Verify Nginx WebSocket configuration
3. Check browser console for errors

### Playwright errors

```bash
# Reinstall browsers
npx playwright install chromium

# Check dependencies
npx playwright install-deps

# Test Playwright
node -e "const {chromium} = require('playwright'); chromium.launch().then(b => {console.log('OK'); b.close()})"
```

### Memory issues

```bash
# Check memory usage
free -m

# If low memory, add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Backup

### Backup Application Data

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz logs/

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete
EOF

chmod +x backup.sh

# Add to cron
crontab -e
# Add: 0 2 * * * /home/ubuntu/resume-auto-apply-agent/backup.sh
```

## Security Recommendations

1. **Use HTTPS**: Always use SSL in production
2. **Restrict IPs**: Limit security group access
3. **Update regularly**: Keep system and dependencies updated
4. **Monitor logs**: Set up log monitoring/alerts
5. **Use secrets manager**: Consider AWS Secrets Manager for sensitive data
6. **Enable MFA**: Use MFA on AWS account
7. **Backup regularly**: Automate backups

## Cost Optimization

- Use **t2.micro** for testing (free tier eligible)
- Use **t2.medium** or **t3.medium** for production
- Consider **spot instances** for non-critical workloads
- Set up **auto-shutdown** during off-hours

## Architecture for Scale

For high-volume usage:

```
                    ┌─────────────┐
                    │   Route 53  │
                    │     DNS     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     ALB     │
                    │ Load Balancer│
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │   EC2 #1    │ │   EC2 #2    │ │   EC2 #3    │
    │   Server    │ │   Server    │ │   Server    │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │   ElastiCache│
                    │    Redis    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    RDS      │
                    │  PostgreSQL │
                    └─────────────┘
```

This requires additional setup for:
- Redis for session/state sharing
- PostgreSQL for persistent storage
- Application Load Balancer with WebSocket support
