// 🔥 USTAW TO NA SWÓJ ARKUSZ
const API_BASE = "https://sheetdb.io/api/v1/7gslk5j1lnvg7";

// =================================================
// GOOGLE CALLBACK
// =================================================
window.handleCredentialResponse = async function(response) {

    const token = response.credential;
    const payload = JSON.parse(atob(token.split(".")[1]));

    const email = payload.email;
    const name  = payload.name;

    console.log("Zalogowano:", email);

    localStorage.setItem("user_email", email);
    localStorage.setItem("user_name", name);

    // SPRAWDZAMY CZY ISTNIEJE W BAZIE
    let check = await fetch(`${API_BASE}/search?email=${email}`);
    let data = await check.json();

    // JEŚLI NIE MA — DODAJEMY
    if (data.length === 0) {
        await fetch(API_BASE, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                email: email,
                nick: name,
                role: "user"
            })
        });
    }

    window.location.href = "panel.html";
};
