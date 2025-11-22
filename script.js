/* ======================
   KONFIGURACJA
====================== */
const API_BASE = 'https://sheetdb.io/api/v1/zwlvogb5fk6ay'; // Twój SheetDB endpoint
let googleID = '';
let nick = '';
let role = 'user'; // 'admin' jeśli użytkownik ma prawa

/* ======================
   Utility: pokaż zakładkę
====================== */
function showTab(name){
  // ukryj wszystkie sekcje tab
  document.querySelectorAll('section.tab').forEach(s=>s.style.display='none');

  const map = { types: 'tab-types', matches: 'tab-matches', ranking: 'tab-ranking', admin: 'tab-admin' };
  if (map[name]) document.getElementById(map[name]).style.display = 'block';

  // ustaw active button
  ['tabTypesBtn','tabMatchesBtn','tabRankingBtn','tabAdminBtn'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.classList.remove('tab-active');
  });
  const btnMap = { types: 'tabTypesBtn', matches:'tabMatchesBtn', ranking:'tabRankingBtn', admin:'tabAdminBtn' };
  if (btnMap[name]) {
    const b = document.getElementById(btnMap[name]);
    if (b) b.classList.add('tab-active');
  }
}

/* ======================
   Google Sign-In callback
   wywoływane przez Google button (data-callback="onGoogleSignIn")
====================== */
async function onGoogleSignIn(response){
  console.log('Google callback', response);
  try {
    // jwt-decode library użyty w HTML: jwt_decode
    const data = jwt_decode(response.credential);
    console.log('JWT decoded', data);
    googleID = data.sub;
    const suggestedName = data.name || data.email || 'Gracz';

    // sprawdź czy user istnieje w arkuszu Users
    const usersRes = await axios.get(`${API_BASE}/Users?UserID=${encodeURIComponent(googleID)}`)
      .catch(e => ({ data: [] }));
    console.log('Users search result:', usersRes.data);

    if (usersRes.data && usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || suggestedName;
      role = (u.Role && u.Role.toLowerCase()==='admin') ? 'admin' : 'user';
      loginShowApp();
    } else {
      // nowy użytkownik -> pokaż ustaw nicku
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('nickSetup').style.display = 'block';
      document.getElementById('nickMsg').innerText = 'Witaj — ustaw swój nick (unikalny).';
      document.getElementById('nickInput').value = suggestedName;
    }
  } catch(err){
    console.error('onGoogleSignIn error', err);
    document.getElementById('loginDebug').innerText = 'Błąd logowania (sprawdź konsolę).';
  }
}

/* ======================
   Save nick (POST lub PATCH)
====================== */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;
  try {
    // sprawdź czy istnieje
    const usersRes = await axios.get(`${API_BASE}/Users?UserID=${encodeURIComponent(googleID)}`).catch(()=>({data:[]}));
    if (usersRes.data && usersRes.data.length > 0){
      // PATCH istniejącego wiersza
      await axios.patch(`${API_BASE}/Users?UserID=${encodeURIComponent(googleID)}`, { data: { Nick: nick }});
    } else {
      // POST nowego wiersza
      await axios.post(`${API_BASE}/Users`, { data: { UserID: googleID, Nick: nick, Role: 'user' }});
    }
    loginShowApp();
  } catch(err){
    console.error('saveNick err', err);
    alert('Błąd zapisu nicku — sprawdź arkusz Users i konfigurację SheetDB (konsola).');
  }
}

/* ======================
   Po poprawnym logowaniu - pokaż UI
====================== */
function loginShowApp(){
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('nickSetup').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userDisplay').innerText = nick + (role==='admin' ? ' (admin)' : '');
  showTab('types');
  loadMatchesForTyping();
  loadMatchesList();
  loadRanking();
  if (role === 'admin') loadAdminArea();
}

/* ======================
   Wyloguj (proste reload)
====================== */
function signOut(){ location.reload(); }

/* ======================
   Load matches for typing (TYPY tab)
====================== */
async function loadMatchesForTyping(){
  const cont = document.getElementById('meczeList');
  if (!cont) return;
  cont.innerHTML = '<div class="loader inline-block"></div>';
  try {
    const res = await axios.get(`${API_BASE}/Mecze`);
    const data = res.data || [];
    // sortuj po StartTime
    data.sort((a,b) => (a.StartTime||'').localeCompare(b.StartTime||''));
    cont.innerHTML = '';
    if (data.length === 0){ cont.innerHTML = '<div class="text-gray-400">Brak meczów.</div>'; return; }

    const now = new Date();
    data.forEach(m => {
      const id = m.MatchID || '';
      const t1 = m.Team1 || '';
      const t2 = m.Team2 || '';
      const start = m.StartTime || '';
      const bo = m.BO || 'BO1';
      const finished = (m.Status||'').toLowerCase() === 'finished';
      const startDate = start ? new Date(start) : null;
      const canType = !startDate || now < startDate;

      const resultText = (m.WynikA !== undefined && m.WynikB !== undefined && m.WynikA !== '') ? `Wynik: ${m.WynikA} : ${m.WynikB}` : '';

      const card = document.createElement('div');
      card.className = 'p-3 rounded card flex justify-between items-center';
      card.innerHTML = `
        <div>
          <div class="font-semibold">${escapeHtml(t1)} <span class="text-gray-400">vs</span> ${escapeHtml(t2)} <span class="text-sm text-gray-400">(${escapeHtml(bo)})</span></div>
          <div class="text-sm text-gray-400">${ start ? new Date(start).toLocaleString() : 'Brak daty' } ${resultText}</div>
        </div>
        <div class="flex gap-2 items-center">
          ${ canType ? `
            <select id="pick_${id}" class="p-2 rounded bg-transparent border">
              <option value="${escapeHtml(t1)}">${escapeHtml(t1)}</option>
              <option value="${escapeHtml(t2)}">${escapeHtml(t2)}</option>
            </select>
            <input id="scoreA_${id}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border"/>
            <input id="scoreB_${id}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border"/>
            <button class="btn px-3 py-2 rounded" onclick="submitPick('${id}')">Wyślij</button>
          ` : `<div class="text-sm text-gray-400">Typowanie zamknięte</div>` }
        </div>
      `;
      cont.appendChild(card);
    });

  } catch(err){
    console.error('loadMatchesForTyping err', err);
    cont.innerHTML = '<div class="text-red-400">Błąd wczytywania meczów</div>';
  }
}

/* ======================
   Submit pick/typ
====================== */
async function submitPick(matchId){
  try {
    const pickEl = document.getElementById(`pick_${matchId}`);
    const scoreAEl = document.getElementById(`scoreA_${matchId}`);
    const scoreBEl = document.getElementById(`scoreB_${matchId}`);
    if (!pickEl || !scoreAEl || !scoreBEl) { alert('Elementy formularza nie znalezione'); return; }

    const pick = pickEl.value;
    const scoreA = scoreAEl.value;
    const scoreB = scoreBEl.value;
    if (scoreA === '' || scoreB === '') { alert('Podaj dokładny wynik (obie wartości)'); return; }

    // zapisz typ
    await axios.post(`${API_BASE}/Typy`, { data: { MatchID: matchId, UserID: googleID, Pick: pick, ScoreA: scoreA, ScoreB: scoreB, Points: 0 }});
    alert('Typ zapisany');
    loadRanking();
  } catch(err){
    console.error('submitPick err', err);
    alert('Błąd zapisu typu (sprawdź SheetDB i konsolę)');
  }
}

/* ======================
   Matches list (przegląd)
====================== */
async function loadMatchesList(){
  const cont = document.getElementById('matchesList');
  if (!cont) return;
  cont.innerHTML = '<div class="loader inline-block"></div>';
  try {
    const res = await axios.get(`${API_BASE}/Mecze`);
    const data = res.data || [];
    data.sort((a,b) => (a.StartTime||'').localeCompare(b.StartTime||''));
    cont.innerHTML = '';
    if (data.length === 0){ cont.innerHTML = '<div class="text-gray-400">Brak meczów.</div>'; return; }

    data.forEach(m=>{
      const el = document.createElement('div');
      el.className = 'p-3 rounded card flex justify-between items-center';
      el.innerHTML = `<div><strong>${escapeHtml(m.Team1||'')} vs ${escapeHtml(m.Team2||'')}</strong><div class="text-sm text-gray-400">${m.StartTime || 'brak'} • ${m.BO || 'BO1'}</div></div>
        <div class="text-sm text-yellow-400">${escapeHtml((m.Status||'').toString()).toUpperCase()}</div>`;
      cont.appendChild(el);
    });
  } catch(err){
    console.error('loadMatchesList err', err);
    cont.innerHTML = '<div class="text-red-400">Błąd wczytywania meczów</div>';
  }
}

/* ======================
   Ranking
====================== */
async function loadRanking(){
  const cont = document.getElementById('rankingList');
  if (!cont) return;
  cont.innerHTML = '<div class="loader inline-block"></div>';
  try {
    const [tRes,mRes] = await Promise.all([ axios.get(`${API_BASE}/Typy`), axios.get(`${API_BASE}/Mecze`) ]);
    const typy = tRes.data || [];
    const mecze = (mRes.data || []).reduce((acc,m)=>{ acc[m.MatchID||''] = m; return acc; }, {});
    const scores = {};

    typy.forEach(t=>{
      const user = t.UserID || t.Nick || 'anon';
      let pts = 0;
      const match = mecze[t.MatchID];
      if (match && (match.Status||'').toLowerCase() === 'finished'){
        const a = String(match.WynikA || '');
        const b = String(match.WynikB || '');
        // winner points
        const winner = parseInt(match.WynikA) > parseInt(match.WynikB) ? match.Team1 : (parseInt(match.WynikB) > parseInt(match.WynikA) ? match.Team2 : 'draw');
        if (t.Pick === winner) pts += 1;
        // exact score
        if (String(t.ScoreA) === a && String(t.ScoreB) === b) pts += 3;
      }
      scores[user] = (scores[user] || 0) + pts;
    });

    const arr = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    cont.innerHTML = '';
    if (arr.length === 0){ cont.innerHTML = '<div class="text-gray-400">Brak typów</div>'; return; }
    arr.forEach(([u,p],i)=>{
      const el = document.createElement('div');
      el.className = 'p-2 rounded flex justify-between items-center';
      el.innerHTML = `<div>${i+1}. <strong>${escapeHtml(u)}</strong></div><div class="text-yellow-400 font-bold">${p} pkt</div>`;
      cont.appendChild(el);
    });

  } catch(err){
    console.error('loadRanking err', err);
    cont.innerHTML = '<div class="text-red-400">Błąd wczytywania rankingu</div>';
  }
}

/* ======================
   Admin area
====================== */
async function loadAdminArea(){
  const adminArea = document.getElementById('adminArea');
  if (!adminArea) return;
  adminArea.innerHTML = '<div class="loader inline-block"></div>';
  try {
    const [mRes,uRes] = await Promise.all([ axios.get(`${API_BASE}/Mecze`), axios.get(`${API_BASE}/Users`) ]);
    const matches = mRes.data || [];
    const users = uRes.data || [];
    adminArea.innerHTML = '';

    // Matches editor
    matches.forEach(m=>{
      const row = document.createElement('div');
      row.className = 'p-2 rounded card flex gap-2 items-center';
      row.innerHTML = `
        <div class="flex-1"><strong>${escapeHtml(m.Team1||'')} vs ${escapeHtml(m.Team2||'')}</strong><div class="text-sm text-gray-400">ID: ${escapeHtml(m.MatchID||'')}</div></div>
        <input id="resA_${m.MatchID}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikA||''}" placeholder="A"/>
        <input id="resB_${m.MatchID}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikB||''}" placeholder="B"/>
        <select id="status_${m.MatchID}" class="p-1 rounded bg-transparent border">
          <option value="open" ${((m.Status||'open')==='open')?'selected':''}>open</option>
          <option value="finished" ${((m.Status||'')==='finished')?'selected':''}>finished</option>
        </select>
        <button class="btn px-2 py-1 rounded" onclick="adminSaveResult('${m.MatchID}')">Zapisz</button>
        <button class="px-2 py-1 rounded bg-red-600" onclick="adminDeleteMatch('${m.MatchID}')">Usuń</button>
      `;
      adminArea.appendChild(row);
    });

    // Users editor
    const usersBlock = document.createElement('div');
    usersBlock.className = 'mt-4';
    usersBlock.innerHTML = '<h4 class="font-semibold mb-2">Użytkownicy</h4>';
    users.forEach(u=>{
      const r = document.createElement('div');
      r.className = 'p-2 rounded flex justify-between items-center card mb-2';
      r.innerHTML = `<div><strong>${escapeHtml(u.Nick||'(brak)')}</strong><div class="text-sm text-gray-400">${escapeHtml(u.UserID||'')}</div></div>
        <div class="flex gap-2 items-center"><div class="text-sm text-gray-300">${escapeHtml(u.Role||'user')}</div>
        <button class="btn px-2 py-1 rounded" onclick="setUserRole('${encodeURIComponent(u.UserID)}','admin')">Nadaj admin</button></div>`;
      usersBlock.appendChild(r);
    });
    adminArea.appendChild(usersBlock);

  } catch(err){
    console.error('loadAdminArea err', err);
    adminArea.innerHTML = '<div class="text-red-400">Błąd wczytywania panelu admina</div>';
  }
}

/* ======================
   Admin actions: add/save/delete
====================== */
async function adminAddMatch(){
  const t1 = document.getElementById('adminTeam1').value.trim();
  const t2 = document.getElementById('adminTeam2').value.trim();
  const start = document.getElementById('adminStart').value; // datetime-local format
  const bo = document.getElementById('adminBO').value || 'BO1';
  if (!t1 || !t2 || !start){ alert('Wpisz wszystkie dane'); return; }
  const id = 'm' + Date.now();
  try {
    await axios.post(`${API_BASE}/Mecze`, { data: { MatchID: id, Team1: t1, Team2: t2, StartTime: start, BO: bo, Status: 'open', WynikA:'', WynikB:'' }});
    alert('Mecz dodany');
    loadMatchesForTyping(); loadMatchesList(); loadAdminArea();
  } catch(err){
    console.error('adminAddMatch err', err);
    alert('Błąd dodawania meczu');
  }
}

async function adminSaveResult(matchId){
  try {
    const a = document.getElementById(`resA_${matchId}`).value;
    const b = document.getElementById(`resB_${matchId}`).value;
    const st = document.getElementById(`status_${matchId}`).value;
    await axios.patch(`${API_BASE}/Mecze?MatchID=${encodeURIComponent(matchId)}`, { data: { WynikA: a, WynikB: b, Status: st }});
    alert('Wynik zapisany — przeliczam punkty...');
    await recalcPointsForMatch(matchId);
    loadMatchesForTyping(); loadMatchesList(); loadRanking(); loadAdminArea();
  } catch(err){
    console.error('adminSaveResult err', err);
    alert('Błąd zapisu wyniku');
  }
}

async function adminDeleteMatch(matchId){
  if (!confirm('Na pewno usunąć mecz?')) return;
  try {
    await axios.delete(`${API_BASE}/Mecze?MatchID=${encodeURIComponent(matchId)}`);
    alert('Usunięto mecz');
    loadMatchesForTyping(); loadMatchesList(); loadAdminArea(); loadRanking();
  } catch(err){
    console.error('adminDeleteMatch err', err);
    alert('Błąd usuwania meczu');
  }
}

/* ======================
   Recalculate points for a match
====================== */
async function recalcPointsForMatch(matchId){
  try {
    const matchRes = await axios.get(`${API_BASE}/Mecze?MatchID=${encodeURIComponent(matchId)}`);
    const match = (matchRes.data && matchRes.data[0]) || null;
    if (!match) return;

    const typyRes = await axios.get(`${API_BASE}/Typy?MatchID=${encodeURIComponent(matchId)}`).catch(()=>({data:[]})); // fetch types for match
    const typy = typyRes.data || [];

    for (const t of typy){
      let pts = 0;
      if ((match.Status||'').toLowerCase() === 'finished'){
        const a = String(match.WynikA||'');
        const b = String(match.WynikB||'');
        const winner = parseInt(match.WynikA) > parseInt(match.WynikB) ? match.Team1 : (parseInt(match.WynikB) > parseInt(match.WynikA) ? match.Team2 : 'draw');
        if (t.Pick === winner) pts += 1;
        if (String(t.ScoreA) === a && String(t.ScoreB) === b) pts += 3;
      }
      // aktualizuj punkty w Typy (PATCH po MatchID i UserID)
      await axios.patch(`${API_BASE}/Typy?MatchID=${encodeURIComponent(matchId)}&UserID=${encodeURIComponent(t.UserID)}`, { data: { Points: pts }})
        .catch(e => console.warn('patch typ error', e));
    }
  } catch(err){
    console.error('recalcPointsForMatch err', err);
  }
}

/* ======================
   Set user role (admin)
====================== */
async function setUserRole(userIdEncoded, newRole){
  try {
    const userId = decodeURIComponent(userIdEncoded);
    await axios.patch(`${API_BASE}/Users?UserID=${encodeURIComponent(userId)}`, { data: { Role: newRole }});
    alert('Rola ustawiona');
    loadAdminArea();
  } catch(err){
    console.error('setUserRole err', err);
    alert('Błąd ustawiania roli');
  }
}

/* ======================
   Pomocnicze
====================== */
function escapeHtml(str){
  if (!str) return '';
  return String(str).replace(/[&<>"'`]/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' }[s]));
}

/* ======================
   Start - domyślna zakładka
====================== */
showTab('types');
