const API_BASE = "https://sheetdb.io/api/v1/zwlvogb5fk6ay"; 
let currentUser = null;

// ---- GOOGLE LOGIN ----

function handleCredentialResponse(response) {
    const data = parseJwt(response.credential);
    const email = data.email;
    const name = data.name;

    loginUser(email, name);
}

function parseJwt(token) {
    return JSON.parse(atob(token.split('.')[1]));
}

// ---- MAIN LOGIN FLOW ----

async function loginUser(email, name) {
    try {
        // 1) Sprawdzamy czy user istnieje
        const res = await fetch(`${API_BASE}/search?email=${email}`);
        const users = await res.json();

        if (users.length === 0) {
            // 2) Nie ma usera → tworzymy nowego
            await fetch(API_BASE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: [{
                        email: email,
                        nick: name,
                        points: 0
                    }]
                })
            });

            currentUser = { email, nick: name, points: 0 };
            localStorage.setItem("user", JSON.stringify(currentUser));
            showPanel();
            return;
        }

        // 3) User istnieje → PO PROSTU logujemy
        currentUser = users[0];
        localStorage.setItem("user", JSON.stringify(currentUser));
        showPanel();

    } catch (err) {
        console.error("Login error:", err);
        alert("Błąd połączenia z bazą danych.");
    }
}

// ---- UI ----

function showPanel() {
    document.getElementById("login").style.display = "none";
    document.getElementById("panel").style.display = "block";

    document.getElementById("userinfo").innerText =
        `Zalogowany jako: ${currentUser.nick}`;
}

// ---- AUTOLOGIN ----

window.onload = () => {
    const saved = localStorage.getItem("user");
    if (saved) {
        currentUser = JSON.parse(saved);
        showPanel();
    }
}
