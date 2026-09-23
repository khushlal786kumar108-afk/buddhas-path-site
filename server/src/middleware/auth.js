const env = require('../config/env');
const prisma = require('../lib/prisma');
const { verifyToken, hashToken } = require('../utils/jwt');

/**
 * Reads the session cookie, verifies the JWT, and confirms the
 * matching Session row is still valid (not revoked/expired) — this
 * is what lets logout actually invalidate a session immediately
 * instead of waiting for the JWT to expire on its own.
 */
async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[env.COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });

    const payload = verifyToken(token);
    const tokenHash = hashToken(token);

    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revoked || session.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'DISABLED') {
      return res.status(401).json({ error: 'Account is not active.' });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
