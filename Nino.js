
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

// Firebase-Konfiguration aus deiner Firebase Console
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

let tokens = 0;
let power = 1;
let username = "";
let ready = false;
let busy = false;
let saveQueue = Promise.resolve();

function message(text) {
  $("authMessage").textContent = text;
}

function update() {
  $("tokens").textContent = tokens;
  $("power").textContent = power;
}

function usernameToEmail(name) {
  // Nur eine interne Kennung, keine echte E-Mail-Adresse.
  return name.toLowerCase() + "@quintupletsclicker.example.com";
}

function validUsername(name) {
  return /^[A-Za-z0-9_]{3,16}$/.test(name);
}

// Konto erstellen
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
      auth, usernameToEmail(name), password
    );

    await setDoc(doc(db, "users", credential.user.uid), {
      username: name,
      tokens: 0,
      power: 1
    });

    message("Konto erstellt!");
  } catch (error) {
    console.error(error);
    message(error.code === "auth/email-already-in-use"
      ? "Dieser Benutzername ist bereits vergeben."
      : "Konto konnte nicht erstellt werden: " + error.code);
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
      auth, usernameToEmail(name), password
    );
  } catch (error) {
    console.error(error);
    message("Anmeldung fehlgeschlagen. Prüfe Name und Passwort.");
  } finally {
    busy = false;
  }
});

// Spielstand laden und Konto anzeigen
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

    if (!snapshot.exists()) {
      throw new Error("Spielstand fehlt in Firestore.");
    }

    const data = snapshot.data();
    username = data.username;
    tokens = Number.isFinite(data.tokens) ? data.tokens : 0;
    power = Number.isFinite(data.power) ? data.power : 1;

    update();
    $("playerName").textContent = username;
    $("authPanel").hidden = true;
    $("gamePanel").hidden = false;
    $("saveStatus").textContent = "☁️ Spielstand geladen!";
    ready = true;
  } catch (error) {
    console.error(error);
    $("saveStatus").textContent =
      "Laden fehlgeschlagen. Prüfe Firestore-Regeln und Datenbank.";
  }
});

// Speichern nacheinander ausführen, damit schnelle Klicks
// nicht versehentlich ältere Werte zuletzt speichern.
function saveGame() {
  if (!auth.currentUser || !ready) return Promise.resolve();

  const user = auth.currentUser;
  const data = { username, tokens, power };

  $("saveStatus").textContent = "Speichert …";

  saveQueue = saveQueue.then(() =>
    setDoc(doc(db, "users", user.uid), data, { merge: true })
  ).then(() => {
    if (auth.currentUser?.uid === user.uid) {
      $("saveStatus").textContent = "☁️ Spielstand gespeichert!";
    }
  }).catch(error => {
    console.error(error);
    $("saveStatus").textContent = "Speichern fehlgeschlagen!";
  });

  return saveQueue;
}

// Klick-Button
$("clickButton").addEventListener("click", () => {
  if (!ready || !auth.currentUser) return;

  tokens += power;
  update();
  saveGame();
});

// Menü
document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});



function showSection(section) {
  if (section === "shop") {
    $("content").innerHTML = `
      <h2>Shop 🛒</h2>
      <p>Upgrade kostet <span id="upgradeCost">${upgradeCost}</span> Tokens.</p>
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
        alert("Du brauchst mindestens " + upgradeCost + " Tokens!");
      }
    });

  } else if (section === "pets") {
    $("content").innerHTML =
      "<h2>🐱 Pets</h2><p>Kommt bald!</p>";

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
