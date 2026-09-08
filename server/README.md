# Buddha's Path of Equality — Backend

A real Node.js/Express API: authentication, email+SMS OTP verification,
sessions, PDF generation, CMS content, and an admin panel API.

> **Important — read this first:** I built and syntax-checked every file
> in this backend, but I could **not** run `npm install` or boot the
> server here, because this sandbox has no internet access. You'll need
> to run the commands below yourself. I'm confident in the code, but
> treat the first run as a real first run — read any error message it
> gives you, most will be a missing `.env` value.

---

## 1. What you need before you start (external services)

| # | Service | Why you need it | Free option to get started |
|---|---|---|---|
| 1 | **A database** | Stores users, content, sessions, everything. | Dev: nothing — SQLite works out of the box, zero setup. Production: [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app) all have a free Postgres tier. |
| 2 | **An SMTP email account** | Sends the email OTP and password-reset emails. | A Gmail account + an [App Password](https://myaccount.google.com/apppasswords) works for testing. For real sending volume, use [Postmark](https://postmarkapp.com) or [Resend](https://resend.com) (both have free tiers and are easier to keep out of spam folders than Gmail). |
| 3 | **An SMS provider** | Sends the mobile OTP. | [Twilio](https://www.twilio.com/try-twilio) has a free trial. If you're only sending to Indian numbers, MSG91 or Fast2SMS are cheaper long-term — see "Swapping the SMS provider" below. |
| 4 | **Node.js 18+** | Runs the server. | Install from [nodejs.org](https://nodejs.org) if you don't have it. |

You do **not** need anything else to get a working first version — no
cloud hosting account is required to run this on your own computer.

---

## 2. Setup steps (run these yourself, in order)

```bash
cd server
npm install                        # installs everything in package.json
cp .env.example .env                # then open .env and fill in real values
```

Fill in `.env`:
- `JWT_SECRET` — generate one with:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DATABASE_URL` — leave as `file:./dev.db` for now (SQLite, works immediately)
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` — your email provider's SMTP credentials
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` — from your Twilio console
- `CORS_ORIGIN` — the exact URL the frontend is opened from (see step 4)

```bash
npx prisma migrate dev --name init  # creates the SQLite database + tables
npm run seed:admin                  # creates your admin login from ADMIN_EMAIL/ADMIN_PASSWORD in .env
npm run dev                         # starts the API on http://localhost:4000
```

If it started correctly you'll see:
```
🕊️ Buddha's Path of Equality API listening on http://localhost:4000
```

Test it's alive: open `http://localhost:4000/api/health` in a browser —
you should see `{"ok":true,"env":"development"}`.

---

## 3. Don't have email/SMS credentials yet? You can still test today.

Leave `DEV_LOG_OTP_TO_CONSOLE=true` in `.env` (the default). If SMTP or
Twilio aren't configured, the server won't fail — it prints the OTP
code straight to your terminal instead, clearly labelled `[DEV ONLY]`.
This only ever works when `NODE_ENV=development`; it's structurally
impossible to enable in production, so there's no risk of it shipping
live. This lets you test the entire registration → OTP → PDF → login
flow today, before you've signed up for Twilio or an SMTP provider.

---

## 4. Connecting the frontend

The frontend (`../site/index.html`) now calls this API instead of
simulating everything. Two ways to run it locally:

- **Simplest:** open `site/index.html` directly with a local file
  server (e.g. the VS Code "Live Server" extension, or
  `python3 -m http.server 5500` from inside the `site/` folder), then
  set `CORS_ORIGIN` in the backend `.env` to match that URL
  (e.g. `http://localhost:5500` or `http://127.0.0.1:5500`).
- The frontend's API base URL is set at the top of `site/app.js`
  (`const API_BASE = 'http://localhost:4000/api'`) — change this if
  your backend runs on a different port or domain.

If the frontend can't reach the backend, it will show a clear "Can't
reach the server — is it running?" message instead of silently
failing or pretending an action succeeded.

---

## 5. Switching to Postgres for production

1. Create a free Postgres database at Neon, Supabase, or Railway and
   copy its connection string.
2. In `prisma/schema.prisma`, change:
   ```
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` in your production `.env` to that connection string.
4. Run `npx prisma migrate deploy` on the production server.

No other code changes are needed — every query in this codebase goes
through Prisma, which is database-agnostic.

---

## 6. Swapping the SMS provider

`src/services/smsService.js` is the only file that talks to Twilio.
To use MSG91, Fast2SMS, or another provider instead, replace the body
of `sendSms()` with that provider's API call, keeping the same
function signature (`{ to, body }` in, a Promise out). Nothing else
in the app needs to change.

---

## 7. Security notes — what's actually implemented

- Passwords: bcrypt, 12 salt rounds — plain text is never stored or logged.
- OTP codes: bcrypt-hashed before storage, never stored in plain text,
  expire after `OTP_EXPIRY_MINUTES`, capped retry attempts, resend cooldown.
- Sessions: httpOnly, sameSite cookies backed by a server-side Session
  table, so logout / password-reset can revoke a session immediately
  rather than waiting for the JWT to expire.
- Rate limiting: separate stricter limits on auth and OTP endpoints
  (`src/middleware/rateLimit.js`).
- Admin routes: every `/api/admin/*` and every content-management
  write route checks `role === 'ADMIN'` server-side — the frontend
  admin panel has no special access on its own, it's just calling the
  same protected API.
- Admin can never see a password or an OTP code — the `/api/admin/users`
  endpoint explicitly selects only non-secret fields, and OTP codes are
  never selectable at all (only their bcrypt hash exists in the DB).
- No secrets in frontend code — everything provider-specific
  (SMTP/Twilio credentials, JWT secret) lives only in the backend's
  `.env`, which is never sent to the browser.
- CORS is locked to the exact origin(s) you configure — not `*`.

## 8. What I did NOT build (be aware)

- **CSRF tokens**: because auth uses a `sameSite: lax` cookie + JSON
  API (not classic HTML form posts), the practical CSRF risk is low,
  but for a production deployment taking real payments or sensitive
  actions, consider adding `csurf` or a double-submit-cookie token on
  state-changing requests.
- **File upload for gallery images**: the CMS gallery routes accept an
  `imagePath` string (you paste a path/URL), not a real upload
  pipeline. Wiring actual image uploads needs a storage backend (S3,
  Cloudinary, or local disk with `multer`) — tell me if you want this
  built next.
- **Automated tests**: none included yet, given the sandbox couldn't
  run the code to verify test output either.
