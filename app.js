/* ==========================================================
   BUDDHA'S PATH OF EQUALITY — Frontend Application Logic
   Now wired to the real backend in ../server. If the backend
   isn't running, every API call fails gracefully with a clear
   "can't reach the server" message instead of pretending to work.
   ========================================================== */

// Set in config.js (loaded before this file) — see that file to
// point this at your deployed backend for production.
const API_BASE = window.BPE_API_BASE || 'http://localhost:4000/api';

const seenIntros = new Set();
let currentUser = null; // filled in from /api/auth/me or after login/verify

function $(sel, ctx=document){ return ctx.querySelector(sel); }
function $all(sel, ctx=document){ return [...ctx.querySelectorAll(sel)]; }

/* ---------------- API helper ---------------- */
async function api(path, { method='GET', body, admin=false } = {}){
  let res;
  try{
    res = await fetch(API_BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'include', // sends/receives the httpOnly session cookie
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch(networkErr){
    throw { networkError: true, message: "Can't reach the server — is the backend running? See server/README.md." };
  }
  let data = null;
  try{ data = await res.json(); } catch(_){ /* empty body, e.g. some 204s */ }
  if(!res.ok){
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function apiErrorMessage(err){
  if(err && err.networkError) return err.message;
  if(err && err.message) return err.message;
  return 'Something went wrong. Please try again.';
}

/* ---------------- View / Page Router ---------------- */
function showView(id){
  $all('.view').forEach(v=>v.classList.remove('active'));
  const v = document.getElementById(id);
  if(v){ v.classList.add('active'); window.scrollTo({top:0,behavior:'instant' in window ? 'instant':'auto'}); }
  closeMobileMenu();
  updateNavActive(id);
}

function updateNavActive(id){
  $all('.nav-links a, .mobile-menu a').forEach(a=>{
    a.classList.toggle('active', a.dataset.view === id);
  });
}

function goTo(pageId, introId){
  if(introId && !seenIntros.has(introId)){
    openIntro(introId, pageId);
  } else {
    showView(pageId);
    if(pageId === 'view-dashboard') loadDashboard();
  }
}

function openIntro(introId, targetPageId){
  $all('.intro').forEach(i=>i.style.display='none');
  const el = document.getElementById(introId);
  if(!el){ showView(targetPageId); return; }
  el.dataset.target = targetPageId;
  el.style.display = 'flex';
  el.querySelectorAll('[style*="animation"], .logo-badge, h1, .tagline, .intro-msg, .intro-actions, .skip, .foot-line, .opening-choices, .intro-eyebrow').forEach(n=>{
    n.style.animation = 'none'; void n.offsetWidth; n.style.animation = '';
  });
}

function closeIntro(introId){
  seenIntros.add(introId);
  const el = document.getElementById(introId);
  const target = el ? el.dataset.target : null;
  if(el) el.style.display = 'none';
  if(target){
    showView(target);
    if(target === 'view-dashboard') loadDashboard();
  }
}

function skipIntro(introId){ closeIntro(introId); }

/* ---------------- Mobile menu ---------------- */
function toggleMobileMenu(){ $('#mobileMenu').classList.toggle('open'); }
function closeMobileMenu(){ $('#mobileMenu') && $('#mobileMenu').classList.remove('open'); }

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 3600);
}

/* ---------------- Daily inspiration save/share ---------------- */
function toggleSave(btn){
  btn.classList.toggle('active');
  toast(btn.classList.contains('active') ? 'सहेजा गया — Saved to your favourites' : 'हटाया गया — Removed from favourites');
}
function shareThought(){ toast('Link copied — share the wisdom 🕊️'); }

/* ---------------- Gallery ---------------- */
function filterGallery(cat, btn){
  $all('.gtab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  $all('.gitem').forEach(g=>{
    g.style.display = (cat==='all' || g.dataset.cat===cat) ? '' : 'none';
  });
}
function openLightbox(src, cap){
  $('#lightboxImg').src = src;
  $('#lightboxCap') && ($('#lightboxCap').textContent = cap || '');
  $('#lightbox').classList.add('open');
}
function closeLightbox(){ $('#lightbox').classList.remove('open'); }

/* ---------------- Shared field-error helpers ---------------- */
function setFieldError(fieldId, msg){
  const field = document.getElementById(fieldId).closest('.field');
  field.classList.add('error');
  field.querySelector('.err-msg').textContent = msg;
}
function clearFieldErrors(formId){
  $all(`#${formId} .field`).forEach(f=>{ f.classList.remove('error'); });
}
function showServerError(boxId, msg){
  const box = document.getElementById(boxId);
  if(!box) return;
  box.style.display = '';
  box.querySelector('.err-msg').textContent = msg;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hideServerError(boxId){
  const box = document.getElementById(boxId);
  if(box) box.style.display = 'none';
}

function validateEmail(email){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

function passwordStrength(pw){
  let score = 0;
  if(pw.length >= 8) score++;
  if(/[A-Z]/.test(pw)) score++;
  if(/[0-9]/.test(pw)) score++;
  if(/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
function onRegPasswordInput(){
  const pw = $('#regPassword').value;
  const bar = $('#pwStrengthBar');
  const label = $('#pwStrengthLabel');
  const s = passwordStrength(pw);
  const pct = (s/4)*100;
  bar.style.width = pct+'%';
  const labels = ['Very weak','Weak','Fair','Good','Strong'];
  const colors = ['#C0503E','#C0503E','#C6A15B','#4C6B4F','#4C6B4F'];
  bar.style.background = colors[s];
  label.textContent = pw ? labels[s] : '';
}
function togglePw(inputId, btn){
  const input = document.getElementById(inputId);
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  btn.textContent = isPw ? '🙈' : '👁️';
}

/* ==========================================================
   REGISTRATION — real 4-step flow against the backend
   ========================================================== */
let regStep = 1;
let regContext = { userId: null, email: null, mobile: null, fullName: null };

function regGoStep(n){
  regStep = n;
  $all('.reg-step-panel').forEach(p=>p.classList.remove('active'));
  $(`#regStep${n}`).classList.add('active');
  $all('#regSteps .step').forEach((s,i)=>{
    s.classList.remove('active','done');
    if(i+1 < n) s.classList.add('done');
    if(i+1 === n) s.classList.add('active');
  });
}

async function submitRegistration(e){
  e.preventDefault();
  hideServerError('regServerError');
  clearFieldErrors('registerForm');

  const fullName = $('#regName').value.trim();
  const email = $('#regEmail').value.trim();
  const mobile = $('#regMobile').value.trim();
  const pw = $('#regPassword').value;
  const cpw = $('#regConfirmPassword').value;
  const terms = $('#regTerms').checked;

  let valid = true;
  if(fullName.length < 2){ setFieldError('regName','कृपया अपना पूरा नाम दर्ज करें / Please enter your full name'); valid=false; }
  if(!validateEmail(email)){ setFieldError('regEmail','कृपया एक मान्य ईमेल दर्ज करें / Enter a valid email address'); valid=false; }
  if(!/^\+?[0-9]{10,15}$/.test(mobile)){ setFieldError('regMobile','Enter a valid mobile number with country code, e.g. +91XXXXXXXXXX'); valid=false; }
  if(passwordStrength(pw) < 2){ setFieldError('regPassword','Password is too weak — use 8+ characters with a number & symbol'); valid=false; }
  if(pw !== cpw){ setFieldError('regConfirmPassword','Passwords do not match'); valid=false; }
  if(!terms){ toast('Please accept the Terms & Privacy Policy to continue'); valid=false; }
  if(!valid) return;

  const btn = $('#regSubmitBtn');
  btn.disabled = true; btn.textContent = 'Creating account...';
  try{
    const data = await api('/auth/register', { method:'POST', body:{ fullName, email, mobile, password: pw } });
    regContext = { userId: data.userId, email, mobile, fullName };
    $('#otpMaskedEmail').textContent = data.maskedEmail;
    $('#otpMaskedMobile').textContent = data.maskedMobile;
    hideServerError('otpServerError');
    $('#otpEmailCode').value = ''; $('#otpSmsCode').value = '';
    startResendCooldown('resendEmailBtn', data.resendCooldownSeconds);
    startResendCooldown('resendSmsBtn', data.resendCooldownSeconds);
    regGoStep(3);
    toast(`Verification codes sent — valid for ${data.otpExpiryMinutes} minutes`);
  } catch(err){
    if(err.status === 409){ setFieldError('regEmail', err.message); }
    else showServerError('regServerError', apiErrorMessage(err));
  } finally {
    btn.disabled = false; btn.textContent = 'CREATE MY ACCOUNT';
  }
}

async function submitOtpVerification(e){
  e.preventDefault();
  hideServerError('otpServerError');
  clearFieldErrors('otpForm');
  const emailCode = $('#otpEmailCode').value.trim();
  const smsCode = $('#otpSmsCode').value.trim();
  if(emailCode.length !== 6 || smsCode.length !== 6){
    showServerError('otpServerError', 'Enter both 6-digit codes.');
    return;
  }
  try{
    const data = await api('/auth/verify-otp', { method:'POST', body:{ userId: regContext.userId, emailCode, smsCode } });
    currentUser = { name: data.user.fullName, email: data.user.email, regId: data.user.registrationId, id: data.user.id };
    $('#successName').textContent = currentUser.name;
    $('#successEmail').textContent = currentUser.email;
    $('#successRegId').textContent = currentUser.regId;
    $('#successDate').textContent = new Date().toLocaleDateString('en-IN', {day:'2-digit', month:'long', year:'numeric'});
    updateDashboardGreeting();
    regGoStep(4);
    toast('Account verified — welcome to Buddha\'s Path of Equality 🕊️');
  } catch(err){
    if(err.data && (err.data.emailError || err.data.smsError)){
      showServerError('otpServerError', [err.data.emailError, err.data.smsError].filter(Boolean).join(' · '));
    } else {
      showServerError('otpServerError', apiErrorMessage(err));
    }
  }
}

function startResendCooldown(btnId, seconds){
  const btn = document.getElementById(btnId);
  if(!btn) return;
  let remaining = seconds;
  btn.disabled = true;
  const originalText = btn.dataset.label || btn.textContent;
  btn.dataset.label = originalText;
  const tick = () => {
    if(remaining <= 0){ btn.disabled = false; btn.textContent = originalText; return; }
    btn.textContent = `${originalText} (${remaining}s)`;
    remaining--;
    setTimeout(tick, 1000);
  };
  tick();
}

async function resendOtp(channel){
  const btnId = channel === 'email' ? 'resendEmailBtn' : 'resendSmsBtn';
  const flagId = channel === 'email' ? 'emailOtpFlag' : 'smsOtpFlag';
  try{
    const data = await api('/auth/resend-otp', { method:'POST', body:{ userId: regContext.userId, channel } });
    startResendCooldown(btnId, data.resendCooldownSeconds);
    document.getElementById(flagId).style.display = '';
    toast(`New ${channel === 'email' ? 'email' : 'mobile'} code sent`);
  } catch(err){
    toast(apiErrorMessage(err));
    if(err.data && err.data.retryAfterSeconds) startResendCooldown(btnId, err.data.retryAfterSeconds);
  }
}

async function downloadRegistrationSlip(){
  try{
    const dash = await api('/user/dashboard');
    const slip = dash.documents.find(d=>d.type === 'registration_slip');
    if(!slip){ toast('No registration document found yet.'); return; }
    window.open(`${API_BASE}/user/documents/${slip.id}/download`, '_blank');
  } catch(err){
    toast(apiErrorMessage(err));
  }
}

/* ==========================================================
   LOGIN / LOGOUT / SESSION
   ========================================================== */
async function submitLogin(e){
  e.preventDefault();
  clearFieldErrors('loginForm');
  const identifier = $('#loginId').value.trim();
  const pw = $('#loginPassword').value;
  let valid = true;
  if(!identifier){ setFieldError('loginId','Please enter your email or mobile number'); valid=false; }
  if(!pw){ setFieldError('loginPassword','Please enter your password'); valid=false; }
  if(!valid) return;

  try{
    const data = await api('/auth/login', { method:'POST', body:{ identifier, password: pw } });
    currentUser = { name: data.user.fullName, email: data.user.email, regId: data.user.registrationId, id: data.user.id, role: data.user.role };
    updateDashboardGreeting();
    toast('Signed in — welcome back 🕊️');
    if(currentUser.role === 'ADMIN'){
      showView('view-admin');
      adminRenderAll();
    } else {
      goTo('view-dashboard','intro-dashboard');
    }
  } catch(err){
    if(err.data && err.data.needsVerification){
      regContext.userId = err.data.userId;
      toast('Please verify your account first — check your email/SMS for the code.');
      goTo('view-register','');
      hideServerError('otpServerError');
      regGoStep(3);
    } else {
      setFieldError('loginPassword', apiErrorMessage(err));
    }
  }
}

async function submitAdminLogin(e){
  e.preventDefault();
  clearFieldErrors('adminLoginForm');
  const email = $('#adminEmail').value.trim();
  const pw = $('#adminPassword').value;
  let valid = true;
  if(!validateEmail(email)){ setFieldError('adminEmail','Enter a valid admin email'); valid=false; }
  if(!pw){ setFieldError('adminPassword','Enter the admin password'); valid=false; }
  if(!valid) return;

  try{
    const data = await api('/auth/login', { method:'POST', body:{ identifier: email, password: pw } });
    if(data.user.role !== 'ADMIN'){
      setFieldError('adminPassword', 'This account does not have admin access.');
      return;
    }
    currentUser = { name: data.user.fullName, email: data.user.email, regId: data.user.registrationId, id: data.user.id, role: 'ADMIN' };
    toast(`Welcome, ${data.user.fullName} — Admin Panel unlocked`);
    showView('view-admin');
    adminRenderAll();
  } catch(err){
    setFieldError('adminPassword', apiErrorMessage(err));
  }
}

function updateDashboardGreeting(){
  if(!currentUser) return;
  $all('.user-name-slot').forEach(el=> el.textContent = currentUser.name);
  $all('.user-email-slot').forEach(el=> el.textContent = currentUser.email);
  $all('.user-regid-slot').forEach(el=> el.textContent = currentUser.regId);
}

async function logout(){
  try{ await api('/auth/logout', { method:'POST' }); } catch(_){ /* ignore — clearing client state regardless */ }
  currentUser = null;
  toast('You have been signed out');
  showView('view-home');
}

/* ---------------- Forgot / Reset password ---------------- */
async function submitForgot(e){
  e.preventDefault();
  const email = $('#forgotEmail').value.trim();
  if(!validateEmail(email)){ toast('Please enter a valid email address'); return; }
  try{
    await api('/auth/forgot-password', { method:'POST', body:{ email } });
    $('#forgotForm').style.display = 'none';
    $('#forgotSuccess').style.display = 'flex';
  } catch(err){
    toast(apiErrorMessage(err));
  }
}

async function submitResetPassword(e){
  e.preventDefault();
  clearFieldErrors('resetForm');
  const pw = $('#resetPassword').value;
  const token = new URLSearchParams(window.location.search).get('token');
  if(!token){ toast('This reset link is missing its token.'); return; }
  if(passwordStrength(pw) < 2){ setFieldError('resetPassword','Password is too weak — use 8+ characters with a number & symbol'); return; }
  try{
    await api('/auth/reset-password', { method:'POST', body:{ token, password: pw } });
    $('#resetForm').style.display = 'none';
    $('#resetSuccess').style.display = 'flex';
  } catch(err){
    setFieldError('resetPassword', apiErrorMessage(err));
  }
}

/* ==========================================================
   DASHBOARD — real data from /api/user/dashboard
   ========================================================== */
async function loadDashboard(){
  try{
    const data = await api('/user/dashboard');
    currentUser = currentUser || {};
    currentUser.name = data.profile.fullName;
    currentUser.email = data.profile.email;
    currentUser.regId = data.profile.registrationId;
    updateDashboardGreeting();

    const savedEl = $('#dashSavedCount'); if(savedEl) savedEl.textContent = data.savedCount;
    const notifEl = $('#dashNotifCount'); if(notifEl) notifEl.textContent = data.unreadCount;
    const docsEl = $('#dashDocsList');
    if(docsEl){
      docsEl.innerHTML = data.documents.length
        ? data.documents.map(d=>`<div class="summary-row"><span>${d.filename}</span><button class="btn btn-ghost" style="padding:8px 14px;font-size:12.5px;" onclick="window.open('${API_BASE}/user/documents/${d.id}/download','_blank')">Download</button></div>`).join('')
        : '<p class="muted">No documents yet.</p>';
    }
    const notifListEl = $('#dashNotifList');
    if(notifListEl){
      notifListEl.innerHTML = data.notifications.length
        ? data.notifications.map(n=>`<div class="update-row" style="border-bottom:1px solid var(--line);"><div class="update-tag">${n.read?'Read':'New'}</div><div><h4>${n.title}</h4><p style="font-size:13px;margin-top:4px;">${n.body}</p></div></div>`).join('')
        : '<p class="muted">No notifications yet.</p>';
    }
  } catch(err){
    if(err.status === 401){
      toast('Please log in to view your dashboard.');
      showView('view-login');
    } else {
      toast(apiErrorMessage(err));
    }
  }
}

/* ==========================================================
   CONTACT / FEEDBACK — real submissions to the database
   ========================================================== */
async function submitContact(e){
  e.preventDefault();
  clearFieldErrors('contactForm');
  const name = $('#cName').value.trim();
  const email = $('#cEmail').value.trim();
  const subject = $('#cSubject').value.trim();
  const msg = $('#cMessage').value.trim();
  let valid = true;
  if(!name){ setFieldError('cName','Please enter your name'); valid=false; }
  if(!validateEmail(email)){ setFieldError('cEmail','Enter a valid email'); valid=false; }
  if(msg.length < 10){ setFieldError('cMessage','Please write a little more (min 10 characters)'); valid=false; }
  if(!valid) return;
  try{
    await api('/contact', { method:'POST', body:{ name, email, subject, message: msg, source:'contact' } });
    $('#contactForm').reset();
    $('#contactSuccess').style.display = 'flex';
    toast('Message sent — धन्यवाद for reaching out');
  } catch(err){
    toast(apiErrorMessage(err));
  }
}

async function submitFeedback(e){
  e.preventDefault();
  const msg = $('#fbMessage').value.trim();
  if(msg.length < 5){ toast('Please share a few more words of feedback'); return; }
  try{
    await api('/contact', { method:'POST', body:{
      name: currentUser ? currentUser.name : 'Anonymous',
      email: currentUser ? currentUser.email : 'anonymous@buddhaspathofequality.org',
      message: msg, source:'feedback',
    }});
    $('#fbMessage').value = '';
    toast('आपकी प्रतिक्रिया के लिए धन्यवाद — Feedback received');
  } catch(err){
    toast(apiErrorMessage(err));
  }
}

/* ==========================================================
   ADMIN PANEL — real CRUD against the backend
   ========================================================== */
function adminShowTab(tabId, link){
  $all('.admin-tab-link').forEach(l=>l.classList.remove('active'));
  link.classList.add('active');
  $all('.admin-tab-panel').forEach(p=> p.style.display = 'none');
  document.getElementById(tabId).style.display = '';
}
function adminOpenForm(type){ document.getElementById('admin'+capitalize(type)+'Form').style.display = ''; }
function adminCloseForm(type){ document.getElementById('admin'+capitalize(type)+'Form').style.display = 'none'; }
function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

function adminRowShell(title, subtitle, onDelete, extraBtn){
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 0;border-bottom:1px solid var(--line);';
  row.innerHTML = `<div style="min-width:0;"><b style="color:var(--navy);font-size:15px;">${title}</b><div class="muted" style="font-size:13px;margin-top:2px;">${subtitle}</div></div>`;
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex:none;';
  if(extraBtn) actions.appendChild(extraBtn);
  const del = document.createElement('button');
  del.className = 'btn btn-ghost';
  del.style.cssText = 'padding:8px 14px;font-size:12.5px;color:#C0503E;border-color:#e3c6bd;';
  del.textContent = 'Delete';
  del.onclick = onDelete;
  actions.appendChild(del);
  row.appendChild(actions);
  return row;
}

function publishToggleBtn(published, onToggle){
  const b = document.createElement('button');
  b.className = 'btn btn-ghost';
  b.style.cssText = 'padding:8px 14px;font-size:12.5px;';
  b.textContent = published ? 'Unpublish' : 'Publish';
  b.onclick = onToggle;
  return b;
}

// ---- Articles ----
async function adminRenderArticles(){
  try{
    const { items } = await api('/content/articles/admin');
    const list = $('#adminArticleList'); list.innerHTML = '';
    items.forEach(a=>{
      const btn = publishToggleBtn(a.published, async ()=>{
        await api(`/content/articles/${a.id}/publish`, { method:'PATCH', body:{ published: !a.published } });
        adminRenderArticles(); adminRenderStats();
      });
      list.appendChild(adminRowShell(a.title, `${a.category} — ${a.published?'Published':'Draft'}`, async ()=>{
        await api(`/content/articles/${a.id}`, { method:'DELETE' });
        adminRenderArticles(); adminRenderStats(); toast('Article deleted');
      }, btn));
    });
    const stat = $('#statArticles'); if(stat) stat.textContent = items.filter(i=>i.published).length;
  } catch(err){ toast(apiErrorMessage(err)); }
}
async function adminSaveArticle(){
  const title = $('#af_title').value.trim(), category = $('#af_cat').value.trim(), excerpt = $('#af_desc').value.trim();
  if(!title){ toast('Please enter an article title'); return; }
  try{
    await api('/content/articles', { method:'POST', body:{ title, category: category||'सामान्य', excerpt, body: excerpt, published: true } });
    $('#af_title').value=''; $('#af_cat').value=''; $('#af_desc').value='';
    adminCloseForm('article'); adminRenderArticles(); adminRenderStats();
    toast('Article published');
  } catch(err){ toast(apiErrorMessage(err)); }
}

// ---- Gallery ----
async function adminRenderGallery(){
  try{
    const { items } = await api('/content/gallery/admin');
    const list = $('#adminGalleryList'); list.innerHTML = '';
    items.forEach(g=>{
      list.appendChild(adminRowShell(g.caption, `Category: ${g.category}`, async ()=>{
        await api(`/content/gallery/${g.id}`, { method:'DELETE' });
        adminRenderGallery(); adminRenderStats(); toast('Image removed');
      }));
    });
    const stat = $('#statGallery'); if(stat) stat.textContent = items.length;
  } catch(err){ toast(apiErrorMessage(err)); }
}
async function adminSaveGallery(){
  const caption = $('#gf_caption').value.trim(), category = $('#gf_cat').value;
  if(!caption){ toast('Please enter a caption'); return; }
  try{
    // imagePath is a placeholder here — see server/README.md "What I did NOT build"
    // for wiring a real upload pipeline (S3/Cloudinary/multer).
    await api('/content/gallery', { method:'POST', body:{ caption, category, imagePath: 'placeholder.jpg', published: true } });
    $('#gf_caption').value='';
    adminCloseForm('gallery'); adminRenderGallery(); adminRenderStats();
    toast('Image entry added (upload requires backend file storage — see README)');
  } catch(err){ toast(apiErrorMessage(err)); }
}

// ---- Events ----
async function adminRenderEvents(){
  try{
    const { items } = await api('/content/events/admin');
    const list = $('#adminEventList'); list.innerHTML = '';
    items.forEach(ev=>{
      const dateStr = new Date(ev.date).toLocaleDateString('en-IN');
      list.appendChild(adminRowShell(ev.name, `${dateStr} · ${ev.time||'TBA'} · ${ev.location||'TBA'}`, async ()=>{
        await api(`/content/events/${ev.id}`, { method:'DELETE' });
        adminRenderEvents(); adminRenderStats(); toast('Event removed');
      }));
    });
    const stat = $('#statEvents'); if(stat) stat.textContent = items.length;
  } catch(err){ toast(apiErrorMessage(err)); }
}
async function adminSaveEvent(){
  const name = $('#ef_name').value.trim(), date = $('#ef_date').value, time = $('#ef_time').value.trim(), location = $('#ef_loc').value.trim();
  if(!name || !date){ toast('Please enter an event name and date'); return; }
  try{
    await api('/content/events', { method:'POST', body:{ name, date: new Date(date).toISOString(), time: time||'TBA', location: location||'TBA', published: true } });
    $('#ef_name').value=''; $('#ef_date').value=''; $('#ef_time').value=''; $('#ef_loc').value='';
    adminCloseForm('event'); adminRenderEvents(); adminRenderStats();
    toast('Event added');
  } catch(err){ toast(apiErrorMessage(err)); }
}

// ---- Announcements ----
async function adminRenderAnnouncements(){
  try{
    const { items } = await api('/content/announcements/admin');
    const list = $('#adminAnnouncementList'); list.innerHTML = '';
    items.forEach(an=>{
      list.appendChild(adminRowShell(an.message, '', async ()=>{
        await api(`/content/announcements/${an.id}`, { method:'DELETE' });
        adminRenderAnnouncements(); adminRenderStats(); toast('Announcement removed');
      }));
    });
    const stat = $('#statAnnouncements'); if(stat) stat.textContent = items.length;
  } catch(err){ toast(apiErrorMessage(err)); }
}
async function adminSaveAnnouncement(){
  const message = $('#an_msg').value.trim();
  if(!message){ toast('Please write an announcement'); return; }
  try{
    await api('/content/announcements', { method:'POST', body:{ message, published: true } });
    $('#an_msg').value='';
    adminCloseForm('announcement'); adminRenderAnnouncements(); adminRenderStats();
    toast('Announcement published');
  } catch(err){ toast(apiErrorMessage(err)); }
}

// ---- Daily Inspiration ----
async function adminLoadInspiration(){
  try{
    const { inspiration } = await api('/content/daily-inspiration');
    $('#ai_thought').value = inspiration ? inspiration.thought : '';
  } catch(err){ /* non-fatal */ }
}
async function adminSaveInspiration(){
  const thought = $('#ai_thought').value.trim();
  if(!thought){ toast("Please write today's thought"); return; }
  try{
    await api('/content/daily-inspiration', { method:'POST', body:{ thought } });
    toast('Daily inspiration updated for the homepage');
  } catch(err){ toast(apiErrorMessage(err)); }
}

// ---- Users ----
let userSearchDebounce;
function adminSearchUsersDebounced(){
  clearTimeout(userSearchDebounce);
  userSearchDebounce = setTimeout(adminRenderUsers, 350);
}
async function adminRenderUsers(){
  try{
    const query = ($('#adminUserSearch') && $('#adminUserSearch').value.trim()) || '';
    const { users, total } = await api(`/admin/users?query=${encodeURIComponent(query)}&pageSize=50`);
    const list = $('#adminUserList'); if(!list) return;
    list.innerHTML = '';
    users.forEach(u=>{
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:12px 0;border-bottom:1px solid var(--line);font-size:14px;';
      const verified = u.emailVerified && u.mobileVerified ? '✅ Verified' : '⏳ Unverified';
      const statusBtn = document.createElement('button');
      statusBtn.className = 'btn btn-ghost';
      statusBtn.style.cssText = 'padding:6px 12px;font-size:12px;';
      statusBtn.textContent = u.status === 'ACTIVE' ? 'Disable' : 'Enable';
      statusBtn.onclick = async ()=>{
        const newStatus = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
        await api(`/admin/users/${u.id}/status`, { method:'PATCH', body:{ status: newStatus } });
        adminRenderUsers();
        toast(`Account ${newStatus === 'ACTIVE' ? 'enabled' : 'disabled'}`);
      };
      row.innerHTML = `<span><b style="color:var(--navy);">${u.fullName}</b> · ${u.email}<br><span class="muted" style="font-size:12px;">${u.registrationId} · ${verified} · ${u.status}</span></span>`;
      row.appendChild(statusBtn);
      list.appendChild(row);
    });
    const stat = $('#statUsers'); if(stat) stat.textContent = total;
  } catch(err){ toast(apiErrorMessage(err)); }
}

// ---- Contact / Feedback ----
async function adminRenderFeedback(){
  try{
    const { messages } = await api('/contact');
    const list = $('#adminFeedbackList'); if(!list) return;
    list.innerHTML = messages.length ? '' : '<p class="muted">No messages yet — try the Contact or Feedback form on the site.</p>';
    messages.forEach(f=>{
      const row = document.createElement('div');
      row.style.cssText = 'padding:14px 0;border-bottom:1px solid var(--line);';
      row.innerHTML = `<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;"><span><b style="color:var(--navy);">${f.name}</b> <span class="muted" style="font-size:12.5px;">${f.email} · ${f.source}</span></span><span class="muted" style="font-size:12px;">${f.handled ? 'Handled' : 'New'}</span></div><p style="margin-top:6px;font-size:14px;">${f.subject ? `<b>${f.subject}:</b> `:''}${f.message}</p>`;
      list.appendChild(row);
    });
    const stat = $('#statFeedback'); if(stat) stat.textContent = messages.length;
  } catch(err){ toast(apiErrorMessage(err)); }
}

function adminRenderStats(){
  adminRenderUsers();
  adminRenderFeedback();
}

function adminRenderAll(){
  adminLoadInspiration();
  adminRenderArticles();
  adminRenderGallery();
  adminRenderEvents();
  adminRenderAnnouncements();
  adminRenderStats();
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  // If arriving from an emailed password-reset link (?token=...),
  // skip straight to the reset-password screen.
  const token = new URLSearchParams(window.location.search).get('token');
  if(token){
    showView('view-reset-password');
    return;
  }

  // No showView() call needed here — the opening intro (#intro-opening)
  // is visible by default via its own inline style in the HTML, not
  // through the .view system, so it's already showing at this point.

  // Silently check for an existing session (e.g. page refresh while
  // logged in) so the header/dashboard can reflect it if present.
  try{
    const { user } = await api('/auth/me');
    currentUser = { name: user.fullName, email: user.email, regId: user.registrationId, id: user.id, role: user.role };
    updateDashboardGreeting();
  } catch(_){ /* not logged in — normal for a fresh visit */ }
});
