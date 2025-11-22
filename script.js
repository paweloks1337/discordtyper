/* ======================
   Konfiguracja
====================== */
const API_BASE = 'https://sheetdb.io/api/v1/zwlvogb5fk6ay';
let googleID = '';
let nick = '';
let role = 'user'; // 'admin' jeśli użytkownik ma prawa

/* ======================
   Helper: pokaz tab
====================== */
function showTab(name){
  document.querySelectorAll('.tab').forEach(el=>el.style.display='none');
  document.getElementById('tab-'+name).style.display='block';

  // aktywna zakładka
  ['Types','Ranking','Admin'].forEach(lbl=>{
    const btn = document.getElementById('tab'+lbl+'Btn');
    if (lbl.toLowerCase() === name) btn.classList.add('tab-active');
    else btn.classList.remove('tab-active');
  });
}

/* ======================
   Google Sign-In callback
====================== */
async function onGoogleSignIn(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';

    // Sprawdź czy użytkownik istnieje
    const usersRes = await axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`)
      .catch(e => ({ data: [] }));

    if (usersRes && usersRes.data && usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase()==='admin') ? 'admin' : 'user';
      afterLogin();
    } else {
      // pokaz ustaw nick
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('nickSetup').style.display = 'block';
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw teraz swój nick (unikalny w turnieju).';
      document.getElementById('nickInput').value = givenName;
    }
  } catch(err){
    console.error('login error', err);
    alert('Błąd logowania. Sprawdź konsolę.');
  }
}

/* ======================
   Save nick
====================== */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;
  try {
    await axios.post(API_BASE + '/Users', { data: { UserID: googleID, Nick: nick, Role: 'user' }});
    document.getElementById('nickSetup').style.display = 'none';
    afterLogin();
  } catch(err){
    console.error('saveNick err', err);
    alert('Błąd zapisu nicku. Sprawdź arkusz Users i SheetDB.');
  }
}

/* ======================
   After login
====================== */
function afterLogin(){
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('nickSetup').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin' ? ' (admin)' : '');
  showTab('types');
  loadMecze();
  loadRanking();
  if (role==='admin') loadAdminData();
}

/* ======================
   Sign out
====================== */
function signOut(){ location.reload(); }

/* ======================
   Load mecze
====================== */
async function loadMecze(){
  try {
    const res = await axios.get(API_BASE + '/Mecze');
    const mecze = res.data || [];
    mecze.sort((a,b)=> (a.ID||'').localeCompare(b.ID||''));
    const cont = document.getElementById('meczeList');
    cont.innerHTML = '';

    if (mecze.length === 0){ cont.innerHTML = '<div class="text-gray-400">Brak meczów.</div>'; return; }

    mecze.forEach(m=>{
      const id = m.ID || '';
      const teamA = m.TeamA || 'Team A';
      const teamB = m.TeamB || 'Team B';
      const startTime = m.Godzina || '00:00';
      const finished = (m.Zakończony||'').toLowerCase() === 'tak';

      const now = new Date();
      const [h, min] = startTime.split(':');
      const matchDate = new Date();
      matchDate.setHours(parseInt(h), parseInt(min),0,0);

      const canType = now < matchDate && !finished;

      const resultText = (m.WynikA !== undefined && m.WynikB !== undefined && m.WynikA !== '' ) ? `Wynik: ${m.WynikA} : ${m.WynikB}` : '';

      const card = document.createElement('div');
      card.className = 'p-3 rounded card';

      card.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="font-semibold">${teamA} <span class="text-gray-400">vs</span> ${teamB}</div>
            <div class="text-sm text-gray-400">Start: ${startTime} ${resultText}</div>
          </div>
          <div class="text-sm text-gray-300">${finished ? 'Zakończony' : (canType ? 'Otwarty' : 'Rozpoczęty')}</div>
        </div>
        ${canType ? `<div class="mt-3 flex gap-2 items-center">
          <select id="winner_${id}" class="p-2 rounded bg-transparent border">
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
          <input id="scoreA_${id}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" />
          <input id="scoreB_${id}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" />
          <button class="px-3 py-2 rounded btn" onclick="submitTyp('${id}')">Wyślij typ</button>
        </div>` : '<div class="mt-2 text-gray-400">Typowanie zamknięte</div>'}
      `;
      cont.appendChild(card);
    });
  } catch(err){
    console.error('loadMecze', err);
    document.getElementById('meczeList').innerHTML = '<div class="text-red-400">Błąd wczytywania meczów</div>';
  }
}

/* ======================
   Submit typ
====================== */
async function submitTyp(idMeczu){
  try {
    const winner = document.getElementById('winner_'+idMeczu).value;
    const scoreA = document.getElementById('scoreA_'+idMeczu).value;
    const scoreB = document.getElementById('scoreB_'+idMeczu).value;

    if (scoreA === '' || scoreB === '') { alert('Podaj dokładny wynik (obie wartości)'); return; }

    await axios.post(API_BASE + '/Typy', { data: { 
      Nick: nick, 
      UserID: googleID, 
      ID_meczu: idMeczu, 
      Typ_zwyciezcy: winner, 
      Typ_wynikuA: scoreA, 
      Typ_wynikuB: scoreB, 
      Punkty: 0 
    }});

    alert('Typ zapisany!');
    loadRanking();
  } catch(err){
    console.error('submitTyp', err);
    alert('Błąd zapisu typu. Sprawdź konfigurację SheetDB.');
  }
}

/* ======================
   Load ranking
====================== */
async function loadRanking(){
  try {
    const [typRes, mecRes] = await Promise.all([ axios.get(API_BASE + '/Typy'), axios.get(API_BASE + '/Mecze') ]);
    const typy = typRes.data || [];
    const mecze = (mecRes.data || []).reduce((acc,m)=>{ acc[m.ID||''] = m; return acc; }, {});

    const scores = {};
    typy.forEach(t=>{
      const uid = t.UserID || t.Nick || 'anon';
      let pts = 0;
      const match = mecze[t.ID_meczu];
      if (match && (match.Zakończony||'').toLowerCase() === 'tak'){
        const a = String(match.WynikA);
        const b = String(match.WynikB);
        const pickA = String(t.Typ_wynikuA || '');
        const pickB = String(t.Typ_wynikuB || '');
        const actualWinner = (parseInt(match.WynikA) > parseInt(match.WynikB)) ? match.TeamA : (parseInt(match.WynikB) > parseInt(match.WynikA) ? match.TeamB : 'draw');
        if (t.Typ_zwyciezcy === actualWinner) pts += 1;
        if (pickA === a && pickB === b) pts += 3;
      }
      scores[uid] = (scores[uid] || 0) + pts;
    });

    const arr = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const cont = document.getElementById('rankingList');
    cont.innerHTML = '';
    if (arr.length === 0) cont.innerHTML = '<div class="text-gray-400">Brak typów</div>';
    arr.forEach(([u, p], idx)=>{
      const el = document.createElement('div');
      el.className = 'p-2 rounded flex justify-between items-center';
      el.innerHTML = `<div><span class="font-semibold">${idx+1}. ${u}</span><div class="text-sm text-gray-400">punkty: ${p}</div></div><div class="text-yellow-400 font-bold">${p} pkt</div>`;
      cont.appendChild(el);
    });
  } catch(err){
    console.error('loadRanking', err);
    document.getElementById('rankingList').innerHTML = '<div class="text-red-400">Błąd wczytywania rankingu</div>';
  }
}

/* ======================
   ADMIN FUNCTIONS
====================== */
async function loadAdminData(){
  try {
    const [mRes, uRes] = await Promise.all([ axios.get(API_BASE + '/Mecze'), axios.get(API_BASE + '/Users') ]);
    const mecze = mRes.data || [];
    const users = uRes.data || [];

    // mecze panel
    const am = document.getElementById('adminMecze');
    am.innerHTML = '';
    if (mecze.length===0) am.innerHTML = '<div class="text-gray-400">Brak meczów</div>';
    mecze.forEach(m=>{
      const id = m.ID || '';
      const teamA = m.TeamA || '';
      const teamB = m.TeamB || '';
      const startTime = m.Godzina || '00:00';
      const aVal = m.WynikA || '';
      const bVal = m.WynikB || '';
      const row = document.createElement('div');
      row.className = 'p-2 rounded flex gap-2 items-center';
      row.innerHTML = `
        <div class="flex-1"><strong>${teamA} vs ${teamB}</strong> <div class="text-sm text-gray-400">ID: ${id}, Start: ${startTime}</div></div>
        <input id="resA_${id}" class="w-16 p-1 rounded bg-transparent border" value="${aVal}" placeholder="A"/>
        <input id="resB_${id}" class="w-16 p-1 rounded bg-transparent border" value="${bVal}" placeholder="B"/>
        <select id="done_${id}" class="p-1 rounded bg-transparent border">
          <option value="NIE" ${((m.Zakończony||'').toUpperCase()==='NIE')?'selected':''}>NIE</option>
          <option value="TAK" ${((m.Zakończony||'').toUpperCase()==='TAK')?'selected':''}>TAK</option>
        </select>
        <button class="px-2 py-1 rounded btn" onclick="adminSaveResult('${id}')">Zapisz</button>
        <button class="px-2 py-1 rounded bg-red-600 hover:bg-red-500 transition" onclick="adminDeleteMatch('${id}')">Usuń</button>
      `;
      am.appendChild(row);
    });

    // users panel
    const au = document.getElementById('adminUsers');
    au.innerHTML = '';
    users.forEach(u=>{
      const uid = u.UserID || '';
      const nicku = u.Nick || '(brak)';
      const urole = (u.Role||'user');
      const row = document.createElement('div');
      row.className = 'p-2 rounded flex justify-between items-center';
      row.innerHTML = `<div><strong>${nicku}</strong> <div class="text-sm text-gray-400">${uid}</div></div>
        <div class="flex gap-2">
          <div class="text-sm text-gray-300">${urole}</div>
          <button class="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 transition" onclick="copyToClipboard('${uid}')">Kopiuj ID</button>
          <button class="px-2 py-1 rounded btn" onclick="setUserRole('${uid}','admin')">Nadaj admin</button>
        </div>`;
      au.appendChild(row);
    });

  } catch(err){
    console.error('loadAdminData', err);
    document.getElementById('adminMecze').innerHTML = '<div class="text-red-400">Błąd wczytywania (admin)</div>';
  }
}

/* ======================
   ADMIN: add match
====================== */
async function adminDodajMecz(){
  const a = document.getElementById('adminTeamA').value.trim();
  const b = document.getElementById('adminTeamB').value.trim();
  const godz = document.getElementById('adminTime').value.trim();
  const bo = document.getElementById('adminBO').value;
  if (!a || !b || !godz) { alert('Wpisz wszystkie dane'); return; }
  const id = 'm' + Date.now();
  try {
    await axios.post(API_BASE + '/Mecze', { data: { ID: id, TeamA: a, TeamB: b, WynikA:'', WynikB:'', Zakończony:'NIE', Godzina: godz, BO: bo }});
    alert('Mecz dodany');
    document.getElementById('adminTeamA').value=''; document.getElementById('adminTeamB').value=''; document.getElementById('adminTime').value='';
    loadMecze(); loadAdminData();
  } catch(err){
    console.error('adminDodajMecz', err);
    alert('Błąd dodawania meczu');
  }
}

/* ======================
   ADMIN: save result
====================== */
async function adminSaveResult(id){
  try {
    const a = document.getElementById(`resA_${id}`).value;
    const b = document.getElementById(`resB_${id}`).value;
    const done = document.getElementById(`done_${id}`).value;
    await axios.patch(API_BASE + `/Mecze?ID=${encodeURIComponent(id)}`, { data: { WynikA: a, WynikB: b, Zakończony: done }});
    alert('Wynik zapisany. Przeliczam punkty...');
    await recalcPointsForMatch(id);
    loadAdminData(); loadRanking(); loadMecze();
  } catch(err){
    console.error('adminSaveResult', err);
    alert('Błąd zapisu wyniku');
  }
}

/* ======================
   ADMIN: delete match
====================== */
async function adminDeleteMatch(id){
  if (!confirm('Na pewno chcesz usunąć ten mecz?')) return;
  try {
    await axios.delete(API_BASE + `/Mecze?ID=${encodeURIComponent(id)}`);
    alert('Mecz usunięty');
    loadMecze(); loadAdminData(); loadRanking();
  } catch(err){
    console.error('adminDeleteMatch', err);
    alert('Błąd usuwania meczu');
  }
}

/* ======================
   Recalculate points
====================== */
async function recalcPointsForMatch(matchId){
  try {
    const matchRes = await axios.get(API_BASE + `/Mecze?ID=${encodeURIComponent(matchId)}`);
    const match = (matchRes.data && matchRes.data[0]) || null;
    if (!match) return;

    const typyRes = await axios.get(API_BASE + `/Typy/search?ID_meczu=${encodeURIComponent(matchId)}`).catch(e=>({data:[]}));
    const typy = typyRes.data || [];
    for (const t of typy){
      let pts = 0;
      if ((match.Zakończony||'').toLowerCase() === 'tak'){
        const a = String(match.WynikA||'');
        const b = String(match.WynikB||'');
        const actualWinner = (parseInt(match.WynikA) > parseInt(match.WynikB)) ? match.TeamA : (parseInt(match.WynikB) > parseInt(match.WynikA) ? match.TeamB : 'draw');
        if (t.Typ_zwyciezcy === actualWinner) pts += 1;
        if (String(t.Typ_wynikuA) === a && String(t.Typ_wynikuB) === b) pts += 3;
      }
      await axios.patch(API_BASE + `/Typy?Nick=${encodeURIComponent(t.Nick)}&ID_meczu=${encodeURIComponent(matchId)}`, { data: { Punkty: pts }})
        .catch(e => console.warn('patch typ error', e));
    }
  } catch(err){
    console.error('recalcPointsForMatch', err);
  }
}

/* ======================
   Set user role
====================== */
async function setUserRole(userId, newRole){
  try {
    await axios.patch(API_BASE + `/Users?UserID=${encodeURIComponent(userId)}`, { data: { Role: newRole }});
    alert('Rola ustawiona');
    loadAdminData();
  } catch(err){
    console.error('setUserRole', err);
    alert('Błąd ustawiania roli');
  }
}

/* ======================
   Copy to clipboard
====================== */
function copyToClipboard(text){
  navigator.clipboard?.writeText(text).then(()=> alert('ID skopiowane'));
}

/* ======================
   On load
====================== */
showTab('types');
