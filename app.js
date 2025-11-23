// app.js (komplet) - dostosowane do "Opcja B" (data + godzina osobno)
// Upewnij się, że w index.html są incl. compat Firebase SDK (w head) przed tym skryptem.

// -----------------------
// FIREBASE CONFIG (wstaw swój jeśli inny)
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
let currentUser = null;
let isAdmin = false;
const adminEmails = ["paweloxbieniek1@gmail.com"]; // dodaj inne jeśli trzeba
let matches = [];
let users = [];
let rankings = {};

// DOM
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
function showNotification(msg, type = "success") {
  if (!notificationEl) { alert(msg); return; }
  notificationEl.textContent = msg;
  notificationEl.className = `notification ${type} show`;
  clearTimeout(showNotification._t);
  showNotification._t = setTimeout(() => {
    notificationEl.className = `notification ${type}`;
  }, 2500);
}

// ----------------------- AUTH
loginBtn?.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(provider); }
  catch (err) { console.error("Login error", err); showNotification("Błąd logowania", "error"); }
});
logoutBtn?.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async (user) => {
  try {
    if (user) {
      currentUser = user;
      if (loginPanel) loginPanel.style.display = "none";
      if (header) header.style.display = "flex";
      if (nav) nav.style.display = "flex";
      const mainEl = document.querySelector("main"); if (mainEl) mainEl.style.display = "block";

      // ensure user doc
      const userRef = db.collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        // prompt for nick (required)
        let nick = "";
        while (!nick || nick.length < 2) {
          nick = prompt("Wybierz swój nick (min 2 znaki):", user.displayName || "");
          if (nick === null) { await auth.signOut(); showNotification("Musisz ustawić nick", "error"); return; }
          nick = (nick || "").trim();
        }
        await userRef.set({ nick, points: 0, email: user.email });
      }
      const doc = await userRef.get();
      const data = doc.data() || {};
      userNameSpan.textContent = `Zalogowany jako: ${data.nick || user.displayName || user.email}`;
      checkAdmin(user.email);
      await loadData();
    } else {
      currentUser = null;
      if (loginPanel) loginPanel.style.display = "flex";
      if (header) header.style.display = "none";
      if (nav) nav.style.display = "none";
      const mainEl = document.querySelector("main"); if (mainEl) mainEl.style.display = "none";
      userNameSpan.textContent = "Zaloguj";
      matches = []; users = []; rankings = {};
    }
  } catch (err) {
    console.error("onAuthStateChanged err", err);
  }
});

function checkAdmin(email) {
  if (!email) { isAdmin = false; return; }
  isAdmin = adminEmails.map(x => x.toLowerCase()).includes(String(email).toLowerCase());
  const adminTab = document.querySelector('nav button[data-tab="admin"]');
  if (adminTab) adminTab.style.display = isAdmin ? "inline-block" : "none";
}

// ----------------------- NAV
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const id = tab.getAttribute("data-tab");
    contents.forEach(c => c.classList.remove("active"));
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  });
});

// ----------------------- LOAD DATA
async function loadData() {
  try {
    const matchesSnap = await db.collection("matches").orderBy("startTime").get();
    matches = await Promise.all(matchesSnap.docs.map(async doc => {
      const data = doc.data();
      const typesSnap = await doc.ref.collection("types").get();
      const types = {}; typesSnap.forEach(t => types[t.id] = t.data());
      return { id: doc.id, ...data, types };
    }));

    const usersSnap = await db.collection("users").get();
    users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    buildRanking();
    renderMatches();
    renderAdminMatches();
    renderAdminUsers();
    renderUserHistory();
  } catch (err) { console.error("loadData err", err); showNotification("Błąd wczytywania danych", "error"); }
}

// ----------------------- RENDER matches
function renderMatches() {
  const container = document.getElementById("matches-list"); if (!container) return;
  container.innerHTML = "";
  const now = new Date();
  matches.forEach(match => {
    const start = match.startTime && match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime);
    const canType = now < start;
    const userType = match.types && currentUser && match.types[currentUser.uid];

    const card = document.createElement("div"); card.className = "match-card";
    card.innerHTML = `
      <div class="match-info">
        <div class="match-teams">${match.teamA} vs ${match.teamB}</div>
        <div class="match-time">${start.toLocaleString()} | BOP: ${match.bop || "-"}</div>
        <div class="match-history">Twój typ: ${userType ? userType.scoreA + "-" + userType.scoreB : "brak"}</div>
      </div>
      <div class="match-actions">
        <input class="input-score" id="scoreA_${match.id}" type="number" min="0" placeholder="A" ${!canType ? "disabled" : ""}>
        <input class="input-score" id="scoreB_${match.id}" type="number" min="0" placeholder="B" ${!canType ? "disabled" : ""}>
        <button class="btn-submit" id="sendBtn_${match.id}" ${!canType ? "disabled" : ""}>Wyślij</button>
      </div>
      <div id="feedback_${match.id}" class="type-feedback"></div>
    `;
    container.appendChild(card);

    const sendBtn = document.getElementById(`sendBtn_${match.id}`);
    if (sendBtn) sendBtn.addEventListener("click", () => submitType(match.id));

    if (canType) startCountdown(match.id, start);
  });
}

// ----------------------- USER history
function renderUserHistory(){
  const container = document.getElementById("user-history"); if (!container) return;
  container.innerHTML = "";
  matches.forEach(match=>{
    const userType = match.types && currentUser && match.types[currentUser.uid];
    if (userType) {
      const div = document.createElement("div");
      div.className = "match-card";
      div.textContent = `${match.teamA} vs ${match.teamB} — Twój typ: ${userType.scoreA}-${userType.scoreB} (${userType.Punkty || 0} pkt)`;
      container.appendChild(div);
    }
  });
  // also put in alt container if exists
  const container2 = document.getElementById("user-history-2");
  if (container2) container2.innerHTML = container.innerHTML;
}

// ----------------------- COUNTDOWN
const countdowns = {};
function startCountdown(matchId, startTime) {
  if (countdowns[matchId]) clearInterval(countdowns[matchId]);
  countdowns[matchId] = setInterval(() => {
    const now = new Date(); const diff = startTime - now;
    const fb = document.getElementById(`feedback_${matchId}`);
    if (!fb) return;
    if (diff <= 0) {
      fb.textContent = "⏱️ Mecz rozpoczęty — typowanie zamknięte";
      clearInterval(countdowns[matchId]);
      renderMatches();
    } else {
      const mins = Math.floor(diff/60000); const secs = Math.floor((diff%60000)/1000);
      fb.textContent = `Pozostało: ${mins}:${secs<10?"0"+secs:secs}`;
    }
  }, 1000);
}

// ----------------------- submit type
async function submitType(matchId) {
  try {
    const a = parseInt(document.getElementById(`scoreA_${matchId}`).value);
    const b = parseInt(document.getElementById(`scoreB_${matchId}`).value);
    if (isNaN(a) || isNaN(b)) return showNotification("Podaj poprawne wyniki!", "error");
    if (!currentUser) return showNotification("Musisz być zalogowany", "error");

    const nick = (await db.collection("users").doc(currentUser.uid).get()).data()?.nick || currentUser.displayName || currentUser.email;
    await db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid).set({
      userId: currentUser.uid, nick, scoreA: a, scoreB: b, Punkty: 0, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    showNotification("🟢 Typ zapisany", "success");
    await loadData();
  } catch (err) { console.error("submitType err", err); showNotification("Błąd zapisu typu", "error"); }
}

// ----------------------- RANKING
function buildRanking() {
  rankings = {};
  users.forEach(u => rankings[u.id] = u.points || 0);
  renderRanking();
}
function renderRanking(){
  const container = document.getElementById("ranking-list"); if (!container) return;
  container.innerHTML = "";
  const arr = Object.entries(rankings).sort((a,b)=>b[1]-a[1]);
  arr.forEach(([uid,pts],i)=>{
    const u = users.find(x=>x.id===uid) || {};
    const div = document.createElement("div"); div.className = "match-card";
    div.innerHTML = `<div>${i+1}. ${u.nick||"(user)"}</div><div>${pts} pkt</div>`;
    container.appendChild(div);
  });
}

// ----------------------- ADMIN: add match (data DD.MM.YYYY + godzina HH:MM)
document.getElementById("addMatchBtn")?.addEventListener("click", async () => {
  try {
    if (!currentUser) return showNotification("Musisz być zalogowany", "error");
    if (!isAdmin) return showNotification("Brak uprawnień admina", "error");

    const teamA = document.getElementById("teamA").value.trim();
    const teamB = document.getElementById("teamB").value.trim();
    const dateRaw = document.getElementById("matchDate").value.trim(); // DD.MM.YYYY
    const timeRaw = document.getElementById("matchTime").value.trim(); // HH:MM
    const bop = parseInt(document.getElementById("bop").value);

    if (!teamA || !teamB || !dateRaw || !timeRaw || !bop) return showNotification("Uzupełnij wszystkie pola!", "error");

    const dateRegex = /^([0-3][0-9])\.([0-1][0-9])\.([0-9]{4})$/;
    const timeRegex = /^([0-2][0-9]):([0-5][0-9])$/;
    const dateMatch = dateRaw.match(dateRegex);
    const timeMatch = timeRaw.match(timeRegex);
    if (!dateMatch) return showNotification("Data: użyj formatu DD.MM.YYYY", "error");
    if (!timeMatch) return showNotification("Godzina: użyj formatu HH:MM", "error");

    const day = parseInt(dateMatch[1],10), mon = parseInt(dateMatch[2],10), year = parseInt(dateMatch[3],10);
    const hh = parseInt(timeMatch[1],10), mm = parseInt(timeMatch[2],10);
    const start = new Date(year, mon-1, day, hh, mm, 0, 0);
    if (isNaN(start.getTime())) return showNotification("Nieprawidłowa data/godzina", "error");

    const startTs = firebase.firestore.Timestamp.fromDate(start);

    await db.collection("matches").add({
      teamA, teamB, bop, startTime: startTs, Zakończony: false, createdBy: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showNotification("Mecz dodany", "success");
    document.getElementById("teamA").value = ""; document.getElementById("teamB").value = "";
    document.getElementById("matchDate").value = ""; document.getElementById("matchTime").value = ""; document.getElementById("bop").value = "";
    await loadData();
  } catch (err) { console.error("addMatch err", err); showNotification("Błąd dodawania meczu", "error"); }
});

// ----------------------- ADMIN: render matches + save results
function renderAdminMatches() {
  const container = document.getElementById("admin-matches-list"); if (!container) return;
  container.innerHTML = "";
  matches.forEach(match => {
    const start = match.startTime && match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime);
    const div = document.createElement("div"); div.className = "match-card";
    div.innerHTML = `
      <div style="flex:1"><strong>${match.teamA} vs ${match.teamB}</strong><br><small>${start.toLocaleString()}</small></div>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="resA_${match.id}" placeholder="Wynik A" style="width:70px;padding:6px;border-radius:6px"/>
        <input id="resB_${match.id}" placeholder="Wynik B" style="width:70px;padding:6px;border-radius:6px"/>
        <select id="done_${match.id}">
          <option value="false" ${match.Zakończony ? "" : "selected"}>W trakcie</option>
          <option value="true" ${match.Zakończony ? "selected" : ""}>Zakończony</option>
        </select>
        <button class="btn-submit" id="saveRes_${match.id}">Zapisz</button>
        <button class="btn-danger" id="delMatch_${match.id}">Usuń</button>
      </div>`;
    container.appendChild(div);
    document.getElementById(`saveRes_${match.id}`).addEventListener("click", () => adminSaveResult(match.id));
    document.getElementById(`delMatch_${match.id}`).addEventListener("click", () => deleteMatch(match.id));
  });
}

// ----------------------- ADMIN: save result -> calc points
async function adminSaveResult(matchId) {
  try {
    if (!currentUser) return showNotification("Musisz być zalogowany","error");
    if (!isAdmin) return showNotification("Brak uprawnień admina","error");

    const aVal = document.getElementById(`resA_${matchId}`).value;
    const bVal = document.getElementById(`resB_${matchId}`).value;
    const doneVal = document.getElementById(`done_${matchId}`).value === "true";
    if (aVal === "" || bVal === "") return showNotification("Wpisz wyniki", "error");

    const wa = parseInt(aVal), wb = parseInt(bVal);
    if (isNaN(wa) || isNaN(wb)) return showNotification("Nieprawidłowe wyniki", "error");

    await db.collection("matches").doc(matchId).update({ WynikA: wa, WynikB: wb, Zakończony: doneVal, finishedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showNotification("Wynik zapisany — przeliczam punkty...", "success");
    await recalcPointsForMatch(matchId);
    await recomputeAllUsersPoints();
    await loadData();
  } catch (err) { console.error("adminSaveResult err", err); showNotification("Błąd zapisu wyniku","error"); }
}

// ----------------------- recalc points for match
async function recalcPointsForMatch(matchId) {
  try {
    const matchDoc = await db.collection("matches").doc(matchId).get();
    const match = matchDoc.data();
    if (!match) return;
    const typesSnap = await db.collection("matches").doc(matchId).collection("types").get();
    const batch = db.batch();
    typesSnap.forEach(tDoc => {
      const t = tDoc.data();
      let pts = 0;
      if (match.Zakończony || (match.WynikA !== undefined && match.WynikB !== undefined)) {
        const actualA = parseInt(match.WynikA);
        const actualB = parseInt(match.WynikB);
        const pickA = parseInt(t.scoreA);
        const pickB = parseInt(t.scoreB);
        const actualWinner = actualA > actualB ? "A" : actualB > actualA ? "B" : "D";
        const pickWinner = pickA > pickB ? "A" : pickB > pickA ? "B" : "D";
        if (pickWinner === actualWinner && actualWinner !== "D") pts += 1;
        if (pickA === actualA && pickB === actualB) pts += 3;
      }
      const tRef = db.collection("matches").doc(matchId).collection("types").doc(tDoc.id);
      batch.update(tRef, { Punkty: pts });
    });
    await batch.commit();
  } catch (err) { console.error("recalcPointsForMatch err", err); }
}

// ----------------------- recompute totals & save to users.points
async function recomputeAllUsersPoints() {
  try {
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
    const batch = db.batch();
    const usersSnap = await db.collection("users").get();
    usersSnap.forEach(uDoc => {
      const uRef = db.collection("users").doc(uDoc.id);
      const pts = totals[uDoc.id] || 0;
      batch.update(uRef, { points: pts });
    });
    await batch.commit();
  } catch (err) { console.error("recomputeAllUsersPoints err", err); }
}

// ----------------------- ADMIN users render & delete
function renderAdminUsers() {
  const container = document.getElementById("admin-users-list"); if (!container) return;
  container.innerHTML = "";
  users.forEach(u => {
    const div = document.createElement("div"); div.className = "match-card";
    div.innerHTML = `${u.nick || "(no nick)"} (${u.email || u.id}) <button class="btn-danger" id="delUser_${u.id}">Usuń</button>`;
    container.appendChild(div);
    document.getElementById(`delUser_${u.id}`).addEventListener("click", () => deleteUser(u.id));
  });
}

async function deleteMatch(id) {
  if (!confirm("Na pewno chcesz usunąć mecz?")) return;
  try {
    const typesSnap = await db.collection("matches").doc(id).collection("types").get();
    const batch = db.batch();
    typesSnap.forEach(t => batch.delete(t.ref));
    batch.delete(db.collection("matches").doc(id));
    await batch.commit();
    showNotification("Mecz usunięty", "success");
    await loadData();
  } catch (err) { console.error("deleteMatch err", err); showNotification("Błąd usuwania meczu","error"); }
}

async function deleteUser(id) {
  if (!confirm("Na pewno chcesz usunąć użytkownika?")) return;
  try {
    await db.collection("users").doc(id).delete();
    const matchesSnap = await db.collection("matches").get();
    const batch = db.batch();
    matchesSnap.forEach(mDoc => {
      const tRef = mDoc.ref.collection("types").doc(id);
      batch.delete(tRef);
    });
    await batch.commit();
    showNotification("Użytkownik usunięty", "success");
    await loadData();
  } catch (err) { console.error("deleteUser err", err); showNotification("Błąd usuwania użytkownika","error"); }
}

// ----------------------- initial checks
(function init() {
  console.log("CS2 Typer app init. Firebase apps:", firebase.apps.length);
  if (!firebase.firestore || !firebase.firestore.Timestamp) console.warn("Firestore Timestamp missing (check compat SDK).");
})();
