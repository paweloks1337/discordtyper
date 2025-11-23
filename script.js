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

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        document.getElementById("user-name").textContent = `Zalogowany jako: ${user.displayName}`;
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
function loadData() {
    // Load matches
    db.collection("matches").orderBy("startTime").get().then(snapshot => {
        matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMatches();
        renderAdminMatches();
    });

    // Load users
    db.collection("users").get().then(snapshot => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        buildRanking();
        renderAdminUsers();
    });
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
function submitType(matchId) {
    const scoreA = parseInt(document.getElementById(`scoreA_${matchId}`).value);
    const scoreB = parseInt(document.getElementById(`scoreB_${matchId}`).value);

    if (isNaN(scoreA) || isNaN(scoreB)) return showNotification("Podaj poprawne wyniki!", "error");

    db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid).set({
        userId: currentUser.uid,
        nick: currentUser.displayName,
        scoreA,
        scoreB,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => showNotification("🟢 Typ oddany!", "success"));
}

// -----------------------
// RANKING
// -----------------------
function buildRanking() {
    rankings = {};
    users.forEach(u => {
        rankings[u.id] = u.points || 0;
    });
    renderRanking();
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    tbody.innerHTML = "";
    const sorted = Object.entries(rankings).sort((a,b) => b[1]-a[1]);
    sorted.forEach(([uid, points], index) => {
        const user = users.find(u => u.id === uid);
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${index+1}</td><td>${user.nick}</td><td>${points}</td>`;
        tbody.appendChild(tr);
    });
}

// -----------------------
// ADMIN FUNCTIONS
// -----------------------
document.getElementById("addMatchBtn").addEventListener("click", () => {
    const teamA = document.getElementById("teamA").value;
    const teamB = document.getElementById("teamB").value;
    const bop = parseInt(document.getElementById("bop").value);
    const time = document.getElementById("matchTime").value;

    if (!teamA || !teamB || !bop || !time) return showNotification("Uzupełnij wszystkie pola!", "error");

    const startTime = new Date();
    const [hours, minutes] = time.split(":");
    startTime.setHours(hours);
    startTime.setMinutes(minutes);

    db.collection("matches").add({
        teamA, teamB, bop, startTime
    }).then(() => {
        showNotification("Mecz dodany!", "success");
        loadData();
        document.getElementById("teamA").value = "";
        document.getElementById("teamB").value = "";
        document.getElementById("bop").value = "";
        document.getElementById("matchTime").value = "";
    });
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

function deleteMatch(id) {
    if (confirm("Na pewno chcesz usunąć mecz?")) {
        db.collection("matches").doc(id).delete().then(() => loadData());
    }
}

function deleteUser(id) {
    if (confirm("Na pewno chcesz usunąć użytkownika?")) {
        db.collection("users").doc(id).delete().then(() => loadData());
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
