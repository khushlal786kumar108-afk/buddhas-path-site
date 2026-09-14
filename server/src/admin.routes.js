const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/users?query=&status=&verified=&page=&pageSize=
router.get('/users', async (req, res) => {
  const { query = '', status, verified, page = '1', pageSize = '20' } = req.query;
  const take = Math.min(parseInt(pageSize, 10) || 20, 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

  const where = {
    AND: [
      query ? { OR: [
        { fullName: { contains: query } },
        { email: { contains: query } },
        { mobile: { contains: query } },
        { registrationId: { contains: query } },
      ] } : {},
      status ? { status } : {},
      verified === 'true' ? { emailVerified: true, mobileVerified: true } : {},
      verified === 'false' ? { OR: [{ emailVerified: false }, { mobileVerified: false }] } : {},
    ],
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { registeredAt: 'desc' },
      skip, take,
      select: {
        id: true, fullName: true, email: true, mobile: true, registrationId: true,
        emailVerified: true, mobileVerified: true, status: true, role: true, registeredAt: true,
        // passwordHash and OTPs are intentionally never selected here.
      },
    }),
  ]);

  res.json({ total, page: Number(page), pageSize: take, users });
});

// PATCH /api/admin/users/:id/status  { status: "ACTIVE" | "DISABLED" }
router.patch('/users/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['ACTIVE', 'DISABLED'].includes(status)) {
    return res.status(400).json({ error: 'status must be ACTIVE or DISABLED.' });
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status } });
  // Disabling an account also revokes its active sessions immediately.
  if (status === 'DISABLED') {
    await prisma.session.updateMany({ where: { userId: user.id }, data: { revoked: true } });
  }
  res.json({ ok: true, user: { id: user.id, status: user.status } });
});

module.exports = router;
