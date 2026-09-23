const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

// Hash of the raw token, stored server-side in the Session table so
// a session can be revoked (logout) before the JWT would naturally
// expire — a plain JWT alone can't be invalidated early.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRegistrationId() {
  const n = crypto.randomInt(100000, 999999);
  return `BPE-${n}`;
}

module.exports = { signToken, verifyToken, hashToken, generateRegistrationId };
