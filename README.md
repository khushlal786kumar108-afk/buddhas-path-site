# 🕊️ Buddha's Path of Equality ☸️

A peaceful, premium platform for wisdom, compassion, humanity and equality —
now wired to a **real backend** (see `../server/`).

## What's in this package

```
buddhas-path-of-equality/
├── index.html        ← the entire frontend (all pages, all intros)
├── style.css          ← full design system (colors, type, components)
├── app.js             ← navigation + real API calls to the backend
├── config.js           ← ⚠️ edit this to point at your deployed backend
├── vercel.json         ← explicit static-site config for Vercel
├── assets/images/     ← your uploaded logo + images, sorted by section
└── README.md          ← this file

../server/             ← the real backend — see server/README.md
```

## Deploying to Vercel

**Deploy this `site/` folder only** — never the repo root, and never
`server/`. The backend is a traditional Node/Express process
(`app.listen(...)`), which Vercel's serverless model does not run
as-is; it needs a different host (see `server/README.md`).

Exact Vercel dashboard settings:

| Setting | Value |
|---|---|
| Root Directory | `site` |
| Framework Preset | **Other** |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty / default)* |
| Install Command | *(leave empty — there's no `package.json` here, nothing to install)* |
| Environment Variables | **None required** — this static frontend holds no secrets |

`vercel.json` in this folder makes these explicit so Vercel doesn't
guess wrong, but the Root Directory dashboard setting above still
needs to be set by you — it can't be set from inside the repo.

**Why the previous deploy showed plain unstyled HTML:** every asset
was referenced with a relative path (`style.css`, not `/style.css`).
That works when `site/` is genuinely the serving root, but if Vercel
ever resolves the page at a URL without a trailing slash (e.g.
because Root Directory wasn't set and it served `/site` instead of
`/`), the browser resolves every relative asset against the wrong
base path and everything 404s — HTML renders, nothing else does.
Every path in `index.html` is now root-relative (`/style.css`,
`/app.js`, `/assets/...`), which resolves correctly regardless of
that trailing-slash edge case, as long as Root Directory is set
correctly above.

### Connecting the deployed frontend to a real backend

This deployment is **not connected to a backend by default**.
`config.js` is the one file that controls this — open it and replace
`API_BASE_URL` with your backend's real public URL once it's
deployed (see `server/README.md` for where to host it). Until you do
that, every feature that needs the backend (register, login,
dashboard, admin, contact) will show a clear "Can't reach the
server" message — by design, not a bug — rather than pretending to
work.

## Running the full, real system

1. Start the backend first — follow `../server/README.md` exactly
   (`npm install`, fill in `.env`, `npx prisma migrate dev`,
   `npm run seed:admin`, `npm run dev`). It listens on
   `http://localhost:4000` by default.
2. Serve this `site/` folder with any local static server, e.g.:
   ```bash
   cd site
   python3 -m http.server 5500
   ```
   then open `http://localhost:5500/index.html`.
3. Make sure the backend's `.env` has `CORS_ORIGIN=http://localhost:5500`
   (or whatever port you used) — otherwise the browser will block the
   requests and you'll see the "Can't reach the server" message.
4. If your backend runs on a different host/port, update the
   `API_BASE` constant at the very top of `app.js`.

You do not have to run the backend to look at the design — opening
`index.html` on its own still shows every page and intro. Anything
that needs real data (register, login, dashboard, admin, contact)
will show a clear "Can't reach the server — is the backend running?"
message instead of pretending to work, until the backend is running.

## What's real now vs. what's still a demo

| Feature | Status |
|---|---|
| Registration → email OTP + SMS OTP → verified → PDF → auto-login | **Real**, against the backend in `../server` |
| Login / logout / forgot / reset password | **Real** |
| User dashboard (profile, documents, notifications) | **Real** — pulled live from `/api/user/dashboard` |
| Registration PDF | **Real** — generated server-side, downloadable from the dashboard |
| Admin login | **Real** — same `/api/auth/login`, gated on `role === 'ADMIN'` server-side |
| Admin: Users (search/filter/enable/disable) | **Real** |
| Admin: Articles / Wisdom / Gallery / Events / Announcements / Daily Inspiration | **Real CRUD**, publish/unpublish included |
| Contact & Feedback forms | **Real** — saved to the database, visible in Admin → Feedback & Messages |
| Gallery **image upload** in the admin panel | **Still a placeholder** — you can create a gallery entry with a caption/category, but it doesn't yet accept a real image file. Needs a file-upload pipeline (S3/Cloudinary/multer) — see "What I did NOT build" in `server/README.md`. |
| Email/SMS delivery | **Real code**, but needs your own SMTP + Twilio (or equivalent) credentials in `server/.env` to actually send. Without them, codes print to the backend's terminal in development mode instead — see `server/README.md` section 3. |

## A note on how this was built

This sandbox has no internet access, so every backend file was written
and syntax-checked (`node --check`), but never `npm install`-ed or
booted live here. The frontend was tested end-to-end against the
backend being *intentionally offline*, to confirm it fails safely and
honestly rather than faking success. Run it yourself following
`server/README.md` for the first real, live end-to-end test.
