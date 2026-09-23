// Run with: npm run seed:admin
// Creates (or promotes) the admin account defined by ADMIN_EMAIL /
// ADMIN_PASSWORD / ADMIN_NAME in .env. Safe to re-run.
require('dotenv').config();
const prisma = require('../lib/prisma');
const { hashPassword } = require('./password');
const { generateRegistrationId } = require('./jwt');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || 'Administrator';

  if (!email || !password) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await hashPassword(password);

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN', passwordHash, emailVerified: true, mobileVerified: true, status: 'ACTIVE' },
    });
    console.log(`✔ Existing user ${email} promoted to ADMIN and password updated.`);
  } else {
    const registrationId = generateRegistrationId();
    await prisma.user.create({
      data: {
        fullName, email, passwordHash, role: 'ADMIN',
        emailVerified: true, mobileVerified: true, registrationId,
      },
    });
    console.log(`✔ Admin account created: ${email} (Registration ID: ${registrationId})`);
  }
  console.log('You can now log in at /api/auth/login with this email and password.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
