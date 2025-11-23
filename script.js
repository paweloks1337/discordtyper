// ================= KONFIGURACJA =================
const API_BASE = "https://sheetdb.io/api/v1/4d1oxkwj57o7h"; // Twój SheetDB
const ADMIN_EMAILS = ["paweloxbieniek1@gmail.com"];
let user = { email:'', nick:'', role:'user', id:'' };
let mecze = [];
let ranking = [];

// ================= LOGOWANIE GOOGLE =================
function onGoogleSignIn(response){
    const profile = jwt_decode(response.credential);
    user.email = profile.email;
    user.id = profile.sub;

    // Sprawdzenie admina
    if(ADMIN_EMAILS.includes(user.email)) user.role = 'admin';
    
    document.getElementById('loginCard').classList.add('hidden');

    // Sprawdzenie czy użytkownik ma już nick
    axios.get(`${API_BASE}/users`)
      .then(res=>{
        const found = res.data.find(u=>u.UserID===user.id);
        if(found) {
          user.nick = found.Nick;
          showMainApp();
        } else {
          document.getElementById('nickSetup').classList.remove('hidden');
        }
      }).catch(err=>console.log(err));
}

function saveNick(){
    const nickVal = document.getElementById('nickInput').value.trim();
    if(!nickVal){ document.getElementById('nickMsg').textContent="Nick nie może być pusty"; return; }
    user.nick = nickVal;
    // zapis do SheetDB
    axios.post(`${API_BASE}/users`, { data:{ UserID:user.id, Nick:user.nick, Role:user.role } })
         .then(res=>{ showMainApp(); })
         .catch(err=>{ document.getElementById('nickMsg').textContent="Błąd zapisu nicku"; });
}

// ================= POKAZANIE GŁÓWNEJ APLIKACJI =================
function showMainApp(){
    document.getElementById('nickSetup').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userDisplay').textContent = `${user.nick} (${user.email})`;
    loadMecze();
    loadRanking();
}

// ================= WYLOGUJ =================
function signOut(){
    google.accounts.id.disableAutoSelect();
    user = { email:'', nick:'', role:'user', id:'' };
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
}

// ================= MECZE =================
function loadMecze(){
    axios.get(`${API_BASE}/mecze`).then(res=>{
        mecze = res.data;
        renderMecze();
        renderAdminMecze();
    });
}

function renderMecze(){
    const container = document.getElementById('meczeList');
    container.innerHTML='';
    const now = new Date();
    mecze.forEach(m=>{
        const matchTime = new Date(m.Time);
        const disabled = now >= matchTime;
        const div = document.createElement('div');
        div.className='flex items-center justify-between card';
        div.innerHTML=`
          <div>${m.TeamA} vs ${m.TeamB} - ${matchTime.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
          <div class="flex gap-2">
            <input type="text" placeholder="Twój wynik A-B" id="tip-${m.id}" class="p-1 rounded w-20" ${disabled?'disabled':''}>
            <button class="btn px-2 py-1" onclick="oddajTyp('${m.id}')" ${disabled?'disabled':''}>Wyślij</button>
          </div>
        `;
        container.appendChild(div);
    });
}

function oddajTyp(matchId){
    const input = document.getElementById(`tip-${matchId}`);
    const val = input.value.trim();
    if(!val) return;
    axios.post(`${API_BASE}/typy`, { data:{ UserID:user.id, MatchID:matchId, Typ:val } })
         .then(()=>{ 
             input.value=''; 
             input.disabled=true; 
             input.nextSibling.disabled=true; 
             input.parentElement.insertAdjacentHTML('beforeend',' <span class="text-green-400 font-bold">🟢</span>'); 
         })
         .catch(err=>console.log(err));
}

// ================= RANKING =================
function loadRanking(){
    axios.get(`${API_BASE}/ranking`).then(res=>{
        ranking = res.data;
        renderRanking();
    });
}

function renderRanking(){
    const container = document.getElementById('rankingList');
    container.innerHTML='';
    ranking.sort((a,b)=>b.Points-a.Points);
    ranking.forEach(u=>{
        const div = document.createElement('div');
        div.className='card flex justify-between';
        div.textContent = `${u.Nick}: ${u.Points} pkt`;
        container.appendChild(div);
    });
}

// ================= PANEL ADMINA =================
function adminDodajMecz(){
    const a = document.getElementById('adminTeamA').value.trim();
    const b = document.getElementById('adminTeamB').value.trim();
    const t = document.getElementById('adminTime').value;
    if(!a||!b||!t) return alert("Uzupełnij wszystkie pola");
    const timeISO = new Date();
    const [h,min] = t.split(':');
    timeISO.setHours(h, min, 0,0);
    axios.post(`${API_BASE}/mecze`, { data:{ TeamA:a, TeamB:b, Time:timeISO.toISOString() } })
         .then(()=>{ loadMecze(); 
             document.getElementById('adminTeamA').value=''; 
             document.getElementById('adminTeamB').value=''; 
             document.getElementById('adminTime').value=''; 
         });
}

function renderAdminMecze(){
    const container = document.getElementById('adminMecze');
    container.innerHTML='';
    mecze.forEach(m=>{
        const div = document.createElement('div');
        div.className='flex justify-between card';
        div.innerHTML=`
          <div>${m.TeamA} vs ${m.TeamB} - ${new Date(m.Time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
          <div class="flex gap-2">
            <button class="btn px-2 py-1" onclick="adminUsunMecz('${m.id}')">Usuń</button>
          </div>
        `;
        container.appendChild(div);
    });
}

// Usuwanie meczów
function adminUsunMecz(matchId){
    if(!confirm("Usunąć mecz?")) return;
    axios.delete(`${API_BASE}/mecze/${matchId}`).then(()=>{ loadMecze(); });
}

// ================= ADMIN: UŻYTKOWNICY =================
function renderAdminUsers(){
    axios.get(`${API_BASE}/users`).then(res=>{
        const container = document.getElementById('adminUsers');
        container.innerHTML='';
        res.data.forEach(u=>{
            const div = document.createElement('div');
            div.className='flex justify-between card';
            div.innerHTML=`<div>${u.Nick} (${u.email||u.UserID})</div>
            <button class="btn px-2 py-1" onclick="adminUsunUser('${u.UserID}')">Usuń</button>`;
            container.appendChild(div);
        });
    });
}

function adminUsunUser(userId){
    if(!confirm("Usunąć użytkownika?")) return;
    axios.delete(`${API_BASE}/users/${userId}`).then(()=>{ renderAdminUsers(); });
}

// ================= INICJALIZACJA =================
if(user.role==='admin'){ renderAdminUsers(); }
