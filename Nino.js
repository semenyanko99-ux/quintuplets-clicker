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
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// ========================================
// FIREBASE
// ========================================

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

// ========================================
// SPIELVARIABLEN (BALANCED)
// ========================================

// Lower base power so progression is slower
let tokens = 0;
let power = 0.1; // each click gives 0.1 tokens initially
let upgradeCost = 10;
let petMultiplier = 1;
let petRarity = "Kein Pet";
let username = "";

let ownedSkins = [];
let equippedSkin = null;

const SKINS = [
  {
    id: "skin1",
    name: "Skin 1",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0002.jpeg"
  },
  {
    id: "skin2",
    name: "Skin 2",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0293.jpeg"
  },
  {
    id: "skin3",
    name: "Skin 3",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0010.png"
  },
  {
    id: "skin4",
    name: "Skin 4",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0013.jpeg"
  },
  {
    id: "skin5",
    name: "Skin 5",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0041.jpeg"
  },
  {
    id: "skin6",
    name: "Skin 6",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0043.jpeg"
  },
  {
    id: "skin7",
    name: "Skin 7",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0044.jpeg"
  },
  {
    id: "skin8",
    name: "Skin 8",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0042.jpeg"
  }
];

let ready = false;
let busy = false;
let saveQueue = Promise.resolve();
let leaderboardRefreshTimer = null;
let quest = null;
let questTimer = null;
let questRefreshInterval = null;
let saveTimer = null;
let lastPublicProfileSaveAt = 0;
let lastPublicProfileTokens = 0;

const SAVE_DEBOUNCE_MS = 2000;
const PUBLIC_PROFILE_SAVE_INTERVAL_MS = 5 * 60 * 1000;
const PUBLIC_PROFILE_TOKEN_THRESHOLD = 100;

// ========================================
// HILFSFUNKTIONEN
// ========================================

function message(text) {
  const element = $("authMessage");
  if (element) element.textContent = text;
}

function update() {
  if ($("tokens")) {
    $("tokens").textContent = Math.floor(tokens);
  }

  if ($("power")) {
    $("power").textContent = Number(
      (power * petMultiplier).toFixed(2)
    );
  }
}

function usernameToEmail(name) {
  return name.toLowerCase() +
    "@quintupletsclicker.example.com";
}

function validUsername(name) {
  return /^[A-Za-z0-9_]{3,16}$/.test(name);
}

function defaultPlayerData(name) {
  return {
    username: name || "Spieler",
    tokens: 0,
    power: 0.1,
    upgradeCost: 10,
    petMultiplier: 1,
    petRarity: "Kein Pet",
    ownedSkins: [],
    equippedSkin: null,
    quest: null
  };
}

function resetPetState() {
  petRarity = "Kein Pet";
  petMultiplier = 1;

  if ($("currentPet")) {
    $("currentPet").textContent = petRarity;
  }

  if ($("currentMultiplier")) {
    $("currentMultiplier").textContent = petMultiplier;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applySkin(skinId) {
  const clickButton = $("clickButton");
  const buttonImage = $("buttonImage");
  if (!clickButton || !buttonImage) return;

  const selectedSkin = SKINS.find(skin => skin.id === skinId);

  if (!selectedSkin) {
    buttonImage.src = "Volume_7_clean_cover_art.webp";
    buttonImage.alt = "Standard Bild";
    clickButton.style.border = "5px solid #ff80bd";
    clickButton.style.backgroundImage = "IMG_0013.jpeg";
    clickButton.style.backgroundSize = "";
    clickButton.style.backgroundPosition = "";
    clickButton.style.backgroundRepeat = "";
    clickButton.style.backgroundColor = "";
    return;
  }

  buttonImage.src = selectedSkin.image;
  buttonImage.alt = selectedSkin.name;
  clickButton.style.border = "2px solid #ffd700";
  clickButton.style.backgroundImage = "IMG_0293.jpeg";
  clickButton.style.backgroundSize = "";
  clickButton.style.backgroundPosition = "";
  clickButton.style.backgroundRepeat = "";
  clickButton.style.backgroundColor = "";
}

function renderSkinsUI(container) {
  if (!container) return;

  container.innerHTML = "";

  SKINS.forEach(skin => {
    const item = document.createElement("div");
    item.style.margin = "10px 0";
    item.style.padding = "10px";
    item.style.border = "1px solid #444";
    item.style.borderRadius = "12px";
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.gap = "12px";
    item.style.background = "rgba(255,255,255,0.04)";

    const imageWrap = document.createElement("div");
    imageWrap.style.width = "80px";
    imageWrap.style.height = "80px";
    imageWrap.style.borderRadius = "10px";
    imageWrap.style.overflow = "hidden";
    imageWrap.style.background = "#111";

    const img = document.createElement("img");
    img.src = skin.image;
    img.alt = skin.name;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";

    imageWrap.appendChild(img);

    const info = document.createElement("div");
    info.style.flex = "1";
    info.innerHTML = `
      <strong>${skin.name}</strong><br>
      <span>Preis: ${skin.price}</span>
    `;

    const action = document.createElement("button");
    const hasSkin = ownedSkins.includes(skin.id);
    const isEquipped = equippedSkin === skin.id;

    if (!hasSkin) {
      action.textContent = "Kaufen";
      action.addEventListener("click", async () => {
        if (!ready || !auth.currentUser) return;

        if (tokens < skin.price) {
          alert("Du brauchst mindestens " + skin.price + " Tokens!");
          return;
        }

        tokens -= skin.price;
        ownedSkins.push(skin.id);
        equippedSkin = skin.id;
        applySkin(equippedSkin);
        update();
        await savePlayerGame();
        renderSkinsUI(container);
      });
    } else if (isEquipped) {
      action.textContent = "Ausgerüstet";
      action.disabled = true;
    } else {
      action.textContent = "Anlegen";
      action.addEventListener("click", async () => {
        if (!ready || !auth.currentUser) return;

        equippedSkin = skin.id;
        applySkin(equippedSkin);
        await savePlayerGame();
        renderSkinsUI(container);
      });
    }

    item.appendChild(imageWrap);
    item.appendChild(info);
    item.appendChild(action);
    container.appendChild(item);
  });
}

async function renderLeaderboard() {
  const listEl = $("leaderboardList");
  if (!listEl) return;

  listEl.innerHTML = "<li>Lädt...</li>";

  try {
    const q = query(
      collection(db, "public_profiles"),
      orderBy("tokens", "desc"),
      limit(10)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listEl.innerHTML = "<li>Keine Einträge</li>";
      return;
    }

    listEl.innerHTML = snapshot.docs
      .map((docSnap, index) => {
        const data = docSnap.data();
        const usernameValue = escapeHtml(data.username || "Spieler");
        const scoreValue = Number.isFinite(data.tokens)
          ? Math.floor(data.tokens)
          : 0;

        return `
          <li>
            <span class="rank">${index + 1}.</span>
            <span class="name">${usernameValue}</span>
            <span class="score">${scoreValue}</span>
          </li>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Leaderboard laden fehlgeschlagen:", error);
    listEl.innerHTML = "<li>Fehler beim Laden</li>";

    if (error?.code) {
      const err = document.createElement("li");
      err.style.fontSize = "12px";
      err.style.opacity = "0.8";
      err.textContent = "Fehler: " + error.code;
      listEl.appendChild(err);
    }
  }
}

function scheduleLeaderboardRefresh() {
  if (leaderboardRefreshTimer) {
    clearTimeout(leaderboardRefreshTimer);
  }

  leaderboardRefreshTimer = setTimeout(async () => {
    try {
      await renderLeaderboard();
    } catch (error) {
      console.error("Leaderboard refresh failed:", error);
    }
  }, 5000);
}

function randomQuestTarget() {
  // return a random target between 10,000 and 100,000 clicks
  const min = 10000;
  const max = 100000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatQuestTime(ms) {
  if (!ms || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function startNewQuest(autoSave = true) {
  quest = {
    target: randomQuestTarget(),
    progress: 0,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    completed: false
  };

  if (questTimer) {
    clearTimeout(questTimer);
  }

  questTimer = setTimeout(() => {
    startNewQuest(true);
    const content = $("content");
    if (content && content.innerHTML.includes("Quest")) {
      showSection("quests");
    }
  }, 2 * 60 * 60 * 1000);

  if (autoSave) {
    savePlayerGame();
  }
}

function ensureQuestActive() {
  // If no quest or target missing/invalid, start new one
  if (!quest || !Number.isFinite(quest.target) || quest.expiresAt <= Date.now()) {
    startNewQuest(true);
    return;
  }

  if (questTimer) {
    clearTimeout(questTimer);
  }

  const remaining = Math.max(0, quest.expiresAt - Date.now());
  questTimer = setTimeout(() => {
    startNewQuest(true);
    const content = $("content");
    if (content && content.innerHTML.includes("Quest")) {
      showSection("quests");
    }
  }, remaining);
}

function scheduleSave(immediate = false) {
  if (immediate) {
    return savePlayerGame();
  }

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    savePlayerGame();
  }, SAVE_DEBOUNCE_MS);
}

// ========================================
// REGISTRIEREN
// ========================================

if ($("registerButton")) {
  $("registerButton").addEventListener("click", async () => {
    if (busy) return;

    const name = $("username")?.value.trim() || "";
    const password = $("password")?.value || "";

    if (!validUsername(name)) {
      message(
        "Benutzername: 3–16 Buchstaben, Zahlen oder _."
      );
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
      } else if (
        error.code === "auth/operation-not-allowed"
      ) {
        message(
          "Aktiviere E-Mail/Passwort in Firebase Authentication."
        );
      } else {
        message(
          "Konto konnte nicht erstellt werden: " + error.code
        );
      }

    } finally {
      busy = false;
      $("registerButton").disabled = false;
    }
  });
}

// ========================================
// ANMELDEN
// ========================================

if ($("authForm")) {
  $("authForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (busy) return;

    const name = $("username")?.value.trim() || "";
    const password = $("password")?.value || "";

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
      } else if (
        error.code === "auth/operation-not-allowed"
      ) {
        message(
          "E-Mail/Passwort-Anmeldung ist in Firebase nicht aktiviert."
        );
      } else {
        message(
          "Anmeldung fehlgeschlagen: " + error.code
        );
      }

    } finally {
      busy = false;
    }
  });
}

// ========================================
// SPIELSTAND LADEN
// ========================================

onAuthStateChanged(auth, async user => {
  ready = false;

  if (!user) {
    if ($("authPanel")) $("authPanel").hidden = false;
    if ($("gamePanel")) $("gamePanel").hidden = true;

    username = "";
    resetPetState();
    ownedSkins = [];
    equippedSkin = null;
    applySkin(null);
    quest = null;
    if (questTimer) clearTimeout(questTimer);
    if (questRefreshInterval) clearInterval(questRefreshInterval);
    questRefreshInterval = null;
    return;
  }

  if ($("saveStatus")) {
    $("saveStatus").textContent = "Spielstand wird geladen …";
  }

  try {
    const ref = doc(db, "users", user.uid);
    let snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      await setDoc(
        ref,
        defaultPlayerData(
          user.email
            ? user.email.split("@")[0]
            : "Spieler"
        )
      );

      snapshot = await getDoc(ref);
    }

    const data = snapshot.data();

    username = data.username || "Spieler";
    tokens = Number.isFinite(data.tokens) ? data.tokens : 0;
    power = Number.isFinite(data.power) ? data.power : 0.1;

    upgradeCost = Number.isFinite(data.upgradeCost)
      ? data.upgradeCost
      : 10;

    petMultiplier = Number.isFinite(data.petMultiplier)
      ? data.petMultiplier
      : 1;

    petRarity = data.petRarity || "Kein Pet";
    ownedSkins = Array.isArray(data.ownedSkins) ? data.ownedSkins : [];
    equippedSkin = data.equippedSkin || null;

    if (data.quest) {
      quest = {
        target: Number.isFinite(data.quest.target) ? data.quest.target : randomQuestTarget(),
        progress: Number.isFinite(data.quest.progress) ? data.quest.progress : 0,
        expiresAt: Number.isFinite(data.quest.expiresAt) ? data.quest.expiresAt : Date.now() + 2 * 60 * 60 * 1000,
        completed: !!data.quest.completed,
        completedAt: Number.isFinite(data.quest.completedAt) ? data.quest.completedAt : null
      };
    } else {
      quest = null;
    }

    if (equippedSkin) {
      applySkin(equippedSkin);
    } else {
      applySkin(null);
    }

    update();

    if ($("playerName")) {
      $("playerName").textContent = username;
    }

    if ($("authPanel")) $("authPanel").hidden = true;
    if ($("gamePanel")) $("gamePanel").hidden = false;

    if ($("saveStatus")) {
      $("saveStatus").textContent = "☁️ Spielstand geladen!";
    }

    ensureQuestActive();
    await renderLeaderboard();
    ready = true;

  } catch (error) {
    console.error("Ladefehler:", error);

    if ($("saveStatus")) {
      $("saveStatus").textContent =
        "❌ Laden fehlgeschlagen: " + (error?.code || error?.message || "Unbekannt");
    }
  }
});

// ========================================
// SPIELSTAND SPEICHERN
// Diese Funktion darf nur einmal existieren!
// ========================================

function savePlayerGame() {
  if (!auth.currentUser || !ready) {
    return Promise.resolve(false);
  }

  const user = auth.currentUser;

  try {
    localStorage.setItem(
      "qc_local_save_" + user.uid,
      JSON.stringify({
        username,
        tokens,
        power,
        upgradeCost,
        petMultiplier,
        petRarity,
        ownedSkins,
        equippedSkin,
        quest,
        savedAt: Date.now()
      })
    );
  } catch (error) {
    console.warn("Local save failed:", error);
  }

  if ($("saveStatus")) {
    $("saveStatus").textContent = "Speichert …";
  }

  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      if (auth.currentUser?.uid !== user.uid) {
        return false;
      }

      const data = {
        username,
        tokens,
        power,
        upgradeCost,
        petMultiplier,
        petRarity,
        ownedSkins,
        equippedSkin,
        quest
      };

      await setDoc(
        doc(db, "users", user.uid),
        data,
        { merge: true }
      );

      const now = Date.now();
      const tokenDiff = Math.abs((tokens || 0) - (lastPublicProfileTokens || 0));
      const timeSinceLastPublicSave = now - (lastPublicProfileSaveAt || 0);

      if (
        lastPublicProfileSaveAt === 0 ||
        timeSinceLastPublicSave >= PUBLIC_PROFILE_SAVE_INTERVAL_MS ||
        tokenDiff >= PUBLIC_PROFILE_TOKEN_THRESHOLD
      ) {
        await setDoc(
          doc(db, "public_profiles", user.uid),
          {
            username,
            tokens
          },
          { merge: true }
        );

        lastPublicProfileSaveAt = now;
        lastPublicProfileTokens = tokens;
      }

      scheduleLeaderboardRefresh();

      if (
        auth.currentUser?.uid === user.uid &&
        $("saveStatus")
      ) {
        $("saveStatus").textContent =
          "☁️ Spielstand gespeichert!";
      }

      return true;
    })
    .catch(error => {
      console.error("Save failed:", error);

      if ($("saveStatus")) {
        $("saveStatus").textContent =
          "Speichern fehlgeschlagen: " +
          (error.code || error.message);
      }

      return false;
    });

  return saveQueue;
}

// ========================================
// KLICK-BUTTON
// ========================================

if ($("clickButton")) {
  $("clickButton").addEventListener("click", () => {
    if (!ready || !auth.currentUser) return;

    tokens = Number(
      (tokens + power * petMultiplier).toFixed(2)
    );

    if (quest && !quest.completed) {
      quest.progress += 1;

      if (quest.progress >= quest.target) {
        // mark completed and lock next quest for 2 hours
        quest.completed = true;
        quest.completedAt = Date.now();
        quest.expiresAt = Date.now() + 2 * 60 * 60 * 1000; // lock for 2 hours

        // Reward: small multiplicative increase to avoid instant power spikes
        power *= 1.15; // +15% power

        const status = $("questStatus");
        if (status) {
          status.textContent = `Quest abgeschlossen! +15% Klickstärke`;
        }

        // persist new state (quest + power)
        scheduleSave(true);
        // don't start a new quest immediately; ensureQuestActive will create a new one when expiresAt passes
      }
    }

    update();
    scheduleSave();
  });
}

// ========================================
// MENÜ-BUTTONS
// ========================================

document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});

// ========================================
// SHOP, PETS, SKINS UND QUESTS
// ========================================

function showSection(section) {
  const content = $("content");
  if (!content) return;

  if (section === "shop") {
    content.innerHTML = `
      <h2>Shop 🛒</h2>
      <p>
        Upgrade kostet
        <strong>${upgradeCost}</strong> Tokens.
      </p>
      <p>Deine Klickstärke: ${(power * petMultiplier).toFixed(2)}</p>
      <button id="buyUpgrade">Upgrade kaufen</button>
      <button id="openSkins" style="margin-left:8px;">Skins ansehen</button>
      <div id="shopSkinsContainer" style="margin-top:16px; display:none;"></div>
    `;

    const buyBtn = $("buyUpgrade");
    if (buyBtn) {
      buyBtn.addEventListener("click", () => {
        if (!ready || !auth.currentUser) return;

        if (tokens >= upgradeCost) {
          tokens -= upgradeCost;
          // slower, smoother progression: small multiplicative growth
          power *= 1.15; // +15% power per upgrade
          upgradeCost = Math.max( Math.floor(upgradeCost * 1.5), upgradeCost + 1 );

          update();
          savePlayerGame();
          showSection("shop");
        } else {
          alert(
            "Du brauchst mindestens " + upgradeCost + " Tokens!"
          );
        }
      });
    }

    const openSkinsBtn = $("openSkins");
    if (openSkinsBtn) {
      openSkinsBtn.addEventListener("click", () => {
        const c = $("shopSkinsContainer");
        if (!c) return;
        const show = c.style.display === "none";
        c.style.display = show ? "block" : "none";
        if (show) renderSkinsUI(c);
      });
    }

    renderSkinsUI($("shopSkinsContainer"));

  } else if (section === "pets") {
    content.innerHTML = `
      <h2>🎰 Pet-Roulette</h2>

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

      <button id="spinRoulette">
        🎰 Roulette drehen
      </button>

      <h3>Seltenheiten</h3>
      <p>🔵 Gojo: 50 % — ×1,2</p>
      <p>🟣 Marin: 20 % — ×2</p>
      <p>🟡 Alya: 15 % — ×4</p>
      <p>🔴 Futaro: 7 % — ×6</p>
      <p>😢 Kein Pet: 8 %</p>
    `;

    $("spinRoulette").addEventListener("click", () => {
      if (!ready || !auth.currentUser) return;

      // make pets rarer by increasing cost
      const petSpinCost = 5000;

      if (tokens < petSpinCost) {
        alert("Du brauchst mindestens 5000 Tokens, um das Roulette zu drehen!");
        return;
      }

      tokens -= petSpinCost;
      update();
      savePlayerGame();

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
        resetPetState();
        $("rouletteResult").textContent =
          "😢 Kein Pet diesmal! Versuch es erneut.";

        update();
        savePlayerGame();
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
      savePlayerGame();
    });

  } else if (section === "skins") {
    content.innerHTML = `
      <h2>🎨 Skins</h2>
      <p>Skins kosten jeweils <strong>100000</strong> Tokens.</p>
      <div id="skinsContainer"></div>
    `;

    renderSkinsUI($("skinsContainer"));

  } else if (section === "quests") {
    if (questRefreshInterval) {
      clearInterval(questRefreshInterval);
      questRefreshInterval = null;
    }

    ensureQuestActive();

    const currentTarget = quest ? quest.target : 0;
    const currentProgress = quest ? quest.progress : 0;
    const remaining = quest ? Math.max(0, quest.expiresAt - Date.now()) : 0;

    content.innerHTML = `
      <h2>📜 Quest</h2>
      <p>Ziel: <strong>${currentTarget.toLocaleString()}</strong> Klicks</p>
      <p>Fortschritt: <strong id="questProgress">${currentProgress.toLocaleString()}</strong> / <strong>${currentTarget.toLocaleString()}</strong></p>
      <p>Verbleibende Zeit: <strong id="questTime">${formatQuestTime(remaining)}</strong></p>
      <p id="questStatus" style="margin-top: 12px; font-size: 13px; opacity: 0.9;">Quest läuft…</p>
      <p style="margin-top: 12px; font-size: 12px; opacity: 0.8;">Die Quest wird alle 2 Stunden neu geladen.</p>
    `;

    const questStatus = $("questStatus");
    if (questStatus && quest) {
      if (quest.completed) {
        const rem = Math.max(0, quest.expiresAt - Date.now());
        questStatus.textContent = `Quest abgeschlossen. Nächste Quest in ${formatQuestTime(rem)}.`;
      } else {
        questStatus.textContent = "Quest läuft…";
      }
    }

    const refreshQuestText = () => {
      if (!quest) return;
      const progressEl = $("questProgress");
      if (progressEl) progressEl.textContent = quest.progress.toLocaleString();
      const timeEl = $("questTime");
      if (timeEl) timeEl.textContent = formatQuestTime(Math.max(0, quest.expiresAt - Date.now()));

      // If the quest was completed and the lock expired, refresh the section so a new quest appears
      if (quest.completed && quest.expiresAt <= Date.now()) {
        ensureQuestActive();
        showSection("quests");
      }
    };

    refreshQuestText();
    questRefreshInterval = setInterval(refreshQuestText, 1000);
  }
}

// ========================================
// ABMELDEN
// ========================================

if ($("logoutButton")) {
  $("logoutButton").addEventListener("click", async () => {
    try {
      await savePlayerGame();
      await signOut(auth);
      message("Du wurdest abgemeldet.");
    } catch (error) {
      console.error("Abmeldefehler:", error);

      if ($("saveStatus")) {
        $("saveStatus").textContent =
          "Abmelden fehlgeschlagen: " + error.code;
      }
    }
  });
}
