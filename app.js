const storageKey = "walk-mate-state";
const ringLength = 427;
const strideMeters = 0.72;
const kcalPerKgKm = 0.75;
const fallbackWeightKg = 60;
const maxUsableAccuracyMeters = 65;
const preferredAccuracyMeters = 35;
const maxWalkingSpeedMetersPerSecond = 4.5;
const maxSegmentMeters = 120;
const minSampleIntervalMs = 1200;

const text = {
  recording: "\u8a18\u9332\u4e2d",
  paused: "\u4e00\u6642\u505c\u6b62\u4e2d",
  pause: "\u4e00\u6642\u505c\u6b62",
  resume: "\u518d\u958b",
  saved: "\u4fdd\u5b58\u3057\u307e\u3057\u305f",
  gpsUnavailable: "\u4e0d\u53ef",
  gpsCheck: "\u78ba\u8a8d",
  gpsPermission: "\u8a31\u53ef\u5f85\u3061",
  gpsNeeded: "GPS\u8a31\u53ef\u304c\u5fc5\u8981\u3067\u3059",
  gpsGood: "\u826f\u597d",
  gpsWeak: "\u5f31\u3044",
  distanceAdded: "\u8ddd\u96e2\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f",
  checkWeight: "\u4f53\u91cd\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044",
  weightSaved: "\u4f53\u91cd\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f",
  safariInstall: "Safari\u306e\u5171\u6709\u30e1\u30cb\u30e5\u30fc\u304b\u3089\u8ffd\u52a0\u3067\u304d\u307e\u3059",
  csvSaved: "CSV\u3092\u66f8\u304d\u51fa\u3057\u307e\u3057\u305f",
  noWalks: "\u307e\u3060\u8a18\u9332\u304c\u3042\u308a\u307e\u305b\u3093",
  noWeights: "\u4f53\u91cd\u8a18\u9332\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093",
  noWeight: "\u4f53\u91cd\u672a\u5165\u529b",
  goal: "\u76ee\u6a19",
  shareTitle: "Walk Mate \u30c7\u30fc\u30bf",
  shareText: "\u30a6\u30a9\u30fc\u30ad\u30f3\u30b0\u3068\u4f53\u91cd\u306e\u8a18\u9332\u3067\u3059\u3002",
};

const elements = {
  distance: document.querySelector("#distanceValue"),
  timer: document.querySelector("#timerValue"),
  pace: document.querySelector("#paceValue"),
  steps: document.querySelector("#stepsValue"),
  calories: document.querySelector("#calorieValue"),
  weight: document.querySelector("#weightValue"),
  gps: document.querySelector("#gpsValue"),
  accuracy: document.querySelector("#accuracyValue"),
  status: document.querySelector("#statusText"),
  goal: document.querySelector("#goalInput"),
  goalText: document.querySelector("#goalText"),
  goalRing: document.querySelector("#goalRing"),
  start: document.querySelector("#startButton"),
  pause: document.querySelector("#pauseButton"),
  finish: document.querySelector("#finishButton"),
  manualDistance: document.querySelector("#manualDistance"),
  addManual: document.querySelector("#addManualButton"),
  weightInput: document.querySelector("#weightInput"),
  saveWeight: document.querySelector("#saveWeightButton"),
  weightDateLabel: document.querySelector("#weightDateLabel"),
  weightHistory: document.querySelector("#weightHistoryList"),
  shareData: document.querySelector("#shareDataButton"),
  history: document.querySelector("#historyList"),
  clearHistory: document.querySelector("#clearHistoryButton"),
  install: document.querySelector("#installButton"),
};

const state = loadState();
let session = createSession();
let timerId = 0;
let watchId = 0;
let installPrompt = null;

init();

function init() {
  elements.goal.value = state.goalKm;
  elements.weightInput.value = getTodayWeight()?.weightKg || "";
  elements.weightDateLabel.textContent = formatDateLabel(new Date());
  render();
  renderHistory();
  renderWeightHistory();
  registerServiceWorker();

  elements.start.addEventListener("click", startWalk);
  elements.pause.addEventListener("click", togglePause);
  elements.finish.addEventListener("click", finishWalk);
  elements.addManual.addEventListener("click", addManualDistance);
  elements.goal.addEventListener("change", updateGoal);
  elements.saveWeight.addEventListener("click", saveTodayWeight);
  elements.shareData.addEventListener("click", shareHealthData);
  elements.clearHistory.addEventListener("click", clearHistory);
  elements.install.addEventListener("click", installApp);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    elements.install.hidden = false;
  });
}

function createSession() {
  return {
    active: false,
    paused: false,
    startedAt: 0,
    pausedAt: 0,
    pausedMs: 0,
    movingMs: 0,
    distanceKm: 0,
    manualDistanceKm: 0,
    lastPoint: null,
    track: [],
    rejectedSamples: 0,
  };
}

function startWalk() {
  if (!session.active) {
    session = createSession();
    session.active = true;
    session.startedAt = Date.now();
    elements.status.textContent = text.recording;
    startGps();
    timerId = window.setInterval(render, 1000);
  }

  session.paused = false;
  elements.start.disabled = true;
  elements.pause.disabled = false;
  elements.finish.disabled = false;
  render();
}

function togglePause() {
  if (!session.active) return;

  if (session.paused) {
    session.paused = false;
    session.pausedMs += Date.now() - session.pausedAt;
    session.pausedAt = 0;
    elements.pause.textContent = text.pause;
    elements.status.textContent = text.recording;
    startGps();
    timerId = window.setInterval(render, 1000);
  } else {
    session.paused = true;
    session.pausedAt = Date.now();
    elements.pause.textContent = text.resume;
    elements.status.textContent = text.paused;
    stopGps();
    window.clearInterval(timerId);
  }

  render();
}

function finishWalk() {
  if (!session.active) return;

  const elapsedMs = getElapsedMs();
  const weightKg = getLatestWeightKg();
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: new Date().toISOString(),
    distanceKm: session.distanceKm,
    elapsedMs,
    movingMs: session.movingMs,
    steps: Math.round((session.distanceKm * 1000) / strideMeters),
    calories: calculateCalories(session.distanceKm, session.movingMs || elapsedMs, weightKg),
    weightKg,
    route: session.track.slice(-300),
  };

  if (record.distanceKm > 0 || record.elapsedMs > 5000) {
    state.history.unshift(record);
    state.history = state.history.slice(0, 30);
    saveState();
  }

  stopGps();
  window.clearInterval(timerId);
  session = createSession();
  elements.gps.textContent = "OFF";
  elements.accuracy.textContent = "--";
  elements.status.textContent = text.saved;
  elements.start.disabled = false;
  elements.pause.disabled = true;
  elements.finish.disabled = true;
  elements.pause.textContent = text.pause;
  render();
  renderHistory();
}

function startGps() {
  if (!navigator.geolocation) {
    elements.gps.textContent = text.gpsUnavailable;
    elements.accuracy.textContent = "--";
    return;
  }

  stopGps();
  watchId = navigator.geolocation.watchPosition(
    updatePosition,
    () => {
      elements.gps.textContent = text.gpsCheck;
      elements.accuracy.textContent = text.gpsPermission;
      elements.status.textContent = text.gpsNeeded;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 12000,
    }
  );
}

function stopGps() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = 0;
  }
}

function updatePosition(position) {
  if (!session.active || session.paused) return;

  const point = createGpsPoint(position);
  elements.accuracy.textContent = `${Math.round(point.accuracy)}m`;

  if (point.accuracy > maxUsableAccuracyMeters) {
    session.rejectedSamples += 1;
    elements.gps.textContent = text.gpsWeak;
    return;
  }

  elements.gps.textContent = point.accuracy <= preferredAccuracyMeters ? text.gpsGood : "ON";

  if (!session.lastPoint) {
    acceptGpsPoint(point, 0, 0);
    render();
    return;
  }

  const deltaMs = point.time - session.lastPoint.time;
  if (deltaMs < minSampleIntervalMs) {
    replaceAnchorIfBetter(point);
    return;
  }

  const meters = distanceBetween(session.lastPoint, point);
  const seconds = deltaMs / 1000;
  const speed = meters / seconds;
  const reportedSpeed = Number.isFinite(point.speed) ? point.speed : speed;
  const noiseFloor = getNoiseFloorMeters(session.lastPoint, point);

  if (meters < noiseFloor) {
    replaceAnchorIfBetter(point);
    render();
    return;
  }

  if (meters > maxSegmentMeters || speed > maxWalkingSpeedMetersPerSecond || reportedSpeed > maxWalkingSpeedMetersPerSecond) {
    session.rejectedSamples += 1;
    if (point.accuracy < session.lastPoint.accuracy) {
      session.lastPoint = point;
    }
    render();
    return;
  }

  acceptGpsPoint(point, meters, deltaMs);
  render();
}

function createGpsPoint(position) {
  const { latitude, longitude, accuracy, speed } = position.coords;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : 999,
    speed: Number.isFinite(speed) ? speed : null,
    time: position.timestamp || Date.now(),
  };
}

function acceptGpsPoint(point, meters, deltaMs) {
  session.distanceKm += meters / 1000;
  session.movingMs += deltaMs;
  session.lastPoint = point;
  session.track.push({
    lat: roundCoordinate(point.latitude),
    lon: roundCoordinate(point.longitude),
    t: point.time,
    a: Math.round(point.accuracy),
    d: Math.round(session.distanceKm * 1000),
  });
  if (session.track.length > 600) {
    session.track = session.track.slice(-600);
  }
}

function replaceAnchorIfBetter(point) {
  if (!session.lastPoint || point.accuracy + 5 < session.lastPoint.accuracy) {
    session.lastPoint = point;
  }
}

function getNoiseFloorMeters(a, b) {
  const accuracyNoise = (a.accuracy + b.accuracy) * 0.12;
  return Math.max(4, Math.min(14, accuracyNoise));
}

function roundCoordinate(value) {
  return Math.round(value * 1000000) / 1000000;
}

function distanceBetween(a, b) {
  const earthRadiusMeters = 6371000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function addManualDistance() {
  const value = Number(elements.manualDistance.value);
  if (!Number.isFinite(value) || value <= 0) return;

  if (!session.active) {
    session.active = true;
    session.startedAt = Date.now();
    timerId = window.setInterval(render, 1000);
    elements.start.disabled = true;
    elements.pause.disabled = false;
    elements.finish.disabled = false;
  }

  session.distanceKm += value;
  session.manualDistanceKm += value;
  elements.manualDistance.value = "";
  elements.status.textContent = text.distanceAdded;
  render();
}

function updateGoal() {
  const nextGoal = Number(elements.goal.value);
  if (!Number.isFinite(nextGoal) || nextGoal <= 0) {
    elements.goal.value = state.goalKm;
    return;
  }

  state.goalKm = nextGoal;
  saveState();
  render();
}

function saveTodayWeight() {
  const weightKg = Number(elements.weightInput.value);
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 250) {
    elements.status.textContent = text.checkWeight;
    return;
  }

  const dateKey = getDateKey(new Date());
  const existing = state.weights.find((item) => item.dateKey === dateKey);
  if (existing) {
    existing.weightKg = weightKg;
    existing.date = new Date().toISOString();
  } else {
    state.weights.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: new Date().toISOString(),
      dateKey,
      weightKg,
    });
  }

  state.weights.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  state.weights = state.weights.slice(0, 90);
  saveState();
  elements.status.textContent = text.weightSaved;
  render();
  renderWeightHistory();
}

function clearHistory() {
  state.history = [];
  saveState();
  renderHistory();
}

async function installApp() {
  if (!installPrompt) {
    elements.status.textContent = text.safariInstall;
    return;
  }

  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
}

async function shareHealthData() {
  const csv = buildHealthCsv();
  const fileName = `walk-mate-${getDateKey(new Date())}.csv`;
  const file = new File([csv], fileName, { type: "text/csv" });

  if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: text.shareTitle,
      text: text.shareText,
      files: [file],
    });
    return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  elements.status.textContent = text.csvSaved;
}

function buildHealthCsv() {
  const rows = [["type", "date", "value", "unit", "duration_seconds", "steps", "calories_kcal"]];

  for (const item of state.weights) {
    rows.push(["body_weight", item.date, item.weightKg, "kg", "", "", ""]);
  }

  for (const item of state.history) {
    rows.push([
      "walking",
      item.date,
      item.distanceKm.toFixed(3),
      "km",
      Math.round((item.movingMs || item.elapsedMs) / 1000),
      item.steps || Math.round((item.distanceKm * 1000) / strideMeters),
      item.calories || calculateCalories(item.distanceKm, item.movingMs || item.elapsedMs, getLatestWeightKg()),
    ]);
  }

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value) {
  const csvText = String(value);
  return /[",\n]/.test(csvText) ? `"${csvText.replace(/"/g, '""')}"` : csvText;
}

function getElapsedMs() {
  if (!session.active) return 0;
  const now = session.paused ? session.pausedAt : Date.now();
  return Math.max(0, now - session.startedAt - session.pausedMs);
}

function render() {
  const distanceKm = session.distanceKm;
  const elapsedMs = getElapsedMs();
  const elapsedMinutes = elapsedMs / 60000;
  const paceMinutes = distanceKm > 0 ? elapsedMinutes / distanceKm : 0;
  const steps = Math.round((distanceKm * 1000) / strideMeters);
  const weightKg = getLatestWeightKg();
  const calories = calculateCalories(distanceKm, session.movingMs || elapsedMs, weightKg);
  const progress = Math.min(1, distanceKm / state.goalKm);

  elements.distance.textContent = distanceKm.toFixed(2);
  elements.timer.textContent = formatDuration(elapsedMs);
  elements.pace.textContent = paceMinutes ? formatPace(paceMinutes) : "--'--\"";
  elements.steps.textContent = steps.toLocaleString("ja-JP");
  elements.calories.textContent = String(calories);
  elements.weight.textContent = getLatestWeight()?.weightKg.toFixed(1) || "--";
  elements.goalText.textContent = `${text.goal} ${state.goalKm.toFixed(1)} km`;
  elements.goalRing.style.strokeDashoffset = String(ringLength * (1 - progress));
}

function renderHistory() {
  elements.history.innerHTML = "";

  if (!state.history.length) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${text.noWalks}</span><span></span>`;
    elements.history.append(item);
    return;
  }

  for (const record of state.history) {
    const item = document.createElement("li");
    const date = formatDateLabel(new Date(record.date));
    const weightText = record.weightKg ? `${record.weightKg.toFixed(1)} kg` : text.noWeight;
    const paceText =
      record.distanceKm && record.elapsedMs > 1000
        ? `${formatPace((record.movingMs || record.elapsedMs) / 60000 / record.distanceKm)} / km`
        : "--";
    item.innerHTML = `
      <strong>${record.distanceKm.toFixed(2)} km</strong>
      <strong>${formatDuration(record.elapsedMs)}</strong>
      <span>${date} / ${weightText}</span>
      <span>${paceText}</span>
    `;
    elements.history.append(item);
  }
}

function renderWeightHistory() {
  elements.weightHistory.innerHTML = "";
  const recentWeights = state.weights.slice(0, 5);

  if (!recentWeights.length) {
    const item = document.createElement("li");
    item.innerHTML = `<span>${text.noWeights}</span><span></span>`;
    elements.weightHistory.append(item);
    return;
  }

  for (const record of recentWeights) {
    const item = document.createElement("li");
    item.innerHTML = `
      <strong>${record.weightKg.toFixed(1)} kg</strong>
      <span>${formatDateLabel(new Date(record.date))}</span>
    `;
    elements.weightHistory.append(item);
  }
}

function getLatestWeight() {
  return state.weights[0] || null;
}

function getTodayWeight() {
  const today = getDateKey(new Date());
  return state.weights.find((item) => item.dateKey === today) || null;
}

function getLatestWeightKg() {
  return getLatestWeight()?.weightKg || fallbackWeightKg;
}

function calculateCalories(distanceKm, elapsedMs, weightKg) {
  if (!distanceKm || distanceKm <= 0) return 0;

  const minutes = elapsedMs / 60000;
  if (!Number.isFinite(minutes) || minutes < 1) {
    return Math.round(distanceKm * weightKg * kcalPerKgKm);
  }

  const hours = minutes / 60;
  const speedKmh = distanceKm / hours;
  const met = getWalkingMet(speedKmh);
  return Math.round((met * 3.5 * weightKg * minutes) / 200);
}

function getWalkingMet(speedKmh) {
  if (speedKmh < 3.2) return 2.8;
  if (speedKmh < 4.8) return 3.5;
  if (speedKmh < 6.4) return 4.3;
  return 5;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatPace(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}'${String(secs).padStart(2, "0")}"`;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return {
      goalKm: Number(saved?.goalKm) || 3,
      history: Array.isArray(saved?.history) ? saved.history : [],
      weights: Array.isArray(saved?.weights) ? saved.weights : [],
    };
  } catch {
    return { goalKm: 3, history: [], weights: [] };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("service-worker.js");
  }
}
