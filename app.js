// ==============================
// KONFIGURACJA
// ==============================
const adminEmail = 'TWÓJ_EMAIL@gmail.com'; // Twój mail admin
let googleID = '';
let nick = '';
let role = 'user';

// ==============================
// INIT STORAGE
// ==============================
let users = JSON.parse(localStorage.getItem('users') || '[]');
let matches = JSON.parse(localStorage.getItem('matches') || '[]');
let types = JSON.parse(localStorage.getItem('types') || '[]');

function saveStorage(){
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('matches', JSON.stringify(matches));
  localStorage.setItem('types', JSON.stringify(types));
}

// ==============================
// Google Sign-In
// ==============================
function onGoogleSignIn(response){
  try{
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const email = data.email;
    role = (email === adminEmail) ? 'admin' : 'user';
    
    let user = users.find(u => u.id === googleID);
    if(user){
      nick = user.nick;
      afterLogin();
    } else {
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('nickSetup').style.display = 'block';
      document.getElementById('nickInput').value = data.name || email.split('@')[0];
    }
  }catch(err){
    console.error('Błąd logowania:', err);
    alert('Błąd logowania Google');
  }
}

// ==============================
// SAVE NICK
// ==============================
function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if(!v){ alert('Nick nie może być pusty'); return; }
  nick = v;
  users.push({id: googleID, nick, role: 'user', points: 0});
  saveStorage();
  document.getElementById('nickSetup').style.display = 'none';
  afterLogin();
}

// ==============================
// AFTER LOGIN
// ==============================
function afterLogin(){
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin'?' (admin)':'');
  showTab('types');
  renderMatches();
  renderRanking();
  if(role==='admin') renderAdmin();
}

// ==============================
// LOGOUT
// ==============================
function signOut(){
  location.reload();
}

// ==============================
// TABS
// ==============================
function showTab(name){
  document.querySelectorAll('.tab').forEach(el => el.style.display='none');
  document.getElementById('tab-'+name).style.display='block';
}

// ==============================
// MATCHES
// ==============================
function renderMatches(){
  const cont = document.getElementById('meczeList');
  cont.innerHTML = '';
  if(matches.length===0){ cont.innerHTML='<div class="text-gray-400">Brak meczów</div>'; return;}
  const now = new Date();
  matches.forEach(m=>{
    const start = new Date(m.startTime);
    const isClosed = now >= start;
    const card = document.createElement('div');
    card.className = 'p-3 rounded card mb-2';
    card.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div><strong>${m.teamA} vs ${m.teamB}</strong> <span class="text-gray-400">${start.toLocaleTimeString()}</span></div>
        <div class="text-sm text-gray-300">${isClosed?'Zamknięty':'Otwarty'}</div>
      </div>
      <div class="flex gap-2 items-center">
        <select id="winner_${m.id}" class="p-2 rounded bg-transparent border" ${isClosed?'disabled':''}>
          <option value="${m.teamA}">${m.teamA}</option>
          <option value="${m.teamB}">${m.teamB}</option>
        </select>
        <input id="scoreA_${m.id}" type="number" min="0" placeholder="A" class="w-16 p-2 rounded bg-transparent border" ${isClosed?'disabled':''}/>
        <input id="scoreB_${m.id}" type="number" min="0" placeholder="B" class="w-16 p-2 rounded bg-transparent border" ${isClosed?'disabled':''}/>
        <button class="px-3 py-2 rounded btn" onclick="submitTyp('${m.id}')" ${isClosed?'disabled':''}>Wyślij typ</button>
      </div>
    `;
    cont.appendChild(card);
  });
}

// ==============================
// SUBMIT TYPE
// ==============================
function submitTyp(matchId){
  const match = matches.find(m=>m.id===matchId);
  const now = new Date();
  if(now >= new Date(match.startTime)){ alert('Typowanie zamknięte'); return;}
  const winner = document.getElementById('winner_'+matchId).value;
  const scoreA = document.getElementById('scoreA_'+matchId).value;
  const scoreB = document.getElementById('scoreB_'+matchId).value;
  if(scoreA===''||scoreB===''){ alert('Podaj wynik'); return;}
  const existing = types.find(t=>t.userId===googleID && t.matchId===matchId);
  if(existing){
    existing.winner = winner;
    existing.scoreA = scoreA;
    existing.scoreB = scoreB;
  } else {
    types.push({userId: googleID, matchId, winner, scoreA, scoreB});
  }
  saveStorage();
  renderRanking();
  alert('Typ zapisany!');
}

// ==============================
// RANKING
// ==============================
function renderRanking(){
  const cont = document.getElementById('rankingList');
  const scoresMap = {};
  users.forEach(u=>scoresMap[u.id] = {nick:u.nick, points:0});
  types.forEach(t=>{
    const match = matches.find(m=>m.id===t.matchId);
    if(!match) return;
    const mScoreA = parseInt(match.scoreA || 0);
    const mScoreB = parseInt(match.scoreB || 0);
    const tScoreA = parseInt(t.scoreA);
    const tScoreB = parseInt(t.scoreB);
    const actualWinner = mScoreA>mScoreB ? match.teamA : mScoreB>mScoreA ? match.teamB : 'draw';
    let pts = 0;
    if(tScoreA===mScoreA && tScoreB===mScoreB && t.winner===actualWinner) pts=3;
    else if(t.winner===actualWinner) pts=1;
    scoresMap[t.userId].points += pts;
  });
  const ranking = Object.values(scoresMap).sort((a,b)=>b.points-a.points);
  cont.innerHTML = '';
  ranking.forEach((r,i)=>{
    const el = document.createElement('div');
    el.className='p-2 rounded flex justify-between items-center mb-1';
    el.innerHTML = `<div>${i+1}. ${r.nick}</div><div class="text-yellow-400 font-bold">${r.points} pkt</div>`;
    cont.appendChild(el);
  });
}

// ==============================
// ADMIN
// ==============================
function renderAdmin(){
  const cont = document.getElementById('adminPanel');
  cont.innerHTML = '';

  // Dodaj mecz
  const addDiv = document.createElement('div');
  addDiv.className='mb-4';
  addDiv.innerHTML=`
    <h3 class="font-semibold">Dodaj mecz</h3>
    <input id="adminTeamA" placeholder="Team A" class="p-2 rounded border mb-1"/>
    <input id="adminTeamB" placeholder="Team B" class="p-2 rounded border mb-1"/>
    <input type="time" id="adminTime" class="p-2 rounded border mb-1"/>
    <input type="number" id="adminRounds" placeholder="Liczba rund" class="p-2 rounded border mb-1"/>
    <button class="btn px-3 py-2 rounded" onclick="adminAddMatch()">Dodaj mecz</button>
  `;
  cont.appendChild(addDiv);

  // Lista meczów
  matches.forEach(m=>{
    const div = document.createElement('div');
    div.className='p-2 rounded card mb-2 flex justify-between items-center';
    div.innerHTML=`
      <div><strong>${m.teamA} vs ${m.teamB}</strong> ${m.startTime} Rundy: ${m.rounds}</div>
      <div class="flex gap-2">
        <button class="btn px-2 py-1 rounded" onclick="adminDeleteMatch('${m.id}')">Usuń mecz</button>
      </div>
    `;
    cont.appendChild(div);
  });

  // Lista użytkowników
  const userDiv = document.createElement('div');
  userDiv.className='mt-4';
  userDiv.innerHTML='<h3 class="font-semibold">Użytkownicy</h3>';
  users.forEach(u=>{
    const div = document.createElement('div');
    div.className='p-2 rounded card mb-1 flex justify-between items-center';
    div.innerHTML=`<div>${u.nick} (${u.role})</div>
      <button class="btn px-2 py-1 rounded" onclick="adminDeleteUser('${u.id}')">Usuń użytkownika</button>`;
    userDiv.appendChild(div);
  });
  cont.appendChild(userDiv);
}

// ==============================
// ADMIN ADD/DELETE
// ==============================
function adminAddMatch(){
  const teamA = document.getElementById('adminTeamA').value.trim();
  const teamB = document.getElementById('adminTeamB').value.trim();
  const startTime = document.getElementById('adminTime').value;
  const rounds = document.getElementById('adminRounds').value || 1;
  if(!teamA || !teamB || !startTime){ alert('Wypełnij wszystkie pola'); return; }
  const id = 'm'+Date.now();
  matches.push({id, teamA, teamB, startTime: new Date().toISOString().split('T')[0]+'T'+startTime, rounds});
  saveStorage();
  renderMatches();
  renderAdmin();
}

function adminDeleteMatch(id){
  if(!confirm('Usunąć mecz?')) return;
  matches = matches.filter(m=>m.id!==id);
  types = types.filter(t=>t.matchId!==id);
  saveStorage();
  renderMatches();
  renderAdmin();
}

function adminDeleteUser(id){
  if(!confirm('Usunąć użytkownika?')) return;
  users = users.filter(u=>u.id!==id);
  types = types.filter(t=>t.userId!==id);
  saveStorage();
  renderRanking();
  renderAdmin();
}
