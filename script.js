// Firebase setup
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

// DOM Elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const nicknameInput = document.getElementById("nicknameInput");
const saveNickBtn = document.getElementById("saveNickBtn");
const userLabel = document.getElementById("userLabel");

const tabs = document.querySelectorAll(".tab");
const tabButtons = document.querySelectorAll(".tabBtn");

// Login
loginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    await checkUserFirestore(currentUser);
    showApp();
  } catch (err) {
    console.error(err);
    alert("Błąd logowania: " + err.message);
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  currentUser = null;
  showLogin();
});

// Check if user exists in Firestore
async function checkUserFirestore(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      nickname: "",
      email: user.email,
      role: "user",
      points: 0
    });
  } else {
    // Load nickname and role
    const data = userSnap.data();
    nicknameInput.value = data.nickname || "";
  }
}

// Save nickname
saveNickBtn.addEventListener("click", async () => {
  const nick = nicknameInput.value.trim();
  if (!nick) return alert("Wpisz nick!");
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { nickname: nick });
  userLabel.innerText = `Zalogowany jako: ${nick}`;
});

// Tab switching
tabButtons.forEach((btn, idx) => {
  btn.addEventListener("click", () => {
    tabs.forEach(t => t.style.display = "none");
    tabs[idx].style.display = "block";
  });
});

// Fetch matches
async function fetchMatches() {
  const matchesCol = collection(db, "matches");
  const snapshot = await getDocs(query(matchesCol, orderBy("startTime")));
  const matchesContainer = document.getElementById("matchesContainer");
  matchesContainer.innerHTML = "";
  snapshot.forEach(docSnap => {
    const match = docSnap.data();
    const matchDiv = document.createElement("div");
    matchDiv.className = "matchCard";
    const startTime = new Date(match.startTime).toLocaleTimeString();
    matchDiv.innerHTML = `
      <div>${match.teamA} vs ${match.teamB} | ${startTime} | BOP: ${match.bop}</div>
      <button class="pickBtn" data-match="${docSnap.id}" data-team="A">${match.teamA}</button>
      <button class="pickBtn" data-match="${docSnap.id}" data-team="B">${match.teamB}</button>
      <input type="text" placeholder="Wynik (np. 16:12)" class="scoreInput" data-match="${docSnap.id}"/>
      <button class="submitPick" data-match="${docSnap.id}">Wyślij</button>
      <span class="status" id="status-${docSnap.id}"></span>
    `;
    matchesContainer.appendChild(matchDiv);
  });

  // Add pick event listeners
  document.querySelectorAll(".submitPick").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const matchId = btn.dataset.match;
      const scoreInput = document.querySelector(`.scoreInput[data-match='${matchId}']`);
      const pick = scoreInput.value.trim();
      if (!pick) return alert("Wpisz wynik!");
      await submitPick(matchId, pick);
    });
  });
}

// Submit pick
async function submitPick(matchId, pick) {
  const pickRef = doc(db, "matches", matchId, "picks", currentUser.uid);
  await setDoc(pickRef, {
    userId: currentUser.uid,
    pick: pick,
    timestamp: new Date()
  });
  document.getElementById(`status-${matchId}`).innerText = "🟢 Typ oddany!";
}

// Show app after login
function showApp() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";
  userLabel.innerText = `Zalogowany jako: ${currentUser.email}`;
  fetchMatches();
}

// Show login screen
function showLogin() {
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("appSection").style.display = "none";
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    showApp();
  } else {
    currentUser = null;
    showLogin();
  }
});

// Call fetchMatches periodically to prevent odświeżania
setInterval(fetchMatches, 30000);
