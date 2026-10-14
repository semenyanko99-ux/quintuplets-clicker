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
// GAME VARIABLES (BALANCED)
// ========================================

// Lower base power so progression is slower
let tokens = 0;
let power = 0.1; // each click gives 0.1 tokens initially
let upgradeCost = 10;
let petMultiplier = 1;
let petRarity = "No Pet";
let username = "";
let rebirths = 0;
let rebirthPowerBonus = 1;

let ownedSkins = [];
let equippedSkin = null;

const SKINS = [
  {
    id: "skin1",
    name: "Black Hole",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0002.jpeg"
  },
  {
    id: "skin2",
    name: "Russian Meme",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0293.jpeg"
  },
  {
    id: "skin3",
    name: "Idk random screenshot",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0010.png"
  },
  {
    id: "skin4",
    name: "Quintulets",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0013.jpeg"
  },
  {
    id: "skin5",
    name: "Miku Nakano",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0041.jpeg"
  },
  {
    id: "skin6",
    name: "Eatsuki Nakano",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0043.jpeg"
  },
  {
    id: "skin7",
    name: "Nino Nakano",
    price: 100000,
    image: "https://raw.githubusercontent.com/semenyanko99-ux/quintuplets-clicker/main/IMG_0044.jpeg"
  },
  {
    id: "skin8",
    name: "Yotsuba Nakano",
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
const REBIRTH_BASE_COST = 100000;
const REBIRTH_BONUS_PER_REBIRTH = 0.5;

// ========================================
// HELPER FUNCTIONS
// ========================================

function message(text) {
  const element = $("authMessage");
  if (element) element.textContent = text;
}

function getRebirthCost() {
  return Math.floor(REBIRTH_BASE_COST * Math.pow(2.5, rebirths));
}

function getEffectivePower() {
  return power * petMultiplier * rebirthPowerBonus;
}

function update() {
  if ($("tokens")) {
    $("tokens").textContent = Math.floor(tokens);
  }

  if ($("power")) {
    $("power").textContent = Number(
      (getEffectivePower()).toFixed(2)
    );
  }

  if ($("rebirthCount")) {
    $("rebirthCount").textContent = rebirths;
  }

  if ($("rebirthBonusValue")) {
    $("rebirthBonusValue").textContent = Number(
      rebirthPowerBonus.toFixed(2)
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
    username: name || "Player",
    tokens: 0,
    power: 0.1,
    upgradeCost: 10,
    petMultiplier: 1,
    petRarity: "No Pet",
    ownedSkins: [],
    equippedSkin: null,
    quest: null,
    rebirths: 0,
    rebirthPowerBonus: 1
  };
}

function resetPetState() {
  petRarity = "No Pet";
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
    buttonImage.alt = "Default image";
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
      <span>Price: ${skin.price}</span>
    `;

    const action = document.createElement("button");
    const hasSkin = ownedSkins.includes(skin.id);
    const isEquipped = equippedSkin === skin.id;

    if (!hasSkin) {
      action.textContent = "Buy";
      action.addEventListener("click", async () => {
        if (!ready || !auth.currentUser) return;

        if (tokens < skin.price) {
          alert("You need " + skin.price + " Tokens!");
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
      action.textContent = "Equipped";
      action.disabled = true;
    } else {
      action.textContent = "Equip";
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

  listEl.innerHTML = "<li>Loading...</li>";

  try {
    const q = query(
      collection(db, "public_profiles"),
      orderBy("tokens", "desc"),
      limit(10)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listEl.innerHTML = "<li>No quests</li>";
      return;
    }

    listEl.innerHTML = snapshot.docs
      .map((docSnap, index) => {
        const data = docSnap.data();
        const usernameValue = escapeHtml(data.username || "Player");
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
    console.error("Leaderboard load error:", error);
    listEl.innerHTML = "<li>Load error</li>";

    if (error?.code) {
      const err = document.createElement("li");
      err.style.fontSize = "12px";
      err.style.opacity = "0.8";
      err.textContent = "Error: " + error.code;
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
// REGISTER
// ========================================

if ($("registerButton")) {
  $("registerButton").addEventListener("click", async () => {
    if (busy) return;

    const name = $("username")?.value.trim() || "";
    const password = $("password")?.value || "";

    if (!validUsername(name)) {
      message(
        "Nickname: 3–16 letters, numbers, or _."
      );
      return;
    }

    if (password.length < 6) {
      message("The password must be at least 6 characters long.");
      return;
    }

    busy = true;
    $("registerButton").disabled = true;
    message("Creating account…");

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

      message("Account created!");

    } catch (error) {
      console.error("Registration error:", error);

      if (error.code === "auth/email-already-in-use") {
        message("There is already a user with this nickname.");
      } else if (
        error.code === "auth/operation-not-allowed"
      ) {
        message(
          "Enable email/password sign-in in Firebase Authentication."
        );
      } else {
        message(
          "Account could not be created: " + error.code
        );
      }

    } finally {
      busy = false;
      $("registerButton").disabled = false;
    }
  });
}

// ========================================
// SIGN IN
// ========================================

if ($("authForm")) {
  $("authForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (busy) return;

    const name = $("username")?.value.trim() || "";
    const password = $("password")?.value || "";

    if (!validUsername(name)) {
      message("Please enter a valid username.");
      return;
    }

    if (!password) {
      message("Please enter your password.");
      return;
    }

    busy = true;
    message("Signing in...");

    try {
      await signInWithEmailAndPassword(
        auth,
        usernameToEmail(name),
        password
      );

      message("Login successful!");

    } catch (error) {
      console.error("Login error:", error);

      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        message("Nickname or password is incorrect.");
      } else if (
        error.code === "auth/operation-not-allowed"
      ) {
        message(
          "Email/password sign-in is not enabled in Firebase."
        );
      } else {
        message(
          "Login error: " + error.code
        );
      }

    } finally {
      busy = false;
    }
  });
}

// ========================================
// LOAD GAME STATE
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
    $("saveStatus").textContent = "Loading…";
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
            : "Player"
        )
      );

      snapshot = await getDoc(ref);
    }

    const data = snapshot.data();

    username = data.username || "Player";
    tokens = Number.isFinite(data.tokens) ? data.tokens : 0;
    power = Number.isFinite(data.power) ? data.power : 0.1;

    upgradeCost = Number.isFinite(data.upgradeCost)
      ? data.upgradeCost
      : 10;

    petMultiplier = Number.isFinite(data.petMultiplier)
      ? data.petMultiplier
      : 1;

    petRarity = data.petRarity || "No Pet";
    ownedSkins = Array.isArray(data.ownedSkins) ? data.ownedSkins : [];
    equippedSkin = data.equippedSkin || null;
    rebirths = Number.isFinite(data.rebirths) ? data.rebirths : 0;
    rebirthPowerBonus = Number.isFinite(data.rebirthPowerBonus)
      ? data.rebirthPowerBonus
      : 1 + rebirths * REBIRTH_BONUS_PER_REBIRTH;

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
      $("saveStatus").textContent = "Loaded!";
    }

    ensureQuestActive();
    await renderLeaderboard();
    ready = true;

  } catch (error) {
    console.error("Load error:", error);

    if ($("saveStatus")) {
      $("saveStatus").textContent =
        "Loading error: " + (error?.code || error?.message || "?s");
    }
  }
});

// ========================================
// SAVE GAME STATE
// This function may exist only once!
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
        rebirths,
        rebirthPowerBonus,
        savedAt: Date.now()
      })
    );
  } catch (error) {
    console.warn("Local save failed:", error);
  }

  if ($("saveStatus")) {
    $("saveStatus").textContent = "Saving…";
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
        quest,
        rebirths,
        rebirthPowerBonus
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
          "Saved!";
      }

      return true;
    })
    .catch(error => {
      console.error("Save failed:", error);

      if ($("saveStatus")) {
        $("saveStatus").textContent =
          "Save Error: " +
          (error.code || error.message);
      }

      return false;
    });

  return saveQueue;
}

// ========================================
// REBIRTH
// ========================================

function performRebirth() {
  if (!ready || !auth.currentUser) return;

  const cost = getRebirthCost();

  if (tokens < cost) {
    alert(`You need at least ${cost.toLocaleString()} Tokens for a Rebirth.`);
    return;
  }

  tokens = 0;
  power = 0.1;
  upgradeCost = 10;
  petMultiplier = 1;
  petRarity = "No Pet";
  ownedSkins = [];
  equippedSkin = null;
  quest = null;
  rebirths += 1;
  rebirthPowerBonus = 1 + rebirths * REBIRTH_BONUS_PER_REBIRTH;

  resetPetState();
  applySkin(null);

  if (questTimer) clearTimeout(questTimer);
  if (questRefreshInterval) clearInterval(questRefreshInterval);
  questRefreshInterval = null;

  if ($("questStatus")) {
    $("questStatus").textContent = "Rebirth successful! A new quest starts on the next load.";
  }

  update();
  savePlayerGame();
  showSection("shop");
}

// ========================================
// CLICK BUTTON
// ========================================

if ($("clickButton")) {
  $("clickButton").addEventListener("click", () => {
    if (!ready || !auth.currentUser) return;

    tokens = Number(
      (tokens + getEffectivePower()).toFixed(2)
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
          status.textContent = `Quest complete! +15% Click Multiplier`;
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
// MENU BUTTONS
// ========================================

document.querySelectorAll("[data-section]").forEach(button => {
  button.addEventListener("click", () => {
    showSection(button.dataset.section);
  });
});

// ========================================
// SHOP, PETS, SKINS, AND QUESTS
// ========================================

function showSection(section) {
  const content = $("content");
  if (!content) return;

  if (section === "shop") {
    const rebirthCost = getRebirthCost();

    content.innerHTML = `
      <h2>Shop 🛒</h2>
      <p>
        Upgrade cost
        <strong>${upgradeCost}</strong> Tokens.
      </p>
      <p>Your click power: ${(getEffectivePower()).toFixed(2)}</p>
      <p>Rebirths: <strong id="rebirthCount">${rebirths}</strong></p>
      <p>Rebirth bonus: ×<strong id="rebirthBonusValue">${rebirthPowerBonus.toFixed(2)}</strong></p>
      <p id="rebirthInfo">Next Rebirth: ${rebirthCost.toLocaleString()} Tokens</p>
      <button id="buyUpgrade">Buy Upgrade</button>
      <button id="doRebirth" style="margin-left:8px;">Rebirth</button>
      <button id="openSkins" style="margin-left:8px;">Skins</button>
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
          upgradeCost = Math.max(Math.floor(upgradeCost * 1.5), upgradeCost + 1);

          update();
          savePlayerGame();
          showSection("shop");
        } else {
          alert(
            "You need at least " + upgradeCost + " Tokens!"
          );
        }
      });
    }

    const rebirthBtn = $("doRebirth");
    if (rebirthBtn) {
      rebirthBtn.addEventListener("click", performRebirth);
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
      <h2>🎰 Pet Roulette</h2>

      <p>Your Pet:
        <strong id="currentPet">${petRarity}</strong>
      </p>

      <p>Your pet multiplier:
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
      ">🐣 Ready?</div>

      <button id="spinRoulette">
        🎰 Roll!
      </button>

      <h3>Rarities</h3>
      <p>🔵 Gojo: 50% — ×1.2</p>
      <p>🟣 Marin: 20% — ×2</p>
      <p>🟡 Alya: 15% — ×4</p>
      <p>🔴 Futaro: 7% — ×6</p>
      <p>😢 No Pet: 8%</p>
    `;

    $("spinRoulette").addEventListener("click", () => {
      if (!ready || !auth.currentUser) return;

      // make pets rarer by increasing cost
      const petSpinCost = 5000;

      if (tokens < petSpinCost) {
        alert("You need at least 5k tokens to roll");
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
          "😢 No Pet this time, roll again.";

        update();
        savePlayerGame();
        return;
      }

      petRarity = rarity;
      petMultiplier = multiplier;

      $("rouletteResult").innerHTML = `
        🎉 New Pet!<br><br>
        ${rarity}<br>
        Multiplier: ×${multiplier}
      `;

      $("currentPet").textContent = petRarity;
      $("currentMultiplier").textContent = petMultiplier;

      update();
      savePlayerGame();
    });

  } else if (section === "skins") {
    content.innerHTML = `
      <h2>🎨 Skins</h2>
      <p>Every skin costs <strong>100000</strong> Tokens.</p>
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
      <p>Goal: <strong>${currentTarget.toLocaleString()}</strong> clicks</p>
      <p>Progress: <strong id="questProgress">${currentProgress.toLocaleString()}</strong> / <strong>${currentTarget.toLocaleString()}</strong></p>
      <p>Time: <strong id="questTime">${formatQuestTime(remaining)}</strong></p>
      <p id="questStatus" style="margin-top: 12px; font-size: 13px; opacity: 0.9;">Quest in progress…</p>
      <p style="margin-top: 12px; font-size: 12px; opacity: 0.8;">Quests reset every 2 hours.</p>
    `;

    const questStatus = $("questStatus");
    if (questStatus && quest) {
      if (quest.completed) {
        const rem = Math.max(0, quest.expiresAt - Date.now());
        questStatus.textContent = `Quest completed. Next quest in ${formatQuestTime(rem)}.`;
      } else {
        questStatus.textContent = "Quest in progress…";
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
// LOG OUT
// ========================================

if ($("logoutButton")) {
  $("logoutButton").addEventListener("click", async () => {
    try {
      await savePlayerGame();
      await signOut(auth);
      message("Logged out.");
    } catch (error) {
      console.error("Logout error:", error);

      if ($("saveStatus")) {
        $("saveStatus").textContent =
          "Logout error: " + error.code;
      }
    }
  });
}
