const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const env = require('../config/env');
const { validate, schemas } = require('../middleware/validate');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const { requireAuth } = require('../middleware/auth');
const { hashPassword, verifyPassword, isPasswordStrongEnough } = require('../utils/password');
const { generateOtpCode, hashOtp, verifyOtp: checkOtp, otpExpiryDate, maskEmail, maskMobile } = require('../utils/otp');
const { signToken, hashToken, generateRegistrationId } = require('../utils/jwt');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/emailService');
const { sendOtpSms } = require('../services/smsService');
const { generateRegistrationSlip } = require('../services/pdfService');

const router = express.Router();

const SESSION_DAYS = 7;

async function issueSession(res, req, user) {
  const token = signToken({ sub: user.id, role: user.role });
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      userAgent: req.headers['user-agent'] || null,
      ip: req.ip,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  res.cookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

async function issueOtp(userId, channel, destination) {
  const code = generateOtpCode();
  const codeHash = await hashOtp(code);
  await prisma.otp.create({
    data: { userId, channel, codeHash, expiresAt: otpExpiryDate() },
  });
  if (channel === 'email') await sendOtpEmail(destination, code);
  else await sendOtpSms(destination, code);
  if (env.DEV_LOG_OTP_TO_CONSOLE) {
    console.log(`[DEV ONLY] ${channel.toUpperCase()} OTP for ${destination}: ${code}`);
  }
}

// ---------------------------------------------------------------
// POST /api/auth/register
// Creates an unverified user, sends both OTPs. Frontend must then
// call /verify-otp before the account is usable.
// ---------------------------------------------------------------
router.post('/register', authLimiter, validate(schemas.register), async (req, res) => {
  const { fullName, email, mobile, password } = req.body;

  if (!isPasswordStrongEnough(password)) {
    return res.status(400).json({ error: 'Password is too weak. Use 8+ characters with a number and a symbol.' });
  }

  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { mobile }] } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email or mobile number already exists.' });
  }

  const passwordHash = await hashPassword(password);

  let registrationId;
  // Extremely unlikely collision loop, kept for safety.
  do { registrationId = generateRegistrationId(); }
  while (await prisma.user.findUnique({ where: { registrationId } }));

  const user = await prisma.user.create({
    data: { fullName, email, mobile, passwordHash, registrationId },
  });

  await issueOtp(user.id, 'email', email);
  await issueOtp(user.id, 'sms', mobile);

  res.status(201).json({
    userId: user.id,
    maskedEmail: maskEmail(email),
    maskedMobile: maskMobile(mobile),
    otpExpiryMinutes: env.OTP_EXPIRY_MINUTES,
    resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
  });
});

// ---------------------------------------------------------------
// POST /api/auth/resend-otp
// ---------------------------------------------------------------
router.post('/resend-otp', otpLimiter, validate(schemas.resendOtp), async (req, res) => {
  const { userId, channel } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'Registration session not found.' });
  if ((channel === 'email' && user.emailVerified) || (channel === 'sms' && user.mobileVerified)) {
    return res.status(400).json({ error: `${channel === 'email' ? 'Email' : 'Mobile'} is already verified.` });
  }

  const lastOtp = await prisma.otp.findFirst({
    where: { userId, channel },
    orderBy: { lastSentAt: 'desc' },
  });
  if (lastOtp) {
    const secondsSince = (Date.now() - lastOtp.lastSentAt.getTime()) / 1000;
    if (secondsSince < env.OTP_RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({
        error: `Please wait ${Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - secondsSince)}s before requesting another code.`,
        retryAfterSeconds: Math.ceil(env.OTP_RESEND_COOLDOWN_SECONDS - secondsSince),
      });
    }
  }

  await issueOtp(user.id, channel, channel === 'email' ? user.email : user.mobile);
  res.json({ ok: true, resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS });
});

// ---------------------------------------------------------------
// POST /api/auth/verify-otp
// Checks BOTH email and SMS codes together, marks the account
// verified, generates the PDF slip, and logs the user in.
// ---------------------------------------------------------------
router.post('/verify-otp', otpLimiter, validate(schemas.verifyOtp), async (req, res) => {
  const { userId, emailCode, smsCode } = req.body;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'Registration session not found.' });

  async function checkChannel(channel, code) {
    const otp = await prisma.otp.findFirst({
      where: { userId, channel, consumed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) return { ok: false, reason: 'No active code. Please resend.' };
    if (otp.expiresAt < new Date()) return { ok: false, reason: 'Code expired. Please resend.' };
    if (otp.attempts >= otp.maxAttempts) return { ok: false, reason: 'Too many incorrect attempts. Please resend.' };

    const valid = await checkOtp(code, otp.codeHash);
    if (!valid) {
      await prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return { ok: false, reason: 'Incorrect code.' };
    }
    await prisma.otp.update({ where: { id: otp.id }, data: { consumed: true } });
    return { ok: true };
  }

  const emailResult = await checkChannel('email', emailCode);
  const smsResult = await checkChannel('sms', smsCode);

  if (!emailResult.ok || !smsResult.ok) {
    return res.status(400).json({
      error: 'Verification failed.',
      emailError: emailResult.ok ? null : emailResult.reason,
      smsError: smsResult.ok ? null : smsResult.reason,
    });
  }

  const verifiedUser = await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, mobileVerified: true },
  });

  const { filename, filePath } = await generateRegistrationSlip({
    userId: verifiedUser.id,
    fullName: verifiedUser.fullName,
    email: verifiedUser.email,
    registrationId: verifiedUser.registrationId,
    registeredAt: verifiedUser.registeredAt,
  });
  await prisma.document.create({
    data: { userId: verifiedUser.id, type: 'registration_slip', filename, filePath },
  });

  await issueSession(res, req, verifiedUser);

  res.json({
    ok: true,
    user: {
      id: verifiedUser.id,
      fullName: verifiedUser.fullName,
      email: verifiedUser.email,
      registrationId: verifiedUser.registrationId,
    },
  });
});

// ---------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------
router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
  const { identifier, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { mobile: identifier }] },
  });

  // Same generic error whether the account doesn't exist or the
  // password is wrong — avoids leaking which emails are registered.
  const genericError = { error: 'Invalid email/mobile or password.' };
  if (!user) return res.status(401).json(genericError);
  if (user.status === 'DISABLED') return res.status(403).json({ error: 'This account has been disabled. Contact support.' });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return res.status(401).json(genericError);

  if (!user.emailVerified || !user.mobileVerified) {
    return res.status(403).json({
      error: 'Please complete OTP verification before logging in.',
      needsVerification: true,
      userId: user.id,
    });
  }

  await issueSession(res, req, user);
  res.json({
    ok: true,
    user: { id: user.id, fullName: user.fullName, email: user.email, registrationId: user.registrationId, role: user.role },
  });
});

// ---------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------
router.post('/logout', requireAuth, async (req, res) => {
  await prisma.session.update({
    where: { tokenHash: hashToken(req.sessionToken) },
    data: { revoked: true },
  });
  res.clearCookie(env.COOKIE_NAME);
  res.json({ ok: true });
});

// ---------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  const { id, fullName, email, mobile, registrationId, role, registeredAt } = req.user;
  res.json({ user: { id, fullName, email, mobile, registrationId, role, registeredAt } });
});

// ---------------------------------------------------------------
// POST /api/auth/forgot-password
// Always returns 200 with the same message, whether or not the
// email exists — prevents account enumeration.
// ---------------------------------------------------------------
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash, resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000) },
    });
    // FRONTEND_RESET_URL should point at your deployed frontend's
    // index.html (this single-page app reads ?token= on load and
    // shows the reset-password view automatically — see app.js).
    const resetUrl = `${process.env.FRONTEND_RESET_URL || 'http://localhost:5500/index.html'}?token=${rawToken}`;
    await sendPasswordResetEmail(email, resetUrl);
  }

  res.json({ ok: true, message: 'If this email is registered, reset instructions have been sent.' });
});

// ---------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), async (req, res) => {
  const { token, password } = req.body;
  if (!isPasswordStrongEnough(password)) {
    return res.status(400).json({ error: 'Password is too weak. Use 8+ characters with a number and a symbol.' });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await prisma.user.findFirst({ where: { resetTokenHash: tokenHash } });

  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetTokenHash: null, resetTokenExpires: null },
  });
  // Revoke all existing sessions on password reset, as good practice.
  await prisma.session.updateMany({ where: { userId: user.id }, data: { revoked: true } });

  res.json({ ok: true, message: 'Password updated. You can now log in.' });
});

module.exports = router;
