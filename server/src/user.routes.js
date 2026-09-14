const express = require('express');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { STORAGE_DIR } = require('../services/pdfService');

const router = express.Router();
router.use(requireAuth);

// GET /api/user/dashboard — everything the dashboard view needs in one call
router.get('/dashboard', async (req, res) => {
  const userId = req.user.id;
  const [documents, savedItems, notifReads, totalNotifs] = await Promise.all([
    prisma.document.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.savedItem.findMany({ where: { userId } }),
    prisma.notificationRead.findMany({ where: { userId }, select: { notificationId: true } }),
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);
  const readIds = new Set(notifReads.map(r => r.notificationId));
  const notifications = totalNotifs.map(n => ({ ...n, read: readIds.has(n.id) }));

  res.json({
    profile: {
      fullName: req.user.fullName,
      email: req.user.email,
      mobile: req.user.mobile,
      registrationId: req.user.registrationId,
      registeredAt: req.user.registeredAt,
    },
    documents,
    savedCount: savedItems.length,
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  });
});

// GET /api/user/documents/:id/download
router.get('/documents/:id/download', async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc || doc.userId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });
  const fullPath = path.join(STORAGE_DIR, '..', doc.filePath);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File missing on server.' });
  res.download(fullPath, doc.filename);
});

// POST /api/user/saved  { contentType, contentId }
router.post('/saved', async (req, res) => {
  const { contentType, contentId } = req.body;
  if (!contentType || !contentId) return res.status(400).json({ error: 'contentType and contentId are required.' });
  const item = await prisma.savedItem.upsert({
    where: { userId_contentType_contentId: { userId: req.user.id, contentType, contentId } },
    update: {},
    create: { userId: req.user.id, contentType, contentId },
  });
  res.status(201).json({ ok: true, item });
});

// DELETE /api/user/saved/:contentType/:contentId
router.delete('/saved/:contentType/:contentId', async (req, res) => {
  const { contentType, contentId } = req.params;
  await prisma.savedItem.deleteMany({ where: { userId: req.user.id, contentType, contentId } });
  res.json({ ok: true });
});

// POST /api/user/notifications/:id/read
router.post('/notifications/:id/read', async (req, res) => {
  await prisma.notificationRead.upsert({
    where: { userId_notificationId: { userId: req.user.id, notificationId: req.params.id } },
    update: {},
    create: { userId: req.user.id, notificationId: req.params.id },
  });
  res.json({ ok: true });
});

module.exports = router;
