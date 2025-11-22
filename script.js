const API_BASE = 'https://sheetdb.io/api/v1/zwlvogb5fk6ay';
let googleID = '';
let nick = '';
let role = 'user';

/* ========================
   TABY
======================== */
function showTab(name){
  document.querySelectorAll('.tab').forEach(el=>el.style.display='none');
  document.getElementById('tab-'+name).style.display='block';
}

/* ========================
   GOOGLE LOGIN
======================== */
async function onGoogleSignIn(response){
  try{
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';

    const usersRes = await axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`)
      .catch(e=>({data:[]}));

    if(usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase()==='admin')?'admin':'user';
      afterLogin();
    } else {
      document.getElementById('loginCard').style.display='none';
      document.getElementById('nickSetup').style.display='block';
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw teraz swój nick.';
      document.getElementById('nickInput').value = givenName;
    }
  } catch(err){
    console.error('login error', err);
    alert('Błąd logowania. Sprawdź konsolę.');
  }
}

/* ========================
   NICK
======================== */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if(!v){ alert('Nick nie może być pusty'); return; }
  nick = v;
  try{
    await axios.post(API_BASE + '/Users', { data: { UserID: googleID, Nick: nick, Role: 'user' }});
    document.getElementById('nickSetup').style.display='none';
    afterLogin();
  } catch(err){
    console.error('saveNick', err);
    alert('Błąd zapisu nicku. Sprawdź arkusz Users i SheetDB.');
  }
}

/* ========================
   AFTER LOGIN
======================== */
function afterLogin(){
  document.getElementById('loginCard').style.display='none';
  document.getElementById('nickSetup').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin'?' (admin)':'');
  showTab('types');
  loadMecze();
  loadRanking();
  if(role==='admin') loadAdminData();
}

function signOut(){ location.reload(); }

/* ========================
   TYPY
======================== */
async function loadMecze(){
  try{
    const res = await axios.get(API_BASE + '/Mecze');
    const mecze = res.data || [];
    const cont = document.getElementById('meczeList');
    cont.innerHTML='';
    if(mecze.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów.</div>'; return; }

    const now = new Date();

    mecze.forEach(m=>{
      const matchTime = m.Time ? new Date('1970-01-01T'+m.Time) : null;
      const editable = !matchTime || now < matchTime;

      const card = document.createElement('div');
      card.className='p-3 rounded card flex justify-between items-center';
      card.innerHTML=`
        <div>
          <div class="font-semibold">${m.TeamA} vs ${m.TeamB} <span class="text-sm text-gray-400">${m.Rounds||'BO1'}</span></div>
          <div class="text-sm text-gray-400">Godzina: ${m.Time||'nie ustawiona'}</div>
        </div>
        <div class="flex gap-2">
          <select id="winner_${m.ID}" class="p-2 rounded bg-transparent border" ${!editable?'disabled':''}>
            <option value="${m.TeamA}">${m.TeamA}</option>
            <option value="${m.TeamB}">${m.TeamB}</option>
          </select>
          <input id="scoreA_${m.ID}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" ${!editable?'disabled':''}/>
          <input id="scoreB_${m.ID}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" ${!editable?'disabled':''}/>
          <button class="btn px-3 py-2 rounded" onclick="submitTyp('${m.ID}')" ${!editable?'disabled':''}>Wyślij typ</button>
        </div>
      `;
      cont.appendChild(card);
    });
  } catch(err){
    console.error('loadMecze', err);
    document.getElementById('meczeList').innerHTML='<div class="text-red-400">Błąd wczytywania meczów</div>';
  }
}

async function submitTyp(idMeczu){
  try{
    const winner = document.getElementById('winner_'+idMeczu).value;
    const scoreA = document.getElementById('scoreA_'+idMeczu).value;
    const scoreB = document.getElementById('scoreB_'+idMeczu).value;
    if(scoreA==='' || scoreB===''){ alert('Podaj dokładny wynik'); return; }
    await axios.post(API_BASE+'/Typy', { data: { Nick: nick, UserID: googleID, ID_meczu: idMeczu, Typ_zwyciezcy: winner, Typ_wynikuA: scoreA, Typ_wynikuB: scoreB, Punkty: 0 }});
    alert('Typ zapisany!');
    loadRanking();
  } catch(err){
    console.error('submitTyp', err);
    alert('Błąd zapisu typu');
  }
}

/* ========================
   RANKING
======================== */
async function loadRanking(){
  try{
    const [typRes, mecRes] = await Promise.all([axios.get(API_BASE+'/Typy'), axios.get(API_BASE+'/Mecze')]);
    const typy = typRes.data || [];
    const mecze = (mecRes.data || []).reduce((acc,m)=>{ acc[m.ID||'']=m; return acc; }, {});
    const scores = {};

    typy.forEach(t=>{
      const uid = t.UserID || t.Nick || 'anon';
      let pts = 0;
      const match = mecze[t.ID_meczu];
      if(match && (match.Zakończony||'').toLowerCase()==='tak' && match.WynikA!==undefined){
        const a = String(match.WynikA);
        const b = String(match.WynikB);
        const pickA = String(t.Typ_wynikuA||'');
        const pickB = String(t.Typ_wynikuB||'');
        const actualWinner = (parseInt(match.WynikA) > parseInt(match.WynikB)) ? match.TeamA : (parseInt(match.WynikB) > parseInt(match.WynikA)?match.TeamB:'draw');
        if(t.Typ_zwyciezcy === actualWinner) pts += 1;
        if(pickA===a && pickB===b) pts += 3;
      } else { pts += parseInt(t.Punkty||0); }
      scores[uid] = (scores[uid]||0)+pts;
    });

    const arr = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const cont = document.getElementById('rankingList');
    cont.innerHTML='';
    if(arr.length===0) cont.innerHTML='<div class="text-gray-400">Brak typów</div>';
    arr.forEach(([u,p], idx)=>{
      const el = document.createElement('div');
      el.className='p-2 rounded flex justify-between items-center';
      el.innerHTML=`<div><span class="font-semibold">${idx+1}. ${u}</span></div>
        <div class="text-yellow-400 font-bold">${p} pkt</div>`;
      cont.appendChild(el);
    });
  } catch(err){
    console.error('loadRanking', err);
  }
}

/* ========================
   PANEL ADMIN
======================== */
async function loadAdminData(){
  try{
    const [mRes, uRes] = await Promise.all([axios.get(API_BASE+'/Mecze'), axios.get(API_BASE+'/Users')]);
    const mecze = mRes.data || [];
    const cont = document.getElementById('adminMecze');
    cont.innerHTML='';
    if(mecze.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów</div>'; return; }

    mecze.forEach(m=>{
      const row = document.createElement('div');
      row.className='p-2 rounded flex gap-2 items-center card';
      row.innerHTML=`
        <div class="flex-1"><strong>${m.TeamA} vs ${m.TeamB}</strong> <span class="text-sm text-gray-400">ID: ${m.ID}</span></div>
        <input id="resA_${m.ID}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikA||''}" placeholder="A"/>
        <input id="resB_${m.ID}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikB||''}" placeholder="B"/>
        <input id="time_${m.ID}" type="time" class="w-20 p-1 rounded bg-transparent border" value="${m.Time||''}"/>
        <select id="rounds_${m.ID}" class="p-1 rounded bg-transparent border">
          <option value="BO1" ${m.Rounds==='BO1'?'selected':''}>BO1</option>
          <option value="BO3" ${m.Rounds==='BO3'?'selected':''}>BO3</option>
          <option value="BO5" ${m.Rounds==='BO5'?'selected':''}>BO5</option>
        </select>
        <button class="px-2 py-1 rounded btn" onclick="adminSaveResult('${m.ID}')">Zapisz</button>
        <button class="px-2 py-1 rounded bg-red-600" onclick="adminDeleteMatch('${m.ID}')">Usuń</button>
      `;
      cont.appendChild(row);
    });
  } catch(err){ console.error('loadAdminData', err); }
}

async function adminDodajMecz(){
  const a = document.getElementById('adminTeamA').value.trim();
  const b = document.getElementById('adminTeamB').value.trim();
  const time = document.getElementById('adminTime').value;
  const rounds = document.getElementById('adminRounds').value;
  if(!a || !b){ alert('Wpisz oba zespoły'); return; }
  const id = 'm'+Date.now();
  try{
    await axios.post(API_BASE+'/Mecze', { data: { ID:id, TeamA:a, TeamB:b, WynikA:'', WynikB:'', Time:time, Rounds:rounds, Zakończony:'NIE' }});
    alert('Mecz dodany');
    document.getElementById('adminTeamA').value='';
    document.getElementById('adminTeamB').value='';
    document.getElementById('adminTime').value='';
    loadMecze();
    loadAdminData();
  } catch(err){ console.error('adminDodajMecz',err); alert('Błąd dodawania meczu'); }
}

async function adminSaveResult(id){
  const a = document.getElementById(`resA_${id}`).value;
  const b = document.getElementById(`resB_${id}`).value;
  const time = document.getElementById(`time_${id}`).value;
  const rounds = document.getElementById(`rounds_${id}`).value;
  try{
    await axios.patch(API_BASE+`/Mecze?ID=${encodeURIComponent(id)}`, { data: { WynikA:a, WynikB:b, Time:time, Rounds:rounds, Zakończony:(a!==''&&b!=='')?'TAK':'NIE'}});
    alert('Zapisano wynik');
    loadMecze();
    loadAdminData();
    loadRanking();
  } catch(err){ console.error(err); alert('Błąd zapisu wyniku'); }
}

async function adminDeleteMatch(id){
  if(!confirm('Na pewno chcesz usunąć ten mecz?')) return;
  try{
    await axios.delete(API_BASE+`/Mecze?ID=${encodeURIComponent(id)}`);
    alert('Mecz usunięty');
    loadMecze();
    loadAdminData();
  } catch(err){ console.error(err); alert('Błąd usuwania meczu'); }
}
