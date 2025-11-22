/* ======================
   ADMIN FUNCTIONS
====================== */

/* Load admin data */
async function loadAdminData(){
  try{
    const [mRes,uRes]=await Promise.all([
      axios.get(`${API_BASE}?sheet=Mecze`),
      axios.get(`${API_BASE}?sheet=Users`)
    ]);
    const mecze=mRes.data||[];
    const users=uRes.data||[];

    // mecze
    const am=document.getElementById('adminMecze');
    am.innerHTML='';
    if(mecze.length===0){ am.innerHTML='<div class="text-gray-400">Brak meczów</div>'; }
    mecze.forEach(m=>{
      const id=m.ID||'';
      const card=document.createElement('div');
      card.className='p-2 rounded flex gap-2 items-center card';
      card.innerHTML=`
        <div class="flex-1">
          <strong>${m.TeamA} vs ${m.TeamB}</strong> • ${m.Start || ''} • BO${m.BO || '1'}
        </div>
        <input id="resA_${id}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikA||''}" placeholder="A"/>
        <input id="resB_${id}" class="w-16 p-1 rounded bg-transparent border" value="${m.WynikB||''}" placeholder="B"/>
        <select id="done_${id}" class="p-1 rounded bg-transparent border">
          <option value="NIE" ${(m.Zakończony||'NIE')==='NIE'?'selected':''}>NIE</option>
          <option value="TAK" ${(m.Zakończony||'NIE')==='TAK'?'selected':''}>TAK</option>
        </select>
        <button class="px-2 py-1 rounded btn" onclick="adminSaveResult('${id}')">Zapisz</button>
        <button class="px-2 py-1 rounded bg-red-600 hover:bg-red-500" onclick="adminUsunMecz('${id}')">Usuń</button>
      `;
      am.appendChild(card);
    });

    // users
    const au=document.getElementById('adminUsers');
    au.innerHTML='';
    users.forEach(u=>{
      const uid=u.UserID||'';
      const card=document.createElement('div');
      card.className='p-2 rounded flex justify-between items-center card';
      card.innerHTML=`
        <div><strong>${u.Nick||'(brak)'}</strong> <div class="text-sm text-gray-400">${uid}</div></div>
        <div class="flex gap-2 items-center">
          <div class="text-sm text-gray-300">${u.Role||'user'}</div>
          <button class="px-2 py-1 rounded btn" onclick="setUserRole('${uid}','admin')">Nadaj admin</button>
        </div>
      `;
      au.appendChild(card);
    });

  }catch(err){ console.error(err); }
}

/* Add match */
async function adminDodajMecz(){
  const a=document.getElementById('adminTeamA').value.trim();
  const b=document.getElementById('adminTeamB').value.trim();
  const start=document.getElementById('adminStart').value;
  const bo=document.getElementById('adminBO').value;
  if(!a||!b||!start){ alert('Wpisz wszystkie dane'); return; }
  const id='m'+Date.now();
  try{
    await axios.post(`${API_BASE}?sheet=Mecze`, { data:{ ID:id, TeamA:a, TeamB:b, WynikA:'', WynikB:'', Zakończony:'NIE', Start:start, BO:bo }});
    alert('Mecz dodany');
    document.getElementById('adminTeamA').value='';
    document.getElementById('adminTeamB').value='';
    document.getElementById('adminStart').value='';
    loadMecze(); loadAdminData();
  }catch(err){ console.error(err); alert('Błąd dodawania meczu'); }
}

/* Save match result */
async function adminSaveResult(id){
  try{
    const a=document.getElementById(`resA_${id}`).value;
    const b=document.getElementById(`resB_${id}`).value;
    const done=document.getElementById(`done_${id}`).value;
    await axios.patch(`${API_BASE}?sheet=Mecze&search.ID=${encodeURIComponent(id)}`, { data:{ WynikA:a, WynikB:b, Zakończony:done }});
    alert('Zapisano wynik');
    loadRanking(); loadMecze();
  }catch(err){ console.error(err); alert('Błąd zapisu wyniku'); }
}

/* Delete match */
async function adminUsunMecz(id){
  if(!confirm('Na pewno usunąć mecz?')) return;
  try{
    await axios.delete(`${API_BASE}?sheet=Mecze&search.ID=${encodeURIComponent(id)}`);
    alert('Mecz usunięty');
    loadMecze(); loadAdminData();
  }catch(err){ console.error(err); alert('Błąd usuwania'); }
}

/* Set user role */
async function setUserRole(userId,newRole){
  try{
    await axios.patch(`${API_BASE}?sheet=Users&search.UserID=${encodeURIComponent(userId)}`, { data:{ Role:newRole }});
    alert('Rola ustawiona');
    loadAdminData();
  }catch(err){ console.error(err); alert('Błąd ustawiania roli'); }
}
