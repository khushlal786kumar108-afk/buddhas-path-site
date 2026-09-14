const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// POST /api/contact  — used by both the Contact page and the
// homepage Feedback box; `source` distinguishes them.
router.post('/', authLimiter, validate(schemas.contact), async (req, res) => {
  const { name, email, subject, message, source } = req.body;
  const saved = await prisma.contactMessage.create({
    data: { name, email, subject, message, source },
  });
  res.status(201).json({ ok: true, id: saved.id });
});

// GET /api/contact  — admin only
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ messages });
});

// PATCH /api/contact/:id/handled — admin only
router.patch('/:id/handled', requireAuth, requireAdmin, async (req, res) => {
  const { handled = true } = req.body;
  const msg = await prisma.contactMessage.update({ where: { id: req.params.id }, data: { handled: !!handled } });
  res.json({ ok: true, message: msg });
});

module.exports = router;
