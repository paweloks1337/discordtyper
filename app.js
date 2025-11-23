// app.js (kompletny) - działa z compat SDK (firebase-app-compat, auth-compat, firestore-compat)
// Upewnij się, że w index.html przed tym plikiem dodałeś:
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>

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
// GLOBAL
// -----------------------
let currentUser = null;
let isAdmin = false;
const adminEmails = ["paweloxbieniek1@gmail.com"]; // możesz dopisać inne
let matches = [];
let users = [];
let rankings = {};

// DOM refs (muszą istnieć w HTML)
const loginPanel = document.getElementById("login-panel");
const loginBtn = document.getElementById("loginBtn");
const header = document.querySelector("header");
const nav = document.querySelector("nav");
const logoutBtn = document.getElementById("logoutBtn");
const userNameSpan = document.getElementById("user-name");
const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");
const notificationEl = document.getElementById("notification");

// -----------------------
// HELPERS
// -----------------------
function showNotification(msg, type = "success") {
  if (!notificationEl) return alert(msg);
  notificationEl.textContent = msg;
  notificationEl.className = `notification ${type} show`;
  clearTimeout(showNotification._t);
  showNotification._t = setTimeout(() => {
    notificationEl.className = `notification ${type}`;
  }, 2500);
}

function safeLower(s){ return s ? String(s).toLowerCase().trim() : ""; }

// -----------------------
// AUTH
// -----------------------
loginBtn?.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    console.error("Login error:", err);
    showNotification("Błąd logowania Google", "error");
  }
});

logoutBtn?.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  try {
    if (user) {
      currentUser = user;
      // show UI
      if (loginPanel) loginPanel.style.display = "none";
      if (header) header.style.display = "flex";
      if (nav) nav.style.display = "flex";
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.style.display = "block";

      // ensure user doc present and nick set
      const userRef = db.collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        // prompt until valid nick
        let nick = "";
        while (!nick || nick.length < 2) {
          nick = prompt("Wybierz swój nick (min 2 znaki):", user.displayName || "");
          if (nick === null) { // user canceled prompt
            // sign out if they refuse to set nick
            await auth.signOut();
            showNotification("Musisz ustawić nick, aby kontynuować", "error");
            return;
          }
          nick = (nick || "").trim();
          if (!nick || nick.length < 2) alert("Nick musi mieć minimum 2 znaki.");
        }
        await userRef.set({ nick, points: 0, email: user.email });
      }

      // load user doc to show nick
      const doc = await userRef.get();
      const data = doc.data() || {};
      userNameSpan.textContent = `Zalogowany jako: ${data.nick || user.displayName || user.email}`;
      checkAdmin(user.email);
      await loadData();
    } else {
      // signed out
      currentUser = null;
      if (loginPanel) loginPanel.style.display = "flex";
      if (header) header.style.display = "none";
      if (nav) nav.style.display = "none";
      const mainEl = document.querySelector("main");
      if (mainEl) mainEl.style.display = "none";
      userNameSpan.textContent = "Zaloguj";
      matches = []; users = []; rankings = {};
    }
  } catch (err) {
    console.error("onAuthStateChanged error", err);
    showNotification("Błąd stanu logowania", "error");
  }
});

function checkAdmin(email) {
  if (!email) { isAdmin = false; return; }
  isAdmin = adminEmails.map(e => e.toLowerCase()).includes(String(email).toLowerCase());
  const adminTab = document.querySelector('nav button[data-tab="admin"]');
  if (adminTab) adminTab.style.display = isAdmin ? "inline-block" : "none";
}

// -----------------------
// NAVIGATION
// -----------------------
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const tabId = tab.getAttribute("data-tab");
    contents.forEach(c => c.classList.remove("active"));
    const el = document.getElementById(tabId);
    if (el) el.classList.add("active");
  });
});

// -----------------------
// LOAD DATA
// -----------------------
async function loadData() {
  try {
    // load matches and each match's types
    const matchesSnap = await db.collection("matches").orderBy("startTime").get();
    matches = await Promise.all(matchesSnap.docs.map(async doc => {
      const data = doc.data();
      // read types subcollection
      const typesSnap = await doc.ref.collection("types").get();
      const types = {};
      typesSnap.forEach(t => types[t.id] = t.data());
      return { id: doc.id, ...data, types };
    }));

    // load users
    const usersSnap = await db.collection("users").get();
    users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // build ranking and render
    buildRanking();
    renderMatches();
    renderAdminMatches();
    renderAdminUsers();
    renderUserHistory();
  } catch (err) {
    console.error("loadData error:", err);
    showNotification("Błąd wczytywania danych", "error");
  }
}

// -----------------------
// RENDER MATCHES + TYPING
// -----------------------
function renderMatches() {
  const container = document.getElementById("matches-list");
  const historyContainer = document.getElementById("user-history");
  if (!container) return;
  container.innerHTML = "";
  if (historyContainer) historyContainer.innerHTML = "";

  const now = new Date();
  matches.forEach(match => {
    // match.startTime can be Timestamp or plain date object
    const start = match.startTime && match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime);
    const canType = now < start;
    const userType = match.types && currentUser && match.types[currentUser.uid];

    const div = document.createElement("div");
    div.className = "match-card";
    div.innerHTML = `
      <div class="match-info">
        <span class="match-teams">${match.teamA} vs ${match.teamB}</span>
        <span class="match-time">${start.toLocaleString()} | BOP: ${match.bop || "-"}</span>
        <span class="match-history">Twój typ: ${userType ? userType.scoreA + "-" + userType.scoreB : "brak"}</span>
      </div>
      <div class="match-actions">
        <input type="number" min="0" placeholder="Wynik ${match.teamA}" id="scoreA_${match.id}" class="input-score" ${!canType ? "disabled" : ""}>
        <input type="number" min="0" placeholder="Wynik ${match.teamB}" id="scoreB_${match.id}" class="input-score" ${!canType ? "disabled" : ""}>
        <button class="btn btn-submit" id="sendBtn_${match.id}" ${!canType ? "disabled" : ""}>Wyślij</button>
      </div>
      <div class="type-feedback" id="feedback_${match.id}"></div>
    `;
    container.appendChild(div);

    // wire the send button (delegation safe: get button by id)
    const sendBtn = document.getElementById(`sendBtn_${match.id}`);
    if (sendBtn) {
      sendBtn.addEventListener("click", () => submitType(match.id));
    }

    // add to personal history view if user typed
    if (userType && historyContainer) {
      const hdiv = document.createElement("div");
      hdiv.className = "match-card";
      hdiv.textContent = `${match.teamA} vs ${match.teamB} — Twój typ: ${userType.scoreA}-${userType.scoreB}`;
      historyContainer.appendChild(hdiv);
    }

    if (canType) startCountdown(match.id, start);
  });
}

// -----------------------
// COUNTDOWN
// -----------------------
const countdownIntervals = {};
function startCountdown(matchId, startTime) {
  // clear old
  if (countdownIntervals[matchId]) clearInterval(countdownIntervals[matchId]);
  countdownIntervals[matchId] = setInterval(() => {
    const now = new Date();
    const diff = startTime - now;
    const feedback = document.getElementById(`feedback_${matchId}`);
    if (!feedback) return;
    if (diff <= 0) {
      feedback.textContent = "⏱️ Mecz rozpoczęty, typowanie zakończone!";
      clearInterval(countdownIntervals[matchId]);
      renderMatches(); // re-render to disable inputs
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
  try {
    const scoreAEl = document.getElementById(`scoreA_${matchId}`);
    const scoreBEl = document.getElementById(`scoreB_${matchId}`);
    const scoreA = parseInt(scoreAEl?.value);
    const scoreB = parseInt(scoreBEl?.value);

    if (isNaN(scoreA) || isNaN(scoreB)) {
      return showNotification("Podaj poprawne wyniki (liczby)!", "error");
    }

    if (!currentUser) return showNotification("Musisz być zalogowany!", "error");

    // Save type under match subcollection
    const docRef = db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid);
    await docRef.set({
      userId: currentUser.uid,
      nick: (await db.collection("users").doc(currentUser.uid).get()).data()?.nick || currentUser.displayName || currentUser.email,
      scoreA,
      scoreB,
      Punkty: 0,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    showNotification("🟢 Typ oddany!", "success");
    await loadData();
  } catch (err) {
    console.error("submitType error:", err);
    showNotification("Błąd zapisu typu", "error");
  }
}

// -----------------------
// RANKING BUILD/RENDER
// -----------------------
function buildRanking() {
  rankings = {};
  users.forEach(u => rankings[u.id] = u.points || 0);
  renderRanking();
}

function renderRanking() {
  const tbody = document.getElementById("ranking-list");
  if (!tbody) return;
  // if it's table element with tbody inside
  if (tbody.tagName.toLowerCase() === 'table') {
    // earlier HTML variant
    const t = tbody.querySelector('tbody');
    if (t) {
      t.innerHTML = "";
      const arr = Object.entries(rankings).sort((a, b) => b[1] - a[1]);
      arr.forEach(([uid, pts], i) => {
        const u = users.find(x => x.id === uid) || {};
        const tr = document.createElement("tr");
        const topClass = i === 0 ? "top1" : i === 1 ? "top2" : i === 2 ? "top3" : "";
        tr.innerHTML = `<td>${i + 1}</td><td>${u.nick || '(user)'}</td><td class="${topClass}">${pts}</td>`;
        t.appendChild(tr);
      });
    }
  } else {
    tbody.innerHTML = "";
    const arr = Object.entries(rankings).sort((a, b) => b[1] - a[1]);
    arr.forEach(([uid, pts], i) => {
      const u = users.find(x => x.id === uid) || {};
      const div = document.createElement("div");
      div.className = "match-card";
      div.innerHTML = `<div>${i + 1}. ${u.nick || '(user)'}</div><div>${pts} pkt</div>`;
      tbody.appendChild(div);
    });
  }
}

// -----------------------
// ADMIN: ADD MATCH (manual date input HH:MM DD.MM.YYYY)
// -----------------------
document.getElementById("addMatchBtn")?.addEventListener("click", async () => {
  try {
    if (!currentUser) return showNotification("Musisz być zalogowany!", "error");
    if (!isAdmin) return showNotification("Brak uprawnień admina", "error");

    const teamA = document.getElementById("teamA").value.trim();
    const teamB = document.getElementById("teamB").value.trim();
    const bop = parseInt(document.getElementById("bop").value);
    const rawTime = document.getElementById("matchTime").value.trim();

    if (!teamA || !teamB || !bop || !rawTime) return showNotification("Uzupełnij wszystkie pola!", "error");

    // regex: HH:MM DD.MM.YYYY
    const regex = /^([0-2][0-9]):([0-5][0-9])\s+([0-3][0-9])\.([0-1][0-9])\.([0-9]{4})$/;
    const match = rawTime.match(regex);
    if (!match) return showNotification("Podaj format: HH:MM DD.MM.YYYY (np. 19:30 11.12.2025)", "error");

    const [, hh, mm, dd, mon, yyyy] = match.map(x => x);
    const startTime = new Date(parseInt(yyyy), parseInt(mon) - 1, parseInt(dd), parseInt(hh), parseInt(mm), 0, 0);
    if (isNaN(startTime.getTime())) return showNotification("Nieprawidłowa data", "error");

    // convert to firestore timestamp
    if (!firebase.firestore || !firebase.firestore.Timestamp) {
      console.error("Firestore Timestamp not available. Check SDK import.");
      return showNotification("Błąd konfiguracji Firebase (Timestamp)", "error");
    }

    const startTimestamp = firebase.firestore.Timestamp.fromDate(startTime);

    // Save match
    const docRef = await db.collection("matches").add({
      teamA,
      teamB,
      bop,
      startTime: startTimestamp,
      Zakończony: false,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showNotification("Mecz dodany!", "success");
    // clear
    document.getElementById("teamA").value = "";
    document.getElementById("teamB").value = "";
    document.getElementById("bop").value = "";
    document.getElementById("matchTime").value = "";

    await loadData();
  } catch (err) {
    console.error("addMatch error:", err);
    showNotification("Błąd dodawania meczu", "error");
  }
});

// -----------------------
// ADMIN: RENDER matches with result inputs + SAVE result
// -----------------------
function renderAdminMatches() {
  const container = document.getElementById("admin-matches-list");
  if (!container) return;
  container.innerHTML = "";

  matches.forEach(match => {
    const start = match.startTime && match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime);
    const div = document.createElement("div");
    div.className = "match-card";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${match.teamA} vs ${match.teamB}</strong><br>
        <small>${start.toLocaleString()}</small>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="resA_${match.id}" placeholder="A" style="width:60px;padding:6px;border-radius:6px">
        <input type="number" id="resB_${match.id}" placeholder="B" style="width:60px;padding:6px;border-radius:6px">
        <select id="done_${match.id}">
          <option value="false" ${match.Zakończony ? "" : "selected"}>W trakcie</option>
          <option value="true" ${match.Zakończony ? "selected" : ""}>Zakończony</option>
        </select>
        <button class="btn btn-submit" id="saveRes_${match.id}">Zapisz</button>
        <button class="btn btn-danger" id="delMatch_${match.id}">Usuń</button>
      </div>
    `;
    container.appendChild(div);

    // attach listeners
    document.getElementById(`saveRes_${match.id}`).addEventListener("click", () => adminSaveResult(match.id));
    document.getElementById(`delMatch_${match.id}`).addEventListener("click", () => deleteMatch(match.id));
  });
}

// Save result by admin -> update match doc and recalc points
async function adminSaveResult(matchId) {
  try {
    if (!currentUser) return showNotification("Musisz być zalogowany", "error");
    if (!isAdmin) return showNotification("Brak uprawnień admina", "error");

    const aVal = document.getElementById(`resA_${matchId}`).value;
    const bVal = document.getElementById(`resB_${matchId}`).value;
    const doneVal = document.getElementById(`done_${matchId}`).value === "true";

    if (aVal === "" || bVal === "") return showNotification("Wpisz wyniki (obie wartości)", "error");
    const wa = parseInt(aVal), wb = parseInt(bVal);
    if (isNaN(wa) || isNaN(wb)) return showNotification("Nieprawidłowe wyniki", "error");

    // update match
    await db.collection("matches").doc(matchId).update({
      WynikA: wa,
      WynikB: wb,
      Zakończony: doneVal,
      finishedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showNotification("Wynik zapisany. Przeliczam punkty...", "success");

    // recalc points for this match (update Punkty in types)
    await recalcPointsForMatch(matchId);

    // then recompute totals for all users
    await recomputeAllUsersPoints();

    await loadData();
  } catch (err) {
    console.error("adminSaveResult error:", err);
    showNotification("Błąd zapisu wyniku", "error");
  }
}

// Recalculate points for single match: update each type doc
async function recalcPointsForMatch(matchId) {
  try {
    const matchDoc = await db.collection("matches").doc(matchId).get();
    const match = matchDoc.data();
    if (!match) return;

    // fetch all types for this match
    const typesSnap = await db.collection("matches").doc(matchId).collection("types").get();
    const batch = db.batch();

    typesSnap.forEach(tDoc => {
      const t = tDoc.data();
      let pts = 0;
      // points only if match finished and WynikA/B are defined
      if (match.Zakończony || match.Zakończony === true || (match.WynikA !== undefined && match.WynikB !== undefined)) {
        const actualA = parseInt(match.WynikA);
        const actualB = parseInt(match.WynikB);
        const pickA = parseInt(t.scoreA);
        const pickB = parseInt(t.scoreB);

        // winner logic
        const actualWinner = actualA > actualB ? "A" : actualB > actualA ? "B" : "D";
        const pickWinner = pickA > pickB ? "A" : pickB > pickA ? "B" : "D";

        if (pickWinner === actualWinner && actualWinner !== "D") pts += 1; // correct winner = 1
        if (pickA === actualA && pickB === actualB) pts += 3; // exact = 3
      }
      const tRef = db.collection("matches").doc(matchId).collection("types").doc(tDoc.id);
      batch.update(tRef, { Punkty: pts });
    });

    await batch.commit();
  } catch (err) {
    console.error("recalcPointsForMatch error:", err);
  }
}

// recompute totals for ALL users by summing Punkty across all match types
async function recomputeAllUsersPoints() {
  try {
    // build map userId -> total
    const totals = {};
    const matchesSnap = await db.collection("matches").get();
    for (const mDoc of matchesSnap.docs) {
      const typesSnap = await mDoc.ref.collection("types").get();
      typesSnap.forEach(tDoc => {
        const t = tDoc.data();
        const uid = t.userId;
        const p = parseInt(t.Punkty || 0);
        totals[uid] = (totals[uid] || 0) + p;
      });
    }
    // write totals back to users collection (batch)
    const batch = db.batch();
    for (const uid of Object.keys(totals)) {
      const uRef = db.collection("users").doc(uid);
      batch.update(uRef, { points: totals[uid] });
    }
    // for users without types ensure points 0
    const usersSnap = await db.collection("users").get();
    usersSnap.forEach(uDoc => {
      if (!totals[uDoc.id]) {
        const uRef = db.collection("users").doc(uDoc.id);
        batch.update(uRef, { points: 0 });
      }
    });

    await batch.commit();
  } catch (err) {
    console.error("recomputeAllUsersPoints error:", err);
  }
}

// -----------------------
// ADMIN: render users & delete
// -----------------------
function renderAdminUsers() {
  const container = document.getElementById("admin-users-list");
  if (!container) return;
  container.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div");
    div.className = "match-card";
    div.innerHTML = `${u.nick || "(no nick)"} (${u.email || u.id})
      <button class="btn btn-danger" id="delUser_${u.id}">Usuń</button>`;
    container.appendChild(div);
    document.getElementById(`delUser_${u.id}`).addEventListener("click", () => deleteUser(u.id));
  });
}

// -----------------------
// DELETE match / user
// -----------------------
async function deleteMatch(id) {
  if (!confirm("Na pewno chcesz usunąć mecz?")) return;
  try {
    // delete types first (batch)
    const typesSnap = await db.collection("matches").doc(id).collection("types").get();
    const batch = db.batch();
    typesSnap.forEach(t => batch.delete(t.ref));
    batch.delete(db.collection("matches").doc(id));
    await batch.commit();
    showNotification("Mecz usunięty", "success");
    await loadData();
  } catch (err) {
    console.error("deleteMatch error:", err);
    showNotification("Błąd usuwania meczu", "error");
  }
}

async function deleteUser(id) {
  if (!confirm("Na pewno chcesz usunąć użytkownika?")) return;
  try {
    // delete user doc
    await db.collection("users").doc(id).delete();
    // delete their types across matches (batch)
    const matchesSnap = await db.collection("matches").get();
    const batch = db.batch();
    matchesSnap.forEach(mDoc => {
      const tRef = mDoc.ref.collection("types").doc(id);
      batch.delete(tRef);
    });
    await batch.commit();
    showNotification("Użytkownik usunięty", "success");
    await loadData();
  } catch (err) {
    console.error("deleteUser error:", err);
    showNotification("Błąd usuwania użytkownika", "error");
  }
}

// -----------------------
// RENDER admin matches & users wrapper
// -----------------------
function renderAdminMatches() {
  const container = document.getElementById("admin-matches-list");
  if (!container) return;
  container.innerHTML = "";
  matches.forEach(match => {
    const start = match.startTime && match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime);
    const div = document.createElement("div");
    div.className = "match-card";
    div.innerHTML = `
      <div style="flex:1">
        <strong>${match.teamA} vs ${match.teamB}</strong><br>
        <small>${start.toLocaleString()}</small>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" id="resA_${match.id}" placeholder="A" style="width:60px;padding:6px;border-radius:6px">
        <input type="number" id="resB_${match.id}" placeholder="B" style="width:60px;padding:6px;border-radius:6px">
        <select id="done_${match.id}">
          <option value="false" ${match.Zakończony ? "" : "selected"}>W trakcie</option>
          <option value="true" ${match.Zakończony ? "selected" : ""}>Zakończony</option>
        </select>
        <button class="btn btn-submit" id="saveRes_${match.id}">Zapisz</button>
        <button class="btn btn-danger" id="delMatch_${match.id}">Usuń</button>
      </div>
    `;
    container.appendChild(div);
    // attach listeners
    document.getElementById(`saveRes_${match.id}`).addEventListener("click", () => adminSaveResult(match.id));
    document.getElementById(`delMatch_${match.id}`).addEventListener("click", () => deleteMatch(match.id));
  });
}

// -----------------------
// INITIAL small sanity check
// -----------------------
(function initChecks() {
  console.log("App initialized. Firebase apps:", firebase.apps.length);
  if (!firebase.firestore || !firebase.firestore.Timestamp) {
    console.warn("Firestore Timestamp missing. Ensure you're using compat SDK scripts.");
  }
})();
