/* ===========================
   Typer CS2 — lokalny (script.js)
   - localStorage keys: typer_users, typer_matches, typer_types
   - Admin e-mail: paweloxbieniek1@gmail.com
   =========================== */

/* ---------- Konfiguracja ---------- */
const ADMIN_EMAIL = "paweloxbieniek1@gmail.com";
const STORAGE_USERS = "typer_users";
const STORAGE_MATCHES = "typer_matches";
const STORAGE_TYPES = "typer_types";

/* ---------- Stan aplikacji ---------- */
let session = { googleID: null, email: null, nick: null, role: "user" };
let users = JSON.parse(localStorage.getItem(STORAGE_USERS) || "[]");
let matches = JSON.parse(localStorage.getItem(STORAGE_MATCHES) || "[]");
let types = JSON.parse(localStorage.getItem(STORAGE_TYPES) || "[]");

/* ---------- Helpery ---------- */
const $ = id => document.getElementById(id);
const nowISO = () => (new Date()).toISOString();

function saveAll(){
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
  localStorage.setItem(STORAGE_MATCHES, JSON.stringify(matches));
  localStorage.setItem(STORAGE_TYPES, JSON.stringify(types));
}

/* JWT decode small util */
function parseJwt(token){
  try{
    const p = token.split('.')[1];
    return JSON.parse(decodeURIComponent(atob(p).split('').map(c=>'%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  }catch(e){ return null; }
}

/* Notification */
function notify(msg = "✔ Zapisano", green = true){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position = 'fixed'; el.style.right = '18px'; el.style.top = '18px';
  el.style.background = green ? '#16a34a' : '#ef4444';
  el.style.color = '#fff'; el.style.padding = '8px 12px'; el.style.borderRadius = '8px';
  el.style.boxShadow = '0 8px 30px rgba(0,0,0,0.4)'; el.style.zIndex = 9999;
  document.body.appendChild(el);
  setTimeout(()=> el.style.opacity = '0', 1400);
  setTimeout(()=> el.remove(), 2000);
}

/* ---------- Google Sign-In callback (global for gsi) ---------- */
function onGoogleSignIn(response){
  const payload = parseJwt(response.credential);
  if(!payload){ alert("Błąd logowania (token)"); return; }
  session.googleID = payload.sub;
  session.email = payload.email;
  session.nick = payload.name || null;
  session.role = (session.email === ADMIN_EMAIL) ? "admin" : "user";

  // if user exists -> restore nick and points; otherwise require nick input
  const found = users.find(u => u.googleID === session.googleID);
  if(found){
    session.nick = found.nick;
    session.role = found.role || session.role;
    openMainUI();
  } else {
    // show nick setup
    $('loginCard').classList.add('hidden');
    $('nickCard').classList.remove('hidden');
    $('nickInput').value = session.nick || "";
  }
}

/* ---------- Nick setup handlers ---------- */
$('saveNickBtn').addEventListener('click', () => {
  const v = $('nickInput').value.trim();
  if(!v){ $('nickMsg').textContent = "Nick jest wymagany"; return; }
  session.nick = v;
  // add to users
  users.push({ googleID: session.googleID, email: session.email, nick: session.nick, points: 0, role: session.role });
  saveAll();
  $('nickCard').classList.add('hidden');
  openMainUI();
});
$('cancelNickBtn').addEventListener('click', () => { // logout fallback
  location.reload();
});

/* ---------- Open main UI ---------- */
function openMainUI(){
  $('loginCard').classList.add('hidden');
  $('nickCard').classList.add('hidden');
  $('mainApp').classList.remove('hidden');
  // show admin panel if admin
  if(session.role === "admin") $('tabAdminBtn').style.display = 'inline-flex';
  else $('tabAdminBtn').style.display = 'none';
  $('userDisplay').textContent = `${session.nick} (${session.email})`;
  $('userNickDisplay').textContent = session.nick;
  updateUserPoints();
  renderAll();
}

/* ---------- Logout ---------- */
$('logoutBtn').addEventListener('click', () => {
  // disable auto select in GSI and reload
  try{ google.accounts.id.disableAutoSelect(); }catch(e){}
  session = { googleID:null, email:null, nick:null, role:"user" };
  location.reload();
});

/* ---------- Tabs ---------- */
$('tabTypesBtn').addEventListener('click', ()=> showView('types'));
$('tabRankingBtn').addEventListener('click', ()=> showView('ranking'));
$('tabAdminBtn').addEventListener('click', ()=> showView('admin'));

function showView(v){
  // hide all
  $('viewTypes').classList.toggle('hidden', v!=='types');
  $('viewRanking').classList.toggle('hidden', v!=='ranking');
  $('adminPanel').classList.toggle('hidden', v!=='admin');
  // active class on buttons
  ['tabTypesBtn','tabRankingBtn','tabAdminBtn'].forEach(id => $(id).classList.remove('active'));
  if(v==='types') $('tabTypesBtn').classList.add('active');
  if(v==='ranking') $('tabRankingBtn').classList.add('active');
  if(v==='admin') $('tabAdminBtn').classList.add('active');
}

/* ---------- Render functions ---------- */
function renderAll(){
  renderMatchesList();
  renderRanking();
  renderHistory();
  renderAdminLists();
}

/* Matches list with filtering and countdowns */
function renderMatchesList(){
  const container = $('matchesList');
  container.innerHTML = '';
  const filterDate = $('filterDate').value; // yyyy-mm-dd or ''
  // sort by start asc
  const list = [...matches].sort((a,b)=> new Date(a.start) - new Date(b.start));
  list.forEach(m=>{
    // filter by date if set
    if(filterDate){
      const sd = new Date(m.start).toISOString().slice(0,10);
      if(sd !== filterDate) return;
    }

    const start = new Date(m.start);
    const now = new Date();
    const open = now < start;
    const timeLeft = Math.max(0, start - now);
    const hours = Math.floor(timeLeft / (1000*60*60));
    const mins = Math.floor((timeLeft % (1000*60*60)) / (1000*60));
    const secs = Math.floor((timeLeft % (1000*60)) / 1000);
    const countdown = open ? `${hours}h ${mins}m ${secs}s` : (m.finished ? 'Zakończony' : 'W toku');

    // current user type for this match
    const userType = types.find(t => t.matchID === m.id && t.googleID === session.googleID);

    const div = document.createElement('div');
    div.className = 'match fadeIn';
    div.innerHTML = `
      <div class="left">
        <div class="teams">${escapeHtml(m.teamA)} <span style="color:var(--muted)">vs</span> ${escapeHtml(m.teamB)} <span class="tiny muted">| ${m.bo ? 'BO'+m.bo : ''}</span></div>
        <div class="small">Start: ${start.toLocaleString()} • ${countdown}</div>
        ${m.finished ? `<div class="small">Wynik: <strong>${m.scoreA}:${m.scoreB}</strong></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="display:flex;gap:6px;align-items:center">
          <input type="number" id="inpA_${m.id}" placeholder="A" min="0" style="width:64px" value="${userType?userType.scoreA:''}" ${open?'':'disabled'}>
          <input type="number" id="inpB_${m.id}" placeholder="B" min="0" style="width:64px" value="${userType?userType.scoreB:''}" ${open?'':'disabled'}>
        </div>
        <button class="btn" id="send_${m.id}" ${open?'':'disabled'}>Wyślij</button>
      </div>
    `;
    container.appendChild(div);

    // button handler
    $(`send_${m.id}`).addEventListener('click', ()=>{
      const a = parseInt($(`inpA_${m.id}`).value);
      const b = parseInt($(`inpB_${m.id}`).value);
      if(Number.isNaN(a) || Number.isNaN(b)){ notify("Wpisz wynik (liczby)", false); return; }
      saveUserType(m.id, a, b);
      // visual tick
      const tick = document.createElement('span'); tick.textContent = ' 🟢'; tick.style.fontWeight='800';
      $(`send_${m.id}`).after(tick); setTimeout(()=>tick.remove(),1400);
      renderHistory();
    });

  }); // forEach
}

/* Escape small helper */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* Save a user's type (winner+exact) locally */
function saveUserType(matchID, scoreA, scoreB){
  // ensure user exists
  if(!session.googleID){ notify("Zaloguj się najpierw", false); return; }
  // find existing
  let t = types.find(x => x.matchID === matchID && x.googleID === session.googleID);
  if(t){
    t.scoreA = scoreA; t.scoreB = scoreB;
  } else {
    types.push({ googleID: session.googleID, matchID, scoreA, scoreB, points: 0 });
  }
  localStorage.setItem(STORAGE_TYPES, JSON.stringify(types));
  notify("🟢 Typ zapisany");
}

/* Render user's history */
function renderHistory(){
  const cont = $('historyList'); cont.innerHTML = '';
  const myTypes = types.filter(t => t.googleID === session.googleID).map(t => {
    const m = matches.find(mm => mm.id === t.matchID);
    return { match: m, t };
  }).sort((a,b)=> new Date(a.match.start) - new Date(b.match.start));
  myTypes.forEach(entry=>{
    const m = entry.match; const t = entry.t;
    const el = document.createElement('div');
    const status = m.finished ? computeTypeStatus(t, m) : '⏳';
    el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:12px">
      <div><strong>${escapeHtml(m.teamA)}</strong> ${t.scoreA}:${t.scoreB} <strong>${escapeHtml(m.teamB)}</strong></div>
      <div class="tiny">${status}</div>
    </div>`;
    cont.appendChild(el);
  });
}

/* compute status for history entry */
function computeTypeStatus(t, match){
  if(!match.finished) return '⏳ oczekuje';
  const correctExact = (t.scoreA === match.scoreA && t.scoreB === match.scoreB);
  if(correctExact) return '🟢 +3 pkt';
  const pickWinnerUser = Math.sign(t.scoreA - t.scoreB);
  const pickWinnerReal = Math.sign(match.scoreA - match.scoreB);
  if(pickWinnerUser !== 0 && pickWinnerUser === pickWinnerReal) return '🟡 +1 pkt';
  return '🔴 0 pkt';
}

/* ---------- Ranking ---------- */
function renderRanking(){
  const cont = $('rankingList'); cont.innerHTML = '';
  // compute points fresh (recompute from types and matches to avoid double counting)
  const scoreMap = {};
  users.forEach(u => scoreMap[u.googleID] = { nick: u.nick, points: 0 });

  types.forEach(t => {
    const m = matches.find(mm => mm.id === t.matchID);
    if(!m || !m.finished) return;
    const exact = (t.scoreA === m.scoreA && t.scoreB === m.scoreB);
    if(exact) scoreMap[t.googleID].points += 3;
    else {
      const pickU = Math.sign(t.scoreA - t.scoreB);
      const pickM = Math.sign(m.scoreA - m.scoreB);
      if(pickU !== 0 && pickU === pickM) scoreMap[t.googleID].points += 1;
    }
  });

  // update users points
  users.forEach(u => u.points = scoreMap[u.googleID] ? scoreMap[u.googleID].points : 0);
  // sort
  const arr = Object.values(scoreMap).sort((a,b) => b.points - a.points);
  // top3 badges
  arr.forEach((r, idx) => {
    const div = document.createElement('div'); div.className = 'rank-item';
    const badge = idx===0 ? '🏆' : idx===1 ? '🥈' : idx===2 ? '🥉' : '';
    div.innerHTML = `<div style="font-weight:700">${idx+1}. ${escapeHtml(r.nick)} ${badge}</div><div style="font-weight:800;color:var(--accent)">${r.points} pkt</div>`;
    cont.appendChild(div);
  });

  // update user points display for current session
  const me = users.find(u => u.googleID === session.googleID);
  if(me) { $('userPoints').textContent = me.points; }
  saveAll();
}

/* ---------- Admin functions ---------- */
$('adminAddMatch').addEventListener('click', () => {
  const a = $('adminTeamA').value.trim();
  const b = $('adminTeamB').value.trim();
  const dt = $('adminDate').value;
  const bo = parseInt($('adminBO').value) || 1;
  if(!a||!b||!dt){ notify("Wypełnij pola daty i zespołów", false); return; }
  const id = 'm' + Date.now();
  matches.push({ id, teamA: a, teamB: b, start: new Date(dt).toISOString(), bo, finished: false, scoreA: null, scoreB: null });
  saveAll(); renderMatchesList(); renderAdminLists(); notify("Mecz dodany");
});

$('adminRefresh').addEventListener('click', ()=> { renderAll(); notify("Odświeżono"); });

function renderAdminLists(){
  // admin matches
  const mcont = $('adminMatchesList'); mcont.innerHTML = '';
  matches.sort((a,b)=> new Date(a.start)-new Date(b.start)).forEach(m => {
    const div = document.createElement('div'); div.className = 'match';
    div.innerHTML = `<div><strong>${escapeHtml(m.teamA)}</strong> vs <strong>${escapeHtml(m.teamB)}</strong><div class="small">${new Date(m.start).toLocaleString()} • BO${m.bo}</div></div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="resA_${m.id}" placeholder="A" style="width:64px" value="${m.scoreA!==null?m.scoreA:''}">
        <input type="number" id="resB_${m.id}" placeholder="B" style="width:64px" value="${m.scoreB!==null?m.scoreB:''}">
        <button class="btn" onclick="adminSaveResult('${m.id}')">Zapisz</button>
        <button class="btn danger" onclick="adminDeleteMatch('${m.id}')">Usuń</button>
      </div>`;
    mcont.appendChild(div);
  });

  // admin users
  const ucont = $('adminUsersList'); ucont.innerHTML = '';
  users.forEach(u => {
    const d = document.createElement('div'); d.className = 'match';
    d.innerHTML = `<div>${escapeHtml(u.nick)} <div class="tiny muted">${escapeHtml(u.email||'')}</div></div>
      <div><div class="tiny">pkt: ${u.points}</div><div style="display:flex;gap:8px"><button class="btn ghost" onclick="adminRemoveUser('${u.googleID}')">Usuń</button></div></div>`;
    ucont.appendChild(d);
  });
}

/* Admin save result -> recalc points for all types */
function adminSaveResult(matchID){
  const a = parseInt($(`resA_${matchID}`).value);
  const b = parseInt($(`resB_${matchID}`).value);
  if(Number.isNaN(a) || Number.isNaN(b)){ notify("Wpisz poprawne wyniki", false); return; }
  const m = matches.find(x=>x.id===matchID);
  m.scoreA = a; m.scoreB = b; m.finished = true;
  // recalc: we keep types and recompute in renderRanking
  saveAll();
  renderRanking();
  renderMatchesList();
  renderAdminLists();
  notify("Wynik zapisany");
}

/* Admin delete match */
function adminDeleteMatch(matchID){
  if(!confirm("Usunąć mecz?")) return;
  matches = matches.filter(m=>m.id!==matchID);
  types = types.filter(t=>t.matchID!==matchID);
  saveAll(); renderAll(); notify("Mecz usunięty");
}

/* Admin remove user */
function adminRemoveUser(googleID){
  if(!confirm("Usunąć użytkownika? (usunie też jego typy)")) return;
  users = users.filter(u=>u.googleID!==googleID);
  types = types.filter(t=>t.googleID!==googleID);
  saveAll(); renderAll(); notify("Użytkownik usunięty");
}

/* ---------- Utils for page interaction ---------- */
$('filterDate') && $('filterDate').addEventListener('change', ()=> renderMatchesList());
$('clearFilter') && $('clearFilter').addEventListener('click', ()=> { $('filterDate').value = ''; renderMatchesList(); });

/* update user points display */
function updateUserPoints(){
  const u = users.find(x=> x.googleID === session.googleID);
  if(u) $('userPoints').textContent = u.points;
}

/* ---------- Init: restore session if local user exists (optional) ---------- */
/* We intentionally don't auto-login from localStorage to avoid confusion: must use Google Sign-In.
   But if you want to support "remember me" via localStorage, add code here. */

/* expose onGoogleSignIn as global for GSI */
window.onGoogleSignIn = onGoogleSignIn;

/* Initial render of admin lists (if any data exists) */
renderMatchesList();
renderRanking();
renderHistory();
renderAdminLists();
