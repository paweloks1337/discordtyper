// ==== KONFIGURACJA ====
const adminEmail = "paweloxbieniek1@gmail.com";

// ==== ZMIENNE GLOBALNE ====
let currentUser = null;
let matches = [];  // Lista meczów
let users = [];    // Lista użytkowników

// ==== FUNKCJE LOGOWANIA GOOGLE ====
function onGoogleSignIn(response) {
    const profile = decodeJwtResponse(response.credential);
    currentUser = { email: profile.email, name: profile.name };
    initApp();
}

// Dekoder tokena JWT Google
function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
}

// Wyloguj
function signOut() {
    currentUser = null;
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
    document.getElementById('nickCard').classList.add('hidden');
}

// ==== INICJALIZACJA APLIKACJI ====
function initApp() {
    document.getElementById('loginCard').classList.add('hidden');
    const storedUsers = JSON.parse(localStorage.getItem('users')) || [];
    users = storedUsers;

    // Sprawdź czy użytkownik istnieje
    let user = users.find(u => u.email === currentUser.email);
    if (!user) {
        // Nowy użytkownik, pokaż panel nick
        document.getElementById('nickCard').classList.remove('hidden');
    } else {
        currentUser.nick = user.nick;
        currentUser.points = user.points || 0;
        currentUser.role = user.role || 'user';
        showMainApp();
    }
}

// ==== ZAPIS NICKU ====
function saveNick() {
    const nickInput = document.getElementById('nickInput').value.trim();
    if (!nickInput) {
        document.getElementById('nickMsg').innerText = "Podaj nick!";
        return;
    }
    currentUser.nick = nickInput;
    currentUser.points = 0;
    currentUser.role = 'user';
    users.push(currentUser);
    localStorage.setItem('users', JSON.stringify(users));
    document.getElementById('nickCard').classList.add('hidden');
    showMainApp();
}

// ==== POKAŻ GŁÓWNY PANEL ====
function showMainApp() {
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userDisplay').innerText = `${currentUser.nick} (${currentUser.email})`;
    if (currentUser.email !== adminEmail) {
        document.getElementById('tabAdminBtn').style.display = 'none';
    }
    renderMatches();
    renderRanking();
    renderAdminUsers();
}

// ==== TABY ====
function showTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
}

// ==== MECZE ====
function renderMatches() {
    const list = document.getElementById('matchesList');
    list.innerHTML = '';
    if (matches.length === 0) {
        list.innerHTML = "<p>Brak meczów</p>";
        return;
    }
    matches.forEach((match, i) => {
        const now = new Date();
        const matchTime = new Date(match.time);
        const disabled = now >= matchTime ? "disabled opacity-50 cursor-not-allowed" : "";
        const card = document.createElement('div');
        card.className = "card bg-gray-700 p-4 rounded flex justify-between items-center";
        card.innerHTML = `
            <div>${match.teamA} vs ${match.teamB} <span class="text-sm text-gray-300">(${match.timeStr})</span></div>
            <div class="flex gap-2">
                <button class="btn bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded ${disabled}" onclick="submitPick(${i}, 'A')">Team A</button>
                <button class="btn bg-red-500 hover:bg-red-600 px-3 py-1 rounded ${disabled}" onclick="submitPick(${i}, 'B')">Team B</button>
            </div>
        `;
        list.appendChild(card);
    });
}

// Typowanie meczu
function submitPick(matchIndex, choice) {
    const match = matches[matchIndex];
    if (!match.picks) match.picks = {};
    match.picks[currentUser.email] = choice;
    localStorage.setItem('matches', JSON.stringify(matches));
    alert(`Twój typ na ${match.teamA} vs ${match.teamB} został zapisany!`);
}

// ==== RANKING ====
function renderRanking() {
    const list = document.getElementById('rankingList');
    list.innerHTML = '';
    const sorted = [...users].sort((a,b) => (b.points||0)-(a.points||0));
    sorted.forEach((u,i) => {
        const div = document.createElement('div');
        div.className = "bg-gray-700 p-2 rounded flex justify-between";
        div.innerHTML = `<span>${i+1}. ${u.nick}</span><span>${u.points || 0} pkt</span>`;
        list.appendChild(div);
    });
}

// ==== PANEL ADMINA ====
function adminAddMatch() {
    const teamA = document.getElementById('adminTeamA').value.trim();
    const teamB = document.getElementById('adminTeamB').value.trim();
    const time = document.getElementById('adminTime').value;
    if (!teamA || !teamB || !time) { alert("Uzupełnij wszystkie pola!"); return; }
    const match = { teamA, teamB, time: new Date().toISOString().split('T')[0]+"T"+time, timeStr: time };
    matches.push(match);
    localStorage.setItem('matches', JSON.stringify(matches));
    renderMatches();
    renderAdminMatches();
}

// Renderowanie meczów w panelu admina
function renderAdminMatches() {
    const list = document.getElementById('adminMatches');
    list.innerHTML = '';
    matches.forEach((match,i) => {
        const div = document.createElement('div');
        div.className = "bg-gray-600 p-2 rounded flex justify-between items-center";
        div.innerHTML = `
            <span>${match.teamA} vs ${match.teamB} (${match.timeStr})</span>
            <div class="flex gap-2">
                <button class="btn bg-green-500 hover:bg-green-600 px-2 py-1 rounded" onclick="setResult(${i}, 'A')">Wynik A</button>
                <button class="btn bg-red-500 hover:bg-red-600 px-2 py-1 rounded" onclick="setResult(${i}, 'B')">Wynik B</button>
                <button class="btn bg-gray-500 hover:bg-gray-600 px-2 py-1 rounded" onclick="removeMatch(${i})">Usuń</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// Ustawienie wyniku przez admina
function setResult(matchIndex, winner) {
    const match = matches[matchIndex];
    match.winner = winner;
    // przyznawanie punktów
    Object.keys(match.picks||{}).forEach(email => {
        const user = users.find(u => u.email===email);
        if (!user.points) user.points=0;
        if (match.picks[email] === winner) user.points += 1; // 1 pkt za wygranie
    });
    localStorage.setItem('matches', JSON.stringify(matches));
    localStorage.setItem('users', JSON.stringify(users));
    renderRanking();
    renderMatches();
    renderAdminMatches();
}

// Usuń mecz
function removeMatch(index) {
    matches.splice(index,1);
    localStorage.setItem('matches', JSON.stringify(matches));
    renderMatches();
    renderAdminMatches();
}

// Zarządzanie użytkownikami (admin)
function renderAdminUsers() {
    const div = document.getElementById('adminUsers');
    div.innerHTML = '';
    users.forEach((u,i) => {
        const d = document.createElement('div');
        d.className = "flex justify-between bg-gray-600 p-2 rounded";
        d.innerHTML = `<span>${u.nick} (${u.email})</span>
                       <button class="btn bg-red-500 hover:bg-red-600 px-2 py-1 rounded" onclick="removeUser(${i})">Usuń</button>`;
        div.appendChild(d);
    });
}

function removeUser(index) {
    if (!confirm("Na pewno usunąć użytkownika?")) return;
    users.splice(index,1);
    localStorage.setItem('users', JSON.stringify(users));
    renderAdminUsers();
    renderRanking();
}

// ==== INICJALIZACJA DANYCH ====
function loadData() {
    matches = JSON.parse(localStorage.getItem('matches')) || [];
    users = JSON.parse(localStorage.getItem('users')) || [];
}
window.onload = loadData;
