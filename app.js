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
const adminEmails = ["paweloxbieniek1@gmail.com"];
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
const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');

// -----------------------
// AUTH
// -----------------------
loginBtn.addEventListener("click", async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { await auth.signInWithPopup(provider); }
    catch { showNotification("Błąd logowania!", "error"); }
});

logoutBtn.addEventListener("click", () => auth.signOut());

auth.onAuthStateChanged(async user => {
    if(user){
        currentUser = user;
        loginPanel.style.display="none";
        header.style.display="flex";
        nav.style.display="flex";
        document.querySelector("main").style.display="block";

        const userRef = db.collection("users").doc(user.uid);
        const userDoc = await userRef.get();

        if(!userDoc.exists){
            let nick="";
            while(!nick){ nick = prompt("Wybierz swój nick:").trim(); }
            await userRef.set({ nick, points:0, email:user.email });
        }

        const data = (await userRef.get()).data();
        userNameSpan.textContent = `Zalogowany jako: ${data.nick}`;
        checkAdmin(user.email);
        loadData();
    } else {
        currentUser = null;
        loginPanel.style.display="flex";
        header.style.display="none";
        nav.style.display="none";
        document.querySelector("main").style.display="none";
    }
});

function checkAdmin(email){
    isAdmin = adminEmails.includes(email);
    const adminTab = document.querySelector('nav button[data-tab="admin"]');
    if(adminTab) adminTab.style.display = isAdmin ? "inline-block" : "none";
}

// -----------------------
// NAV
// -----------------------
tabs.forEach(tab=>{
    tab.addEventListener("click",()=>{
        tabs.forEach(t=>t.classList.remove("active"));
        tab.classList.add("active");
        const tabId = tab.getAttribute("data-tab");
        contents.forEach(c=>c.classList.remove("active"));
        document.getElementById(tabId).classList.add("active");
    });
});

// -----------------------
// LOAD DATA
// -----------------------
async function loadData(){
    const matchesSnap = await db.collection("matches").orderBy("startTime").get();
    matches = await Promise.all(matchesSnap.docs.map(async doc=>{
        const data = doc.data();
        const typesSnap = await doc.ref.collection("types").get();
        const types = {};
        typesSnap.forEach(t=>types[t.id]=t.data());
        return { id:doc.id, ...data, types };
    }));

    const usersSnap = await db.collection("users").get();
    users = usersSnap.docs.map(doc=>({id:doc.id,...doc.data()}));

    buildRanking();
    renderMatches();
    renderAdminMatches();
    renderAdminUsers();
}

// -----------------------
// MATCHES
// -----------------------
function renderMatches(){
    const container = document.getElementById("matches-list");
    const historyContainer = document.getElementById("user-history");
    container.innerHTML=""; historyContainer.innerHTML="";
    const now = new Date();

    matches.forEach(match=>{
        const start = match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime.seconds*1000);
        const canType = now<start;
        const userType = match.types && match.types[currentUser.uid];

        const div=document.createElement("div");
        div.className="match-card";
        div.innerHTML=`
            <div class="match-info">
                <span class="match-teams">${match.teamA} vs ${match.teamB}</span>
                <span class="match-time">${start.toLocaleString()} | BOP: ${match.bop}</span>
                <span class="match-history">Twój typ: ${userType?userType.scoreA+'-'+userType.scoreB:"brak"}</span>
            </div>
            <div class="match-actions">
                <input type="number" min="0" placeholder="Wynik ${match.teamA}" id="scoreA_${match.id}" class="input-score" ${!canType?"disabled":""}>
                <input type="number" min="0" placeholder="Wynik ${match.teamB}" id="scoreB_${match.id}" class="input-score" ${!canType?"disabled":""}>
                <button class="btn btn-submit" onclick="submitType('${match.id}')" ${!canType?"disabled":""}>Wyślij</button>
            </div>
            <div class="type-feedback" id="feedback_${match.id}"></div>
        `;
        container.appendChild(div);

        if(userType){
            const hdiv = document.createElement("div");
            hdiv.textContent = `${match.teamA} vs ${match.teamB}: ${userType.scoreA}-${userType.scoreB}`;
            historyContainer.appendChild(hdiv);
        }

        if(canType) startCountdown(match.id,start);
    });
}

// -----------------------
// COUNTDOWN
// -----------------------
function startCountdown(matchId,startTime){
    const interval=setInterval(()=>{
        const now=new Date();
        const diff=startTime-now;
        const feedback=document.getElementById(`feedback_${matchId}`);
        if(diff<=0){
            feedback.textContent="⏱️ Mecz rozpoczęty, typowanie zakończone!";
            clearInterval(interval);
            renderMatches();
        }else{
            const minutes=Math.floor(diff/60000);
            const seconds=Math.floor((diff%60000)/1000);
            feedback.textContent=`Pozostało: ${minutes}:${seconds<10?"0"+seconds:seconds}`;
        }
    },1000);
}

// -----------------------
// SUBMIT TYPE
// -----------------------
async function submitType(matchId){
    const scoreA=parseInt(document.getElementById(`scoreA_${matchId}`).value);
    const scoreB=parseInt(document.getElementById(`scoreB_${matchId}`).value);
    if(isNaN(scoreA)||isNaN(scoreB)) return showNotification("Podaj poprawne wyniki!","error");

    const nick = (await db.collection("users").doc(currentUser.uid).get()).data().nick;

    await db.collection("matches").doc(matchId).collection("types").doc(currentUser.uid).set({
        userId: currentUser.uid,
        nick,
        scoreA,
        scoreB,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    showNotification("🟢 Typ oddany!","success");
    loadData();
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
    sorted.forEach(([uid,points],index)=>{
        const user=users.find(u=>u.id===uid);
        const tr=document.createElement("tr");
        const topClass=index===0?"top1":index===1?"top2":index===2?"top3":"";
        tr.innerHTML=`<td>${index+1}</td><td>${user.nick}</td><td class="${topClass}">${points}</td>`;
        tbody.appendChild(tr);
    });
}

// -----------------------
// ADMIN
// -----------------------
document.getElementById("addMatchBtn").addEventListener("click",async()=>{
    const teamA=document.getElementById("teamA").value.trim();
    const teamB=document.getElementById("teamB").value.trim();
    const bop=parseInt(document.getElementById("bop").value);
    const time=document.getElementById("matchTime").value;

    if(!teamA||!teamB||!bop||!time) return showNotification("Uzupełnij wszystkie pola!","error");

    const startTime=new Date();
    const [hours,minutes]=time.split(":");
    startTime.setHours(parseInt(hours),parseInt(minutes),0,0);

    try{
        await db.collection("matches").add({
            teamA,teamB,bop,startTime: firebase.firestore.Timestamp.fromDate(startTime)
        });
        showNotification("Mecz dodany!","success");
        loadData();
        document.getElementById("teamA").value="";
        document.getElementById("teamB").value="";
        document.getElementById("bop").value="";
        document.getElementById("matchTime").value="";
    }catch(err){ console.error(err); showNotification("Nie udało się dodać meczu!","error"); }
});

function renderAdminMatches(){
    const container=document.getElementById("admin-matches-list");
    container.innerHTML="";
    matches.forEach(match=>{
        const start = match.startTime.toDate ? match.startTime.toDate() : new Date(match.startTime.seconds*1000);
        const div=document.createElement("div");
        div.className="match-card";
        div.innerHTML=`${match.teamA} vs ${match.teamB} | ${start.toLocaleString()} 
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
        div.innerHTML = `${u.nick} (${u.email || u.id})
            <button class="btn btn-danger" onclick="deleteUser('${u.id}')">Usuń</button>`;
        container.appendChild(div);
    });
}

async function deleteMatch(id){
    if(!confirm("Na pewno chcesz usunąć mecz?")) return;
    try {
        await db.collection("matches").doc(id).delete();
        showNotification("Mecz usunięty", "success");
        loadData();
    } catch(err){
        console.error(err);
        showNotification("Błąd usuwania meczu", "error");
    }
}

async function deleteUser(id){
    if(!confirm("Na pewno chcesz usunąć użytkownika?")) return;
    try {
        // usuwamy dokument użytkownika
        await db.collection("users").doc(id).delete();
        // opcjonalnie: usuń typy tego użytkownika z każdego meczu (bez tego będą wisieć)
        const matchesSnap = await db.collection("matches").get();
        const batch = db.batch();
        matchesSnap.forEach(mDoc => {
            const typeRef = mDoc.ref.collection("types").doc(id);
            batch.delete(typeRef);
        });
        await batch.commit();
        showNotification("Użytkownik usunięty", "success");
        loadData();
    } catch(err){
        console.error(err);
        showNotification("Błąd usuwania użytkownika", "error");
    }
}

// -----------------------
// NOTIFICATIONS
// -----------------------
function showNotification(msg, type = "success") {
    const notif = document.getElementById("notification");
    notif.textContent = msg;
    notif.className = `notification ${type} show`;
    // usuń po czasie
    clearTimeout(showNotification._timeout);
    showNotification._timeout = setTimeout(() => {
        notif.className = `notification ${type}`;
    }, 2500);
}
