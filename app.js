const storageKey = "walk-mate-state";
const ringLength = 427;
const strideMeters = 0.72;
const kcalPerKgKm = 0.75;
const fallbackWeightKg = 60;
const maxUsableAccuracyMeters = 65;
const preferredAccuracyMeters = 35;
const maxWalkingSpeedMetersPerSecond = 4.8;
const maxSegmentMeters = 900;
const minSampleIntervalMs = 1200;
const googleMapsWaypointLimit = 8;

const text = {
  recording: "\u8a18\u9332\u4e2d",
  paused: "\u4e00\u6642\u505c\u6b62\u4e2d",
  pause: "\u4e00\u6642\u505c\u6b62",
  resume: "\u518d\u958b",
  saved: "\u4fdd\u5b58\u3057\u307e\u3057\u305f",
  gpsUnavailable: "\u4e0d\u53ef",
  gpsCheck: "\u78ba\u8a8d",
  gpsPermission: "\u8a31\u53ef\u5f85\u3061",
  gpsPreparing: "\u4f4d\u7f6e\u60c5\u5831\u3092\u78ba\u8a8d\u4e2d",
  gpsNeeded: "GPS\u8a31\u53ef\u304c\u5fc5\u8981\u3067\u3059",
  gpsDenied: "\u8a2d\u5b9a\u3067\u4f4d\u7f6e\u60c5\u5831\u3092\u8a31\u53ef\u3057\u3066\u304f\u3060\u3055\u3044",
  keepScreenOpen: "\u753b\u9762\u3092\u958b\u3044\u305f\u307e\u307e\u8a18\u9332\u4e2d",
  gpsResumed: "GPS\u8a18\u9332\u3092\u518d\u958b\u3057\u307e\u3057\u305f",
  pocketOn: "\u30dd\u30b1\u30c3\u30c8\u30e2\u30fc\u30c9\u4e2d",
  pocketOff: "\u30dd\u30b1\u30c3\u30c8\u30e2\u30fc\u30c9\u3092\u89e3\u9664\u3057\u307e\u3057\u305f",
  gpsGood: "\u826f\u597d",
  gpsWeak: "\u5f31\u3044",
  mapWaiting: "\u8a18\u9332\u5f85\u3061",
  mapReady: "\u78ba\u8a8d\u3067\u304d\u307e\u3059",
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
  pocket: document.querySelector("#pocketButton"),
  pause: document.querySelector("#pauseButton"),
  finish: document.querySelector("#finishButton"),
  manualDistance: document.querySelector("#manualDistance"),
  addManual: document.querySelector("#addManualButton"),
  avgSpeed: document.querySelector("#avgSpeedValue"),
  routePoints: document.querySelector("#routePointsValue"),
  googleMaps: document.querySelector("#googleMapsButton"),
  weightInput: document.querySelector("#weightInput"),
  saveWeight: document.querySelector("#saveWeightButton"),
  weightDateLabel: document.querySelector("#weightDateLabel"),
  weightHistory: document.querySelector("#weightHistoryList"),
  shareData: document.querySelector("#shareDataButton"),
  history: document.querySelector("#historyList"),
  clearHistory: document.querySelector("#clearHistoryButton"),
  install: document.querySelector("#installButton"),
  pocketScreen: document.querySelector("#pocketScreen"),
  pocketDistance: document.querySelector("#pocketDistanceValue"),
  pocketTimer: document.querySelector("#pocketTimerValue"),
  pocketGps: document.querySelector("#pocketGpsValue"),
  unlockPocket: document.querySelector("#unlockPocketButton"),
};

const state = loadState();
let session = createSession();
let timerId = 0;
let watchId = 0;
let installPrompt = null;
let wakeLock = null;
let pocketMode = false;
let unlockTimer = 0;

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
  elements.pocket.addEventListener("click", enablePocketMode);
  elements.pause.addEventListener("click", togglePause);
  elements.finish.addEventListener("click", finishWalk);
  elements.addManual.addEventListener("click", addManualDistance);
  elements.googleMaps.addEventListener("click", openCurrentRouteInGoogleMaps);
  elements.goal.addEventListener("change", updateGoal);
  elements.saveWeight.addEventListener("click", saveTodayWeight);
  elements.shareData.addEventListener("click", shareHealthData);
  elements.clearHistory.addEventListener("click", clearHistory);
  elements.history.addEventListener("click", openHistoryRouteInGoogleMaps);
  elements.install.addEventListener("click", installApp);
  elements.unlockPocket.addEventListener("pointerdown", startPocketUnlock);
  elements.unlockPocket.addEventListener("pointerup", cancelPocketUnlock);
  elements.unlockPocket.addEventListener("pointercancel", cancelPocketUnlock);
  elements.unlockPocket.addEventListener("pointerleave", cancelPocketUnlock);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    elements.install.hidden = false;
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);
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

async function startWalk() {
  if (!session.active) {
    elements.start.disabled = true;
    session = createSession();
    session.active = true;
    session.startedAt = Date.now();
    elements.status.textContent = text.gpsPreparing;
    elements.gps.textContent = text.gpsCheck;
    elements.accuracy.textContent = text.gpsPermission;
    await requestWakeLock();
    const firstPosition = await requestInitialPosition();
    if (firstPosition) {
      updatePosition(firstPosition);
    }
    startGps();
    timerId = window.setInterval(render, 1000);
  }

  session.paused = false;
  elements.start.disabled = true;
  elements.pocket.disabled = false;
  elements.pause.disabled = false;
  elements.finish.disabled = false;
  if (elements.status.textContent === text.gpsPreparing) {
    elements.status.textContent = text.keepScreenOpen;
  }
  render();
}

function togglePause() {
  if (!session.active) return;

  if (session.paused) {
    session.paused = false;
    session.pausedMs += Date.now() - session.pausedAt;
    session.pausedAt = 0;
    elements.pause.textContent = text.pause;
    elements.status.textContent = text.keepScreenOpen;
    requestWakeLock();
    startGps();
    timerId = window.setInterval(render, 1000);
  } else {
    session.paused = true;
    session.pausedAt = Date.now();
    elements.pause.textContent = text.resume;
    elements.status.textContent = text.paused;
    disablePocketMode(false);
    releaseWakeLock();
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
  disablePocketMode(false);
  releaseWakeLock();
  window.clearInterval(timerId);
  session = createSession();
  elements.gps.textContent = "OFF";
  elements.accuracy.textContent = "--";
  elements.status.textContent = text.saved;
  elements.start.disabled = false;
  elements.pocket.disabled = true;
  elements.pause.disabled = true;
  elements.finish.disabled = true;
  elements.pause.textContent = text.pause;
  render();
  renderHistory();
}

function enablePocketMode() {
  if (!session.active || session.paused) return;

  pocketMode = true;
  elements.pocketScreen.hidden = false;
  elements.status.textContent = text.pocketOn;
  requestWakeLock();
  render();
}

function disablePocketMode(showStatus = true) {
  pocketMode = false;
  elements.pocketScreen.hidden = true;
  cancelPocketUnlock();
  if (showStatus) {
    elements.status.textContent = text.pocketOff;
  }
}

function startPocketUnlock() {
  cancelPocketUnlock();
  unlockTimer = window.setTimeout(() => {
    disablePocketMode(true);
  }, 1800);
}

function cancelPocketUnlock() {
  if (!unlockTimer) return;

  window.clearTimeout(unlockTimer);
  unlockTimer = 0;
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
    (error) => {
      elements.gps.textContent = text.gpsCheck;
      elements.accuracy.textContent = "--";
      elements.status.textContent = error?.code === 1 ? text.gpsDenied : text.gpsNeeded;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 18000,
    }
  );
}

function stopGps() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = 0;
  }
}

function requestInitialPosition() {
  if (!navigator.geolocation) {
    elements.gps.textContent = text.gpsUnavailable;
    elements.accuracy.textContent = "--";
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        elements.gps.textContent = text.gpsCheck;
        elements.accuracy.textContent = "--";
        elements.status.textContent = error?.code === 1 ? text.gpsDenied : text.gpsNeeded;
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 18000,
      }
    );
  });
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLock) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  if (!wakeLock) return;

  wakeLock.release().catch(() => {});
  wakeLock = null;
}

function handleVisibilityChange() {
  if (!session.active || session.paused) return;

  if (document.visibilityState === "visible") {
    requestWakeLock();
    if (!watchId) {
      startGps();
    }
    elements.status.textContent = text.gpsResumed;
    render();
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

  const maxSegment = getMaxSegmentMeters(seconds);
  if (meters > maxSegment || speed > maxWalkingSpeedMetersPerSecond || reportedSpeed > maxWalkingSpeedMetersPerSecond) {
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

function getMaxSegmentMeters(seconds) {
  const walkingLimit = seconds * maxWalkingSpeedMetersPerSecond * 1.25;
  return Math.max(90, Math.min(maxSegmentMeters, walkingLimit));
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
  const movingMs = session.movingMs || elapsedMs;
  const movingMinutes = movingMs / 60000;
  const paceMinutes = distanceKm > 0 ? movingMinutes / distanceKm : 0;
  const steps = Math.round((distanceKm * 1000) / strideMeters);
  const weightKg = getLatestWeightKg();
  const calories = calculateCalories(distanceKm, movingMs, weightKg);
  const progress = Math.min(1, distanceKm / state.goalKm);
  const speedKmh = distanceKm > 0 && movingMs > 0 ? distanceKm / (movingMs / 3600000) : 0;

  elements.distance.textContent = distanceKm.toFixed(2);
  elements.timer.textContent = formatDuration(elapsedMs);
  elements.pace.textContent = paceMinutes ? formatPace(paceMinutes) : "--'--\"";
  elements.steps.textContent = steps.toLocaleString("ja-JP");
  elements.calories.textContent = String(calories);
  elements.avgSpeed.textContent = speedKmh ? speedKmh.toFixed(1) : "--";
  elements.routePoints.textContent = String(session.track.length);
  elements.googleMaps.disabled = session.track.length < 2;
  elements.pocket.disabled = !session.active || session.paused;
  elements.pocketDistance.textContent = `${distanceKm.toFixed(2)} km`;
  elements.pocketTimer.textContent = formatDuration(elapsedMs);
  elements.pocketGps.textContent = `GPS ${elements.accuracy.textContent}`;
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
    const routeButton = record.route?.length > 1 ? `<button class="map-link" type="button" data-route-id="${record.id}">Google\u30de\u30c3\u30d7</button>` : "";
    item.innerHTML = `
      <strong>${record.distanceKm.toFixed(2)} km</strong>
      <strong>${formatDuration(record.elapsedMs)}</strong>
      <span>${date} / ${weightText}</span>
      <span>${paceText}</span>
      ${routeButton}
    `;
    elements.history.append(item);
  }
}

function openCurrentRouteInGoogleMaps() {
  if (session.track.length < 2) return;
  window.open(buildGoogleMapsRouteUrl(session.track), "_blank", "noopener");
}

function openHistoryRouteInGoogleMaps(event) {
  const button = event.target.closest("[data-route-id]");
  if (!button) return;

  const record = state.history.find((item) => item.id === button.dataset.routeId);
  if (!record?.route?.length || record.route.length < 2) return;
  window.open(buildGoogleMapsRouteUrl(record.route), "_blank", "noopener");
}

function buildGoogleMapsRouteUrl(route) {
  const points = normalizeRoutePoints(route);
  const origin = points[0];
  const destination = points[points.length - 1];
  const params = new URLSearchParams({
    api: "1",
    travelmode: "walking",
    origin: formatLatLon(origin),
    destination: formatLatLon(destination),
  });
  const waypoints = sampleWaypoints(points.slice(1, -1), googleMapsWaypointLimit);
  if (waypoints.length) {
    params.set("waypoints", waypoints.map(formatLatLon).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function normalizeRoutePoints(route) {
  return route
    .map((point) => ({
      lat: Number(point.lat ?? point.latitude),
      lon: Number(point.lon ?? point.longitude),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
}

function sampleWaypoints(points, limit) {
  if (points.length <= limit) return points;

  const sampled = [];
  const step = points.length / (limit + 1);
  for (let index = 1; index <= limit; index += 1) {
    sampled.push(points[Math.floor(step * index)]);
  }
  return sampled;
}

function formatLatLon(point) {
  return `${point.lat},${point.lon}`;
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
