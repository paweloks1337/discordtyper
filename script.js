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
  document.getElementById('tab-'+name).style.display = 'block';
}

/* ======================
   Google Sign-In callback
====================== */
async function onGoogleSignIn(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';
    
    // Sprawdź, czy użytkownik istnieje w arkuszu Users
    const usersRes = await axios.get(`${API_BASE}/search?sheet=Users&UserID=${encodeURIComponent(googleID)}`)
      .catch(e => ({ data: [] }));
    
    if (usersRes && usersRes.data && usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase() === 'admin') ? 'admin' : 'user';
      afterLogin();
    } else {
      // pokaż ustawienie nicku dla nowego użytkownika
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('nickSetup').style.display = 'block';
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw teraz swój nick (unikalny w turnieju).';
      document.getElementById('nickInput').value = givenName;
    }
  } catch(err){
    console.error('login error', err);
    alert('Błąd logowania: sprawdź konsolę.');
  }
}

/* ======================
   Save nick for new user
====================== */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2){ 
    alert('Nick za krótki'); 
    return; 
  }
  nick = v;
  try {
    await axios.post(API_BASE, { 
      data: { sheet: "Users", UserID: googleID, Nick: nick, Role: 'user' } 
    });
    document.getElementById('nickSetup').style.display = 'none';
    afterLogin();
  } catch(err){
    console.error('saveNick err', err);
    alert('Błąd zapisu nicku. Sprawdź arkusz Users i konfigurację SheetDB.');
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
   Load matches for typowanie
====================== */
async function loadMecze(){
  try {
    const res = await axios.get(API_BASE + '?sheet=Mecze');
    const mecze = res.data || [];
    mecze.sort((a,b)=> (a.ID||'').localeCompare(b.ID||''));
    const cont = document.getElementById('meczeList');
    cont.innerHTML = '';
    if (mecze.length === 0){ 
      cont.innerHTML = '<div class="text-gray-400">Brak meczów.</div>'; 
      return; 
    }
    const now = new Date();
    mecze.forEach(m=>{
      const id = m.ID || '';
      const teamA = m.TeamA || 'Team A';
      const teamB = m.TeamB || 'Team B';
      const timeStr = m.Time || '';
      const finished = (m.Zakończony||'').toLowerCase() === 'tak';
      const startTime = timeStr ? new Date(`1970-01-01T${timeStr}:00`) : null;
      const disabled = startTime && now > startTime;
      const resultText = (m.WynikA !== undefined && m.WynikB !== undefined && m.WynikA !== '' ) ? `Wynik: ${m.WynikA} : ${m.WynikB}` : '';
      
      const card = document.createElement('div');
      card.className = 'p-3 rounded card';
      card.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="font-semibold">${teamA} <span class="text-gray-400">vs</span> ${teamB}</div>
            <div class="text-sm text-gray-400">${resultText} ${timeStr ? '| ' + timeStr : ''}</div>
          </div>
          <div class="text-sm text-gray-300">${finished ? 'Zakończony' : 'Otwarty'}</div>
        </div>
        <div class="mt-3 flex gap-2 items-center">
          <select id="winner_${id}" class="p-2 rounded bg-transparent border" ${disabled ? 'disabled' : ''}>
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
          <input id="scoreA_${id}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" ${disabled ? 'disabled' : ''}/>
          <input id="scoreB_${id}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" ${disabled ? 'disabled' : ''}/>
          <button class="px-3 py-2 rounded btn" onclick="submitTyp('${id}')" ${disabled ? 'disabled' : ''}>Wyślij typ</button>
        </div>
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
    await axios.post(API_BASE, { data: { sheet: "Typy", Nick: nick, UserID: googleID, ID_meczu: idMeczu, Typ_zwyciezcy: winner, Typ_wynikuA: scoreA, Typ_wynikuB: scoreB, Punkty: 0 }});
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
    const [typRes, mecRes] = await Promise.all([
      axios.get(API_BASE + '?sheet=Typy'),
      axios.get(API_BASE + '?sheet=Mecze')
    ]);
    const typy = typRes.data || [];
    const mecze = (mecRes.data || []).reduce((acc,m)=>{ acc[m.ID||''] = m; return acc; }, {});
    const scores = {};
    typy.forEach(t=>{
      const uid = t.UserID || t.Nick || 'anon';
      let pts = 0;
      const match = mecze[t.ID_meczu];
      if (match && (match.Zakończony||'').toLowerCase() === 'tak' && match.WynikA !== undefined && match.WynikB !== undefined){
        const a = String(match.WynikA);
        const b = String(match.WynikB);
        const pickA = String(t.Typ_wynikuA || '');
        const pickB = String(t.Typ_wynikuB || '');
        const actualWinner = (parseInt(match.WynikA) > parseInt(match.WynikB)) ? match.TeamA : (parseInt(match.WynikB) > parseInt(match.WynikA) ? match.TeamB : 'draw');
        if (t.Typ_zwyciezcy === actualWinner) pts += 1;
        if (pickA === a && pickB === b) pts += 3;
      } else {
        pts += parseInt(t.Punkty || 0);
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
   ADMIN functions
   (dodawanie, usuwanie meczów, wpisywanie wyników)
====================== */
// ... tutaj możesz dodać resztę funkcji admina według swojego starego kodu, np. adminDodajMecz(), adminSaveResult(), loadAdminData() ...
