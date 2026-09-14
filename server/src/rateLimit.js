const rateLimit = require('express-rate-limit');

// Generic login/register abuse protection.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// Tighter limit specifically for OTP send/resend/verify, since
// these are the endpoints most valuable to an attacker.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many OTP requests. Please wait before trying again.' },
});

module.exports = { authLimiter, otpLimiter };
