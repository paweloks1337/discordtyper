/* ======================
   Konfiguracja
====================== */
const API_BASE = 'https://sheetdb.io/api/v1/zwlvogb5fk6ay'; // Twój SheetDB
let googleID = '';
let nick = '';
let role = 'user';

/* ======================
   Helper: pokaz tab
====================== */
function showTab(name){
  document.querySelectorAll('.tab').forEach(el => el.style.display='none');
  document.getElementById('tab-' + name).style.display='block';
}

/* ======================
   Google Sign-In callback
====================== */
async function handleLogin(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';

    const usersRes = await axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`)
      .catch(() => ({data:[]}));
    
    if(usersRes.data.length > 0){
      const u = usersRes.data[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase() === 'admin') ? 'admin' : 'user';
      afterLogin();
    } else {
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('nickSetup').style.display = 'block';
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw teraz swój nick (unikalny).';
      document.getElementById('nickInput').value = givenName;
    }
  } catch(err){
    console.error('Login error', err);
    alert('Błąd logowania. Sprawdź konsolę.');
  }
}

/* ======================
   Save nick (nowy user)
====================== */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if(!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;
  try {
    await axios.post(API_BASE + '/Users', {data:{UserID:googleID,Nick:nick,Role:'user'}});
    document.getElementById('nickSetup').style.display = 'none';
    afterLogin();
  } catch(err){
    console.error('saveNick', err);
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
  document.getElementById('userDisplay').textContent = nick + (role==='admin'?' (admin)':'');
  showTab('types');
  loadMecze();
  loadRanking();
  if(role==='admin') loadAdminData();
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
    mecze.sort((a,b) => (a.ID||'').localeCompare(b.ID||''));
    const cont = document.getElementById('meczeList');
    cont.innerHTML = '';
    if(mecze.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów</div>'; return; }

    mecze.forEach(m=>{
      const id = m.ID;
      const teamA = m.TeamA;
      const teamB = m.TeamB;
      const time = m.Godzina || '';
      const bo = m.Bo || 'Bo1';
      const finished = (m.Zakończony||'NIE').toUpperCase() === 'TAK';
      const card = document.createElement('div');
      card.className='p-3 rounded card flex flex-col gap-2';
      const now = new Date();
      const matchTime = time ? new Date(new Date().toDateString() + ' ' + time) : now;
      const canType = now < matchTime;

      card.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <div class="font-semibold">${teamA} vs ${teamB} <span class="text-gray-400">${bo}</span></div>
            <div class="text-gray-400">Start: ${time || 'brak'}</div>
            ${finished ? `<div class="text-gray-400">Wynik: ${m.WynikA}:${m.WynikB}</div>` : ''}
          </div>
          <div class="text-sm text-gray-300">${finished ? 'Zakończony' : 'Otwarty'}</div>
        </div>
      `;

      if(!finished){
        const sel = document.createElement('select');
        sel.className='p-2 rounded border bg-transparent';
        sel.disabled = !canType;
        sel.id='winner_'+id;
        sel.innerHTML=`<option value="${teamA}">${teamA}</option><option value="${teamB}">${teamB}</option>`;

        const inpA = document.createElement('input');
        inpA.type='number'; inpA.min=0; inpA.placeholder='A';
        inpA.className='w-16 p-2 rounded bg-transparent border';
        inpA.disabled = !canType;
        inpA.id='scoreA_'+id;

        const inpB = document.createElement('input');
        inpB.type='number'; inpB.min=0; inpB.placeholder='B';
        inpB.className='w-16 p-2 rounded bg-transparent border';
        inpB.disabled = !canType;
        inpB.id='scoreB_'+id;

        const btn = document.createElement('button');
        btn.className='px-3 py-2 rounded btn';
        btn.disabled = !canType;
        btn.textContent='Wyślij typ';
        btn.onclick=()=>submitTyp(id);

        const div = document.createElement('div');
        div.className='flex gap-2 items-center mt-2';
        div.appendChild(sel);
        div.appendChild(inpA);
        div.appendChild(inpB);
        div.appendChild(btn);
        card.appendChild(div);
      }

      cont.appendChild(card);
    });

  } catch(err){
    console.error('loadMecze', err);
    document.getElementById('meczeList').innerHTML='<div class="text-red-400">Błąd wczytywania meczów</div>';
  }
}

/* ======================
   Submit typ
====================== */
async function submitTyp(idMeczu){
  try{
    const winner = document.getElementById('winner_'+idMeczu).value;
    const scoreA = document.getElementById('scoreA_'+idMeczu).value;
    const scoreB = document.getElementById('scoreB_'+idMeczu).value;
    if(scoreA===''||scoreB===''){ alert('Podaj wynik'); return; }
    await axios.post(API_BASE + '/Typy',{data:{Nick:nick,UserID:googleID,ID_meczu:idMeczu,Typ_zwyciezcy:winner,Typ_wynikuA:scoreA,Typ_wynikuB:scoreB,Punkty:0}});
    alert('Typ zapisany!');
    loadRanking();
  } catch(err){
    console.error('submitTyp',err);
    alert('Błąd zapisu typu');
  }
}

/* ======================
   Load ranking
====================== */
async function loadRanking(){
  try{
    const [typRes,mecRes] = await Promise.all([axios.get(API_BASE+'/Typy'),axios.get(API_BASE+'/Mecze')]);
    const typy = typRes.data || [];
    const mecze = (mecRes.data || []).reduce((acc,m)=>{ acc[m.ID]=m; return acc; },{});
    const scores = {};
    typy.forEach(t=>{
      const uid = t.UserID || t.Nick;
      let pts=0;
      const m = mecze[t.ID_meczu];
      if(m && m.Zakończony==='TAK'){
        const a=String(m.WynikA), b=String(m.WynikB);
        const pa=String(t.Typ_wynikuA), pb=String(t.Typ_wynikuB);
        const winner=(parseInt(m.WynikA)>parseInt(m.WynikB))?m.TeamA:(parseInt(m.WynikB)>parseInt(m.WynikA)?m.TeamB:'draw');
        if(t.Typ_zwyciezcy===winner) pts+=1;
        if(pa===a && pb===b) pts+=3;
      } else {
        pts+=parseInt(t.Punkty||0);
      }
      scores[uid]=(scores[uid]||0)+pts;
    });
    const arr=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
    const cont=document.getElementById('rankingList');
    cont.innerHTML='';
    if(arr.length===0) cont.innerHTML='<div class="text-gray-400">Brak typów</div>';
    arr.forEach(([u,p],i)=>{
      const el=document.createElement('div');
      el.className='p-2 rounded flex justify-between items-center';
      el.innerHTML=`<div><span class="font-semibold">${i+1}. ${u}</span><div class="text-sm text-gray-400">punkty: ${p}</div></div><div class="text-yellow-400 font-bold">${p} pkt</div>`;
      cont.appendChild(el);
    });
  } catch(err){
    console.error('loadRanking',err);
    document.getElementById('rankingList').innerHTML='<div class="text-red-400">Błąd wczytywania rankingu</div>';
  }
}

/* ======================
   Admin functions
====================== */
async function loadAdminData(){
  try{
    const [mRes,uRes] = await Promise.all([axios.get(API_BASE+'/Mecze'),axios.get(API_BASE+'/Users')]);
    const mecze=mRes.data||[];
    const users=uRes.data||[];

    // mecze panel
    const am=document.getElementById('adminMecze');
    am.innerHTML='';
    if(mecze.length===0) am.innerHTML='<div class="text-gray-400">Brak meczów</div>';
    mecze.forEach(m=>{
      const row=document.createElement('div');
      row.className='p-2 rounded flex gap-2 items-center';
      row.innerHTML=`
        <div class="flex-1"><strong>${m.TeamA} vs ${m.TeamB}</strong> ${m.Bo||'Bo1'} <div class="text-sm text-gray-400">ID:${m.ID} Godzina:${m.Godzina||'brak'}</div></div>
        <button class="px-2 py-1 rounded btn" onclick="adminDeleteMecz('${m.ID}')">Usuń</button>
      `;
      am.appendChild(row);
    });

    // users panel
    const au=document.getElementById('adminUsers');
    au.innerHTML='';
    users.forEach(u=>{
      const row=document.createElement('div');
      row.className='p-2 rounded flex justify-between items-center';
      row.innerHTML=`<div><strong>${u.Nick}</strong> <div class="text-sm text-gray-400">${u.UserID}</div></div>
        <div class="flex gap-2">
          <div class="text-sm text-gray-300">${u.Role||'user'}</div>
          <button class="px-2 py-1 rounded btn" onclick="setUserRole('${u.UserID}','admin')">Nadaj admin</button>
        </div>`;
      au.appendChild(row);
    });

  } catch(err){ console.error('loadAdminData',err);}
}

async function adminDodajMecz(){
  const teamA=document.getElementById('adminTeamA').value.trim();
  const teamB=document.getElementById('adminTeamB').value.trim();
  const godzina=document.getElementById('adminTime').value;
  const bo=document.getElementById('adminBo').value;
  if(!teamA||!teamB){alert('Wpisz oba zespoły'); return;}
  const id='m'+Date.now();
  try{
    await axios.post(API_BASE+'/Mecze',{data:{ID:id,TeamA:teamA,TeamB:teamB,WynikA:'',WynikB:'',Zakończony:'NIE',Godzina:godzina,Bo:bo}});
    alert('Mecz dodany');
    loadMecze(); loadAdminData();
  } catch(err){console.error('adminDodajMecz',err); alert('Błąd dodawania meczu');}
}

async function adminDeleteMecz(id){
  if(!confirm('Na pewno usunąć mecz?')) return;
  try{
    await axios.delete(API_BASE+`/Mecze/${id}`);
    alert('Mecz usunięty');
    loadMecze(); loadAdminData();
  } catch(err){console.error('adminDeleteMecz',err); alert('Błąd usuwania meczu');}
}

async function setUserRole(uid,role){
  try{
    await axios.patch(API_BASE+`/Users?UserID=${encodeURIComponent(uid)}`,{data:{Role:role}});
    alert('Rola ustawiona');
    loadAdminData();
  } catch(err){console.error(err); alert('Błąd ustawiania roli');}
}

/* ======================
   Start
====================== */
showTab('types');
