// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDwh9_u2u_NenhPYyvhCaLKFCrCrMmMEGE",
  authDomain: "cs2typer.firebaseapp.com",
  projectId: "cs2typer",
  storageBucket: "cs2typer.firebasestorage.app",
  messagingSenderId: "533657649328",
  appId: "1:533657649328:web:e220acd6865b489fa6bb75"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const provider = new GoogleAuthProvider();

// DOM elements
const loginSection = document.getElementById("loginSection");
const appSection = document.getElementById("appSection");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userLabel = document.getElementById("userLabel");
const nicknameInput = document.getElementById("nicknameInput");
const saveNickBtn = document.getElementById("saveNickBtn");
const tabBtns = document.querySelectorAll(".tabBtn");
const tabs = document.querySelectorAll(".tab");
const matchesContainer = document.getElementById("matchesContainer");
const rankingContainer = document.getElementById("rankingContainer");
const addMatchBtn = document.getElementById("addMatchBtn");
const adminTeamA = document.getElementById("adminTeamA");
const adminTeamB = document.getElementById("adminTeamB");
const adminBOP = document.getElementById("adminBOP");
const adminTime = document.getElementById("adminTime");
const adminMatchesContainer = document.getElementById("adminMatchesContainer");
const adminUsersContainer = document.getElementById("adminUsersContainer");

// STATE
let currentUser = null;
let nick = "";
let role = "user"; // 'admin' jeśli Twój mail
const adminEmail = "paweloxbieniek1@gmail.com";

let users = [];
let matches = [];
let ranking = {};

// UTILS
function updateTabs(tabIndex) {
  tabs.forEach((t, i) => t.classList.toggle("active", i === tabIndex));
}

function saveNick() {
  if (nicknameInput.value.trim() === "") return alert("Wprowadź nick!");
  nick = nicknameInput.value.trim();
  if (!users.find(u => u.email === currentUser.email)) {
    users.push({ email: currentUser.email, nick, role });
  } else {
    users.find(u => u.email === currentUser.email).nick = nick;
  }
  updateRanking();
  renderUsers();
}

function updateRanking() {
  ranking = {};
  users.forEach(u => ranking[u.email] = 0);
  matches.forEach(m => {
    m.typy?.forEach(t => {
      if (!ranking[t.email]) ranking[t.email] = 0;
      const correctWinner = (m.scoreA !== null && m.scoreB !== null) ? (m.scoreA > m.scoreB ? m.teamA : m.teamB) : null;
      if (t.team === correctWinner && t.scoreA == m.scoreA && t.scoreB == m.scoreB) ranking[t.email] += 3;
      else if (t.team === correctWinner) ranking[t.email] += 2;
    });
  });
  renderRanking();
}

// RENDER
function renderUsers() {
  if (currentUser.email !== adminEmail) return;
  adminUsersContainer.innerHTML = "<h3 class='font-bold mb-2'>Użytkownicy:</h3>";
  users.forEach(u => {
    const div = document.createElement("div");
    div.className = "flex justify-between mb-1 items-center";
    div.innerHTML = `<span>${u.nick} (${u.email})</span> 
      <button class="bg-red-500 px-2 py-1 text-white rounded hover:bg-red-600" onclick="deleteUser('${u.email}')">Usuń</button>`;
    adminUsersContainer.appendChild(div);
  });
}

window.deleteUser = (email) => {
  users = users.filter(u => u.email !== email);
  updateRanking();
  renderUsers();
  renderMatches();
};

function renderMatches() {
  matchesContainer.innerHTML = "";
  adminMatchesContainer.innerHTML = "";
  matches.forEach((m, i) => {
    // Typowanie
    const now = new Date();
    const matchTime = new Date(m.time);
    const canType = now < matchTime;
    const matchDiv = document.createElement("div");
    matchDiv.className = "matchCard";
    matchDiv.innerHTML = `
      <div>
        ${m.teamA} vs ${m.teamB} 
        <span class="status">${canType ? matchTime.toLocaleString() : "Rozpoczęty"}</span>
      </div>
      <div>
        <input type="number" placeholder="Score ${m.teamA}" class="scoreA w-16 border px-1 py-0.5 rounded mr-1">
        <input type="number" placeholder="Score ${m.teamB}" class="scoreB w-16 border px-1 py-0.5 rounded mr-1">
        <button class="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600" ${!canType ? "disabled" : ""} onclick="sendTyp(${i})">Wyślij</button>
      </div>
    `;
    matchesContainer.appendChild(matchDiv);

    // Panel admina
    if (currentUser.email === adminEmail) {
      const div = document.createElement("div");
      div.className = "matchCard";
      div.innerHTML = `
        ${m.teamA} vs ${m.teamB} | BOP: ${m.BOP} | ${matchTime.toLocaleString()} 
        <button class="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 ml-2" onclick="deleteMatch(${i})">Usuń</button>
        <input type="number" placeholder="${m.teamA}" class="adminScoreA w-16 border px-1 py-0.5 rounded ml-2">
        <input type="number" placeholder="${m.teamB}" class="adminScoreB w-16 border px-1 py-0.5 rounded ml-2">
        <button class="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 ml-2" onclick="setScore(${i})">Zapisz wynik</button>
      `;
      adminMatchesContainer.appendChild(div);
    }
  });
}

function renderRanking() {
  rankingContainer.innerHTML = "<ul>";
  Object.entries(ranking).sort((a, b) => b[1] - a[1]).forEach(([email, pts]) => {
    const user = users.find(u => u.email === email);
    if (!user) return;
    rankingContainer.innerHTML += `<li>${user.nick}: ${pts} pkt</li>`;
  });
  rankingContainer.innerHTML += "</ul>";
}

// ACTIONS
function sendTyp(i) {
  const match = matches[i];
  const inputs = document.querySelectorAll("#matchesContainer .matchCard")[i].querySelectorAll("input");
  const scoreA = parseInt(inputs[0].value);
  const scoreB = parseInt(inputs[1].value);
  if (isNaN(scoreA) || isNaN(scoreB)) return alert("Wpisz wyniki!");
  if (!match.typy) match.typy = [];
  const existing = match.typy.find(t => t.email === currentUser.email);
  if (existing) {
    existing.team = scoreA > scoreB ? match.teamA : match.teamB;
    existing.scoreA = scoreA;
    existing.scoreB = scoreB;
  } else {
    match.typy.push({
      email: currentUser.email,
      team: scoreA > scoreB ? match.teamA : match.teamB,
      scoreA,
      scoreB
    });
  }
  updateRanking();
  alert("Typ zapisany! 🟢");
}

window.deleteMatch = (i) => {
  matches.splice(i, 1);
  renderMatches();
};

window.setScore = (i) => {
  const match = matches[i];
  const inputs = document.querySelectorAll(".adminScoreA")[i];
  const inputsB = document.querySelectorAll(".adminScoreB")[i];
  const scoreA = parseInt(document.querySelectorAll(".adminScoreA")[i].value);
  const scoreB = parseInt(document.querySelectorAll(".adminScoreB")[i].value);
  if (isNaN(scoreA) || isNaN(scoreB)) return alert("Wpisz wynik!");
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  updateRanking();
  renderMatches();
};

addMatchBtn.addEventListener("click", () => {
  const teamA = adminTeamA.value.trim();
  const teamB = adminTeamB.value.trim();
  const BOP = parseInt(adminBOP.value);
  const time = adminTime.value;
  if (!teamA || !teamB || !time) return alert("Wypełnij wszystkie pola!");
  matches.push({ teamA, teamB, BOP, time, typy: [] });
  renderMatches();
});

tabBtns.forEach(btn => btn.addEventListener("click", () => updateTabs(parseInt(btn.dataset.tab))));
saveNickBtn.addEventListener("click", saveNick);

loginBtn.addEventListener("click", () => {
  signInWithPopup(auth, provider).then(result => {
    currentUser = result.user;
    role = currentUser.email === adminEmail ? "admin" : "user";
    userLabel.innerText = `Zalogowany jako: ${currentUser.displayName}`;
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
  }).catch(console.error);
});

logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    currentUser = null;
    loginSection.classList.remove("hidden");
    appSection.classList.add("hidden");
  });
});
