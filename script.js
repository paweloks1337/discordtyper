// ================= CONFIG =================
const API_BASE = "https://sheetdb.io/api/v1/7gslk5j1lnvg7"; // Twój SheetDB (potwierdzone)
window._debug = (t) => {
  const el = document.getElementById('debug');
  if (el) el.innerText = (el.innerText ? el.innerText + '\n' : '') + t;
  console.log('DEBUG:', t);
};

// ================= Google Sign-In callback =================
// Google wywoła "onGoogleSignIn" — nazwa musi być taka sama
async function onGoogleSignIn(response) {
  try {
    document.getElementById('loginDebug').innerText = 'Google callback OK — dekoduję token...';
    console.log('Google response:', response);

    // prosty decode JWT (ładuje dane bez jwt-decode lib)
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    console.log('JWT payload:', payload);
    window.loggedGoogle = { id: payload.sub, email: payload.email, name: payload.name };

    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('nickBox').style.display = 'block';
    document.getElementById('nickDebug').innerText = `Zalogowano jako: ${payload.email}`;
    document.getElementById('nickInput').value = payload.name || payload.email || '';

    window._debug('Google OK: sub=' + payload.sub);
  } catch (e) {
    console.error('onGoogleSignIn err', e);
    document.getElementById('loginDebug').innerText = 'ERROR: onGoogleSignIn nie powiodło się (sprawdź konsolę)';
  }
}

// ================= SheetDB — helpery (nowy sposób) =================

// POST (create row in given sheet)
async function sheetPost(sheet, obj) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheet, data: obj })
    });
    const j = await res.json();
    window._debug(`POST ${sheet} -> ${JSON.stringify(j)}`);
    return j;
  } catch (e) {
    console.error('sheetPost err', e);
    window._debug('ERROR sheetPost: ' + e.message);
    throw e;
  }
}

// PATCH (update rows by search) — nowy sposób: body zawiera sheet + data + search
async function sheetPatch(sheet, searchObj, updateObj) {
  try {
    const res = await fetch(API_BASE, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: sheet, data: updateObj, search: searchObj })
    });
    const j = await res.json();
    window._debug(`PATCH ${sheet} search=${JSON.stringify(searchObj)} -> ${JSON.stringify(j)}`);
    return j;
  } catch (e) {
    console.error('sheetPatch err', e);
    window._debug('ERROR sheetPatch: ' + e.message);
    throw e;
  }
}

// SEARCH (GET) — spróbujemy najpierw prostego GET na /search?sheet=...&Field=Value
async function sheetSearch(sheet, field, value) {
  try {
    // preferowany /search endpoint
    const url = `${API_BASE}/search?sheet=${encodeURIComponent(sheet)}&${encodeURIComponent(field)}=${encodeURIComponent(value)}`;
    const res = await fetch(url);
    if (!res.ok) {
      window._debug(`GET search returned ${res.status} for ${url}`);
      return [];
    }
    const j = await res.json();
    window._debug(`SEARCH ${sheet} ${field}=${value} -> ${JSON.stringify(j)}`);
    return Array.isArray(j) ? j : [];
  } catch (e) {
    console.error('sheetSearch err', e);
    window._debug('ERROR sheetSearch: ' + e.message);
    return [];
  }
}

// ================= Nick save / update logic (nowy sposób zgodny z 2025) =================

async function createUserIfMissing(userId, nick) {
  // sprawdź czy user istnieje
  const found = await sheetSearch('Users', 'UserID', userId);
  if (found.length === 0) {
    // utwórz
    const post = await sheetPost('Users', { UserID: userId, Nick: nick, Role: 'user' });
    return { created: true, result: post };
  } else {
    return { created: false, existing: found[0] };
  }
}

async function updateOrCreateUser(userId, nick) {
  // stara logika: jeśli istnieje, patch; jeśli nie — post
  const found = await sheetSearch('Users', 'UserID', userId);
  if (found.length === 0) {
    window._debug('Użytkownik nie istniał — tworzę nowy');
    return await sheetPost('Users', { UserID: userId, Nick: nick, Role: 'user' });
  } else {
    window._debug('Użytkownik istnieje — aktualizuję nick');
    return await sheetPatch('Users', { UserID: userId }, { Nick: nick });
  }
}

// ================= DOM events =================
document.addEventListener('DOMContentLoaded', () => {
  // podlinkuj przycisk zapisu nicku
  const b = document.getElementById('saveNickBtn');
  if (b) b.addEventListener('click', async () => {
    const nick = document.getElementById('nickInput').value.trim();
    if (!nick || nick.length < 2) { alert('Nick za krótki'); return; }
    if (!window.loggedGoogle || !window.loggedGoogle.id) { alert('Brak danych Google'); return; }

    document.getElementById('nickDebug').innerText = 'Zapis...';
    try {
      const r = await updateOrCreateUser(window.loggedGoogle.id, nick);
      console.log('updateOrCreateUser result', r);
      document.getElementById('nickDebug').innerText = 'Nick zapisany';
      // pokaż main content
      document.getElementById('nickBox').style.display = 'none';
      document.getElementById('mainContent').style.display = 'block';
      document.getElementById('userInfo').innerText = `${nick} (${window.loggedGoogle.email})`;
      document.getElementById('apiUrl').innerText = API_BASE;
      window._debug('User saved/updated ok');
    } catch (e) {
      console.error('save nick overall err', e);
      document.getElementById('nickDebug').innerText = 'BŁĄD zapisu nicku (zobacz konsolę)';
      alert('Błąd zapisu nicku — sprawdź konsolę i debug na stronie.');
    }
  });

  // przycisk: pobierz users (test)
  window.testListUsers = async function() {
    document.getElementById('debug').innerText = 'Loading Users...';
    try {
      const res = await fetch(`${API_BASE}/Users`);
      if (!res.ok) {
        window._debug('GET /Users returned ' + res.status);
        document.getElementById('debug').innerText = 'GET /Users zwrócił ' + res.status;
        return;
      }
      const j = await res.json();
      document.getElementById('debug').innerText = JSON.stringify(j, null, 2);
      window._debug('Users fetched: ' + (j.length||0) + ' rows');
    } catch (e) {
      console.error('testListUsers err', e);
      document.getElementById('debug').innerText = 'ERROR: ' + e.message;
    }
  };

  // przycisk: utwórz tymczasowego uzytkownika testowego
  window.testCreateFakeUser = async function() {
    try {
      const fakeId = 'test-' + Date.now();
      const fakeNick = 'testuser-' + (Math.random()*1000|0);
      const res = await sheetPost('Users', { UserID: fakeId, Nick: fakeNick, Role: 'user' });
      document.getElementById('debug').innerText = 'Created: ' + JSON.stringify(res);
    } catch (e) {
      console.error('testCreateFakeUser err', e);
      document.getElementById('debug').innerText = 'ERROR (create fake): ' + e.message;
    }
  };
});
