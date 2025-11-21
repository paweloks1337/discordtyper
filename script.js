let nick = '';

function login() {
  nick = document.getElementById('nick').value.trim();
  if (!nick) return alert("Wpisz nick!");
  document.getElementById('login').classList.add('hidden');
  document.getElementById('panel').classList.remove('hidden');
  loadMecze();
  loadRanking();
}

function loadMecze() {
  // TODO: wczytaj mecze z Google Sheets/SheetDB
  document.getElementById('mecze').innerHTML = "<p>Mecze załadują się tutaj...</p>";
}

function dodajMecz() {
  const teamA = document.getElementById('teamA').value;
  const teamB = document.getElementById('teamB').value;
  if (!teamA || !teamB) return alert("Wpisz oba zespoły");
  // TODO: wyślij mecz do Google Sheets
  alert(`Dodano mecz: ${teamA} vs ${teamB}`);
}

function submitTyp(idMeczu, winner, scoreA, scoreB) {
  // TODO: wyślij typ użytkownika do Google Sheets
}

function loadRanking() {
  // TODO: wczytaj ranking z Google Sheets
  document.getElementById('ranking').innerHTML = "<p>Ranking załaduje się tutaj...</p>";
}
