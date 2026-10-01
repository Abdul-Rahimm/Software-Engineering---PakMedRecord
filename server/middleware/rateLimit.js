const { rateLimit } = require('express-rate-limit');

// Slow down password guessing: 10 sign-in attempts per 10 minutes per IP (SIGNIN_RATE_LIMIT overrides)
const signinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.SIGNIN_RATE_LIMIT) || 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
});

// Keep AI spend bounded: 20 AI requests per minute per signed-in user (AI_RATE_LIMIT overrides)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.AI_RATE_LIMIT) || 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user.role}:${req.user.cnic}`,
  message: { error: 'You are sending messages too quickly. Please wait a moment.' },
});

module.exports = { signinLimiter, aiLimiter };
