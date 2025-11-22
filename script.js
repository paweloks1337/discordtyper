// === KONFIGURACJA ===
const API_BASE = "https://sheetdb.io/api/v1/7gslk5j1lnvg7";

// === LOGOWANIE GOOGLE ===
function handleCredentialResponse(response) {
    const data = decodeJwt(response.credential);

    const userId = data.sub;   // unikalne google ID
    const email = data.email;

    document.getElementById("login-box").style.display = "none";
    document.getElementById("nick-box").style.display = "block";

    window.loggedUser = {
        id: userId,
        email: email
    };
}

// JWT decode
function decodeJwt(token) {
    return JSON.parse(atob(token.split('.')[1]));
}



// === ZAPIS / AKTUALIZACJA NICKU ===

// tworzy nowego użytkownika
async function saveNick(userId, nick) {
    try {
        const response = await fetch(API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sheet: "Users",
                data: {
                    UserID: userId,
                    Nick: nick,
                    Role: "user"
                }
            })
        });

        const result = await response.json();

        if (!result.created && !result.updated) {
            throw new Error("SheetDB nie zapisał danych");
        }

        return true;

    } catch (err) {
        console.error("saveNick error:", err);
        return false;
    }
}



// aktualizuje albo tworzy usera
async function updateNick(userId, nick) {
    try {
        // sprawdzamy czy istnieje
        const check = await fetch(`${API_BASE}/search?UserID=${userId}`);
        const users = await check.json();

        // nie istnieje → tworzymy
        if (!Array.isArray(users) || users.length === 0) {
            return await saveNick(userId, nick);
        }

        // istnieje → aktualizujemy
        const update = await fetch(API_BASE, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sheet: "Users",
                data: {
                    Nick: nick
                },
                search: {
                    UserID: userId
                }
            })
        });

        return true;

    } catch (err) {
        console.error("updateNick error:", err);
        return false;
    }
}



// === FORMULARZ NICKU ===
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("saveNickBtn").addEventListener("click", async () => {

        const nick = document.getElementById("nickInput").value.trim();
        if (nick.length < 3) {
            alert("Nick musi mieć min 3 znaki!");
            return;
        }

        const ok = await updateNick(window.loggedUser.id, nick);

        if (!ok) {
            alert("Błąd zapisu nicku!");
            return;
        }

        alert("Nick zapisany ✔️");

        document.getElementById("nick-box").style.display = "none";
        document.getElementById("main-content").style.display = "block";
    });
});
