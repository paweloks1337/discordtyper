/* ======================
  Konfiguracja SheetDB
====================== */
const API_BASE = 'https://sheetdb.io/api/v1/zwlvogb5fk6ay'; // Twój nowy SheetDB API
let googleID = '';
let nick = '';
let role = 'user';

/* ======================
  LOGOWANIE Google
====================== */
function handleLogin(response) {
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';

    axios.get(`${API_BASE}/search?UserID=${encodeURIComponent(googleID)}`)
      .then(res => {
        if (res.data && res.data.length > 0) {
          const u = res.data[0];
          nick = u.Nick || givenName;
          role = (u.Role && u.Role.toLowerCase() === 'admin') ? 'admin' : 'user';
          afterLogin();
        } else {
          // nowy użytkownik → ustaw nick
          document.getElementById('g_id_onload').style.display = 'none';
          document.getElementById('nickForm').style.display = 'block';
          document.getElementById('nickInput').value = givenName;
        }
      })
      .catch(err => console.error(err));
  } catch (err) {
    console.error('Błąd logowania:', err);
  }
}

/* ======================
  ZAPIS NICKU
====================== */
function saveNick() {
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2) { alert('Nick za krótki'); return; }
  nick = v;

  axios.post(API_BASE + '/Users', { data: { UserID: googleID, Nick: nick, Role: 'user' }})
    .then(() => {
      afterLogin();
    })
    .catch(err => {
      console.error('saveNick err', err);
      alert('Błąd zapisu nicku. Sprawdź arkusz Users i konfigurację SheetDB.');
    });
}

/* ======================
  PO LOGOWANIU
====================== */
function afterLogin() {
  localStorage.setItem('nick', nick);
  window.location.href = 'panel.html'; // przejście do panelu
}

/* ======================
  PANEL HTML - TABY
====================== */
function showTab(name) {
  document.querySelectorAll('.tab').forEach(el => el.classList.add('hidden'));
  document.getElementById('tab-' + name).classList.remove('hidden');

  document.querySelectorAll('.tabBtn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.tabBtn[onclick="showTab('${name}')"]`).classList.add('active');
}

/* ======================
  ADMIN - DODAJ MECZ
====================== */
function adminDodajMecz() {
  const a = document.getElementById('adminTeamA').value.trim();
  const b = document.getElementById('adminTeamB').value.trim();
  const time = document.getElementById('adminTime').value;
  const bo = document.getElementById('adminBo').value;

  if (!a || !b || !time) { alert('Wpisz wszystkie dane meczu'); return; }

  const id = 'm' + Date.now();
  axios.post(API_BASE + '/Mecze', {
    data: { ID: id, TeamA: a, TeamB: b, Godzina: time, BO: bo, WynikA: '', WynikB: '', Zakończony: 'NIE' }
  })
  .then(() => {
    alert('Mecz dodany!');
    loadAdminData();
    loadMecze();
    document.getElementById('adminTeamA').value = '';
    document.getElementById('adminTeamB').value = '';
    document.getElementById('adminTime').value = '';
  })
  .catch(err => console.error(err));
}

/* ======================
  ADMIN - WYPISANIE MECZÓW
====================== */
function loadAdminData() {
  axios.get(API_BASE + '/Mecze')
    .then(res => {
      const mecze = res.data || [];
      const container = document.getElementById('adminMecze');
      container.innerHTML = '';

      if (mecze.length === 0) { container.innerHTML = '<div class="text-gray-400">Brak meczów</div>'; return; }

      mecze.forEach(m => {
        const id = m.ID;
        const row = document.createElement('div');
        row.className = 'p-2 rounded bg-gray-800 flex gap-2 items-center';

        row.innerHTML = `
          <div class="flex-1">
            <strong>${m.TeamA} vs ${m.TeamB}</strong> 
            <span class="text-gray-400">(${m.Godzina}, ${m.BO})</span>
          </div>
          <button class="bg-red-600 px-2 py-1 rounded hover:scale-105 transition-transform" onclick="deleteMecz('${id}')">Usuń</button>
        `;
        container.appendChild(row);
      });
    })
    .catch(err => console.error(err));
}

/* ======================
  ADMIN - USUŃ MECZ
====================== */
function deleteMecz(id) {
  if (!confirm('Na pewno chcesz usunąć mecz?')) return;
  axios.delete(API_BASE + `/Mecze/${id}`)
    .then(() => { alert('Mecz usunięty'); loadAdminData(); loadMecze(); })
    .catch(err => console.error(err));
}

/* ======================
  PANEL - ŁADOWANIE MECZÓW DO TYPÓW
====================== */
function loadMecze() {
  const meczeList = document.getElementById('meczeList');
  meczeList.innerHTML = '';

  axios.get(API_BASE + '/Mecze')
    .then(res => {
      const mecze = res.data || [];
      if (mecze.length === 0) { meczeList.innerHTML = 'Brak meczów'; return; }

      mecze.forEach(m => {
        const now = new Date();
        const matchTime = new Date();
        const [h, min] = m.Godzina.split(':');
        matchTime.setHours(h); matchTime.setMinutes(min); matchTime.setSeconds(0);

        const disabled = now >= matchTime ? 'disabled' : '';
        const card = document.createElement('div');
        card.className = 'p-3 rounded bg-gray-800 mb-2 flex justify-between items-center';

        card.innerHTML = `
          <div>
            <strong>${m.TeamA} vs ${m.TeamB}</strong>
            <p class="text-gray-400">${m.Godzina} | ${m.BO}</p>
          </div>
          <div class="flex gap-2 items-center">
            <input type="number" min="0" placeholder="A" id="scoreA_${m.ID}" class="p-1 rounded bg-gray-700 border" ${disabled}>
            <input type="number" min="0" placeholder="B" id="scoreB_${m.ID}" class="p-1 rounded bg-gray-700 border" ${disabled}>
            <button onclick="submitTyp('${m.ID}')" class="bg-yellow-400 px-3 py-1 rounded hover:scale-105 transition-transform" ${disabled}>Wyślij</button>
          </div>
        `;
        meczeList.appendChild(card);
      });
    })
    .catch(err => console.error(err));
}

/* ======================
  WYSYŁANIE TYPU
====================== */
function submitTyp(id) {
  const scoreA = document.getElementById(`scoreA_${id}`).value;
  const scoreB = document.getElementById(`scoreB_${id}`).value;

  if (scoreA === '' || scoreB === '') { alert('Wprowadź wynik'); return; }

  axios.post(API_BASE + '/Typy', { 
    data: { Nick: nick, UserID: googleID, ID_meczu: id, Typ_wynikuA: scoreA, Typ_wynikuB: scoreB, Punkty: 0 } 
  })
  .then(() => { alert('Typ zapisany'); loadRanking(); })
  .catch(err => console.error(err));
}

/* ======================
  RANKING
====================== */
function loadRanking() {
  const rankingList = document.getElementById('rankingList');
  rankingList.innerHTML = '';

  axios.get(API_BASE + '/Typy')
    .then(res => {
      const typy = res.data || [];
      const scores = {};

      typy.forEach(t => {
        scores[t.Nick] = (scores[t.Nick] || 0) + parseInt(t.Punkty || 0);
      });

      const arr = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      arr.forEach(([n, p], i) => {
        const el = document.createElement('div');
        el.className = 'p-2 rounded bg-gray-800 flex justify-between';
        el.innerHTML = `<span>${i+1}. ${n}</span><span class="text-yellow-400 font-bold">${p} pkt</span>`;
        rankingList.appendChild(el);
      });
    })
    .catch(err => console.error(err));
}

/* ======================
  WYLOGUJ
====================== */
function signOut() {
  localStorage.removeItem('nick');
  window.location.href = 'index.html';
}
