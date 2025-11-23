/* ======================
   KONFIGURACJA
====================== */
const API_BASE = 'https://sheetdb.io/api/v1/zwlvogb5fk6ay'; // Twój SheetDB endpoint
let googleID = '';
let nick = '';
let role = 'user'; // 'admin' jeśli użytkownik ma prawa

/* ======================
   POMOCNICZE
====================== */
function showTab(name){
  document.querySelectorAll('.tab').forEach(el=>el.style.display='none');
  document.getElementById('tab-'+name).style.display='block';
}

function signOut(){ location.reload(); }

/* ======================
   GOOGLE LOGIN
====================== */
async function onGoogleSignIn(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';
    
    const usersRes = await axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`)
      .catch(e => ({ data: [] }));

    if (usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase()==='admin') ? 'admin' : 'user';
      afterLogin();
    } else {
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('nickSetup').style.display = 'block';
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw teraz swój nick.';
      document.getElementById('nickInput').value = givenName;
    }
  } catch(err){
    console.error('login error', err);
    alert('Błąd logowania. Sprawdź konsolę.');
  }
}

async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;
  try {
    await axios.post(API_BASE, { data: { UserID: googleID, Nick: nick, Role: 'user' } });
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
  document.getElementById('mainApp').style.display='block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin' ? ' (admin)' : '');
  showTab('types');
  loadMecze();
  loadRanking();
  if(role==='admin') loadAdminData();
}

/* ======================
   MECZE / TYPY
====================== */
async function loadMecze(){
  try {
    const res = await axios.get(API_BASE + '/Mecze');
    const mecze = res.data || [];
    mecze.sort((a,b)=> (a.ID||'').localeCompare(b.ID||''));
    const cont = document.getElementById('meczeList');
    cont.innerHTML = '';
    if(mecze.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów.</div>'; return; }

    mecze.forEach(m=>{
      const id = m.ID || '';
      const teamA = m.TeamA || '';
      const teamB = m.TeamB || '';
      const startTime = m.Start || '';
      const now = new Date();
      const startDate = startTime ? new Date(startTime) : new Date(0);
      const disabled = now >= startDate ? 'disabled' : '';

      const card = document.createElement('div');
      card.className='p-3 rounded card mb-2';
      card.innerHTML=`
        <div class="flex justify-between">
          <div><strong>${teamA} vs ${teamB}</strong> <span class="text-gray-400">${startTime}</span></div>
          <div class="text-sm text-gray-300">${m.Zakończony==='TAK'?'Zakończony':'Otwarty'}</div>
        </div>
        <div class="mt-2 flex gap-2 items-center">
          <select id="winner_${id}" class="p-2 rounded bg-transparent border" ${disabled}>
            <option value="${teamA}">${teamA}</option>
            <option value="${teamB}">${teamB}</option>
          </select>
          <input id="scoreA_${id}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" ${disabled}/>
          <input id="scoreB_${id}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" ${disabled}/>
          <button class="btn px-3 py-2 rounded" onclick="submitTyp('${id}')" ${disabled}>Wyślij typ</button>
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
  try {
    const winner = document.getElementById('winner_'+idMeczu).value;
    const scoreA = document.getElementById('scoreA_'+idMeczu).value;
    const scoreB = document.getElementById('scoreB_'+idMeczu).value;
    if(scoreA===''||scoreB===''){ alert('Podaj wynik'); return; }
    await axios.post(API_BASE, { data: { Nick: nick, UserID: googleID, ID_meczu: idMeczu, Typ_zwyciezcy: winner, Typ_wynikuA: scoreA, Typ_wynikuB: scoreB, Punkty:0 }});
    alert('Typ zapisany!');
    loadRanking();
  } catch(err){
    console.error('submitTyp', err);
    alert('Błąd zapisu typu');
  }
}

/* ======================
   RANKING
====================== */
async function loadRanking(){
  try {
    const [typRes,mecRes] = await Promise.all([axios.get(API_BASE+'/Typy'),axios.get(API_BASE+'/Mecze')]);
    const typy = typRes.data||[];
    const mecze = (mecRes.data||[]).reduce((acc,m)=>{ acc[m.ID||'']=m; return acc; },{});
    const scores = {};
    typy.forEach(t=>{
      const uid=t.UserID||t.Nick||'anon';
      let pts=0;
      const match=mecze[t.ID_meczu];
      if(match && match.Zakończony==='TAK'){
        const a=String(match.WynikA);
        const b=String(match.WynikB);
        const pickA=String(t.Typ_wynikuA||'');
        const pickB=String(t.Typ_wynikuB||'');
        const actualWinner = (parseInt(match.WynikA) > parseInt(match.WynikB))? match.TeamA : (parseInt(match.WynikB) > parseInt(match.WynikA)?match.TeamB:'draw');
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
      el.innerHTML=`<div><span class="font-semibold">${idx+1}. ${u}</span> <div class="text-sm text-gray-400">punkty: ${p}</div></div>
      <div class="text-yellow-400 font-bold">${p} pkt</div>`;
      cont.appendChild(el);
    });
  } catch(err){ console.error('loadRanking', err); }
}

/* ======================
   PANEL ADMINA
====================== */
async function loadAdminData(){
  try {
    const [mRes,uRes]=await Promise.all([axios.get(API_BASE+'/Mecze'),axios.get(API_BASE)]);
    const mecze=mRes.data||[];
    const users=uRes.data||[];

    // MECZE PANEL
    const am=document.getElementById('adminMecze');
    am.innerHTML='';
    if(mecze.length===0) am.innerHTML='<div class="text-gray-400">Brak meczów</div>';
    mecze.forEach(m=>{
      const id=m.ID||'';
      const row=document.createElement('div');
      row.className='p-2 rounded flex gap-2 items-center';
      row.innerHTML=`
        <div class="flex-1"><strong>${m.TeamA} vs ${m.TeamB}</strong></div>
        <button class="btn px-2 py-1 rounded" onclick="deleteMatch('${id}')">Usuń mecz</button>
      `;
      am.appendChild(row);
    });

    // USERS PANEL
    const au=document.getElementById('adminUsers');
    au.innerHTML='';
    users.forEach(u=>{
      const uid=u.UserID||'';
      const row=document.createElement('div');
      row.className='p-2 rounded flex justify-between items-center';
      row.innerHTML=`<div>${u.Nick} (${u.Role})</div>
      <button class="btn px-2 py-1 rounded" onclick="setUserRole('${uid}','admin')">Nadaj admin</button>
      <button class="px-2 py-1 rounded bg-gray-800" onclick="copyToClipboard('${uid}')">Kopiuj ID</button>`;
      au.appendChild(row);
    });

  } catch(err){ console.error('loadAdminData', err); }
}

async function deleteMatch(id){
  if(!confirm('Usunąć mecz?')) return;
  try{
    await axios.delete(`${API_BASE}?ID=${encodeURIComponent(id)}`);
    alert('Mecz usunięty');
    loadMecze();
    loadAdminData();
  } catch(err){ console.error(err); alert('Błąd usuwania meczu'); }
}

/* ======================
   POCZĄTEK
====================== */
document.addEventListener('DOMContentLoaded', ()=>{ showTab('types'); });
