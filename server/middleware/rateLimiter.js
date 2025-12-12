// Rate Limiter Middleware
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { logger } = require('../utils/logger');

const rateLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 60
});

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (error) {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later'
    });
  }
};

module.exports = { rateLimiter: rateLimiterMiddleware };
