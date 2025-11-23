/* =======================
   KONFIGURACJA
======================= */
let googleID = '';
let nick = '';
let role = 'user'; // 'admin' jeśli użytkownik ma prawa
let users = JSON.parse(localStorage.getItem('users') || '[]');
let mecze = JSON.parse(localStorage.getItem('mecze') || '[]');
let typy = JSON.parse(localStorage.getItem('typy') || '[]');

/* =======================
   POKAZ TAB
======================= */
function showTab(name){
  document.querySelectorAll('.tab').forEach(el=>el.style.display='none');
  document.getElementById('tab-'+name).style.display='block';
}

/* =======================
   GOOGLE SIGN-IN CALLBACK
======================= */
function onGoogleSignIn(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';

    // check if user exists
    let u = users.find(u=>u.UserID === googleID);
    if(u){
      nick = u.Nick;
      role = u.Role;
      afterLogin();
    } else {
      document.getElementById('loginCard').style.display='none';
      document.getElementById('nickSetup').style.display='block';
      document.getElementById('nickInput').value = givenName;
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw teraz swój nick.';
    }
  } catch(err){
    console.error(err);
    alert('Błąd logowania');
  }
}

/* =======================
   SAVE NICK (NOWY USER)
======================= */
function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if(!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;
  role = 'user';
  users.push({UserID: googleID, Nick: nick, Role: role});
  localStorage.setItem('users', JSON.stringify(users));
  document.getElementById('nickSetup').style.display='none';
  afterLogin();
}

/* =======================
   AFTER LOGIN
======================= */
function afterLogin(){
  document.getElementById('loginCard').style.display='none';
  document.getElementById('nickSetup').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin' ? ' (admin)' : '');
  showTab('types');
  renderMecze();
  renderRanking();
  if(role==='admin') renderAdmin();
}

/* =======================
   SIGN OUT
======================= */
function signOut(){ location.reload(); }

/* =======================
   RENDER MECZE (TYPUJ)
======================= */
function renderMecze(){
  const cont = document.getElementById('meczeList');
  cont.innerHTML='';
  if(mecze.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów</div>'; return; }

  const now = new Date();

  mecze.forEach((m, idx)=>{
    const startTime = new Date();
    if(m.time){
      const [h,min] = m.time.split(':');
      startTime.setHours(h, min, 0, 0);
    }
    const disabled = now >= startTime ? 'disabled' : '';
    const card = document.createElement('div');
    card.className='p-3 rounded card';
    card.innerHTML=`
      <div class="flex justify-between items-center">
        <div>
          <div class="font-semibold">${m.TeamA} <span class="text-gray-400">vs</span> ${m.TeamB}</div>
          <div class="text-sm text-gray-400">Start: ${m.time || 'brak'} | Rundy: ${m.rounds || 1}</div>
        </div>
      </div>
      <div class="mt-2 flex gap-2 items-center">
        <select id="winner_${idx}" class="p-2 rounded bg-transparent border" ${disabled}>
          <option value="${m.TeamA}">${m.TeamA}</option>
          <option value="${m.TeamB}">${m.TeamB}</option>
        </select>
        <input id="scoreA_${idx}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" ${disabled}/>
        <input id="scoreB_${idx}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" ${disabled}/>
        <button class="px-3 py-2 rounded btn" onclick="submitTyp(${idx})" ${disabled}>Wyślij typ</button>
      </div>
    `;
    cont.appendChild(card);
  });
}

/* =======================
   SUBMIT TYP
======================= */
function submitTyp(idx){
  const winner = document.getElementById(`winner_${idx}`).value;
  const scoreA = document.getElementById(`scoreA_${idx}`).value;
  const scoreB = document.getElementById(`scoreB_${idx}`).value;

  if(scoreA==='' || scoreB===''){ alert('Podaj wynik'); return; }

  const m = mecze[idx];
  const now = new Date();
  const startTime = new Date();
  if(m.time){
    const [h,min] = m.time.split(':');
    startTime.setHours(h,min,0,0);
  }
  if(now >= startTime){ alert('Nie możesz typować po rozpoczęciu meczu'); return; }

  const tIdx = typy.findIndex(t=>t.UserID===googleID && t.matchIdx===idx);
  const typObj = {UserID: googleID, Nick: nick, matchIdx: idx, Typ_zwyciezcy: winner, Typ_wynikuA: scoreA, Typ_wynikuB: scoreB, Punkty:0};
  if(tIdx>=0) typy[tIdx]=typObj;
  else typy.push(typObj);
  localStorage.setItem('typy', JSON.stringify(typy));
  alert('Typ zapisany!');
  renderRanking();
}

/* =======================
   RENDER RANKING
======================= */
function renderRanking(){
  const cont = document.getElementById('rankingList');
  cont.innerHTML='';
  if(typy.length===0){ cont.innerHTML='<div class="text-gray-400">Brak typów</div>'; return; }

  // oblicz punkty
  const scores = {};
  typy.forEach(t=>{
    scores[t.Nick] = scores[t.Nick] || 0;
    const m = mecze[t.matchIdx];
    if(m.WynikA!==undefined && m.WynikB!==undefined && m.WynikA!=='' && m.WynikB!==''){
      const actualWinner = m.WynikA > m.WynikB ? m.TeamA : (m.WynikB > m.WynikA ? m.TeamB : 'draw');
      if(t.Typ_zwyciezcy===actualWinner) scores[t.Nick]+=1;
      if(t.Typ_wynikuA==m.WynikA && t.Typ_wynikuB==m.WynikB) scores[t.Nick]+=3;
    }
  });

  const arr = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  arr.forEach(([n,p],i)=>{
    const el = document.createElement('div');
    el.className='p-2 rounded flex justify-between items-center';
    el.innerHTML=`<div><span class="font-semibold">${i+1}. ${n}</span></div><div class="text-yellow-400 font-bold">${p} pkt</div>`;
    cont.appendChild(el);
  });
}

/* =======================
   ADMIN PANEL
======================= */
function renderAdmin(){
  const cont = document.getElementById('adminMecze');
  cont.innerHTML='';
  if(mecze.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów</div>'; return; }

  mecze.forEach((m, idx)=>{
    const row = document.createElement('div');
    row.className='p-2 rounded flex gap-2 items-center';
    row.innerHTML=`
      <div class="flex-1"><strong>${m.TeamA} vs ${m.TeamB}</strong> | Start: ${m.time || '-'} | Rundy: ${m.rounds || 1}</div>
      <button class="px-2 py-1 rounded bg-red-600" onclick="adminUsunMecz(${idx})">Usuń</button>
    `;
    cont.appendChild(row);
  });
}

function adminDodajMecz(){
  const A=document.getElementById('adminTeamA').value.trim();
  const B=document.getElementById('adminTeamB').value.trim();
  const time=document.getElementById('adminTime').value;
  const rounds=document.getElementById('adminRounds').value || 1;
  if(!A||!B){ alert('Wpisz oba zespoły'); return; }
  mecze.push({TeamA:A,TeamB:B,time:time,rounds:rounds,WynikA:'',WynikB:''});
  localStorage.setItem('mecze',JSON.stringify(mecze));
  renderMecze();
  renderAdmin();
  document.getElementById('adminTeamA').value='';
  document.getElementById('adminTeamB').value='';
  document.getElementById('adminTime').value='';
  document.getElementById('adminRounds').value='';
}

function adminUsunMecz(idx){
  if(confirm('Na pewno usunąć mecz?')){
    mecze.splice(idx,1);
    localStorage.setItem('mecze',JSON.stringify(mecze));
    renderMecze();
    renderAdmin();
  }
}

/* =======================
   ON LOAD
======================= */
showTab('types');
