/* ======================
   KONFIGURACJA
====================== */
const API_BASE = 'https://sheetdb.io/api/v1/zwlvogb5fk6ay'; // Twój endpoint SheetDB
let googleID = '';
let nick = '';
let role = 'user'; // 'admin' jeśli użytkownik ma prawa

/* ======================
   POKAZ ZAKŁADKI
====================== */
function showTab(name){
  document.querySelectorAll('.tab').forEach(el => el.style.display='none');
  document.getElementById('tab-' + name).style.display = 'block';
}

/* ======================
   GOOGLE SIGN-IN
====================== */
async function onGoogleSignIn(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';

    const usersRes = await axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`);
    if (usersRes.data && usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase()==='admin') ? 'admin' : 'user';
      afterLogin();
    } else {
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
   ZAPIS NICKU
====================== */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;

  try {
    const usersRes = await axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`);
    if (usersRes.data && usersRes.data.length > 0){
      // PATCH jeśli istnieje
      await axios.patch(API_BASE + `/Users?UserID=${encodeURIComponent(googleID)}`, { data: { Nick: nick } });
    } else {
      // POST jeśli nowy
      await axios.post(API_BASE + '/Users', { data: { UserID: googleID, Nick: nick, Role: 'user' } });
    }
    document.getElementById('nickSetup').style.display = 'none';
    afterLogin();
  } catch(err){
    console.error('saveNick err', err);
    alert('Błąd zapisu nicku. Sprawdź arkusz Users i konfigurację SheetDB.');
  }
}

/* ======================
   PO LOGOWANIU
====================== */
function afterLogin(){
  document.getElementById('loginCard').style.display='none';
  document.getElementById('nickSetup').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin' ? ' (admin)' : '');
  showTab('types');
  loadMecze();
  loadRanking();
  if(role==='admin') loadAdminData();
}

/* ======================
   WYLOGUJ
====================== */
function signOut(){ location.reload(); }

/* ======================
   WCZYTYWANIE MECZÓW
====================== */
async function loadMecze(){
  try {
    const res = await axios.get(API_BASE + '/Mecze');
    const mecze = res.data || [];
    mecze.sort((a,b)=> (a.ID||'').localeCompare(b.ID||''));
    const cont = document.getElementById('meczeList');
    cont.innerHTML = '';
    if (mecze.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów.</div>'; return; }

    mecze.forEach(m=>{
      const id = m.ID || '';
      const teamA = m.TeamA || 'Team A';
      const teamB = m.TeamB || 'Team B';
      const finished = (m.Zakończony||'').toLowerCase() === 'tak';
      const now = new Date();
      const startTime = m.Start ? new Date(m.Start) : null;
      const canType = !startTime || now < startTime;

      const card = document.createElement('div');
      card.className='p-3 rounded card';
      card.innerHTML=`
        <div class="flex justify-between items-center">
          <div>
            <div class="font-semibold">${teamA} <span class="text-gray-400">vs</span> ${teamB}</div>
            <div class="text-sm text-gray-400">Start: ${m.Start || 'brak'}</div>
          </div>
          <div class="text-sm text-gray-300">${finished ? 'Zakończony' : canType ? 'Otwarty' : 'Typowanie zablokowane'}</div>
        </div>
        <div class="mt-3 flex gap-2 items-center">
          <select id="winner_${id}" class="p-2 rounded bg-transparent border" ${canType ? '' : 'disabled'}>
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
          <input id="scoreA_${id}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" ${canType ? '' : 'disabled'} />
          <input id="scoreB_${id}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" ${canType ? '' : 'disabled'} />
          <button class="px-3 py-2 rounded btn" onclick="submitTyp('${id}')" ${canType ? '' : 'disabled'}>Wyślij typ</button>
        </div>
      `;
      cont.appendChild(card);
    });
  } catch(err){
    console.error('loadMecze', err);
    document.getElementById('meczeList').innerHTML='<div class="text-red-400">Błąd wczytywania meczów</div>';
  }
}

/* ======================
   WYŚLIJ TYP
====================== */
async function submitTyp(idMeczu){
  try {
    const winner = document.getElementById('winner_'+idMeczu).value;
    const scoreA = document.getElementById('scoreA_'+idMeczu).value;
    const scoreB = document.getElementById('scoreB_'+idMeczu).value;
    if(scoreA==='' || scoreB===''){ alert('Podaj dokładny wynik'); return; }
    await axios.post(API_BASE + '/Typy', { data: { Nick: nick, UserID: googleID, ID_meczu:idMeczu, Typ_zwyciezcy:winner, Typ_wynikuA:scoreA, Typ_wynikuB:scoreB, Punkty:0 }});
    alert('Typ zapisany!');
    loadRanking();
  } catch(err){
    console.error('submitTyp', err);
    alert('Błąd zapisu typu');
  }
}

/* ======================
   WCZYTYWANIE RANKINGU
====================== */
async function loadRanking(){
  try{
    const [typRes, mecRes] = await Promise.all([axios.get(API_BASE+'/Typy'), axios.get(API_BASE+'/Mecze')]);
    const typy = typRes.data || [];
    const mecze = (mecRes.data||[]).reduce((acc,m)=>{acc[m.ID||'']=m; return acc;}, {});
    const scores = {};
    typy.forEach(t=>{
      const uid = t.UserID||t.Nick||'anon';
      let pts=0;
      const match = mecze[t.ID_meczu];
      if(match && (match.Zakończony||'').toLowerCase()==='tak'){
        const a=String(match.WynikA), b=String(match.WynikB);
        const pickA=String(t.Typ_wynikuA||''), pickB=String(t.Typ_wynikuB||'');
        const actualWinner=(parseInt(match.WynikA)>parseInt(match.WynikB))?match.TeamA:(parseInt(match.WynikB)>parseInt(match.WynikA)?match.TeamB:'draw');
        if(t.Typ_zwyciezcy===actualWinner) pts+=1;
        if(pickA===a && pickB===b) pts+=3;
      } else { pts+=parseInt(t.Punkty||0); }
      scores[uid]=(scores[uid]||0)+pts;
    });
    const arr=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const cont=document.getElementById('rankingList');
    cont.innerHTML='';
    if(arr.length===0) cont.innerHTML='<div class="text-gray-400">Brak typów</div>';
    arr.forEach(([u,p],idx)=>{
      const el=document.createElement('div');
      el.className='p-2 rounded flex justify-between items-center';
      el.innerHTML=`<div><span class="font-semibold">${idx+1}. ${u}</span><div class="text-sm text-gray-400">punkty: ${p}</div></div><div class="text-yellow-400 font-bold">${p} pkt</div>`;
      cont.appendChild(el);
    });
  } catch(err){
    console.error('loadRanking', err);
    document.getElementById('rankingList').innerHTML='<div class="text-red-400">Błąd wczytywania rankingu</div>';
  }
}

/* ======================
   PANEL ADMINA (dodawanie/usuwanie meczów, start time, BO)
====================== */
async function loadAdminData(){
  try{
    const [mRes,uRes]=await Promise.all([axios.get(API_BASE+'/Mecze'),axios.get(API_BASE+'/Users')]);
    const mecze=mRes.data||[];
    const users=uRes.data||[];
    const adminArea=document.getElementById('adminArea');
    adminArea.innerHTML='';

    // Dodawanie meczu
    const addDiv=document.createElement('div');
    addDiv.className='mb-4';
    addDiv.innerHTML=`
      <h3 class="font-semibold accent mb-1">Dodaj mecz</h3>
      <input id="adminTeamA" placeholder="Team A" class="p-2 rounded border bg-transparent mr-2"/>
      <input id="adminTeamB" placeholder="Team B" class="p-2 rounded border bg-transparent mr-2"/>
      <input id="adminStart" type="datetime-local" class="p-2 rounded border mr-2"/>
      <select id="adminBO" class="p-2 rounded border mr-2">
        <option value="1">BO1</option>
        <option value="3">BO3</option>
        <option value="5">BO5</option>
      </select>
      <button class="btn px-3 py-2 rounded" onclick="adminDodajMecz()">Dodaj mecz</button>
    `;
    adminArea.appendChild(addDiv);

    // Lista meczów do edycji
    const matchList=document.createElement('div');
    matchList.className='space-y-2';
    mecze.forEach(m=>{
      const row=document.createElement('div');
      row.className='p-2 rounded flex gap-2 items-center card';
      row.innerHTML=`
        <div class="flex-1"><strong>${m.TeamA} vs ${m.TeamB}</strong> <div class="text-sm text-gray-400">ID: ${m.ID} | Start: ${m.Start || 'brak'} | ${m.BO || 'BO1'}</div></div>
        <input id="resA_${m.ID}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikA||''}" placeholder="A"/>
        <input id="resB_${m.ID}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikB||''}" placeholder="B"/>
        <select id="done_${m.ID}" class="p-1 rounded bg-transparent border">
          <option value="NIE" ${((m.Zakończony||'').toUpperCase()==='NIE')?'selected':''}>NIE</option>
          <option value="TAK" ${((m.Zakończony||'').toUpperCase()==='TAK')?'selected':''}>TAK</option>
        </select>
        <button class="px-2 py-1 rounded btn" onclick="adminSaveResult('${m.ID}')">Zapisz</button>
        <button class="px-2 py-1 rounded bg-red-700" onclick="adminUsunMecz('${m.ID}')">Usuń</button>
      `;
      matchList.appendChild(row);
    });
    adminArea.appendChild(matchList);

  } catch(err){ console.error(err); adminArea.innerHTML='<div class="text-red-400">Błąd wczytywania (admin)</div>'; }
}

/* ======================
   DODAJ MECZ (admin)
====================== */
async function adminDodajMecz(){
  const a=document.getElementById('adminTeamA').value.trim();
  const b=document.getElementById('adminTeamB').value.trim();
  const start=document.getElementById('adminStart').value;
  const bo=document.getElementById('adminBO').value;
  if(!a||!b){ alert('Wpisz oba zespoły'); return; }
  const id='m'+Date.now();
  try{
    await axios.post(API_BASE+'/Mecze', { data:{ ID:id, TeamA:a, TeamB:b, WynikA:'', WynikB:'', Zakończony:'NIE', Start:start, BO:bo } });
    alert('Mecz dodany');
    loadMecze(); loadAdminData();
  }catch(err){ console.error(err); alert('Błąd dodawania meczu'); }
}

/* ======================
   ZAPIS WYNIKU MECZU (admin)
====================== */
async function adminSaveResult(id){
  try{
    const a=document.getElementById(`resA_${id}`).value;
    const b=document.getElementById(`resB_${id}`).value;
    const done=document.getElementById(`done_${id}`).value;
    await axios.patch(API_BASE+`/Mecze?ID=${encodeURIComponent(id)}`, { data:{ WynikA:a, WynikB:b, Zakończony:done }});
    alert('Wynik zapisany');
    await recalcPointsForMatch(id);
    loadMecze(); loadRanking(); loadAdminData();
  }catch(err){ console.error(err); alert('Błąd zapisu wyniku'); }
}

/* ======================
   USUŃ MECZ (admin)
====================== */
async function adminUsunMecz(id){
  if(!confirm('Na pewno usunąć mecz?')) return;
  try{
    await axios.delete(API_BASE+`/Mecze?ID=${encodeURIComponent(id)}`);
    alert('Mecz usunięty');
    loadMecze(); loadAdminData();
  }catch(err){ console.error(err); alert('Błąd usuwania meczu'); }
}

/* ======================
   PRZELICZENIE PUNKTÓW
====================== */
async function recalcPointsForMatch(matchId){
  try{
    const matchRes=await axios.get(API_BASE+`/Mecze?ID=${encodeURIComponent(matchId)}`);
    const match=(matchRes.data && matchRes.data[0])||null;
    if(!match) return;
    const typyRes=await axios.get(API_BASE+`/Typy/search?ID_meczu=${encodeURIComponent(matchId)}`).catch(e=>({data:[]})); 
    const typy=typyRes.data||[];
    for(const t of typy){
      let pts=0;
      if((match.Zakończony||'').toLowerCase()==='tak'){
        const a=String(match.WynikA||''), b=String(match.WynikB||'');
        const actualWinner=(parseInt(match.WynikA)>parseInt(match.WynikB))?match.TeamA:(parseInt(match.WynikB)>parseInt(match.WynikA)?match.TeamB:'draw');
        if(t.Typ_zwyciezcy===actualWinner) pts+=1;
        if(String(t.Typ_wynikuA)===a && String(t.Typ_wynikuB)===b) pts+=3;
      }
      await axios.patch(API_BASE+`/Typy?Nick=${encodeURIComponent(t.Nick)}&ID_meczu=${encodeURIComponent(matchId)}`, { data:{ Punkty:pts }});
    }
  }catch(err){ console.error(err); }
}

/* ======================
   NA STARTE
====================== */
showTab('types');
