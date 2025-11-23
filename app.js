// ------------------------------------------------------------
// FIREBASE INIT (V9 MODUŁOWY — TO MUSI BYĆ PIERWSZE!)
// ------------------------------------------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, getDocs, collection, addDoc, deleteDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDwh9_u2u_NenhPYyvhCaLKFCrCrMmMEGE",
    authDomain: "cs2typer.firebaseapp.com",
    projectId: "cs2typer",
    storageBucket: "cs2typer.firebasestorage.app",
    messagingSenderId: "533657649328",
    appId: "1:533657649328:web:e220acd6865b489fa6bb75"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ------------------------------------------------------------
// GLOBAL
// ------------------------------------------------------------
let currentUser = null;
let isAdmin = false;
const adminEmails = ["paweloxbieniek1@gmail.com"];
let matches = [];
let users = [];
let rankings = {};

// DOM
const loginPanel = document.getElementById("login-panel");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userNameSpan = document.getElementById("user-name");
const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------
loginBtn.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
        showNotification("Błąd logowania!", "error");
    }
});

logoutBtn.addEventListener("click", () => signOut(auth));

// ------------------------------------------------------------
// ON AUTH CHANGE
// ------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentUser = null;

        loginPanel.style.display = "flex";
        document.querySelector("header").style.display = "none";
        document.querySelector("nav").style.display = "none";
        document.querySelector("main").style.display = "none";
        return;
    }

    currentUser = user;

    // UI after login
    loginPanel.style.display = "none";
    document.querySelector("header").style.display = "flex";
    document.querySelector("nav").style.display = "flex";
    document.querySelector("main").style.display = "block";

    // USER DOC
    const userRef = doc(db, "users", user.uid);
    let userDoc = await getDoc(userRef);

    // FIRST LOGIN → CREATE USER
    if (!userDoc.exists()) {
        let nick = "";
        while (!nick) {
            nick = prompt("Wybierz swój nick:");
            if (nick) nick = nick.trim();
        }

        await setDoc(userRef, {
            nick,
            points: 0,
            email: user.email,
            createdAt: Date.now()
        });

        userDoc = await getDoc(userRef);
    }

    const userData = userDoc.data();
    userNameSpan.textContent = `Zalogowany jako: ${userData.nick}`;

    // ADMIN
    isAdmin = adminEmails.includes(user.email);
    document.querySelector('nav button[data-tab="admin"]').style.display =
        isAdmin ? "inline-block" : "none";

    // LOAD EVERYTHING
    loadData();
});

// ------------------------------------------------------------
// TAB SWITCHING
// ------------------------------------------------------------
tabs.forEach(btn =>
    btn.addEventListener("click", () => {
        tabs.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        contents.forEach(c => c.classList.remove("active"));
        const id = btn.dataset.tab;
        document.getElementById(id).classList.add("active");
    })
);

// ------------------------------------------------------------
// LOAD DATA
// ------------------------------------------------------------
async function loadData() {
    // USERS
    const usersSnap = await getDocs(collection(db, "users"));
    users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // MATCHES
    const q = query(collection(db, "matches"), orderBy("startTime"));
    const matchesSnap = await getDocs(q);

    matches = [];

    for (let docMatch of matchesSnap.docs) {
        const data = docMatch.data();

        // LOAD TYPY
        const typesSnap = await getDocs(collection(db, "matches", docMatch.id, "types"));
        const types = {};
        typesSnap.forEach(t => types[t.id] = t.data());

        matches.push({
            id: docMatch.id,
            ...data,
            types
        });
    }

    buildRanking();
    renderMatches();
    renderAdminMatches();
    renderAdminUsers();
}

// ------------------------------------------------------------
// RANKING
// ------------------------------------------------------------
function buildRanking() {
    rankings = {};
    users.forEach(u => rankings[u.id] = u.points || 0);
    renderRanking();
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    tbody.innerHTML = "";

    const sorted = Object.entries(rankings).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([uid, points], index) => {
        const user = users.find(u => u.id === uid);
        const tr = document.createElement("tr");

        const top = index === 0 ? "top1" : index === 1 ? "top2" : index === 2 ? "top3" : "";

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${user.nick}</td>
            <td class="${top}">${points}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ------------------------------------------------------------
// RENDER MATCHES (USER VIEW)
// ------------------------------------------------------------
function renderMatches() {
    const container = document.getElementById("matches-list");
    container.innerHTML = "";

    const now = new Date();

    matches.forEach(match => {
        const start = new Date(match.startTime);
        const canType = now < start;
        const typed = match.types[currentUser.uid];

        const div = document.createElement("div");
        div.className = "match-card";

        div.innerHTML = `
            <div class="match-info">
                <span>${match.teamA} vs ${match.teamB}</span>
                <span>${start.toLocaleString()} | BOP: ${match.bop}</span>
                <span>Twój typ: ${typed ? `${typed.scoreA}-${typed.scoreB}` : "brak"}</span>
            </div>

            <div class="match-actions">
                <input type="number" id="a_${match.id}" placeholder="${match.teamA}" min="0" ${!canType ? "disabled" : ""}>
                <input type="number" id="b_${match.id}" placeholder="${match.teamB}" min="0" ${!canType ? "disabled" : ""}>
                <button onclick="submitType('${match.id}')" ${!canType ? "disabled" : ""}>Wyślij</button>
            </div>
        `;

        container.appendChild(div);
    });
}

// ------------------------------------------------------------
// SUBMIT TYPE
// ------------------------------------------------------------
window.submitType = async function (matchId) {
    const scoreA = parseInt(document.getElementById("a_" + matchId).value);
    const scoreB = parseInt(document.getElementById("b_" + matchId).value);

    if (isNaN(scoreA) || isNaN(scoreB))
        return showNotification("Podaj wyniki!", "error");

    await setDoc(
        doc(db, "matches", matchId, "types", currentUser.uid),
        {
            scoreA,
            scoreB,
            nick: userNameSpan.textContent.replace("Zalogowany jako: ", ""),
            timestamp: Date.now()
        }
    );

    showNotification("Typ zapisany!", "success");
    loadData();
};

// ------------------------------------------------------------
// ADMIN: ADD MATCH
// ------------------------------------------------------------
document.getElementById("addMatchBtn").addEventListener("click", async () => {
    const teamA = document.getElementById("teamA").value.trim();
    const teamB = document.getElementById("teamB").value.trim();
    const bop = parseInt(document.getElementById("bop").value.trim());
    const dateStr = document.getElementById("matchDate").value.trim();

    if (!teamA || !teamB || !bop || !dateStr)
        return showNotification("Wypełnij wszystkie pola!", "error");

    // DATE PARSER → FORMAT: "DD.MM.YYYY HH:MM"
    const [datePart, timePart] = dateStr.split(" ");
    const [d, m, y] = datePart.split(".");
    const [hh, mm] = timePart.split(":");

    const startTime = new Date(y, m - 1, d, hh, mm);

    await addDoc(collection(db, "matches"), {
        teamA,
        teamB,
        bop,
        startTime: startTime.getTime()
    });

    showNotification("Mecz dodany!", "success");

    document.getElementById("teamA").value = "";
    document.getElementById("teamB").value = "";
    document.getElementById("bop").value = "";
    document.getElementById("matchDate").value = "";

    loadData();
});

// ------------------------------------------------------------
// ADMIN PANELS
// ------------------------------------------------------------
function renderAdminMatches() {
    const box = document.getElementById("admin-matches-list");
    box.innerHTML = "";

    matches.forEach(match => {
        const start = new Date(match.startTime).toLocaleString();

        const div = document.createElement("div");
        div.className = "match-card";
        div.innerHTML = `
            ${match.teamA} vs ${match.teamB} | ${start}
            <button onclick="deleteMatch('${match.id}')">Usuń</button>
        `;
        box.appendChild(div);
    });
}

window.deleteMatch = async function (id) {
    if (!confirm("Usunąć mecz?")) return;

    await deleteDoc(doc(db, "matches", id));
    loadData();
};

function renderAdminUsers() {
    const box = document.getElementById("admin-users-list");
    box.innerHTML = "";

    users.forEach(u => {
        const div = document.createElement("div");
        div.className = "match-card";

        div.innerHTML = `
            ${u.nick} (${u.email})
            <button onclick="deleteUser('${u.id}')">Usuń</button>
        `;
        box.appendChild(div);
    });
}

window.deleteUser = async function (id) {
    if (!confirm("Usunąć użytkownika?")) return;

    await deleteDoc(doc(db, "users", id));
    loadData();
};

// ------------------------------------------------------------
// NOTIFICATION
// ------------------------------------------------------------
function showNotification(msg, type) {
    const box = document.getElementById("notification");
    box.textContent = msg;
    box.className = "notification " + type + " show";

    setTimeout(() => box.classList.remove("show"), 2500);
}
