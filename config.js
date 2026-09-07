/* ==========================================================
   BUDDHA'S PATH OF EQUALITY — Environment Config
   This file MUST load before app.js (already wired in index.html
   as <script src="/config.js"></script> just above <script src="/app.js">).

   This is a plain static site with no build step, so it can't read
   Vercel (or any host's) environment variables at request time the
   way a server-rendered app can. This file is the ONE place that
   controls which backend the frontend talks to.
   ========================================================== */

(function () {

  // ============================================================
  // ⚠️  SET YOUR DEPLOYED BACKEND URL HERE  ⚠️
  // ------------------------------------------------------------
  // Deploy server/ first (see server/README.md — Render, Railway,
  // and Fly.io all work; Vercel does not run this Express server
  // as-is). Then paste its public URL below, ending in "/api".
  //
  // Example: 'https://buddhas-path-api.onrender.com/api'
  //
  // Leave the placeholder as-is and every feature that needs the
  // backend (register, login, dashboard, admin, contact) will show
  // a clear "Can't reach the server" message instead of pretending
  // to work — that is intentional, not a bug.
  // ============================================================
  const API_BASE_URL = 'https://your-backend-domain.example.com/api';

  // Local development convenience: when you're running the site on
  // your own machine (localhost/127.0.0.1) with the backend also
  // running locally (npm run dev in server/, listening on :4000),
  // this automatically points at that local backend instead of the
  // production URL above — no manual switching back and forth.
  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  window.BPE_API_BASE = isLocalDev ? 'http://localhost:4000/api' : API_BASE_URL;
})();
