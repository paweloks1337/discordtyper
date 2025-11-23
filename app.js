// Konfiguracja
let googleID = '';
let nick = '';
let role = 'user';
const adminEmail = 'paweloxbieniek1@gmail.com'; // tylko ten mail admin

let users = JSON.parse(localStorage.getItem('users') || '[]');
let matches = JSON.parse(localStorage.getItem('matches') || '[]');
let types = JSON.parse(localStorage.getItem('types') || '[]');

function onGoogleSignIn(response){
  const data = jwt_decode(response.credential);
  googleID = data.sub;
  const email = data.email;
  role = (email === adminEmail) ? 'admin' : 'user';
  const user = users.find(u=>u.id===googleID);
  if(user){
    nick = user.nick;
    afterLogin();
  } else {
    document.getElementById('loginCard').style.display='none';
    document.getElementById('nickSetup').style.display='block';
  }
}

function saveNick(){
  nick = document.getElementById('nickInput').value.trim();
  if(!nick) { alert('Nick nie może być pusty'); return; }
  users.push({id: googleID, nick, role});
  localStorage.setItem('users', JSON.stringify(users));
  document.getElementById('nickSetup').style.display='none';
  afterLogin();
}

function afterLogin(){
  document.getElementById('loginCard').style.display='none';
  document.getElementById('nickSetup').style.display='none';
  document.getElementById('mainApp').style.display='block';
  document.getElementById('userDisplay').textContent = nick + (role==='admin'?' (admin)':'');
  if(role==='admin') document.getElementById('adminTabBtn').style.display='block';
  showTab('types');
  renderTypes();
  renderRanking();
  renderAdmin();
}

function signOut(){
  location.reload();
}

function showTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.style.display='none');
  document.getElementById('tab-'+name).style.display='block';
}

// ======================
// Typowanie
// ======================
function renderTypes(){
  const tab = document.getElementById('tab-types');
  tab.innerHTML = '';
  const now = new Date();
  matches.forEach(m=>{
    const matchTime = new Date(m.time);
    const disabled = now>matchTime;
    const userType = types.find(t=>t.userID===googleID && t.matchID===m.id) || {};
    const div = document.createElement('div');
    div.className = 'card flex flex-col gap-2';
    div.innerHTML = `
      <div><strong>${m.teamA} vs ${m.teamB}</strong> • ${m.time.split('T')[1]}</div>
      <div class="flex gap-2">
        <select ${disabled?'disabled':''} id="winner_${m.id}">
          <option value="${m.teamA}" ${userType.winner===m.teamA?'selected':''}>${m.teamA}</option>
          <option value="${m.teamB}" ${userType.winner===m.teamB?'selected':''}>${m.teamB}</option>
        </select>
        <input type="number" placeholder="A" min="0" ${disabled?'disabled':''} value="${userType.scoreA||''}" id="scoreA_${m.id}"/>
        <input type="number" placeholder="B" min="0" ${disabled?'disabled':''} value="${userType.scoreB||''}" id="scoreB_${m.id}"/>
        <button class="btn" onclick="submitType('${m.id}')" ${disabled?'disabled':''}>Wyślij</button>
      </div>
    `;
    tab.appendChild(div);
  });
}

function submitType(matchID){
  const winner = document.getElementById('winner_'+matchID).value;
  const scoreA = parseInt(document.getElementById('scoreA_'+matchID).value);
  const scoreB = parseInt(document.getElementById('scoreB_'+matchID).value);
  if(isNaN(scoreA)||isNaN(scoreB)) { alert('Podaj wynik'); return; }
  const existing = types.find(t=>t.userID===googleID && t.matchID===matchID);
  if(existing){
    existing.winner=winner; existing.scoreA=scoreA; existing.scoreB=scoreB;
  } else {
    types.push({userID:googleID, matchID, winner, scoreA, scoreB});
  }
  localStorage.setItem('types', JSON.stringify(types));
  renderRanking();
}

// ======================
// Ranking
// ======================
function renderRanking(){
  const tab = document.getElementById('tab-ranking');
  const scores = {};
  users.forEach(u=>scores[u.nick]=0);
  matches.forEach(m=>{
    const matchTime = new Date(m.time);
    if(matchTime>new Date()) return; // mecz nie rozpoczęty
    types.filter(t=>t.matchID===m.id).forEach(t=>{
      const aScore = t.scoreA;
      const bScore = t.scoreB;
      const winner = (aScore>bScore)?m.teamA:(bScore>aScore)?m.teamB:'draw';
      let pts = 0;
      if(t.winner===winner) pts+=1;
      if(t.scoreA===aScore && t.scoreB===bScore) pts+=2; // razem max 3
      scores[users.find(u=>u.id===t.userID).nick]+=pts;
    });
  });
  const arr = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  tab.innerHTML = '';
  arr.forEach(([u,p],idx)=>{
    const div = document.createElement('div');
    div.className='flex justify-between p-2 card';
    div.innerHTML=`<span>${idx+1}. ${u}</span><span>${p} pkt</span>`;
    tab.appendChild(div);
  });
}

// ======================
// Panel admina
// ======================
function renderAdmin(){
  const tab = document.getElementById('adminMatches');
  if(role!=='admin'){ tab.innerHTML=''; return; }
  tab.innerHTML='';
  matches.forEach(m=>{
    const div=document.createElement('div');
    div.className='flex items-center gap-2 card';
    div.innerHTML=`
      <div class="flex-1">${m.teamA} vs ${m.teamB} • ${m.time.split('T')[1]} BOP:${m.rounds}</div>
      <button class="btn" onclick="deleteMatch('${m.id}')">Usuń</button>
    `;
    tab.appendChild(div);
  });
}

function adminAddMatch(){
  const teamA=document.getElementById('adminMatchA').value.trim();
  const teamB=document.getElementById('adminMatchB').value.trim();
  const time=document.getElementById('adminMatchTime').value;
  const rounds=document.getElementById('adminMatchRounds').value || 1;
  if(!teamA||!teamB||!time){ alert('Wypełnij wszystkie pola'); return; }
  const id='m'+Date.now();
  matches.push({id, teamA, teamB, time:`${new Date().toISOString().split('T')[0]}T${time}`, rounds});
  localStorage.setItem('matches', JSON.stringify(matches));
  renderTypes(); renderAdmin();
}

function deleteMatch(id){
  matches=matches.filter(m=>m.id!==id);
  types=types.filter(t=>t.matchID!==id);
  localStorage.setItem('matches', JSON.stringify(matches));
  localStorage.setItem('types', JSON.stringify(types));
  renderTypes(); renderAdmin(); renderRanking();
}

// Domyślnie
showTab('types');
