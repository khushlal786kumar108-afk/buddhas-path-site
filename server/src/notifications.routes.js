const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /api/notifications — admin broadcasts a new notification to all users
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required.' });
  const notification = await prisma.notification.create({ data: { title, body } });
  res.status(201).json({ notification });
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ notifications });
});

module.exports = router;
