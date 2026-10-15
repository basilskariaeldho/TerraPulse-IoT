import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
  serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
  Replace every value below with the Firebase Web App configuration
  from Firebase Console > Project settings > Your apps.
  Firebase web config is not a password. Firestore Rules protect user data.
*/
const firebaseConfig = {
  apiKey: "AIzaSyB-_uEmZ7hSrilSjljXmsSg1Ta3dQ-LqC8",
  authDomain: "terrapulse-iot.firebaseapp.com",
  projectId: "terrapulse-iot",
  appId: "1:435537315036:web:109a69c0e81bf61b236019"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
let registerMode = false;
let currentUser = null;
let refreshTimers = new Map();
let chartInstances = new Map();
let alertMemory = new Map();

$("toggleAuth").addEventListener("click", () => {
  registerMode = !registerMode;
  $("authTitle").textContent = registerMode ? "Create your account" : "Sign in";
  $("authSubmit").textContent = registerMode ? "Create account" : "Sign in";
  $("toggleAuth").textContent = registerMode ? "I already have an account" : "Create an account";
  $("password").autocomplete = registerMode ? "new-password" : "current-password";
  $("authMessage").textContent = "";
});

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Please wait…";
  try {
    if (registerMode) {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      try { await sendEmailVerification(credential.user); } catch (e) { console.warn("Verification email could not be sent", e); }
      $("authMessage").textContent = "Account created. If verification email is enabled, check your inbox.";
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      $("authMessage").textContent = "";
    }
  } catch (error) {
    $("authMessage").textContent = friendlyAuthError(error.code);
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("signOut").addEventListener("click", async () => {
  stopRefreshers();
  await signOut(auth);
});

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email":"Enter a valid email address.",
    "auth/email-already-in-use":"An account already exists for this email.",
    "auth/weak-password":"Choose a stronger password (at least 6 characters).",
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/too-many-requests":"Too many attempts. Wait a while and try again."
  };
  return map[code] || "Could not complete sign-in. Check your settings and try again.";
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  $("authPanel").hidden = !!user;
  $("appPanel").hidden = !user;
  $("authStatus").textContent = user ? user.email : "Not signed in";
  if (user) await loadDevices();
  else { stopRefreshers(); $("devices").innerHTML = ""; }
});

$("deviceForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const name = $("deviceName").value.trim();
  const channelId = $("channelId").value.trim();
  const readKey = $("readKey").value.trim();
  if (!/^\d{1,20}$/.test(channelId)) {
    $("deviceMessage").textContent = "Channel ID must contain digits only.";
    return;
  }
  if (readKey && !/^[A-Za-z0-9]{8,64}$/.test(readKey)) {
    $("deviceMessage").textContent = "Check the read-only API key format.";
    return;
  }
  $("deviceMessage").textContent = "Checking channel…";
  try {
    const testUrl = makeFeedUrl(channelId, readKey, 1);
    const response = await fetch(testUrl);
    if (!response.ok) throw new Error("ThingSpeak request failed (" + response.status + ").");
    const data = await response.json();
    if (!data || !data.channel || !Array.isArray(data.feeds)) {
      throw new Error("Channel could not be read. Check the ID and Read API Key.");
    }
    await addDoc(collection(db, "users", currentUser.uid, "devices"), {
      name, channelId, readKey, createdAt: serverTimestamp()
    });
    $("deviceName").value = "";
    $("channelId").value = "";
    $("readKey").value = "";
    $("deviceMessage").textContent = "Device added.";
    await loadDevices();
  } catch (error) {
    console.error(error);
    $("deviceMessage").textContent = error.message || "Could not add device.";
  }
});

function makeFeedUrl(channelId, readKey, results = 30) {
  const url = new URL(`https://api.thingspeak.com/channels/${encodeURIComponent(channelId)}/feeds.json`);
  url.searchParams.set("results", String(results));
  if (readKey) url.searchParams.set("api_key", readKey);
  return url.toString();
}

async function loadDevices() {
  if (!currentUser) return;
  stopRefreshers();
  $("devices").innerHTML = "<div class='empty'>Loading your devices…</div>";
  try {
    const ref = query(collection(db, "users", currentUser.uid, "devices"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(ref);
    if (snapshot.empty) {
      $("devices").innerHTML = "<div class='empty'>No devices yet. Add your first ThingSpeak channel above.</div>";
      return;
    }
    $("devices").innerHTML = "";
    snapshot.forEach((item) => renderDevice(item.id, item.data()));
  } catch (error) {
    console.error(error);
    $("devices").innerHTML = "<div class='empty'>Could not load devices. Check Firestore rules and Firebase setup.</div>";
  }
}

function renderDevice(id, device) {
  const card = document.createElement("article");
  card.className = "device-card";
  card.innerHTML = `
    <div class="device-head">
      <div><h2 class="device-title"></h2><p class="muted small channel-label"></p></div>
      <span class="pill status">Checking…</span>
    </div>
    <div class="metrics">
      <div class="metric"><span>Temperature</span><strong class="temperature">—</strong><span>°C</span></div>
      <div class="metric"><span>Humidity</span><strong class="humidity">—</strong><span>% RH</span></div>
    </div>
    <p class="muted small last-update">Waiting for readings…</p>
    <div class="chart-wrap"><canvas aria-label="Temperature history chart"></canvas></div>
    <div class="device-actions">
      <button class="secondary refresh">Refresh readings</button>
      <button class="secondary export">Export CSV</button>
      <button class="delete">Remove device</button>
    </div>`;
  card.querySelector(".device-title").textContent = device.name;
  card.querySelector(".channel-label").textContent = "ThingSpeak channel " + device.channelId;
  $("devices").appendChild(card);

  const canvas = card.querySelector("canvas");
  const chart = new Chart(canvas, {
    type: "line",
    data: { labels: [], datasets: [
      { label: "Temperature °C", data: [], borderColor: "#74e0bd", backgroundColor: "#74e0bd22", fill: true, tension: .25, pointRadius: 1, yAxisID: "y" },
      { label: "Humidity %", data: [], borderColor: "#82aaff", backgroundColor: "#82aaff11", fill: false, tension: .25, pointRadius: 1, yAxisID: "y1" }
    ]},
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: "#dce6f4" } } },
      scales: { x: { ticks: { color: "#9aabc2", maxTicksLimit: 6 }, grid: { color: "#26364e" } },
        y: { position: "left", ticks: { color: "#74e0bd" }, grid: { color: "#26364e" }, title: { display: true, text: "°C", color: "#74e0bd" } },
        y1: { position: "right", min: 0, max: 100, ticks: { color: "#82aaff" }, grid: { drawOnChartArea: false }, title: { display: true, text: "% RH", color: "#82aaff" } } } }
  });
  chartInstances.set(id, chart);

  const refresh = () => refreshDevice(id, device, card);
  card.querySelector(".refresh").addEventListener("click", refresh);
  card.querySelector(".export").addEventListener("click", () => exportCsv(chart, device.name));
  card.querySelector(".delete").addEventListener("click", async () => {
    if (!currentUser || !confirm(`Remove "${device.name}" from your dashboard? This does not delete its ThingSpeak channel.`)) return;
    try {
      await deleteDoc(doc(db, "users", currentUser.uid, "devices", id));
      await loadDevices();
    } catch (e) { alert("Could not remove device. Check Firestore rules."); }
  });
  refresh();
  refreshTimers.set(id, setInterval(refresh, 30000));
}

async function refreshDevice(id, device, card) {
  if (!currentUser) return;
  const status = card.querySelector(".status");
  status.textContent = "Checking…";
  status.className = "pill status";
  try {
    const response = await fetch(makeFeedUrl(device.channelId, device.readKey, 30), { cache: "no-store" });
    if (!response.ok) throw new Error("Channel request failed");
    const result = await response.json();
    if (!result || !Array.isArray(result.feeds)) throw new Error("Invalid feed response");
    const feeds = result.feeds.filter(f => f.created_at);
    const latest = feeds.length ? feeds[feeds.length - 1] : null;
    const temp = latest ? Number(latest.field1) : NaN;
    const hum = latest ? Number(latest.field2) : NaN;
    const ageMs = latest ? Date.now() - new Date(latest.created_at).getTime() : Infinity;
    const online = ageMs < 180000;
    status.textContent = online ? "Online · recent data" : "Offline / stale data";
    status.className = "pill status" + (online ? " online" : "");
    card.querySelector(".temperature").textContent = Number.isFinite(temp) ? temp.toFixed(1) : "—";
    card.querySelector(".humidity").textContent = Number.isFinite(hum) ? hum.toFixed(1) : "—";
    card.querySelector(".last-update").textContent = latest
      ? "Last reading: " + new Date(latest.created_at).toLocaleString()
      : "No readings found in this channel.";
    const chart = chartInstances.get(id);
    if (chart) {
      chart.data.labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));
      chart.data.datasets[0].data = feeds.map(f => f.field1 === null ? null : Number(f.field1));
      chart.data.datasets[1].data = feeds.map(f => f.field2 === null ? null : Number(f.field2));
      chart.update();
    }
    const prior = alertMemory.get(id) || { high:false, low:false };
    const high = Number.isFinite(temp) && temp >= 35;
    const low = Number.isFinite(hum) && hum < 25;
    if (high && !prior.high) alert(`Temperature alert for ${device.name}: ${temp.toFixed(1)} °C`);
    if (low && !prior.low) alert(`Humidity alert for ${device.name}: ${hum.toFixed(1)} %`);
    alertMemory.set(id, { high, low });
  } catch (error) {
    console.warn(error);
    status.textContent = "Could not read channel";
    card.querySelector(".last-update").textContent = "Check the channel ID, read key, network, and ThingSpeak availability.";
  }
}

function exportCsv(chart, name) {
  const rows = [["Time","Temperature C","Humidity percent"]];
  chart.data.labels.forEach((label, i) => rows.push([label, chart.data.datasets[0].data[i] ?? "", chart.data.datasets[1].data[i] ?? ""]));
  const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name.replace(/[^a-z0-9_-]/gi,"_") + "-readings.csv"; a.click();
  URL.revokeObjectURL(url);
}

function stopRefreshers() {
  for (const timer of refreshTimers.values()) clearInterval(timer);
  refreshTimers.clear();
  for (const chart of chartInstances.values()) chart.destroy();
  chartInstances.clear();
}
