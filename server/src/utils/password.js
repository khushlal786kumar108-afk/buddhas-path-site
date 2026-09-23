const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Simple, dependency-free strength check mirrored on the frontend —
// keep both in sync if you change the rules.
function isPasswordStrongEnough(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return false;
  let score = 0;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score >= 2;
}

module.exports = { hashPassword, verifyPassword, isPasswordStrongEnough };
