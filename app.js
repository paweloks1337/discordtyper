// -----------------------
// FIREBASE CONFIG
// -----------------------
const firebaseConfig = {
    apiKey: "AIzaSyDwh9_u2u_NenhPYyvhCaLKFCrCrMmMEGE",
    authDomain: "cs2typer.firebaseapp.com",
    projectId: "cs2typer",
    storageBucket: "cs2typer.firebasestorage.app",
    messagingSenderId: "533657649328",
    appId: "1:533657649328:web:e220acd6865b489fa6bb75"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// -----------------------
// GLOBAL VARIABLES
// -----------------------
let currentUser = null;
let isAdmin = false;
const adminEmails = ["paweloxbieniek1@gmail.com"];
let matches = [];
let users = [];
let rankings = {};
let userHistory = [];

// -----------------------
// DOM ELEMENTS
// -----------------------
const loginPanel = document.getElementById("login-panel");
const loginBtn = document.getElementById("loginBtn");
const header = document.querySelector("header");
const nav = document.querySelector("nav");
const main = document.querySelector("main");
const logoutBtn = document.getElementById("logoutBtn");
const userNameSpan = document.getElementById("user-name");
const nicknamePanel = document.createElement("div");

// -----------------------
// LOGIN / AUTH
// -----------------------
loginBtn.addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (e) {
        showNotification("Błąd logowania!", "error");
        console.error(e);
    }
});

logoutBtn.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user;

        // Sprawdź czy użytkownik ma ustawiony nick
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (!userDoc.exists || !userDoc.data().nick) {
            showNicknamePanel(user);
        } else {
            loginPanel.style.display = "none";
            header.style.display = "flex";
            nav.style.display = "flex";
            main.style.display = "block";
            userNameSpan.textContent = `Zalogowany jako: ${userDoc.data().nick}`;
            checkAdmin(user.email);
            loadData();
        }
    } else {
        currentUser = null;
        loginPanel.style.display = "flex";
        header.style.display = "none";
        nav.style.display = "none";
        main.style.display = "none";
        matches = [];
        users = [];
        rankings = {};
        userHistory = [];
    }
});

// -----------------------
// NICKNAME SETTING
// -----------------------
function showNicknamePanel(user) {
    loginPanel.innerHTML = `
    <div class="login-box">
        <h2>Witaj ${user.displayName}! Wybierz swój nick:</h2>
        <div id="nickname-panel">
            <input type="text" id="nickname-input" placeholder="Twój nick">
            <button id="setNicknameBtn">Zapisz nick</button>
        </div>
    </div>`;
    const setBtn = document.getElementById("setNicknameBtn");
    setBtn.addEventListener("click", async () => {
        const nick = document.getElementById("nickname-input").value.trim();
        if (!nick) return showNotification("Podaj nick!", "error");
        await db.collection("users").doc(user.uid).set({ nick, points: 0, email: user.email }, { merge: true });
        loginPanel.style.display = "none";
        header.style.display = "flex";
        nav.style.display = "flex";
        main.style.display = "block";
        userNameSpan.textContent = `Zalogowany jako: ${nick}`;
        checkAdmin(user.email);
        loadData();
    });
}

// -----------------------
// ADMIN CHECK
// -----------------------
function checkAdmin(email) {
    isAdmin = adminEmails.includes(email);
    const adminTab = document.querySelector('nav button[data-tab="admin"]');
    adminTab.style.display = isAdmin ? "inline-block" : "none";
}

// -----------------------
// LOAD DATA
// -----------------------
async function loadData() {
    const matchesSnap = await db.collection("matches").orderBy("startTime").get();
    matches = matchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const usersSnap = await db.collection("users").get();
    users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const typesSnap = await db.collectionGroup("types").where("userId","==",currentUser.uid).get();
    userHistory = typesSnap.docs.map(doc => doc.data());

    buildRanking();
    renderMatches();
    renderAdminMatches();
    renderAdminUsers();
    renderHistory();
}

// -----------------------
// MATCHES RENDERING
// -----------------------
function renderMatches() {
    const container = document.getElementById("matches-list");
    container.innerHTML = "";
    const now = new Date();

    matches.forEach(match => {
        const start = match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime);
        const canType = now < start;

        const div = document.createElement("div");
        div.className = "match-card";
        div.innerHTML = `
            <div class="match-info">
                <span class="match-teams">${match.teamA} vs ${match.teamB}</span>
                <span class="match-time">${start.toLocaleString()} | BOP: ${match.bop}</span>
            </div>
            <div class="match-actions">
                <input type="number" min="0" placeholder="Wynik ${match.teamA}" id="scoreA_${match.id}" class="input-score" ${!canType ? "disabled" : ""}>
                <input type="number" min="0" placeholder="Wynik ${match.teamB}" id="scoreB_${match.id}" class="input-score" ${!canType ? "disabled" : ""}>
                <button class="btn btn-submit" onclick="submitType('${match.id}')" ${!canType ? "disabled" : ""}>Wyślij</button>
            </div>
            <div class="type-feedback" id="feedback_${match.id}"></div>
        `;
        container.appendChild(div);

        if (canType) startCountdown(match.id, start);
    });
}

// -----------------------
// HISTORY
// -----------------------
function renderHistory() {
    const container = document.getElementById("history-list");
    container.innerHTML = "";
    if (!userHistory.length) return container.textContent = "Nie oddałeś jeszcze żadnego typu.";

    userHistory.forEach(t => {
        const div = document.createElement("div");
        div.className = "match-card";
        div.textContent = `${t.nick}: ${t.scoreA} - ${t.scoreB} (mecz: ${t.matchId || "??"})`;
        container.appendChild(div);
    });
}

// -----------------------
// COUNTDOWN
// -----------------------
function startCountdown(matchId, startTime) {
    const interval = setInterval(() => {
        const now = new Date();
        const diff = startTime - now;
        const feedback = document.getElementById(`feedback_${matchId}`);
        if (diff <= 0) {
            feedback.textContent = "⏱️ Mecz rozpoczęty, typowanie zakończone!";
            clearInterval(interval);
            renderMatches();
        } else {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            feedback.textContent = `Pozostało: ${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
        }
    }, 1000);
}

// -----------------------
// SUBMIT TYPE
// -----------------------
async function submitType(matchId) {
    const scoreA = parseInt(document.getElementById(`scoreA_${matchId}`).value);
    const scoreB = parseInt(document.getElementById(`scoreB_${matchId}`).value);
    if (isNaN(scoreA) || isNaN(scoreB)) return showNotification("Podaj poprawne wyniki!", "error");

    await db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid).set({
        userId: currentUser.uid,
        nick: currentUser.displayName,
        scoreA,
        scoreB,
        matchId,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showNotification("🟢 Typ oddany!", "success");
    loadData();
}

// -----------------------
// RANKING
// -----------------------
function buildRanking() {
    rankings = {};
    users.forEach(u => rankings[u.id] = u.points || 0);
    renderRanking();
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    tbody.innerHTML = "";
    const sorted = Object.entries(rankings).sort((a,b) => b[1]-a[1]);
    sorted.forEach(([uid, points], index) => {
        const user = users.find(u => u.id === uid);
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${index+1}${index<3?" ⭐":""}</td><td>${user.nick}</td><td>${points}</td>`;
        tbody.appendChild(tr);
    });
}

// -----------------------
// ADMIN FUNCTIONS
// -----------------------
document.getElementById("addMatchBtn").addEventListener("click", async () => {
    const teamA = document.getElementById("teamA").value.trim();
    const teamB = document.getElementById("teamB").value.trim();
    const bop = parseInt(document.getElementById("bop").value);
    const time = document.getElementById("matchTime").value;

    if (!teamA || !teamB || !bop || !time) return showNotification("Uzupełnij wszystkie pola!", "error");

    await db.collection("matches").add({ teamA, teamB, bop, startTime: new Date(time) });
    showNotification("Mecz dodany!", "success");
    loadData();

    document.getElementById("teamA").value = "";
    document.getElementById("teamB").value = "";
    document.getElementById("bop").value = "";
    document.getElementById("matchTime").value = "";
});

function renderAdminMatches() {
    const container = document.getElementById("admin-matches-list");
    container.innerHTML = "";
    matches.forEach(match => {
        const div = document.createElement("div");
        div.className = "match-card";
        div.innerHTML = `
            ${match.teamA} vs ${match.teamB} | ${new Date(match.startTime).toLocaleString()}
            <button class="btn btn-danger" onclick="deleteMatch('${match.id}')">Usuń</button>
        `;
        container.appendChild(div);
    });
}

function renderAdminUsers() {
    const container = document.getElementById("admin-users-list");
    container.innerHTML = "";
    users.forEach(u => {
        const div = document.createElement("div");
        div.className = "match-card";
        div.innerHTML = `
            ${u.nick} (${u.email || u.id})
            <button class="btn btn-danger" onclick="deleteUser('${u.id}')">Usuń</button>
        `;
        container.appendChild(div);
    });
}

async function deleteMatch(id) {
    if (confirm("Na pewno chcesz usunąć mecz?")) {
        await db.collection("matches").doc(id).delete();
        loadData();
    }
}

async function deleteUser(id) {
    if (confirm("Na pewno chcesz usunąć użytkownika?")) {
        await db.collection("users").doc(id).delete();
        loadData();
    }
}

// -----------------------
// NOTIFICATIONS
// -----------------------
function showNotification(msg, type="success") {
    const notif = document.getElementById("notification");
    notif.textContent = msg;
    notif.className = `notification ${type} show`;
    setTimeout(() => { notif.className = `notification ${type}`; }, 2000);
}

// -----------------------
// TABS
// -----------------------
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        contents.forEach(c => c.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});
