const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

// Generates a numeric OTP of the configured length, e.g. "483920".
function generateOtpCode() {
  const digits = '0123456789';
  let code = '';
  for (let i = 0; i < env.OTP_LENGTH; i++) {
    code += digits[crypto.randomInt(0, digits.length)];
  }
  return code;
}

// OTP codes are hashed before storage — the raw code is only ever
// held in memory for the duration of one request (to send it), and
// is never written to the database or logs in production.
async function hashOtp(code) {
  return bcrypt.hash(code, 10);
}

async function verifyOtp(code, hash) {
  return bcrypt.compare(code, hash);
}

function otpExpiryDate() {
  return new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);
}

// Masks like j***n@example.com and +91XXXXX•6789
function maskEmail(email) {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(user.length - 1, 1))}@${domain}`;
}

function maskMobile(mobile) {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 4) return mobile;
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

module.exports = { generateOtpCode, hashOtp, verifyOtp, otpExpiryDate, maskEmail, maskMobile };
