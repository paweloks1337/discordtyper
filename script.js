/* ======================
   KONFIGURACJA
   ====================== */
const API_BASE = 'https://sheetdb.io/api/v1/ie4ciodtrejew'; // Twój SheetDB endpoint

let googleID = '';
let nick = '';
let role = 'user'; // 'admin' jeśli użytkownik ma prawa

/* ======================
   POMOCNICZE FUNKCJE
   ====================== */
function showTab(name){
  document.querySelectorAll('.tab').forEach(el=>el.style.display='none');
  document.getElementById('tab-'+name).style.display='block';
}

function signOut(){ location.reload(); }

/* ======================
   LOGOWANIE GOOGLE
   ====================== */
async function onGoogleSignIn(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';
    // sprawdź czy użytkownik istnieje w Users
    const usersRes = await axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`)
      .catch(e => ({ data: [] }));
    if (usersRes.data && usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase() === 'admin') ? 'admin' : 'user';
      afterLogin();
    } else {
      // pokaż ustawienie nicku
      document.getElementById('loginCard').style.display='none';
      document.getElementById('nickSetup').style.display='block';
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw swój nick.';
      document.getElementById('nickInput').value = givenName;
    }
  } catch(err){
    console.error('Login error', err);
    alert('Błąd logowania. Sprawdź konsolę.');
  }
}

/* ======================
   USTAWIANIE NICKU DLA NOWEGO UŻYTKOWNIKA
   ====================== */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;
  try {
    await axios.post(`${API_BASE}/Users`, { data: { UserID: googleID, Nick: nick, Role: 'user' }});
    document.getElementById('nickSetup').style.display='none';
    afterLogin();
  } catch(err){
    console.error('saveNick error', err);
    alert('Błąd zapisu nicku. Sprawdź arkusz Users i SheetDB.');
  }
}

/* ======================
   PO ZALOGOWANIU
   ====================== */
function afterLogin(){
  document.getElementById('loginCard').style.display='none';
  document.getElementById('nickSetup').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin' ? ' (admin)' : '');
  showTab('types');
  loadMecze();
  loadRanking();
  if (role==='admin') loadAdminData();
}

/* ======================
   MECZE I TYPY
   ====================== */
async function loadMecze(){
  try {
    const res = await axios.get(`${API_BASE}/Mecze`);
    const mecze = res.data || [];
    mecze.sort((a,b)=> (a.ID||'').localeCompare(b.ID||''));
    const cont = document.getElementById('meczeList');
    cont.innerHTML = '';
    if (mecze.length===0){ cont.innerHTML='Brak meczów'; return; }
    mecze.forEach(m=>{
      const id = m.ID || '';
      const teamA = m.TeamA || 'Team A';
      const teamB = m.TeamB || 'Team B';
      const startTime = m.Start || '';
      const finished = (m.Zakończony||'').toLowerCase() === 'tak';
      const card = document.createElement('div');
      card.className='p-3 rounded card';
      const now = new Date();
      const matchTime = startTime ? new Date(startTime) : null;
      const disabled = matchTime && now > matchTime ? 'disabled' : '';
      card.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="font-semibold">${teamA} vs ${teamB}</div>
            ${startTime ? `<div class="text-sm text-gray-400">Start: ${startTime}</div>` : ''}
            <div class="text-sm text-gray-400">${finished ? 'Zakończony' : 'Otwarty'}</div>
          </div>
        </div>
        <div class="mt-2 flex gap-2 items-center">
          <select id="winner_${id}" class="p-2 rounded bg-transparent border" ${disabled}>
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
          <input id="scoreA_${id}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" ${disabled}/>
          <input id="scoreB_${id}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" ${disabled}/>
          <button class="px-3 py-2 rounded btn" onclick="submitTyp('${id}')" ${disabled}>Wyślij typ</button>
        </div>
      `;
      cont.appendChild(card);
    });
  } catch(err){
    console.error('loadMecze error', err);
    document.getElementById('meczeList').innerHTML='Błąd wczytywania meczów';
  }
}

async function submitTyp(idMeczu){
  try {
    const winner = document.getElementById('winner_'+idMeczu).value;
    const scoreA = document.getElementById('scoreA_'+idMeczu).value;
    const scoreB = document.getElementById('scoreB_'+idMeczu).value;
    if (scoreA===''||scoreB===''){ alert('Podaj wynik'); return; }
    await axios.post(`${API_BASE}/Typy`, { data: { Nick: nick, UserID: googleID, ID_meczu: idMeczu, Typ_zwyciezcy: winner, Typ_wynikuA: scoreA, Typ_wynikuB: scoreB, Punkty:0 }});
    alert('Typ zapisany!');
    loadRanking();
  } catch(err){
    console.error('submitTyp error', err);
    alert('Błąd zapisu typu');
  }
}

/* ======================
   RANKING
   ====================== */
async function loadRanking(){
  try {
    const [typRes, mecRes] = await Promise.all([ axios.get(`${API_BASE}/Typy`), axios.get(`${API_BASE}/Mecze`) ]);
    const typy = typRes.data || [];
    const mecze = (mecRes.data||[]).reduce((acc,m)=>{ acc[m.ID||'']=m; return acc; },{});
    const scores = {};
    typy.forEach(t=>{
      const uid = t.UserID || t.Nick || 'anon';
      let pts=0;
      const match = mecze[t.ID_meczu];
      if (match && (match.Zakończony||'').toLowerCase()==='tak'){
        const a = String(match.WynikA);
        const b = String(match.WynikB);
        if (t.Typ_zwyciezcy === (parseInt(match.WynikA)>parseInt(match.WynikB)?match.TeamA:match.TeamB)) pts+=1;
        if (String(t.Typ_wynikuA)===a && String(t.Typ_wynikuB)===b) pts+=3;
      } else pts += parseInt(t.Punkty||0);
      scores[uid] = (scores[uid]||0)+pts;
    });
    const arr = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const cont = document.getElementById('rankingList');
    cont.innerHTML='';
    if (arr.length===0) cont.innerHTML='<div class="text-gray-400">Brak typów</div>';
    arr.forEach(([u,p],i)=>{
      const el = document.createElement('div');
      el.className='p-2 rounded flex justify-between items-center';
      el.innerHTML=`<div><span class="font-semibold">${i+1}. ${u}</span></div><div class="text-yellow-400 font-bold">${p} pkt</div>`;
      cont.appendChild(el);
    });
  } catch(err){
    console.error('loadRanking error', err);
    document.getElementById('rankingList').innerHTML='Błąd wczytywania rankingu';
  }
}

/* ======================
   ADMIN
   ====================== */
async function loadAdminData(){
  try {
    const [mRes, uRes] = await Promise.all([ axios.get(`${API_BASE}/Mecze`), axios.get(`${API_BASE}/Users`) ]);
    const mecze = mRes.data||[];
    const users = uRes.data||[];

    const am = document.getElementById('adminMecze');
    am.innerHTML='';
    if(mecze.length===0) am.innerHTML='Brak meczów';
    mecze.forEach(m=>{
      const id = m.ID||'';
      const row = document.createElement('div');
      row.className='p-2 rounded flex gap-2 items-center';
      row.innerHTML=`<div class="flex-1"><strong>${m.TeamA} vs ${m.TeamB}</strong></div>
      <button class="btn px-2 py-1" onclick="deleteMecz('${id}')">Usuń</button>`;
      am.appendChild(row);
    });

    const au = document.getElementById('adminUsers');
    au.innerHTML='';
    users.forEach(u=>{
      const uid = u.UserID||'';
      const row = document.createElement('div');
      row.className='p-2 rounded flex justify-between items-center';
      row.innerHTML=`<div><strong>${u.Nick||'Brak'}</strong></div>
      <button class="btn px-2 py-1" onclick="setUserRole('${uid}','admin')">Nadaj admin</button>`;
      au.appendChild(row);
    });
  } catch(err){
    console.error('loadAdminData error', err);
  }
}

async function adminDodajMecz(){
  const a = document.getElementById('adminTeamA').value.trim();
  const b = document.getElementById('adminTeamB').value.trim();
  if(!a||!b){ alert('Wpisz oba zespoły'); return; }
  const id = 'm'+Date.now();
  try{
    await axios.post(`${API_BASE}/Mecze`, { data:{ID:id,TeamA:a,TeamB:b,WynikA:'',WynikB:'',Zakończony:'NIE'}});
    document.getElementById('adminTeamA').value='';
    document.getElementById('adminTeamB').value='';
    loadMecze(); loadAdminData();
  }catch(err){ console.error('adminDodajMecz error', err);}
}

async function deleteMecz(id){
  if(!confirm('Na pewno usunąć mecz?')) return;
  try{
    await axios.delete(`${API_BASE}/Mecze?ID=${encodeURIComponent(id)}`);
    loadMecze(); loadAdminData();
  }catch(err){ console.error('deleteMecz error', err);}
}

async function setUserRole(userId,newRole){
  try{
    await axios.patch(`${API_BASE}/Users?UserID=${encodeURIComponent(userId)}`, { data:{Role:newRole}});
    loadAdminData();
  }catch(err){ console.error('setUserRole error', err);}
}

/* ======================
   INIT
   ====================== */
showTab('types');
