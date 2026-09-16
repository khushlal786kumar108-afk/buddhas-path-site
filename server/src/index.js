const express = require('express');
require('express-async-errors'); // must be required before routes are defined
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const contentRoutes = require('./routes/content.routes');
const contactRoutes = require('./routes/contact.routes');
const notificationRoutes = require('./routes/notifications.routes');

const app = express();

// ---- Security & core middleware ----
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true, // required so the httpOnly session cookie is sent/received
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Basic request log in development only.
if (env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ---- Health check ----
app.get('/api/health', (req, res) => res.json({ ok: true, env: env.NODE_ENV }));

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/notifications', notificationRoutes);

// ---- 404 ----
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// ---- Central error handler (catches anything thrown/rejected above) ----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const isProd = env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProd ? 'Something went wrong.' : err.message,
  });
});

app.listen(env.PORT, () => {
  console.log(`🕊️ Buddha's Path of Equality API listening on http://localhost:${env.PORT}`);
  console.log(`   CORS allowed origins: ${env.CORS_ORIGIN.join(', ')}`);
  if (env.DEV_LOG_OTP_TO_CONSOLE) {
    console.log('   ⚠️  DEV_LOG_OTP_TO_CONSOLE is ON — OTP codes will print in this console.');
  }
});
