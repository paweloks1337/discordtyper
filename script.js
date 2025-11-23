// =================== Dane ===================
let googleID = '';
let email = '';
let nick = '';
let role = 'user'; // 'admin' jeśli Twój email

const adminEmail = "paweloxbieniek1@gmail.com";

let users = JSON.parse(localStorage.getItem("users")) || [];
let matches = JSON.parse(localStorage.getItem("matches")) || [];
let types = JSON.parse(localStorage.getItem("types")) || [];

// =================== Powiadomienie ===================
function notify(msg="✔ Typ zapisany"){
  const n = document.getElementById("notification");
  n.innerText = msg;
  n.style.display="block";
  setTimeout(()=>{ n.style.display="none"; },2000);
}

// =================== Google Login ===================
function handleCredentialResponse(response){
  const jwt = JSON.parse(atob(response.credential.split('.')[1]));
  googleID = jwt.sub;
  email = jwt.email;
  role = email === adminEmail ? "admin":"user";

  const existing = users.find(u=>u.googleID===googleID);
  if(existing){
    nick = existing.nick;
    showTab('typer-tab');
    updateUserInfo();
    renderMatches();
    renderRanking();
    if(role==="admin") renderAdmin();
  } else {
    showTab('nickname-tab');
  }
}

document.getElementById("save-nick").onclick = ()=>{
  const input = document.getElementById("nickname-input").value.trim();
  if(!input) return alert("Wprowadź nick");
  nick = input;
  users.push({googleID,email,nick,role,points:0});
  localStorage.setItem("users",JSON.stringify(users));
  showTab('typer-tab');
  updateUserInfo();
  renderMatches();
  renderRanking();
  if(role==="admin") renderAdmin();
};

// =================== Logowanie Wyloguj ===================
document.getElementById("logout-btn").onclick = ()=>{
  googleID=''; email=''; nick=''; role='user';
  showTab('login-tab');
  updateUserInfo();
};

function updateUserInfo(){
  document.getElementById("user-nick").innerText = nick ? `Zalogowany jako: ${nick}` : "";
  document.getElementById("logout-btn").style.display = nick ? "inline-block":"none";
}

// =================== Taby ===================
function showTab(tabId){
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
}

// =================== Typowanie ===================
function renderMatches(){
  const container = document.getElementById("matches-list");
  container.innerHTML="";
  matches.forEach(m=>{
    const card = document.createElement("div");
    card.className="match-card";
    const now = new Date();
    const matchDate = new Date(m.date);
    const disabled = now >= matchDate;
    card.innerHTML=`
      <div>${m.teamA} vs ${m.teamB} <br> ${matchDate.toLocaleString()} | BOP: ${m.rounds}</div>
      <div class="match-actions">
        <input type="number" placeholder="Score A" id="scoreA-${m.id}" ${disabled?"disabled":""}>
        <input type="number" placeholder="Score B" id="scoreB-${m.id}" ${disabled?"disabled":""}>
        <button ${disabled?"disabled":""} onclick="submitType('${m.id}')">Wyślij</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function submitType(matchID){
  const match = matches.find(m=>m.id===matchID);
  const scoreA = parseInt(document.getElementById(`scoreA-${matchID}`).value);
  const scoreB = parseInt(document.getElementById(`scoreB-${matchID}`).value);
  if(isNaN(scoreA) || isNaN(scoreB)) return alert("Wprowadź wynik");
  let pts=0;
  if(match.scoreA===scoreA && match.scoreB===scoreB) pts=3;
  else if((scoreA>scoreB && match.scoreA>match.scoreB) || (scoreB>scoreA && match.scoreB>match.scoreA)) pts=1;
  types.push({googleID,matchID,scoreA,scoreB,points:pts});
  const user = users.find(u=>u.googleID===googleID);
  user.points += pts;
  localStorage.setItem("users",JSON.stringify(users));
  localStorage.setItem("types",JSON.stringify(types));
  notify();
  renderRanking();
}

// =================== Ranking ===================
function renderRanking(){
  const container = document.getElementById("ranking-list");
  const sorted = [...users].sort((a,b)=>b.points-a.points);
  container.innerHTML="";
  sorted.forEach(u=>{
    const card = document.createElement("div");
    card.className="rank-card";
    card.innerText = `${u.nick}: ${u.points} pkt`;
    container.appendChild(card);
  });
}

// =================== Admin ===================
function renderAdmin(){
  renderAdminMatches();
  renderAdminUsers();
}

// Dodawanie meczu
document.getElementById("add-match-btn").onclick=()=>{
  const teamA = document.getElementById("teamA-input").value.trim();
  const teamB = document.getElementById("teamB-input").value.trim();
  const date = document.getElementById("match-date").value;
  const rounds = parseInt(document.getElementById("match-rounds").value);
  if(!teamA || !teamB || !date || isNaN(rounds)) return alert("Wypełnij wszystkie pola");
  const id = 'm'+Date.now();
  matches.push({id,teamA,teamB,date,rounds,finished:false,scoreA:null,scoreB:null});
  localStorage.setItem("matches",JSON.stringify(matches));
  renderAdminMatches();
  renderMatches();
};

// Admin: mecze
function renderAdminMatches(){
  const container = document.getElementById("admin-matches");
  container.innerHTML="";
  matches.forEach(m=>{
    const card = document.createElement("div");
    card.className="match-card";
    card.innerHTML=`
      <div>${m.teamA} vs ${m.teamB} <br> ${new Date(m.date).toLocaleString()} | BOP: ${m.rounds}</div>
      <div>
        Wynik A: <input type="number" id="admin-scoreA-${m.id}" value="${m.scoreA||''}">
        Wynik B: <input type="number" id="admin-scoreB-${m.id}" value="${m.scoreB||''}">
        <button onclick="saveResult('${m.id}')">Zapisz wynik</button>
        <button onclick="deleteMatch('${m.id}')">Usuń</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function saveResult(matchID){
  const match = matches.find(m=>m.id===matchID);
  match.scoreA = parseInt(document.getElementById(`admin-scoreA-${matchID}`).value);
  match.scoreB = parseInt(document.getElementById(`admin-scoreB-${matchID}`).value);
  match.finished = true;

  // Przelicz punkty
  types.forEach(t=>{
    if(t.matchID===matchID){
      let pts=0;
      if(t.scoreA===match.scoreA && t.scoreB===match.scoreB) pts=3;
      else if((t.scoreA>t.scoreB && match.scoreA>match.scoreB) || (t.scoreB>t.scoreA && match.scoreB>match.scoreA)) pts=1;
      const user = users.find(u=>u.googleID===t.googleID);
      user.points += pts - t.points; // aktualizacja
      t.points = pts;
    }
  });

  localStorage.setItem("matches",JSON.stringify(matches));
  localStorage.setItem("users",JSON.stringify(users));
  localStorage.setItem("types",JSON.stringify(types));
  renderRanking();
  renderMatches();
  notify("✔ Wynik zapisany");
}

// Usuń mecz
function deleteMatch(matchID){
  matches = matches.filter(m=>m.id!==matchID);
  types = types.filter(t=>t.matchID!==matchID);
  localStorage.setItem("matches",JSON.stringify(matches));
  localStorage.setItem("types",JSON.stringify(types));
  renderAdminMatches();
  renderMatches();
  renderRanking();
}

// Admin: użytkownicy
function renderAdminUsers(){
  const container = document.getElementById("admin-users");
  container.innerHTML="";
  users.forEach(u=>{
    const card = document.createElement("div");
    card.className="user-card";
    card.innerHTML=`${u.nick} (${u.email}) - ${u.points} pkt
    <button onclick="deleteUser('${u.googleID}')">Usuń</button>`;
    container.appendChild(card);
  });
}

function deleteUser(id){
  users = users.filter(u=>u.googleID!==id);
  types = types.filter(t=>t.googleID!==id);
  localStorage.setItem("users",JSON.stringify(users));
  localStorage.setItem("types",JSON.stringify(types));
  renderAdminUsers();
  renderRanking();
  renderMatches();
}

// =================== Inicjalizacja ===================
updateUserInfo();
