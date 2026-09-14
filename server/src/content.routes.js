const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Builds a standard set of public+admin CRUD routes for a simple
// "publishable content" model, to avoid repeating the same five
// handlers for Articles, Wisdom, Gallery, Events and Announcements.
function crudRouter(modelName, { defaultOrderBy = { createdAt: 'desc' } } = {}) {
  const r = express.Router();
  const model = prisma[modelName];

  // Public: only published items.
  r.get('/', async (req, res) => {
    const items = await model.findMany({ where: { published: true }, orderBy: defaultOrderBy });
    res.json({ items });
  });

  // Admin: everything, published or not.
  r.get('/admin', requireAuth, requireAdmin, async (req, res) => {
    const items = await model.findMany({ orderBy: defaultOrderBy });
    res.json({ items });
  });

  r.post('/', requireAuth, requireAdmin, async (req, res) => {
    const item = await model.create({ data: req.body });
    res.status(201).json({ item });
  });

  r.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
    const item = await model.update({ where: { id: req.params.id }, data: req.body });
    res.json({ item });
  });

  r.patch('/:id/publish', requireAuth, requireAdmin, async (req, res) => {
    const { published } = req.body;
    const item = await model.update({ where: { id: req.params.id }, data: { published: !!published } });
    res.json({ item });
  });

  r.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    await model.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });

  return r;
}

router.use('/articles', crudRouter('article'));
router.use('/wisdom', crudRouter('wisdomItem'));
router.use('/gallery', crudRouter('galleryImage', { defaultOrderBy: { createdAt: 'desc' } }));
router.use('/events', crudRouter('event', { defaultOrderBy: { date: 'asc' } }));
router.use('/announcements', crudRouter('announcement'));

// Daily Inspiration is a single "current thought" resource rather
// than a list, so it gets its own small set of routes.
router.get('/daily-inspiration', async (req, res) => {
  const latest = await prisma.dailyInspiration.findFirst({ orderBy: { activeDate: 'desc' } });
  res.json({ inspiration: latest });
});
router.post('/daily-inspiration', requireAuth, requireAdmin, async (req, res) => {
  const { thought } = req.body;
  if (!thought || !thought.trim()) return res.status(400).json({ error: 'Thought text is required.' });
  const created = await prisma.dailyInspiration.create({ data: { thought: thought.trim() } });
  res.status(201).json({ inspiration: created });
});

module.exports = router;
