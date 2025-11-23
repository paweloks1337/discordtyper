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
let types = {};

// -----------------------
// DOM ELEMENTS
// -----------------------
const loginPanel = document.getElementById("login-panel");
const loginBtn = document.getElementById("loginBtn");
const nicknameInput = document.getElementById("nickname");
const logoutBtn = document.getElementById("logoutBtn");
const userNameSpan = document.getElementById("user-name");
const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

// -----------------------
// AUTHENTICATION
// -----------------------
loginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(result => {
        // If first login, set nickname
        const nick = nicknameInput.value.trim();
        const userDoc = db.collection("users").doc(result.user.uid);
        userDoc.get().then(doc => {
            if (!doc.exists) {
                userDoc.set({ nick: nick || result.user.displayName, points: 0, email: result.user.email });
            }
        });
    });
});

logoutBtn.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loginPanel.style.display = "none";
        document.querySelector("header").style.display = "flex";
        document.querySelector("nav").style.display = "flex";
        document.querySelector("main").style.display = "block";
        userNameSpan.textContent = `Zalogowany jako: ${user.displayName}`;
        checkAdmin(user.email);
        loadData();
    } else {
        currentUser = null;
        loginPanel.style.display = "flex";
        document.querySelector("header").style.display = "none";
        document.querySelector("nav").style.display = "none";
        document.querySelector("main").style.display = "none";
    }
});

function checkAdmin(email) {
    isAdmin = adminEmails.includes(email);
    const adminTab = document.querySelector('nav button[data-tab="admin"]');
    adminTab.style.display = isAdmin ? "inline-block" : "none";
}

// -----------------------
// TABS
// -----------------------
tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        const tabId = tab.getAttribute("data-tab");
        contents.forEach(c => c.classList.remove("active"));
        document.getElementById(tabId).classList.add("active");
    });
});

// -----------------------
// LOAD DATA
// -----------------------
function loadData() {
    db.collection("matches").orderBy("startTime").get().then(snapshot => {
        matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMatches();
        renderAdminMatches();
    });

    db.collection("users").get().then(snapshot => {
        users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        buildRanking();
        renderAdminUsers();
    });

    db.collectionGroup("types").get().then(snapshot => {
        types = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!types[data.userId]) types[data.userId] = {};
            types[data.userId][doc.ref.parent.parent.id] = data;
        });
        renderUserHistory();
    });
}

// -----------------------
// RENDER MATCHES
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
                <input type="number" min="0" placeholder="${match.teamA}" id="scoreA_${match.id}" class="input-score" ${!canType ? "disabled" : ""}>
                <input type="number" min="0" placeholder="${match.teamB}" id="scoreB_${match.id}" class="input-score" ${!canType ? "disabled" : ""}>
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
            feedback.textContent = `Pozostało: ${minutes}:${seconds<10?"0"+seconds:seconds}`;
        }
    },1000);
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
    }).then(()=> {
        showNotification("🟢 Typ oddany!", "success");
        renderUserHistory();
    });
}

// -----------------------
// HISTORY
// -----------------------
function renderUserHistory() {
    const container = document.getElementById("user-history");
    container.innerHTML = "";
    const userTypes = types[currentUser?.uid] || {};
    Object.entries(userTypes).forEach(([matchId, t]) => {
        const match = matches.find(m=>m.id===matchId);
        if(!match) return;
        const div = document.createElement("div");
        div.className = "match-card";
        div.innerHTML = `
            <strong>${match.teamA} vs ${match.teamB}</strong> | Twój typ: ${t.scoreA}:${t.scoreB} | ${match.resultA!=undefined?`Wynik: ${match.resultA}:${match.resultB}`:"Mecz nie rozegrany"}
        `;
        container.appendChild(div);
    });
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
    const sorted = Object.entries(rankings).sort((a,b)=>b[1]-a[1]);
    sorted.forEach(([uid, points], index)=>{
        const user = users.find(u=>u.id===uid);
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${index+1}</td><td>${user.nick}</td><td>${points}</td>`;
        tbody.appendChild(tr);
    });
}

// -----------------------
// ADMIN
// -----------------------
document.getElementById("addMatchBtn").addEventListener("click", ()=>{
    const teamA=document.getElementById("teamA").value;
    const teamB=document.getElementById("teamB").value;
    const bop=parseInt(document.getElementById("bop").value);
    const time=document.getElementById("matchTime").value;
    if(!teamA||!teamB||!bop||!time) return showNotification("Uzupełnij wszystkie pola!", "error");
    const startTime = new Date(time);
    db.collection("matches").add({teamA, teamB, bop, startTime})
    .then(()=>{showNotification("Mecz dodany!", "success"); loadData();});
});

function renderAdminMatches() {
    const container=document.getElementById("admin-matches-list");
    container.innerHTML="";
    matches.forEach(match=>{
        const div=document.createElement("div");
        div.className="match-card";
        const start=new Date(match.startTime);
        div.innerHTML=`${match.teamA} vs ${match.teamB} | ${start.toLocaleString()} 
        <button class="btn btn-danger" onclick="deleteMatch('${match.id}')">Usuń</button>`;
        container.appendChild(div);
    });
}

function renderAdminUsers() {
    const container=document.getElementById("admin-users-list");
    container.innerHTML="";
    users.forEach(u=>{
        const div=document.createElement("div");
        div.className="match-card";
        div.innerHTML=`${u.nick} (${u.email||u.id}) 
        <button class="btn btn-danger" onclick="deleteUser('${u.id}')">Usuń</button>`;
        container.appendChild(div);
    });
}

function deleteMatch(id){if(confirm("Na pewno chcesz usunąć mecz?")) db.collection("matches").doc(id).delete().then(()=>loadData());}
function deleteUser(id){if(confirm("Na pewno chcesz usunąć użytkownika?")) db.collection("users").doc(id).delete().then(()=>loadData());}

// -----------------------
// NOTIFICATIONS
// -----------------------
function showNotification(msg,type="success"){
    const notif=document.getElementById("notification");
    notif.textContent=msg;
    notif.className=`notification ${type} show`;
    setTimeout(()=>{notif.className=`notification ${type}`},2000);
}
