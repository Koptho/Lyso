const STORAGE_KEY = "lyso-weekly-syllables";
const SETTINGS_KEY = "lyso-reading-settings";
const DEFAULT_WORDS = ["so", "ma", "le", "ni", "ro"];
const STATION_PAUSE_MS = 550;
const $ = (id) => document.getElementById(id);
const track = $("track");
const trackViewport = $("trackViewport");
const draggableLetter = $("draggableLetter");
const state = {
  words: [], index: 0, station: 0, progress: 0, completed: new Set(),
  pointerId: null, pointerOrigin: 0, pointerLastX: 0, progressOrigin: 0,
  tileSize: 112, step: 168, inset: 18, frame: null, pendingProgress: 0,
  stationTimer: null, nextTimer: null, locked: false, finished: false,
  readyForNext: false, pauseSeconds: 6, automatic: true
};

function parseWords(raw) {
  const words = [], invalid = [], seen = new Set();
  raw.normalize("NFC").split(/\r?\n/).forEach((entry, index) => {
    const word = entry.trim().toLowerCase();
    if (!word) return;
    if (!/^[a-zæøåéèêëáàâäíìîïóòôöúùûüýÿ]{2,}$/.test(word)) {
      invalid.push(index + 1);
    } else if (!seen.has(word)) {
      seen.add(word);
      words.push(word);
    }
  });
  return { words, invalid };
}

function currentWord() { return state.words[state.index]; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function cancelFrame() {
  if (state.frame !== null) window.cancelAnimationFrame(state.frame);
  state.frame = null;
}

function releasePointer() {
  const pointerId = state.pointerId;
  state.pointerId = null;
  draggableLetter.classList.remove("dragging");
  if (pointerId !== null && draggableLetter.hasPointerCapture(pointerId)) {
    draggableLetter.releasePointerCapture(pointerId);
  }
}

function clearPendingWork() {
  cancelFrame();
  releasePointer();
  window.clearTimeout(state.stationTimer);
  window.clearTimeout(state.nextTimer);
  state.stationTimer = state.nextTimer = null;
}

function renderChoices() {
  $("choicesList").replaceChildren();
  state.words.forEach((word, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-pill";
    button.textContent = word;
    button.classList.toggle("active", index === state.index);
    button.classList.toggle("done", state.completed.has(word));
    button.setAttribute("aria-pressed", String(index === state.index));
    button.addEventListener("click", () => loadWord(index));
    $("choicesList").appendChild(button);
  });
}

function updateMetrics() {
  // Use the same reading direction on every device.
  const width = trackViewport.clientWidth;
  state.tileSize = width < 450 ? 88 : 112;
  state.step = clamp((width - 36 - state.tileSize) / (currentWord().length - 1), state.tileSize + 52, 210);
  track.style.setProperty("--tile-size", `${state.tileSize}px`);
  track.style.width = `${Math.max(width, state.inset * 2 + state.tileSize + state.step * (currentWord().length - 1))}px`;
  $("stations").querySelectorAll(".station").forEach((station, index) => {
    station.style.left = `${state.inset + index * state.step}px`;
  });
  $("glowLine").style.left = `${state.inset + state.tileSize / 2}px`;
  $("glowLine").style.width = `${state.step * (currentWord().length - 1)}px`;
  renderPosition();
}

function revealCurrentPair() {
  const activeLeft = state.inset + state.station * state.step;
  const pairRight = activeLeft + state.tileSize + (state.finished ? 0 : state.step);
  const viewLeft = trackViewport.scrollLeft;
  const viewRight = viewLeft + trackViewport.clientWidth;
  if (activeLeft < viewLeft + 12 || pairRight > viewRight - 12) {
    trackViewport.scrollLeft = Math.max(0, activeLeft - state.inset);
  }
}

function renderPosition() {
  const position = state.inset + (state.station + state.progress) * state.step;
  draggableLetter.style.transform = `translate3d(${position}px, -50%, 0)`;
  draggableLetter.setAttribute("aria-valuenow", String(Math.round(state.progress * 100)));
  draggableLetter.classList.toggle("near-target", state.progress > 0.65);
}

function renderStation() {
  const word = currentWord();
  $("consonantChar").textContent = word[state.station];
  $("builtWord").textContent = word.slice(0, state.station + 1);
  $("wordCounter").textContent = `${state.index + 1} / ${state.words.length}`;
  $("stations").querySelectorAll(".station").forEach((station, index) => {
    station.classList.toggle("visited", index < state.station);
    station.classList.toggle("current", index === state.station);
    station.classList.toggle("next", index === state.station + 1 && !state.finished);
  });
  const label = state.finished ? `${word} er ferdig` : `Dra ${word[state.station]} til ${word[state.station + 1]}`;
  draggableLetter.setAttribute("aria-label", label);
  draggableLetter.setAttribute("aria-valuetext", `${word.slice(0, state.station + 1)}. ${label}.`);
  draggableLetter.setAttribute("aria-disabled", String(state.locked || state.finished));
  draggableLetter.classList.toggle("waiting", state.locked);
  renderPosition();
}

function loadWord(index = state.index) {
  clearPendingWork();
  state.index = index;
  state.station = state.progress = state.pendingProgress = 0;
  state.finished = state.locked = state.readyForNext = false;
  $("reward").hidden = true;
  $("nextWordButton").hidden = true;
  $("buddy").classList.remove("saved");
  $("stations").replaceChildren();
  [...currentWord()].forEach((letter) => {
    const station = document.createElement("div");
    station.className = "letter-tile station";
    station.setAttribute("aria-hidden", "true");
    const character = document.createElement("span");
    character.className = "letter-char";
    character.textContent = letter;
    station.appendChild(character);
    $("stations").appendChild(station);
  });
  trackViewport.scrollLeft = 0;
  updateMetrics();
  renderStation();
  renderChoices();
}

function finishWord() {
  if (state.finished) return;
  state.finished = true;
  state.locked = false;
  state.completed.add(currentWord());
  $("reward").hidden = false;
  $("buddy").classList.add("saved");
  $("buddyStatus").textContent = `${currentWord()}. Flott jobba! Du fekk ei stjerne.`;
  renderStation();
  renderChoices();
  startReadingPause();
}

function startReadingPause() {
  window.clearTimeout(state.nextTimer);
  state.nextTimer = null;
  state.readyForNext = false;
  $("nextWordButton").hidden = true;
  $("nextWordButton").disabled = true;
  if (document.hidden) return;
  state.nextTimer = window.setTimeout(() => {
    state.nextTimer = null;
    state.readyForNext = true;
    $("nextWordButton").hidden = false;
    $("nextWordButton").disabled = false;
    $("nextWordButton").textContent = "Neste ord";
    if (state.automatic && !document.hidden) nextWord();
  }, state.pauseSeconds * 1000);
}

function reachStation() {
  cancelFrame();
  state.station += 1;
  state.progress = state.pendingProgress = 0;
  // Keep the same touch, but discard overshoot at each new letter.
  state.pointerOrigin = state.pointerLastX;
  state.progressOrigin = 0;
  if (state.station === currentWord().length - 1) {
    releasePointer();
    finishWord();
    return;
  }
  // Every letter still gets its own calm stop, even in one continuous drag.
  state.locked = true;
  renderStation();
  state.stationTimer = window.setTimeout(() => {
    state.stationTimer = null;
    state.locked = false;
    revealCurrentPair();
    renderStation();
    if (state.pointerId !== null) applyPointerPosition();
  }, STATION_PAUSE_MS);
}

function setProgress(progress) {
  if (state.locked || state.finished) return;
  state.progress = clamp(progress, 0, 1);
  // Snap over the final 18px for a forgiving target under small fingers.
  if (state.progress * state.step >= state.step - 18) reachStation();
  else renderPosition();
}

function applyPointerPosition() {
  if (state.locked || state.finished) return;
  const progress = state.progressOrigin + (state.pointerLastX - state.pointerOrigin) / state.step;
  if (progress < 0) {
    // On a long word the finger can move back left, still held, then drag on.
    // Rebase here so moving right responds immediately, without a dead zone.
    state.pointerOrigin = state.pointerLastX;
    state.progressOrigin = 0;
  }
  setProgress(progress);
}

function onPointerDown(event) {
  if (state.pointerId !== null || state.locked || state.finished || event.isPrimary === false || event.button !== 0) return;
  event.preventDefault();
  cancelFrame();
  state.pointerId = event.pointerId;
  state.pointerOrigin = event.clientX;
  state.pointerLastX = event.clientX;
  state.progressOrigin = state.progress;
  draggableLetter.classList.add("dragging");
  draggableLetter.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (event.pointerId !== state.pointerId) return;
  event.preventDefault();
  state.pointerLastX = event.clientX;
  // Keep the most recent position during the stop; replay it only if held.
  if (state.locked) return;
  if (state.frame !== null) return;
  state.frame = window.requestAnimationFrame(() => {
    state.frame = null;
    if (state.pointerId !== null) applyPointerPosition();
  });
}

function onPointerUp(event) {
  if (event.pointerId !== state.pointerId) return;
  event.preventDefault();
  cancelFrame();
  // Read the release so its last movement cannot be lost between frames.
  state.pointerLastX = event.clientX;
  applyPointerPosition();
  releasePointer();
}

function interruptDrag(event) {
  if (event && event.pointerId !== undefined && event.pointerId !== state.pointerId) return;
  cancelFrame();
  releasePointer();
  // An interrupted touch is a pause, never a failed attempt.
}

function onKeyDown(event) {
  if (!["ArrowRight", "ArrowLeft", "Home", "End", "Enter", " "].includes(event.key)) return;
  event.preventDefault();
  if (state.pointerId !== null || state.locked || state.finished) return;
  if (event.repeat && ["Enter", " ", "End"].includes(event.key)) return;
  setProgress(event.key === "Home" ? 0 : ["End", "Enter", " "].includes(event.key) ? 1 : state.progress + (event.key === "ArrowLeft" ? -0.1 : 0.1));
}

function nextWord() {
  if (state.readyForNext) loadWord((state.index + 1) % state.words.length);
}

function applyWords(words, message) {
  state.words = words;
  state.completed = new Set();
  $("syllableInput").value = words.join("\n");
  $("configStatus").textContent = message;
  loadWord(0);
}

function saveWords() {
  const { words, invalid } = parseWords($("syllableInput").value);
  if (invalid.length || !words.length) {
    $("configStatus").textContent = invalid.length ? `Sjekk linje ${invalid.join(", ")}. Skriv eitt ord per linje med minst to bokstavar, utan mellomrom eller teikn.` : "Skriv inn minst eitt øveord.";
    return;
  }
  let message = "Øveorda er lagra på denne eininga.";
  try { window.localStorage.setItem(STORAGE_KEY, words.join("\n")); }
  catch { message = "Øveorda er klare. Nettlesaren kunne ikkje lagre dei til neste gong."; }
  applyWords(words, message);
}

function saveSettings() {
  state.pauseSeconds = Number($("pauseSelect").value);
  state.automatic = $("autoAdvance").checked;
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ pauseSeconds: state.pauseSeconds, automatic: state.automatic })); }
  catch { $("configStatus").textContent = "Innstillingane gjeld no, men kunne ikkje lagrast til neste gong."; }
  if (state.finished) {
    // Changing pace never triggers an old timer.
    startReadingPause();
  }
}

draggableLetter.addEventListener("pointerdown", onPointerDown);
draggableLetter.addEventListener("pointermove", onPointerMove);
draggableLetter.addEventListener("pointerup", onPointerUp);
draggableLetter.addEventListener("pointercancel", interruptDrag);
draggableLetter.addEventListener("lostpointercapture", interruptDrag);
draggableLetter.addEventListener("keydown", onKeyDown);
window.addEventListener("blur", () => interruptDrag());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) interruptDrag();
  // Time away from the app never counts as the child's reading pause.
  if (state.finished) startReadingPause();
});
document.addEventListener("selectstart", (event) => { if (!event.target.closest("textarea, input")) event.preventDefault(); });
track.addEventListener("contextmenu", (event) => event.preventDefault());
track.addEventListener("dragstart", (event) => event.preventDefault());
$("saveConfigButton").addEventListener("click", saveWords);
$("resetConfigButton").addEventListener("click", () => {
  let message = "Standardpakka er aktiv.";
  try { window.localStorage.removeItem(STORAGE_KEY); }
  catch { message = "Standardpakka er aktiv no. Nettlesaren kunne ikkje lagre endringa."; }
  applyWords(DEFAULT_WORDS, message);
});
$("pauseSelect").addEventListener("change", saveSettings);
$("autoAdvance").addEventListener("change", saveSettings);
$("nextWordButton").addEventListener("click", nextWord);
window.addEventListener("resize", () => {
  interruptDrag();
  updateMetrics();
  revealCurrentPair();
});

let initialWords = DEFAULT_WORDS;
let initialMessage = "Standardpakka er aktiv. Legg inn vekas øveord under.";
try {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const { words, invalid } = parseWords(saved);
    if (words.length && !invalid.length) {
      initialWords = words;
      initialMessage = "Øveorda dine er lasta inn frå denne eininga.";
    }
  }
  const settings = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "null");
  if (settings && [6, 8, 10, 15].includes(settings.pauseSeconds)) state.pauseSeconds = settings.pauseSeconds;
  if (settings && typeof settings.automatic === "boolean") state.automatic = settings.automatic;
} catch { initialMessage = "Du kan øve som vanleg. Lagring er ikkje tilgjengeleg i denne nettlesaren."; }
$("pauseSelect").value = String(state.pauseSeconds);
$("autoAdvance").checked = state.automatic;
applyWords(initialWords, initialMessage);
