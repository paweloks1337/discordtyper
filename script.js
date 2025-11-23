// --- Dane lokalne ---
let currentUser = { nick:'paweloks', points:0 };
let users = [ {...currentUser, role:'admin'} ];
let matches = [];

// Początkowe ustawienia użytkownika
document.getElementById('userNick').innerText = currentUser.nick;

// --- Zakładki ---
function showTab(name){
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
}

// --- Dodawanie meczu ---
function addMatch(){
    const teamA = document.getElementById('teamA').value;
    const teamB = document.getElementById('teamB').value;
    const startTime = document.getElementById('matchTime').value;
    const bop = document.getElementById('bop').value;

    if(!teamA || !teamB || !startTime || !bop) return alert('Wypełnij wszystkie pola');

    const match = {id:Date.now(), teamA, teamB, startTime: new Date(startTime), bop, results:null, types:[]};
    matches.push(match);
    renderMatches();
    renderAdminMatches();
}

// --- Renderowanie meczów ---
function renderMatches(){
    const container = document.getElementById('matchesContainer');
    container.innerHTML = '';
    const now = new Date();

    matches.forEach(m=>{
        const isOpen = now < m.startTime;
        const statusText = `<span class="status hidden" id="status_${m.id}">🟢 Typ oddany</span>`;
        container.innerHTML += `<div class="match">
            <div>${m.teamA} vs ${m.teamB} | ${m.startTime.toLocaleString()} | BOP: ${m.bop}</div>
            <input type="number" id="scoreA_${m.id}" placeholder="0" min="0" ${!isOpen?'disabled':''}>
            <input type="number" id="scoreB_${m.id}" placeholder="0" min="0" ${!isOpen?'disabled':''}>
            <button onclick="submitType(${m.id})" ${!isOpen?'disabled':''}>Wyślij</button>
            ${statusText}
        </div>`;
    });
}

// --- Typowanie meczu ---
function submitType(id){
    const match = matches.find(m=>m.id===id);
    const now = new Date();
    if(now >= match.startTime) return alert("Typowanie zamknięte!");

    const scoreA = parseInt(document.getElementById('scoreA_'+id).value);
    const scoreB = parseInt(document.getElementById('scoreB_'+id).value);

    if(isNaN(scoreA) || isNaN(scoreB)) return alert("Wpisz wyniki!");

    // Sprawdzenie czy użytkownik już typował
    const existing = match.types.find(t=>t.user === currentUser.nick);
    if(existing){
        existing.scoreA = scoreA;
        existing.scoreB = scoreB;
    } else {
        match.types.push({user:currentUser.nick, scoreA, scoreB});
    }

    document.getElementById('status_'+id).classList.remove('hidden');
    setTimeout(()=>document.getElementById('status_'+id).classList.add('hidden'),1500);

    console.log('Typ oddany', match.types);
}

// --- Render admin ---
function renderAdminMatches(){
    const container = document.getElementById('adminMatchesContainer');
    container.innerHTML = '';
    matches.forEach(m=>{
        container.innerHTML += `<div class="match">
            <div>${m.teamA} vs ${m.teamB} | ${m.startTime.toLocaleString()} | BOP: ${m.bop}</div>
            <input type="number" placeholder="Wynik A" id="resA_${m.id}">
            <input type="number" placeholder="Wynik B" id="resB_${m.id}">
            <button onclick="submitResult(${m.id})" style="background:#28a745;">Zapisz wynik</button>
            <button onclick="deleteMatch(${m.id})" style="background:#ff4444;">Usuń</button>
        </div>`;
    });
}

// --- Zapis wyniku i przyznawanie punktów ---
function submitResult(id){
    const match = matches.find(m=>m.id===id);
    const scoreA = parseInt(document.getElementById('resA_'+id).value);
    const scoreB = parseInt(document.getElementById('resB_'+id).value);
    if(isNaN(scoreA) || isNaN(scoreB)) return alert("Wpisz wyniki!");

    match.results = { scoreA, scoreB };

    // Przyznawanie punktów
    match.types.forEach(t=>{
        const user = users.find(u=>u.nick===t.user);
        if(!user) return;
        if(t.scoreA === scoreA && t.scoreB === scoreB) user.points += 3;
        else if((t.scoreA - t.scoreB) * (scoreA - scoreB) > 0) user.points += 1; // poprawny zwycięzca
    });

    renderRanking();
}

// --- Ranking ---
function renderRanking(){
    const container = document.getElementById('rankingTable');
    container.innerHTML = '';
    const sorted = [...users].sort((a,b)=>b.points - a.points);
    sorted.forEach((u,i)=>{
        container.innerHTML += `<tr><td>${i+1}</td><td>${u.nick}</td><td>${u.points}</td></tr>`;
    });
}

// --- Użytkownicy ---
function renderAdminUsers(){
    const container = document.getElementById('adminUsersContainer');
    container.innerHTML = '';
    users.forEach((u,i)=>{
        container.innerHTML += `<div class="match">${i+1}. ${u.nick} (${u.role}) 
        <button onclick="deleteUser('${u.nick}')" style="background:#ff4444;">Usuń</button></div>`;
    });
}

function deleteUser(nick){
    users = users.filter(u=>u.nick!==nick);
    renderAdminUsers();
}

// --- Usuń mecz ---
function deleteMatch(id){
    matches = matches.filter(m=>m.id!==id);
    renderMatches();
    renderAdminMatches();
}

// --- Logout ---
function logout(){ alert('Wylogowano'); location.reload(); }

// Początkowe renderowanie
renderMatches();
renderAdminMatches();
renderAdminUsers();
renderRanking();
