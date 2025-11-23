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

// -----------------------
// AUTHENTICATION
// -----------------------
const loginBtn = document.getElementById("user-name");
const logoutBtn = document.getElementById("logoutBtn");

loginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
});

logoutBtn.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";

        // Sprawdź czy użytkownik istnieje w bazie
        const userRef = db.collection("users").doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
            // jeśli pierwszy login -> ustaw nick
            const nick = prompt("Wybierz swój nick:");
            await userRef.set({
                nick: nick || user.displayName || "Gracz",
                email: user.email,
                points: 0
            });
        }
        const userDoc = await userRef.get();
        document.getElementById("user-name").textContent = `Zalogowany jako: ${userDoc.data().nick}`;

        checkAdmin(user.email);
        loadData();
    } else {
        currentUser = null;
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        document.getElementById("user-name").textContent = "Zaloguj";
        document.getElementById("matches-list").innerHTML = "";
        document.getElementById("ranking-list").innerHTML = "";
        document.getElementById("admin-matches-list").innerHTML = "";
        document.getElementById("admin-users-list").innerHTML = "";
    }
});

function checkAdmin(email) {
    isAdmin = adminEmails.includes(email);
    const adminTab = document.querySelector('nav button[data-tab="admin"]');
    adminTab.style.display = isAdmin ? "inline-block" : "none";
}

// -----------------------
// LOAD DATA
// -----------------------
async function loadData() {
    // Load matches
    const snapshotMatches = await db.collection("matches").orderBy("startTime").get();
    matches = snapshotMatches.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Load users
    const snapshotUsers = await db.collection("users").get();
    users = snapshotUsers.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderMatches();
    renderRanking();
    renderAdminMatches();
    renderAdminUsers();
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
            <div class="history-feedback" id="history_${match.id}"></div>
        `;
        container.appendChild(div);

        renderUserHistory(match.id);

        if (canType) startCountdown(match.id, start);
    });
}

// -----------------------
// HISTORY
// -----------------------
async function renderUserHistory(matchId) {
    if (!currentUser) return;
    const historyDiv = document.getElementById(`history_${matchId}`);
    const doc = await db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid).get();
    if (doc.exists) {
        const data = doc.data();
        historyDiv.textContent = `Twój typ: ${data.scoreA} : ${data.scoreB}`;
    } else {
        historyDiv.textContent = "";
    }
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
    if (!currentUser) return showNotification("Zaloguj się najpierw!", "error");

    const scoreA = parseInt(document.getElementById(`scoreA_${matchId}`).value);
    const scoreB = parseInt(document.getElementById(`scoreB_${matchId}`).value);

    if (isNaN(scoreA) || isNaN(scoreB)) return showNotification("Podaj poprawne wyniki!", "error");

    await db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid).set({
        userId: currentUser.uid,
        nick: currentUser.displayName,
        scoreA,
        scoreB,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    showNotification("🟢 Typ oddany!", "success");

    renderUserHistory(matchId);
}

// -----------------------
// RANKING
// -----------------------
function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    tbody.innerHTML = "";

    const rankingMap = {};
    users.forEach(u => rankingMap[u.id] = u.points || 0);
    const sorted = Object.entries(rankingMap).sort((a,b) => b[1]-a[1]);

    sorted.forEach(([uid, points], index) => {
        const user = users.find(u => u.id === uid);
        const badge = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${index+1} ${badge}</td><td>${user.nick}</td><td>${points}</td>`;
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

    const [hours, minutes] = time.split(":").map(Number);
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);

    try {
        await db.collection("matches").add({
            teamA,
            teamB,
            bop,
            startTime: firebase.firestore.Timestamp.fromDate(startTime)
        });
        showNotification("Mecz dodany!", "success");
        loadData();
        document.getElementById("teamA").value = "";
        document.getElementById("teamB").value = "";
        document.getElementById("bop").value = "";
        document.getElementById("matchTime").value = "";
    } catch (err) {
        console.error(err);
        showNotification("Błąd przy dodawaniu meczu!", "error");
    }
});

function renderAdminMatches() {
    const container = document.getElementById("admin-matches-list");
    container.innerHTML = "";
    matches.forEach(match => {
        const div = document.createElement("div");
        div.className = "match-card";
        div.innerHTML = `
            ${match.teamA} vs ${match.teamB} | ${new Date(match.startTime.toDate ? match.startTime.toDate() : match.startTime).toLocaleString()}
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
    if (!confirm("Na pewno chcesz usunąć mecz?")) return;
    await db.collection("matches").doc(id).delete();
    loadData();
}

async function deleteUser(id) {
    if (!confirm("Na pewno chcesz usunąć użytkownika?")) return;
    await db.collection("users").doc(id).delete();
    loadData();
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
