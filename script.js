/* Google Sign-In callback */
async function onGoogleSignIn(response){
  try {
    const data = jwt_decode(response.credential);
    googleID = data.sub;
    const givenName = data.name || data.email || 'Gracz';

    // Spróbuj znaleźć użytkownika w Users
    let usersRes = [];
    try {
      const res = await axios.get(`${API_BASE}/Users/search?UserID=${encodeURIComponent(googleID)}`);
      usersRes = res.data || [];
    } catch(err) {
      console.warn('Users search failed', err);
      usersRes = [];
    }

    if(usersRes.length > 0){
      const u = usersRes[0];
      nick = u.Nick || givenName;
      role = (u.Role && u.Role.toLowerCase()==='admin') ? 'admin' : 'user';
      afterLogin();
    } else {
      // pokaż formularz ustawienia nicku
      document.getElementById('loginCard').style.display = 'none';
      document.getElementById('nickSetup').style.display = 'block';
      document.getElementById('nickMsg').textContent = 'Witaj! Ustaw teraz swój nick (unikalny w turnieju).';
      document.getElementById('nickInput').value = givenName;
    }

  } catch(err){
    console.error('login error', err);
    alert('Błąd logowania. Sprawdź konsolę.');
  }
}

/* Zapis nicku (bezpieczny) */
async function saveNick(){
  const v = document.getElementById('nickInput').value.trim();
  if (!v || v.length < 2){ alert('Nick za krótki'); return; }
  nick = v;

  // POST z obsługą pustego arkusza
  const payload = { data: { UserID: googleID, Nick: nick, Role: 'user' }};

  try {
    // SheetDB czasami zwraca 404 jeśli arkusz jest pusty, więc najpierw PATCH z fallback
    await axios.patch(`${API_BASE}/Users/search?UserID=${encodeURIComponent(googleID)}`, payload)
      .catch(async () => {
        // jeśli PATCH nie działa, spróbuj POST
        await axios.post(`${API_BASE}/Users`, payload);
      });

    document.getElementById('nickSetup').style.display = 'none';
    afterLogin();

  } catch(err){
    console.error('saveNick error', err);
    alert('Błąd zapisu nicku. Sprawdź czy arkusz Users istnieje i czy ma nagłówki: UserID, Nick, Role');
  }
}
