// WebSocket Server for Extension Communication
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const ApplicationService = require('../services/applicationService');

class WebSocketServer {
  constructor(port) {
    this.port = port;
    this.wss = null;
    this.clients = new Map(); // extensionId -> WebSocket
    this.pendingTasks = new Map(); // taskId -> { resolve, reject, timeout }
    this.applicationService = new ApplicationService();
  }

  start() {
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      logger.info(`New WebSocket connection: ${clientId}`);

      ws.clientId = clientId;
      ws.isAlive = true;

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
          this.sendToClient(ws, {
            type: 'ERROR',
            error: error.message
          });
        }
      });

      ws.on('close', () => {
        logger.info(`WebSocket disconnected: ${ws.clientId}`);
        // Remove from clients map
        for (const [extId, client] of this.clients.entries()) {
          if (client === ws) {
            this.clients.delete(extId);
            break;
          }
        }
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for ${ws.clientId}:`, error);
      });
    });

    // Heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    logger.info(`WebSocket Server running on port ${this.port}`);
  }

  async handleMessage(ws, message) {
    const { type, data, taskId } = message;

    switch (type) {
      case 'REGISTER_EXTENSION':
        this.handleRegistration(ws, data);
        break;

      case 'TASK_RESULT':
        this.handleTaskResult(message);
        break;

      case 'ATS_PAGE_DETECTED':
        await this.handleAtsPageDetected(ws, data);
        break;

      case 'CAPTCHA_DETECTED':
        await this.handleCaptchaDetected(ws, data, taskId);
        break;

      case 'FORM_FILLED':
        logger.info('Form filled:', data);
        break;

      case 'APPLICATION_SUBMITTED':
        await this.handleApplicationSubmitted(ws, data);
        break;

      default:
        logger.warn('Unknown message type:', type);
    }
  }

  handleRegistration(ws, data) {
    const { extensionId } = data;
    this.clients.set(extensionId, ws);
    ws.extensionId = extensionId;
    
    logger.info(`Extension registered: ${extensionId}`);
    
    this.sendToClient(ws, {
      type: 'REGISTRATION_SUCCESS',
      data: { message: 'Connected to server' }
    });
  }

  handleTaskResult(message) {
    const { taskId, success, data, error } = message;
    const pending = this.pendingTasks.get(taskId);
    
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingTasks.delete(taskId);
      
      if (success) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(error || 'Task failed'));
      }
    }
  }

  async handleAtsPageDetected(ws, data) {
    logger.info('ATS page detected:', data);
    
    // Could trigger auto-fill if enabled
    // For now, just log it
  }

  async handleCaptchaDetected(ws, data, taskId) {
    logger.warn('CAPTCHA detected:', data);
    
    // Attempt to solve using external service
    try {
      const solution = await this.applicationService.solveCaptcha(data);
      
      if (solution) {
        this.sendToClient(ws, {
          type: 'CAPTCHA_SOLUTION',
          taskId,
          data: { solution }
        });
      } else {
        // Notify that human intervention is needed
        this.sendToClient(ws, {
          type: 'CAPTCHA_NEEDS_HUMAN',
          taskId,
          data: { message: 'Please solve the CAPTCHA manually' }
        });
      }
    } catch (error) {
      logger.error('Error solving CAPTCHA:', error);
    }
  }

  async handleApplicationSubmitted(ws, data) {
    logger.info('Application submitted:', data);
    
    // Store application record
    await this.applicationService.recordSubmission(data);
  }

  // Send command to extension and wait for result
  sendCommand(extensionId, command, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const ws = this.clients.get(extensionId);
      
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('Extension not connected'));
      }

      const taskId = uuidv4();
      
      const timeoutId = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error('Task timeout'));
      }, timeout);

      this.pendingTasks.set(taskId, { resolve, reject, timeout: timeoutId });

      this.sendToClient(ws, {
        ...command,
        taskId
      });
    });
  }

  // Send message to specific client
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // Broadcast to all connected extensions
  broadcast(message) {
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Get connected extension
  getExtension(extensionId) {
    return this.clients.get(extensionId);
  }

  // Get all connected extensions
  getConnectedExtensions() {
    return Array.from(this.clients.keys());
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
      logger.info('WebSocket server closed');
    }
  }
}

module.exports = WebSocketServer;
