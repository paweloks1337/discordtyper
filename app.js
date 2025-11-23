// ==================== KONFIGURACJA ====================
const ADMIN_EMAIL = "paweloxbieniek1@gmail.com"; // Twój mail jako admin
let userEmail = "";
let userNick = "";
let userRole = "user"; // "admin" jeśli jesteś adminem

// Dane tymczasowe (zamiast arkusza / SheetDB)
let users = []; // {email,nick,role,points,typy}
let mecze = []; // {id,teamA,teamB,time,result} - result np: "2:1"
let ranking = [];

// ==================== LOGOWANIE GOOGLE ====================
function onGoogleSignIn(response) {
    const userObj = jwt_decode(response.credential);
    userEmail = userObj.email;
    userNick = "";
    userRole = (userEmail === ADMIN_EMAIL) ? "admin" : "user";

    const existingUser = users.find(u => u.email === userEmail);
    if(existingUser){
        userNick = existingUser.nick;
        showMainApp();
    } else {
        document.getElementById("loginCard").style.display = "none";
        document.getElementById("nickSetup").style.display = "block";
    }
}

function saveNick() {
    const input = document.getElementById("nickInput").value.trim();
    if(!input){
        document.getElementById("nickMsg").innerText = "Nick nie może być pusty.";
        return;
    }
    userNick = input;
    users.push({email:userEmail,nick:userNick,role:userRole,points:0,typy:[]});
    showMainApp();
}

function showMainApp(){
    document.getElementById("nickSetup").style.display = "none";
    document.getElementById("loginCard").style.display = "none";
    document.getElementById("mainApp").style.display = "block";
    document.getElementById("userDisplay").innerText = `${userNick} (${userRole})`;
    renderMecze();
    renderRanking();
    renderAdmin();
}

// ==================== WYLOGUJ ====================
function signOut(){
    users = users.filter(u => u.email !== userEmail && u.role !== "admin"); // opcjonalnie
    userEmail = "";
    userNick = "";
    userRole = "user";
    document.getElementById("mainApp").style.display = "none";
    document.getElementById("nickSetup").style.display = "none";
    document.getElementById("loginCard").style.display = "block";
}

// ==================== TABY ====================
function showTab(tab){
    document.querySelectorAll(".tab").forEach(t=>t.style.display="none");
    document.getElementById("tab-"+tab).style.display="block";
}

// ==================== MECZE ====================
function renderMecze(){
    const div = document.getElementById("meczeList");
    div.innerHTML = "";
    if(mecze.length===0){ div.innerHTML="<p>Brak meczów</p>"; return; }

    mecze.forEach((m,idx)=>{
        const container = document.createElement("div");
        container.className = "card p-3 rounded-lg flex justify-between items-center animate-fadeIn";
        container.innerHTML = `
            <div>
                <p class="font-semibold">${m.teamA} vs ${m.teamB} - ${m.time}</p>
            </div>
            <div class="flex gap-2">
                <button class="btn-team px-3 py-1" onclick="typuj(${idx},'A')">Team A</button>
                <button class="btn-team px-3 py-1" onclick="typuj(${idx},'B')">Team B</button>
            </div>
            <button class="btn-submit px-3 py-1 ml-2 hidden" id="submitBtn-${idx}" onclick="wyślijTyp(${idx})">Wyślij</button>
        `;
        div.appendChild(container);
    });
}

function typuj(idx,team){
    const btnSubmit = document.getElementById(`submitBtn-${idx}`);
    btnSubmit.style.display = "inline-block";
    mecze[idx].selected = team;
}

function wyślijTyp(idx){
    const m = mecze[idx];
    const user = users.find(u=>u.email===userEmail);
    if(!user.typy) user.typy=[];
    user.typy[idx] = m.selected;
    alert("Typ zapisany!");
}

// ==================== RANKING ====================
function renderRanking(){
    const div = document.getElementById("rankingList");
    div.innerHTML = "";
    users.sort((a,b)=>b.points - a.points).forEach(u=>{
        const el = document.createElement("div");
        el.className="card p-2 rounded flex justify-between";
        el.innerHTML=`<span>${u.nick}</span><span>${u.points} pkt</span>`;
        div.appendChild(el);
    });
}

// ==================== PANEL ADMINA ====================
function renderAdmin(){
    if(userRole!=="admin"){
        document.getElementById("tab-admin").style.display="none";
        return;
    }
    renderAdminMecze();
    renderAdminUsers();
}

function adminDodajMecz(){
    const teamA = document.getElementById("adminTeamA").value.trim();
    const teamB = document.getElementById("adminTeamB").value.trim();
    const time = document.getElementById("adminTime").value;
    if(!teamA||!teamB||!time){ alert("Wypełnij wszystkie pola!"); return;}
    mecze.push({id:mecze.length,teamA,teamB,time,result:null});
    renderMecze();
    renderAdminMecze();
}

function renderAdminMecze(){
    const div = document.getElementById("adminMecze");
    div.innerHTML="";
    mecze.forEach((m,idx)=>{
        const el = document.createElement("div");
        el.className="card p-2 rounded flex items-center justify-between";
        el.innerHTML=`
            <span>${m.teamA} vs ${m.teamB} - ${m.time}</span>
            <input type="text" placeholder="Wynik 2:1" class="p-1 rounded w-20 bg-gray-800 text-white" id="wynik-${idx}" />
            <button class="px-2 py-1 rounded bg-red-700" onclick="usunMecz(${idx})">Usuń</button>
            <button class="px-2 py-1 rounded bg-green-600" onclick="zatwierdzWynik(${idx})">Zatwierdź</button>
        `;
        div.appendChild(el);
    });
}

function renderAdminUsers(){
    const div = document.getElementById("adminUsers");
    div.innerHTML="";
    users.forEach((u,idx)=>{
        const el = document.createElement("div");
        el.className="flex justify-between items-center card p-2 rounded";
        el.innerHTML=`<span>${u.nick} (${u.email}) - ${u.points} pkt</span>
        <button class="px-2 py-1 rounded bg-red-700" onclick="usunUser(${idx})">Usuń</button>`;
        div.appendChild(el);
    });
}

// ==================== AKCJE ADMIN ====================
function usunMecz(idx){
    if(!confirm("Na pewno usunąć mecz?")) return;
    mecze.splice(idx,1);
    renderMecze();
    renderAdminMecze();
}

function usunUser(idx){
    if(!confirm("Na pewno usunąć użytkownika?")) return;
    users.splice(idx,1);
    renderRanking();
    renderAdminUsers();
}

function zatwierdzWynik(idx){
    const wynikInput = document.getElementById(`wynik-${idx}`).value;
    if(!wynikInput.match(/^\d+:\d+$/)){ alert("Niepoprawny format wyniku!"); return;}
    mecze[idx].result = wynikInput;

    // aktualizacja punktów
    const [gA,gB] = wynikInput.split(":").map(Number);
    users.forEach(u=>{
        if(u.typy[idx]){
            const typ = u.typy[idx];
            if((gA>gB && typ==='A') || (gB>gA && typ==='B')) u.points+=1; // poprawny zwycięzca
            if((gA===gB && typ==='draw')) u.points+=1; // jeśli draw
            if((typ==='A' && gA===gB) || (typ==='B' && gB===gA)) u.points+=0;
            // dokładny wynik 2 pkt
            if((typ==='A' && gA>gB && wynikInput==='2:0') || (typ==='B' && gB>gA && wynikInput==='0:2')) u.points+=2;
        }
    });
    renderRanking();
    alert("Wynik zapisany!");
}
