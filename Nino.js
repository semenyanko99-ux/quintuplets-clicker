
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";

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
  const element = $("authMessage");
  if (element) element.textContent = text;
}

function update() {
  if ($("tokens")) $("tokens").textContent = tokens;
  if ($("power")) {
    $("power").textContent = Number(
      (power * petMultiplier).toFixed(2)
    );
  }
}

function usernameToEmail(name) {
  return name.toLowerCase() + "@quintupletsclicker.example.com";
}

function validUsername(name) {
  return /^[A-Za-z0-9_]{3,16}$/.test(name);
}

function defaultPlayerData(name) {
  return {
    username: name || "Spieler",
    tokens: 0,
    power: 1,
    upgradeCost: 10,
    petMultiplier: 1,
    petRarity: "Kein Pet"
  };
}

// REGISTRIEREN
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

    await setDoc(
      doc(db, "users", credential.user.uid),
      defaultPlayerData(name)
    );

    message("Konto erstellt!");

  } catch (error) {
    console.error("Registrierungsfehler:", error);

    if (error.code === "auth/email-already-in-use") {
      message("Dieser Benutzername ist bereits vergeben.");
    } else if (error.code === "auth/operation-not-allowed") {
      message("Aktiviere E-Mail/Passwort in Firebase Authentication.");
    } else {
      message("Konto konnte nicht erstellt werden: " + error.code);
    }

  } finally {
    busy = false;
    $("registerButton").disabled = false;
  }
});

// ANMELDEN
$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;

  const name = $("username").value.trim();
  const password = $("password").value;

  if (!validUsername(name)) {
    message("Bitte gib einen gültigen Benutzernamen ein.");
    return;
  }

  if (!password) {
    message("Bitte gib dein Passwort ein.");
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

    message("Anmeldung erfolgreich!");

  } catch (error) {
    console.error("Anmeldefehler:", error);

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      message("Benutzername oder Passwort ist falsch.");
    } else if (error.code === "auth/operation-not-allowed") {
      message("E-Mail/Passwort-Anmeldung ist in Firebase nicht aktiviert.");
    } else {
      message("Anmeldung fehlgeschlagen: " + error.code);
    }

  } finally {
    busy = false;
  }
});

// SPIELSTAND LADEN
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
    let snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      await setDoc(
        ref,
        defaultPlayerData(
          user.displayName ||
          (user.email ? user.email.split("@")[0] : "Spieler")
        )
      );

      snapshot = await getDoc(ref);
    }

    const data = snapshot.data();

    username = data.username || "Spieler";
    tokens = Number.isFinite(data.tokens) ? data.tokens : 0;
    power = Number.isFinite(data.power) ? data.power : 1;
    upgradeCost = Number.isFinite(data.upgradeCost)
      ? data.upgradeCost : 10;
    petMultiplier = Number.isFinite(data.petMultiplier)
      ? data.petMultiplier : 1;
    petRarity = data.petRarity || "Kein Pet";

    update();

    $("playerName").textContent = username;
    $("authPanel").hidden = true;
    $("gamePanel").hidden = false;
    $("saveStatus").textContent = "☁️ Spielstand geladen!";

    ready = true;

  } catch (error) {
    console.error("Ladefehler:", error);
    $("saveStatus").textContent =
      "❌ Laden fehlgeschlagen: " + error.code;
  }
});

// SPIELSTAND SPEICHERN – nur einmal definiert
{
  if (!auth.currentUser || !ready) {
    return Promise.resolve(false);
  }

  const user = auth.currentUser;

  if ($("saveStatus")) {
    $("saveStatus").textContent = "Speichert …";
  }

  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      if (auth.currentUser?.uid !== user.uid) return false;

      // Aktuelle Werte erst beim tatsächlichen Speichern lesen.
      const data = {
        username,
        tokens,
        power,
        upgradeCost,
        petMultiplier,
        petRarity
      };

      await setDoc(
        doc(db, "users", user.uid),
        data,
        { merge: true }
      );

      if (auth.currentUser?.uid === user.uid && $("saveStatus")) {
        $("saveStatus").textContent = "☁️ Spielstand gespeichert!";
      }

      return true;

    })
    .catch(error => {
      console.error("Speicherfehler:", error);

      if ($("saveStatus")) {
        $("saveStatus").textContent =
          "❌ Speichern fehlgeschlagen: " +
          (error.code || error.message);
      }

      return false;
    });

  return saveQueue;
}

// KLICK-BUTTON
$("clickButton").addEventListener("click", () => {
  if (!ready || !auth.currentUser) return;

  tokens = Number(
    (tokens + power * petMultiplier).toFixed(2)
  );

  update();
  saveGame();
});

// MENÜ-BUTTONS
document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});

// SHOP UND PETS
function showSection(section) {
  const content = $("content");
  if (!content) return;

  if (section === "shop") {
    content.innerHTML = `
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
        power += 1;
        upgradeCost = Math.floor(upgradeCost * 2);

        update();
        saveGame();
        showSection("shop");

      } else {
        alert("Du brauchst mindestens " + upgradeCost + " Tokens!");
      }
    });

  } else if (section === "pets") {
    content.innerHTML = `
      <h2>🎰 Pet Roulette</h2>

      <p>Dein aktuelles Pet:
        <strong id="currentPet">${petRarity}</strong>
      </p>

      <p>Dein Pet-Multiplikator:
        ×<span id="currentMultiplier">${petMultiplier}</span>
      </p>

      <div id="rouletteResult" style="
        margin:20px 0;
        padding:20px;
        background:#20243a;
        color:white;
        border-radius:12px;
        text-align:center;
        font-size:22px;
      ">🐣 Bereit?</div>

      <button id="spinRoulette">🎰 Roulette drehen</button>

      <h3>Seltenheiten</h3>
      <p>🔵 Gojo: 50 % — ×1,2</p>
      <p>🟣 Marin: 20 % — ×2</p>
      <p>🟡 Alya: 15 % — ×4</p>
      <p>🔴 Futaro: 7 % — ×6</p>
      <p>Die übrigen 8 %: kein Gewinn.</p>
    `;

    $("spinRoulette").addEventListener("click", () => {
      if (!ready || !auth.currentUser) return;

      const result = Math.random() * 100;
      let rarity;
      let multiplier;

      if (result < 50) {
        rarity = "🔵 Gojo";
        multiplier = 1.2;
      } else if (result < 70) {
        rarity = "🟣 Marin";
        multiplier = 2;
      } else if (result < 85) {
        rarity = "🟡 Alya";
        multiplier = 4;
      } else if (result < 92) {
        rarity = "🔴 Futaro";
        multiplier = 6;
      } else {
        $("rouletteResult").textContent =
          "😢 Kein Pet diesmal! Versuch es erneut.";
        return;
      }

      petRarity = rarity;
      petMultiplier = multiplier;

      $("rouletteResult").innerHTML = `
        🎉 Neues Pet gewonnen!<br><br>
        ${rarity}<br>
        Multiplikator: ×${multiplier}
      `;

      $("currentPet").textContent = petRarity;
      $("currentMultiplier").textContent = petMultiplier;

      update();
      saveGame();
    });

  } else if (section === "skins") {
    content.innerHTML =
      "<h2>🎨 Skins</h2><p>Kommt bald!</p>";

  } else if (section === "quests") {
    content.innerHTML =
      "<h2>📜 Quests</h2><p>Kommt bald!</p>";
  }
}

// ABMELDEN
$("logoutButton").addEventListener("click", async () => {
  await saveGame();
  await signOut(auth);
});
