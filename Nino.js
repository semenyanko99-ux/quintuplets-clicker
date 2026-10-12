
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAx1i5oHWj34s-9a8dbK7Gbh_EzkZ0I4bY",
  authDomain: "quintessentialclicker.firebaseapp.com",
  projectId: "quintessentialclicker",
  appId: "1:666995427663:web:a69d0c72d2c27b704a5d3a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

// Spielvariablen
let tokens = 0;
let power = 1;
let upgradeCost = 10;
let petMultiplier = 1;
let petRarity = "Kein Pet";
let username = "";
let ready = false;
let busy = false;
let saveQueue = Promise.resolve();

function message(text) {
  $("authMessage").textContent = text;
}

function update() {
  $("tokens").textContent = tokens;
  $("power").textContent =
    Number((power * petMultiplier).toFixed(2));
}

function usernameToEmail(name) {
  return name.toLowerCase() +
    "@quintupletsclicker.example.com";
}

function validUsername(name) {
  return /^[A-Za-z0-9_]{3,16}$/.test(name);
}

// Neues Konto erstellen
$("registerButton").addEventListener("click", async () => {
  if (busy) return;

  const name = $("username").value.trim();
  const password = $("password").value;

  if (!validUsername(name)) {
    message("Benutzername: 3–16 Buchstaben, Zahlen oder _.");
    return;
  }

  if (password.length < 6) {
    message("Das Passwort muss mindestens 6 Zeichen haben.");
    return;
  }

  busy = true;
  $("registerButton").disabled = true;
  message("Konto wird erstellt …");

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      usernameToEmail(name),
      password
    );

    await setDoc(doc(db, "users", credential.user.uid), {
      username: name,
      tokens: 0,
      power: 1,
      upgradeCost: 10,
      petMultiplier: 1,
      petRarity: "Kein Pet"
    });

    message("Konto erstellt!");
  } catch (error) {
    console.error(error);
    message(
      error.code === "auth/email-already-in-use"
        ? "Dieser Benutzername ist bereits vergeben."
        : "Konto konnte nicht erstellt werden: " + error.code
    );
  } finally {
    busy = false;
    $("registerButton").disabled = false;
  }
});

// Anmelden
$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;

  const name = $("username").value.trim();
  const password = $("password").value;

  if (!validUsername(name)) {
    message("Bitte gib einen gültigen Benutzernamen ein.");
    return;
  }

  busy = true;
  message("Anmeldung läuft …");

  try {
    await signInWithEmailAndPassword(
      auth,
      usernameToEmail(name),
      password
    );
  } catch (error) {
    console.error(error);
    message("Anmeldung fehlgeschlagen. Prüfe Name und Passwort.");
  } finally {
    busy = false;
  }
});

// Spielstand laden
onAuthStateChanged(auth, async user => {
  ready = false;

  if (!user) {
    $("authPanel").hidden = false;
    $("gamePanel").hidden = true;
    username = "";
    return;
  }

  $("saveStatus").textContent = "Spielstand wird geladen …";

  try {
    const ref = doc(db, "users", user.uid);
    const snapshot = await getDoc(ref);

    // Fehlenden Spielstand anlegen
    if (!snapshot.exists()) {
      await setDoc(ref, {
        username: user.displayName || "Spieler",
        tokens: 0,
        power: 1,
        upgradeCost: 10,
        petMultiplier: 1,
        petRarity: "Kein Pet"
      });
    }

    const latestSnapshot = await getDoc(ref);
    const data = latestSnapshot.data();

    username = data.username || "Spieler";
    tokens = Number.isFinite(data.tokens) ? data.tokens : 0;
    power = Number.isFinite(data.power) ? data.power : 1;

    upgradeCost = Number.isFinite(data.upgradeCost)
      ? data.upgradeCost
      : 10;

    petMultiplier = Number.isFinite(data.petMultiplier)
      ? data.petMultiplier
      : 1;

    petRarity = data.petRarity || "Kein Pet";

    update();
    $("playerName").textContent = username;
    $("authPanel").hidden = true;
    $("gamePanel").hidden = false;
    $("saveStatus").textContent = "☁️ Spielstand geladen!";

    ready = true;
  } catch (error) {
    console.error(error);
    $("saveStatus").textContent =
      "Laden fehlgeschlagen. Prüfe deine Firestore-Regeln.";
  }
});

// Spielstand speichern
function saveGame() {
  if (!auth.currentUser || !ready) {
    return Promise.resolve();
  }

  const user = auth.currentUser;

  const data = {
    username,
    tokens,
    power,
    upgradeCost,
    petMultiplier,
    petRarity
  };

  $("saveStatus").textContent = "Speichert …";

  saveQueue = saveQueue.then(() =>
    setDoc(doc(db, "users", user.uid), data, { merge: true })
  ).then(() => {
    if (auth.currentUser?.uid === user.uid) {
      $("saveStatus").textContent =
        "☁️ Spielstand gespeichert!";
    }
  }).catch(error => {
    console.error(error);
    $("saveStatus").textContent =
      "Speichern fehlgeschlagen!";
  });

  return saveQueue;
}

// Klick-Button: Pet-Multiplikator berücksichtigen
$("clickButton").addEventListener("click", () => {
  if (!ready || !auth.currentUser) return;

  tokens += power * petMultiplier;
  tokens = Number(tokens.toFixed(2));

  update();
  saveGame();
});

// Menü-Buttons
document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});

// Shop und Pets
function showSection(section) {
  if (section === "shop") {
    $("content").innerHTML = `
      <h2>Shop 🛒</h2>
      <p>
        Upgrade kostet
        <span id="upgradeCost">${upgradeCost}</span> Tokens.
      </p>
      <button id="buyUpgrade">Upgrade kaufen</button>
    `;

    $("buyUpgrade").addEventListener("click", () => {
      if (!ready) return;

      if (tokens >= upgradeCost) {
        tokens -= upgradeCost;
        power++;

        upgradeCost = Math.floor(upgradeCost * 2);

        update();
        saveGame();
        showSection("shop");
      } else {
        alert(
          "Du brauchst mindestens " + upgradeCost + " Tokens!"
        );
      }
    });

  } else if (section === "pets") {
    $("content").innerHTML = `
      <h2>🎰 Pet Roulette</h2>
      <p>Dein aktuelles Pet: <strong>${petRarity}</strong></p>
      <p>Dein Pet-Multiplikator: ×${petMultiplier}</p>

      <div id="rouletteResult" style="
        margin: 20px 0;
        padding: 20px;
        background: #20243a;
        color: white;
        border-radius: 12px;
        text-align: center;
        font-size: 22px;
      ">
        🐣 Bereit?
      </div>

      <button id="spinRoulette">🎰 Roulette drehen</button>

      <h3>Seltenheiten</h3>
      <p>🔵 Rare: 50 % — ×1,2</p>
      <p>🟣 Epic: 20 % — ×2</p>
      <p>🟡 Legendary: 15 % — ×4</p>
      <p>🔴 Mythisch: 7 % — ×6</p>
      <p>Die übrigen 8 %: kein Gewinn.</p>
    `;

    $("spinRoulette").addEventListener("click", () => {
      if (!ready || !auth.currentUser) return;

      const result = Math.random() * 100;

      let rarity;
      let multiplier;

      if (result < 50) {
        rarity = "🔵 Rare";
        multiplier = 1.2;
      } else if (result < 70) {
        rarity = "🟣 Epic";
        multiplier = 2;
      } else if (result < 85) {
        rarity = "🟡 Legendary";
        multiplier = 4;
      } else if (result < 92) {
        rarity = "🔴 Mythisch";
        multiplier = 6;
      } else {
        $("rouletteResult").innerHTML =
          "😢 Kein Pet diesmal! Versuch es erneut.";
        return;
      }

      // Neues Pet ausrüsten
      petRarity = rarity;
      petMultiplier = multiplier;

      $("rouletteResult").innerHTML = `
        🎉 Neues Pet gewonnen!<br><br>
        ${rarity}<br>
        Multiplikator: ×${multiplier}
      `;

      update();
      saveGame();

      // Aktuelles Pet oben aktualisieren
      const petInfo = $("content").querySelector("p");
      if (petInfo) {
        petInfo.innerHTML =
          `Dein aktuelles Pet: <strong>${petRarity}</strong>`;
      }
    });

  } else if (section === "skins") {
    $("content").innerHTML =
      "<h2>🎨 Skins</h2><p>Kommt bald!</p>";

  } else if (section === "quests") {
    $("content").innerHTML =
      "<h2>📜 Quests</h2><p>Kommt bald!</p>";
  }
}

// Abmelden
$("logoutButton").addEventListener("click", async () => {
  await saveGame();
  await signOut(auth);
});

