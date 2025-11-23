// =======================
// Konfiguracja
// =======================
const ADMIN_EMAIL = "paweloxbieniek1@gmail.com";
let user = { googleID: "", nick: "", email: "", role: "user", points: 0, history: [] };
let mecze = []; // lista meczów
let users = []; // lista użytkowników

// =======================
// Google Login callback
// =======================
function onGoogleSignIn(response) {
  const data = jwt_decode(response.credential);
  user.googleID = data.sub;
  user.email = data.email;
  user.nick = data.name || "";
  user.role = (user.email === ADMIN_EMAIL) ? "admin" : "user";

  document.getElementById("loginCard").style.display = "none";

  if (!user.nick) {
    document.getElementById("nickSetup").style.display = "block";
  } else {
    document.getElementById("mainApp").style.display = "block";
    initApp();
  }
  if (user.role === "admin") document.getElementById("tabAdminBtn").style.display = "inline-block";
  document.getElementById("userDisplay").innerText = user.nick || user.email;
}

// =======================
// Wyloguj
// =======================
function signOut() {
  google.accounts.id.disableAutoSelect();
  location.reload();
}

// =======================
// Ustawienie nicku
// =======================
function saveNick() {
  const nickInput = document.getElementById("nickInput").value.trim();
  if (nickInput.length < 1) {
    document.getElementById("nickMsg").innerText = "Nick jest wymagany!";
    return;
  }
  user.nick = nickInput;
  document.getElementById("nickSetup").style.display = "none";
  document.getElementById("mainApp").style.display = "block";
  document.getElementById("userDisplay").innerText = user.nick;
  initApp();
}

// =======================
// Inicjalizacja aplikacji
// =======================
function initApp() {
  renderMecze();
  renderRanking();
  if (user.role === "admin") renderAdminPanel();
}

// =======================
// Zakładki
// =======================
function showTab(tab) {
  document.querySelectorAll(".tab").forEach(s => s.style.display = "none");
  document.getElementById("tab-" + tab).style.display = "block";
}

// =======================
// Dodawanie meczów (admin)
// =======================
function adminDodajMecz() {
  const a = document.getElementById("adminTeamA").value.trim();
  const b = document.getElementById("adminTeamB").value.trim();
  const t = document.getElementById("adminTime").value;
  const bo = document.getElementById("adminBO").value;

  if (!a || !b || !t) return alert("Uzupełnij wszystkie pola!");

  const now = new Date();
  const [hours, minutes] = t.split(":").map(Number);
  const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

  const mecz = {
    id: Date.now(),
    teamA: a,
    teamB: b,
    startTime: startTime,
    bo: parseInt(bo),
    wynik: null,
    typy: []
  };
  mecze.push(mecz);
  renderMecze();
  renderAdminPanel();
}

// =======================
// Render listy meczów
// =======================
function renderMecze() {
  const container = document.getElementById("meczeList");
  container.innerHTML = "";

  if (mecze.length === 0) return container.innerHTML = "<p class='text-gray-400'>Brak meczów</p>";

  mecze.forEach(m => {
    const now = new Date();
    const disabled = now >= m.startTime ? "disabled" : "";

    const remaining = Math.max(0, m.startTime - now);
    const hours = Math.floor(remaining / (1000*60*60));
    const minutes = Math.floor((remaining % (1000*60*60)) / (1000*60));
    const seconds = Math.floor((remaining % (1000*60)) / 1000);
    const timerText = remaining > 0 ? `${hours}h ${minutes}m ${seconds}s` : "Rozpoczęty";

    const card = document.createElement("div");
    card.className = "card p-4 rounded-lg flex justify-between items-center shadow-lg mb-2 bg-gray-800";

    card.innerHTML = `
      <div>
        <div class="font-semibold text-lg">${m.teamA} vs ${m.teamB} (BO${m.bo})</div>
        <div class="text-sm text-gray-400">Start: ${m.startTime.toLocaleTimeString()} | ${timerText}</div>
      </div>
      <div class="flex items-center gap-2">
        <input type="number" min="0" placeholder="A" style="width:50px;" ${disabled} id="scoreA-${m.id}">
        <input type="number" min="0" placeholder="B" style="width:50px;" ${disabled} id="scoreB-${m.id}">
        <button class="btn px-3 py-1 rounded bg-blue-500 hover:bg-blue-700 transition" onclick="submitTyp(${m.id})" ${disabled}>Wyślij</button>
        <span id="typMsg-${m.id}" class="ml-2 font-bold"></span>
      </div>
    `;
    container.appendChild(card);
  });

  // Odświeżaj co sekundę liczniki
  setTimeout(renderMecze, 1000);
}

// =======================
// Zapis typu
// =======================
function submitTyp(meczId) {
  const mecz = mecze.find(m => m.id === meczId);
  const a = parseInt(document.getElementById(`scoreA-${meczId}`).value);
  const b = parseInt(document.getElementById(`scoreB-${meczId}`).value);

  if (isNaN(a) || isNaN(b)) return alert("Wpisz wynik!");

  // zapis typu użytkownika
  const existing = mecz.typy.find(t => t.userID === user.googleID);
  if (existing) {
    existing.scoreA = a;
    existing.scoreB = b;
  } else {
    mecz.typy.push({ userID: user.googleID, scoreA: a, scoreB: b });
  }

  user.history.push({ meczId: mecz.id, teamA: mecz.teamA, teamB: mecz.teamB, scoreA: a, scoreB: b });
  const msg = document.getElementById(`typMsg-${meczId}`);
  msg.innerText = "🟢 Typ zapisany!";
  setTimeout(() => msg.innerText = "", 2000);

  renderRanking();
}

// =======================
// Ranking
// =======================
function renderRanking() {
  const container = document.getElementById("rankingList");
  container.innerHTML = "";

  const ranking = {};

  users.forEach(u => {
    ranking[u.googleID] = { nick: u.nick, points: u.points || 0 };
  });

  mecze.forEach(m => {
    if (!m.wynik) return;
    m.typy.forEach(t => {
      const userRank = ranking[t.userID] || { nick: t.nick || "Anon", points: 0 };
      if (t.scoreA === m.wynik.a && t.scoreB === m.wynik.b) userRank.points += 3;
      else if ((t.scoreA > t.scoreB) === (m.wynik.a > m.wynik.b)) userRank.points += 1;
      ranking[t.userID] = userRank;
    });
  });

  const sorted = Object.values(ranking).sort((a, b) => b.points - a.points);
  sorted.forEach((u, i) => {
    const row = document.createElement("div");
    row.className = "flex justify-between p-2 border-b border-gray-700";
    row.innerHTML = `<span>${i+1}. ${u.nick} ${i===0 ? "🏆" : i===1 ? "🥈" : i===2 ? "🥉" : ""}</span><span>${u.points} pkt</span>`;
    container.appendChild(row);
  });
}

// =======================
// Admin Panel render
// =======================
function renderAdminPanel() {
  const container = document.getElementById("adminMecze");
  container.innerHTML = "";
  mecze.forEach(m => {
    const div = document.createElement("div");
    div.className = "flex justify-between items-center card p-2 rounded mb-2 bg-gray-700";
    div.innerHTML = `
      ${m.teamA} vs ${m.teamB} 
      <button class="px-2 py-1 rounded bg-red-600 hover:bg-red-800 transition text-black" onclick="adminUsunMecz(${m.id})">Usuń</button>
      <button class="px-2 py-1 rounded bg-green-600 hover:bg-green-800 transition text-black" onclick="adminDodajWynik(${m.id})">Wynik</button>
    `;
    container.appendChild(div);
  });

  const usersContainer = document.getElementById("adminUsers");
  usersContainer.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.className = "flex justify-between items-center card p-2 rounded mb-1 bg-gray-700";
    div.innerHTML = `${u.nick} <button class="px-2 py-1 rounded bg-red-600 hover:bg-red-800 transition text-black" onclick="adminUsunUser('${u.googleID}')">Usuń</button>`;
    usersContainer.appendChild(div);
  });
}

// =======================
// Admin usuń mecz
// =======================
function adminUsunMecz(id) {
  mecze = mecze.filter(m => m.id !== id);
  renderMecze();
  renderAdminPanel();
}

// =======================
// Admin usuń user
// =======================
function adminUsunUser(id) {
  users = users.filter(u => u.googleID !== id);
  renderAdminPanel();
}

// =======================
// Admin dodaj wynik
// =======================
function adminDodajWynik(meczId) {
  const a = prompt("Wynik Team A:");
  const b = prompt("Wynik Team B:");
  if (a === null || b === null) return;
  const mecz = mecze.find(m => m.id === meczId);
  mecz.wynik = { a: parseInt(a), b: parseInt(b) };
  renderRanking();
}
