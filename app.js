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
// LOGIN / LOGOUT
// -----------------------
const loginPanel = document.getElementById("login-panel");
const mainContent = document.querySelector("main");
const header = document.querySelector("header");
const nav = document.querySelector("nav");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userName = document.getElementById("user-name");

loginBtn.addEventListener("click", () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
});

logoutBtn.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(user => {
    if(user){
        currentUser = user;
        loginPanel.style.display = "none";
        mainContent.style.display = "block";
        header.style.display = "flex";
        nav.style.display = "flex";
        userName.textContent = `Zalogowany jako: ${user.displayName}`;
        isAdmin = adminEmails.includes(user.email);
        nav.querySelector('[data-tab="admin"]').style.display = isAdmin ? "inline-block" : "none";
        loadData();
    } else {
        currentUser = null;
        loginPanel.style.display = "flex";
        mainContent.style.display = "none";
        header.style.display = "none";
        nav.style.display = "none";
    }
});

// -----------------------
// TABS
// -----------------------
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');
tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    contents.forEach(c => c.classList.remove('active'));
    document.getElementById(tab.dataset.tab).classList.add('active');
}));

// -----------------------
// NOTIFICATIONS
// -----------------------
function showNotification(msg, type="success"){
    const notif = document.getElementById("notification");
    notif.textContent = msg;
    notif.className = `notification ${type} show`;
    setTimeout(()=>{ notif.className = `notification ${type}`; },2000);
}

// -----------------------
// LOAD DATA
// -----------------------
function loadData(){
    db.collection("matches").orderBy("startTime").get().then(snapshot=>{
        matches = snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
        renderMatches();
        renderAdminMatches();
    });

    db.collection("users").get().then(snapshot=>{
        users = snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
        buildRanking();
        renderAdminUsers();
    });
}

// -----------------------
// MATCHES
// -----------------------
function renderMatches(){
    const container = document.getElementById("matches-list");
    container.innerHTML = "";
    const now = new Date();

    matches.forEach(match=>{
        const start = match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime);
        const canType = now < start;

        const div = document.createElement("div");
        div.className="match-card";
        div.innerHTML=`
            <div class="match-info">
                <span class="match-teams">${match.teamA} vs ${match.teamB}</span>
                <span class="match-time">${start.toLocaleString()} | BOP: ${match.bop}</span>
            </div>
            <div class="match-actions">
                <input type="number" min="0" placeholder="Wynik ${match.teamA}" id="scoreA_${match.id}" class="input-score" ${!canType?"disabled":""}>
                <input type="number" min="0" placeholder="Wynik ${match.teamB}" id="scoreB_${match.id}" class="input-score" ${!canType?"disabled":""}>
                <button class="btn btn-submit" onclick="submitType('${match.id}')" ${!canType?"disabled":""}>Wyślij</button>
            </div>
            <div class="type-feedback" id="feedback_${match.id}"></div>
        `;
        container.appendChild(div);
        if(canType) startCountdown(match.id,start);
    });
}

function submitType(matchId){
    const scoreA = parseInt(document.getElementById(`scoreA_${matchId}`).value);
    const scoreB = parseInt(document.getElementById(`scoreB_${matchId}`).value);

    if(isNaN(scoreA)||isNaN(scoreB)) return showNotification("Podaj poprawne wyniki!","error");

    db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid).set({
        userId: currentUser.uid,
        nick: currentUser.displayName,
        scoreA,
        scoreB,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(()=>showNotification("🟢 Typ oddany!","success"));
}

// -----------------------
// COUNTDOWN
// -----------------------
function startCountdown(matchId,startTime){
    const interval = setInterval(()=>{
        const now = new Date();
        const diff = startTime-now;
        const feedback = document.getElementById(`feedback_${matchId}`);
        if(diff<=0){ feedback.textContent="⏱️ Mecz rozpoczęty, typowanie zakończone!"; clearInterval(interval); renderMatches(); }
        else{
            const m=Math.floor(diff/60000);
            const s=Math.floor((diff%60000)/1000);
            feedback.textContent=`Pozostało: ${m}:${s<10?"0"+s:s}`;
        }
    },1000);
}

// -----------------------
// RANKING
// -----------------------
function buildRanking(){
    rankings={};
    users.forEach(u=>rankings[u.id]=u.points||0);
    renderRanking();
}
function renderRanking(){
    const tbody=document.getElementById("ranking-list");
    tbody.innerHTML="";
    const sorted=Object.entries(rankings).sort((a,b)=>b[1]-a[1]);
    sorted.forEach(([uid,points],i)=>{
        const user=users.find(u=>u.id===uid);
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${i+1}</td><td>${user.nick}</td><td>${points}</td>`;
        tbody.appendChild(tr);
    });
}

// -----------------------
// ADMIN
// -----------------------
document.getElementById("addMatchBtn").addEventListener("click",()=>{
    const teamA=document.getElementById("teamA").value;
    const teamB=document.getElementById("teamB").value;
    const bop=parseInt(document.getElementById("bop").value);
    const time=document.getElementById("matchTime").value;
    if(!teamA||!teamB||!bop||!time) return showNotification("Uzupełnij wszystkie pola!","error");

    const startTime=new Date();
    const [hours,minutes]=time.split(":");
    startTime.setHours(hours); startTime.setMinutes(minutes);

    db.collection("matches").add({teamA,teamB,bop,startTime})
    .then(()=>{ showNotification("Mecz dodany!","success"); loadData(); 
        document.getElementById("teamA").value=""; 
        document.getElementById("teamB").value=""; 
        document.getElementById("bop").value=""; 
        document.getElementById("matchTime").value=""; });
});

function renderAdminMatches(){
    const container=document.getElementById("admin-matches-list");
    container.innerHTML="";
    matches.forEach(match=>{
        const div=document.createElement("div");
        div.className="match-card";
        div.innerHTML=`${match.teamA} vs ${match.teamB} | ${new Date(match.startTime).toLocaleString()} 
        <button class="btn btn-danger" onclick="deleteMatch('${match.id}')">Usuń</button>`;
        container.appendChild(div);
    });
}

function renderAdminUsers(){
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

function deleteMatch(id){
    if(confirm("Na pewno chcesz usunąć mecz?")){
        db.collection("matches").doc(id).delete().then(()=>loadData());
    }
}

function deleteUser(id){
    if(confirm("Na pewno chcesz usunąć użytkownika?")){
        db.collection("users").doc(id).delete().then(()=>loadData());
    }
}
