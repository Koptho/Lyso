const STORAGE_KEY = "lyso-weekly-syllables";
const DEFAULT_SYLLABLES = ["SO", "MA", "LE", "NI", "RO"];

const state = {
  levels: [],
  levelIndex: 0,
  stars: 0,
  streak: 0,
  rescued: 0,
  progress: 0,
  pendingProgress: 0,
  framePending: false,
  isDragging: false,
  hasMerged: false,
  pointerStartCoord: 0,
  progressStart: 0,
  maxDrag: 0,
  mobileLayout: false,
  completed: new Set()
};

const draggableLetter = document.getElementById("draggableLetter");
const vowelLetter = document.getElementById("vowelLetter");
const consonantChar = document.getElementById("consonantChar");
const vowelChar = document.getElementById("vowelChar");
const consonantSound = document.getElementById("consonantSound");
const vowelSound = document.getElementById("vowelSound");
const mergeZone = document.getElementById("mergeZone");
const mergeVowel = document.getElementById("mergeVowel");
const mergeSyllable = document.getElementById("mergeSyllable");
const fusionFill = document.getElementById("fusionFill");
const successText = document.getElementById("successText");
const successCard = document.getElementById("successCard");
const successStars = document.getElementById("successStars");
const starCount = document.getElementById("starCount");
const roundCount = document.getElementById("roundCount");
const buddy = document.getElementById("buddy");
const buddyStatus = document.getElementById("buddyStatus");
const playExampleButton = document.getElementById("playExampleButton");
const repeatButton = document.getElementById("repeatButton");
const choicesList = document.getElementById("choicesList");
const helperBanner = document.getElementById("helperBanner");
const audioNote = document.getElementById("audioNote");
const streakCount = document.getElementById("streakCount");
const rescuedCount = document.getElementById("rescuedCount");
const journeyMap = document.getElementById("journeyMap");
const goalText = document.getElementById("goalText");
const weekPackLabel = document.getElementById("weekPackLabel");
const syllableInput = document.getElementById("syllableInput");
const saveConfigButton = document.getElementById("saveConfigButton");
const resetConfigButton = document.getElementById("resetConfigButton");
const configStatus = document.getElementById("configStatus");

function currentLevel() {
  return state.levels[state.levelIndex];
}

function parseSyllables(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim().toUpperCase())
    .filter(Boolean);

  const cleaned = [];
  const seen = new Set();

  lines.forEach((line) => {
    const lettersOnly = line.replace(/[^A-ZÆØÅ]/g, "");
    if (lettersOnly.length < 2) {
      return;
    }

    const syllable = lettersOnly.slice(0, 2);
    if (!seen.has(syllable)) {
      seen.add(syllable);
      cleaned.push(syllable);
    }
  });

  return cleaned;
}

function buildLevels(syllables) {
  return syllables.map((label, index) => ({
    id: label.toLowerCase(),
    label,
    consonant: label[0],
    vowel: label[1],
    stage: Math.floor(index / 2) + 1
  }));
}

function refreshLayoutMetrics() {
  state.mobileLayout = window.matchMedia("(max-width: 620px)").matches;
  if (state.mobileLayout) {
    const vowelTop = vowelLetter.offsetTop;
    const consonantTop = draggableLetter.offsetTop;
    state.maxDrag = Math.max(0, vowelTop - consonantTop - 10);
    return;
  }
  state.maxDrag = Math.max(0, vowelLetter.offsetLeft - draggableLetter.offsetLeft - 150);
}

function loadStoredSyllables() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return { syllables: DEFAULT_SYLLABLES, custom: false };
  }

  const parsed = parseSyllables(saved);
  return parsed.length
    ? { syllables: parsed, custom: true }
    : { syllables: DEFAULT_SYLLABLES, custom: false };
}

function updateWeekPackLabel() {
  const usingDefault = state.levels.map((level) => level.label).join(",") === DEFAULT_SYLLABLES.join(",");
  weekPackLabel.textContent = usingDefault ? "Standard stavingar" : "Eiga vekepakke";
}

function updateGoalText() {
  const doneCount = state.completed.size;
  const totalCount = state.levels.length;
  const remaining = Math.max(0, totalCount - doneCount);

  goalText.textContent = remaining > 0
    ? `Det er att ${remaining} stavingar i denne vekepakka.`
    : "Alle stavingane i vekepakka er fullførte. Du kan starte på nytt eller leggje inn nye.";
}

function updateJourneyMap() {
  journeyMap.innerHTML = "";

  const stages = new Map();
  state.levels.forEach((level) => {
    if (!stages.has(level.stage)) {
      stages.set(level.stage, []);
    }
    stages.get(level.stage).push(level);
  });

  [...stages.entries()].forEach(([stageNumber, levels]) => {
    const done = levels.every((level) => state.completed.has(level.id));
    const current = levels.some((level) => level.id === currentLevel().id);

    const card = document.createElement("div");
    card.className = "journey-node unlocked";
    if (done) {
      card.classList.add("done");
    }
    if (current) {
      card.classList.add("current");
    }
    card.style.setProperty("--node-accent", stageNumber % 2 === 0 ? "#35c26b" : "#ffb347");

    const title = document.createElement("p");
    title.className = "journey-node-title";
    title.textContent = `Vekegruppe ${stageNumber}`;

    const trail = document.createElement("div");
    trail.className = "journey-mini-trail";
    levels.forEach((level) => {
      const bead = document.createElement("span");
      bead.className = "journey-bead";
      if (state.completed.has(level.id)) {
        bead.classList.add("done");
      }
      if (level.id === currentLevel().id) {
        bead.classList.add("current");
      }
      trail.appendChild(bead);
    });

    const meta = document.createElement("p");
    meta.className = "journey-node-meta";
    meta.textContent = levels.map((level) => level.label).join(" · ");

    card.append(title, trail, meta);
    journeyMap.appendChild(card);
  });
}

function updateChoiceList() {
  choicesList.innerHTML = "";

  state.levels.forEach((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-pill";
    button.textContent = level.label;

    if (index === state.levelIndex) {
      button.classList.add("active");
    }
    if (state.completed.has(level.id)) {
      button.classList.add("done");
    }

    button.addEventListener("click", () => {
      state.levelIndex = index;
      loadLevel();
    });

    choicesList.appendChild(button);
  });
}

function refreshScoreboard() {
  starCount.textContent = String(state.stars);
  roundCount.textContent = `${state.levelIndex + 1}/${state.levels.length}`;
  streakCount.textContent = String(state.streak);
  rescuedCount.textContent = String(state.rescued);
  updateJourneyMap();
  updateChoiceList();
  updateGoalText();
  updateWeekPackLabel();
}

function spawnStarBurst() {
  for (let i = 0; i < 8; i += 1) {
    const star = document.createElement("span");
    star.className = "star-burst";
    star.style.left = `${15 + Math.random() * 70}%`;
    star.style.top = `${48 + Math.random() * 24}%`;
    star.style.animationDelay = `${i * 45}ms`;
    successStars.appendChild(star);
    window.setTimeout(() => star.remove(), 1200);
  }
}

function resetBoardVisuals() {
  state.progress = 0;
  state.pendingProgress = 0;
  state.hasMerged = false;
  state.isDragging = false;
  state.progressStart = 0;
  draggableLetter.style.transform = "translate(0px, -50%)";
  draggableLetter.setAttribute("aria-valuenow", "0");
  draggableLetter.classList.remove("fusing", "dragging");
  vowelLetter.classList.remove("fusing");
  mergeZone.classList.remove("active", "show-vowel", "show-syllable");
  fusionFill.style.width = "0%";
  successCard.style.background = "linear-gradient(180deg, #fef9d9, #ffffff)";
}

function loadLevel() {
  const level = currentLevel();
  resetBoardVisuals();
  refreshLayoutMetrics();
  consonantChar.textContent = level.consonant;
  vowelChar.textContent = level.vowel;
  consonantSound.textContent = "første lyd";
  vowelSound.textContent = "andre lyd";
  mergeVowel.textContent = level.vowel;
  mergeSyllable.textContent = level.label;
  successText.textContent = `Dra ${level.consonant} roleg mot ${level.vowel} og bygg ${level.label}.`;
  helperBanner.textContent = `Trykk på ${level.consonant} og dra roleg mot ${level.vowel}.`;
  buddyStatus.textContent = "Lyso ventar på hjelp.";
  refreshScoreboard();
}

function applyDragPosition(progress) {
  if (state.mobileLayout) {
    const y = progress * state.maxDrag;
    draggableLetter.style.transform = `translate(0px, calc(-50% + ${y}px))`;
  } else {
    const x = progress * state.maxDrag;
    draggableLetter.style.transform = `translate(${x}px, -50%)`;
  }

  fusionFill.style.width = `${Math.round(progress * 100)}%`;
  draggableLetter.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  mergeZone.classList.toggle("active", progress > 0.62);
  mergeZone.classList.toggle("show-vowel", progress > 0.68 && progress <= 0.88);
  mergeZone.classList.toggle("show-syllable", progress > 0.88);
  draggableLetter.classList.toggle("fusing", progress > 0.55);
  vowelLetter.classList.toggle("fusing", progress > 0.7);
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function findNextLevelIndex() {
  for (let index = 0; index < state.levels.length; index += 1) {
    if (!state.completed.has(state.levels[index].id)) {
      return index;
    }
  }
  return (state.levelIndex + 1) % state.levels.length;
}

function completeMerge() {
  if (state.hasMerged) {
    return;
  }

  const level = currentLevel();
  state.hasMerged = true;
  state.isDragging = false;
  state.stars += 3;
  state.streak += 1;
  state.rescued += 1;
  state.completed.add(level.id);

  successCard.style.background = "linear-gradient(180deg, #d7ffd9, #fff8d4)";
  successText.textContent = `${level.label}! Flott jobba. Du fekk 3 stjerner.`;
  helperBanner.textContent = `Hurra! ${level.label} blei ferdig.`;
  buddy.classList.remove("saved");
  void buddy.offsetWidth;
  buddy.classList.add("saved");
  buddyStatus.textContent = `${level.label} er redda.`;
  spawnStarBurst();
  refreshScoreboard();

  window.setTimeout(() => {
    state.levelIndex = findNextLevelIndex();
    loadLevel();
  }, 1500);
}

function setProgress(progress) {
  state.progress = clamp(progress, 0, 1);
  applyDragPosition(state.progress);
  if (state.progress > 0.93) {
    completeMerge();
  }
}

function scheduleProgress(progress) {
  state.pendingProgress = clamp(progress, 0, 1);
  if (state.framePending) {
    return;
  }

  state.framePending = true;
  window.requestAnimationFrame(() => {
    state.framePending = false;
    if (!state.isDragging && !state.hasMerged) {
      return;
    }
    setProgress(state.pendingProgress);
  });
}

function handlePointerMove(event) {
  if (!state.isDragging || state.hasMerged) {
    return;
  }

  if (state.mobileLayout) {
    const delta = event.clientY - state.pointerStartCoord;
    scheduleProgress(state.progressStart + delta / Math.max(state.maxDrag, 1));
    return;
  }

  const delta = event.clientX - state.pointerStartCoord;
  scheduleProgress(state.progressStart + delta / Math.max(state.maxDrag, 1));
}

function handlePointerUp() {
  if (!state.isDragging) {
    return;
  }

  state.isDragging = false;
  state.progressStart = state.progress;
  draggableLetter.classList.remove("dragging");

  if (!state.hasMerged) {
    state.progress = 0;
    state.pendingProgress = 0;
    state.streak = 0;
    applyDragPosition(0);
    buddyStatus.textContent = "Prøv ein gong til. Dra roleg heilt fram.";
    helperBanner.textContent = "Fin øving. La oss prøve ein gong til heilt fram til vokalen.";
    refreshScoreboard();
  }
}

function onPointerDown(event) {
  state.isDragging = true;
  state.hasMerged = false;
  state.progressStart = state.progress;
  helperBanner.textContent = "Ja, slik. Hald fram roleg mot vokalen.";
  successText.textContent = "Dra bokstavane heilt saman til dei møtest.";
  draggableLetter.classList.add("dragging");
  refreshLayoutMetrics();
  state.pointerStartCoord = state.mobileLayout ? event.clientY : event.clientX;
  draggableLetter.setPointerCapture(event.pointerId);
}

function playExample() {
  loadLevel();
  helperBanner.textContent = "Eg viser eit stille eksempel no.";
  const steps = [0.08, 0.2, 0.35, 0.52, 0.68, 0.82, 0.96];
  let index = 0;

  const advance = () => {
    if (index >= steps.length) {
      completeMerge();
      return;
    }
    setProgress(steps[index]);
    index += 1;
    window.setTimeout(advance, 180);
  };

  advance();
}

function handleKeyboard(event) {
  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    return;
  }

  event.preventDefault();

  if (event.key === "Enter" || event.key === " ") {
    playExample();
    return;
  }

  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -0.12 : 0.12;
  setProgress(state.progress + direction);
}

function applyWeeklySyllables(syllables, sourceLabel) {
  state.levels = buildLevels(syllables);
  state.levelIndex = 0;
  state.stars = 0;
  state.streak = 0;
  state.rescued = 0;
  state.completed = new Set();
  syllableInput.value = syllables.join("\n");
  configStatus.textContent = sourceLabel;
  loadLevel();
}

function saveWeeklySyllables() {
  const parsed = parseSyllables(syllableInput.value);
  if (!parsed.length) {
    configStatus.textContent = "Skriv inn minst éi gyldig stavelse med to bokstavar.";
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, parsed.join("\n"));
  applyWeeklySyllables(parsed, "Ny vekepakke er lagra for denne eleven på denne eininga.");
}

function resetWeeklySyllables() {
  window.localStorage.removeItem(STORAGE_KEY);
  applyWeeklySyllables(DEFAULT_SYLLABLES, "Standardpakka er aktiv.");
}

draggableLetter.addEventListener("pointerdown", onPointerDown);
draggableLetter.addEventListener("pointerup", handlePointerUp);
draggableLetter.addEventListener("pointercancel", handlePointerUp);
draggableLetter.addEventListener("keydown", handleKeyboard);

playExampleButton.addEventListener("click", playExample);
repeatButton.addEventListener("click", () => {
  loadLevel();
});
saveConfigButton.addEventListener("click", saveWeeklySyllables);
resetConfigButton.addEventListener("click", resetWeeklySyllables);

window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("resize", () => {
  refreshLayoutMetrics();
  applyDragPosition(state.progress);
});

audioNote.textContent = "Denne versjonen er laga utan lydstøtte.";
const initialConfig = loadStoredSyllables();
applyWeeklySyllables(
  initialConfig.syllables,
  initialConfig.custom
    ? "Eiga vekepakke er lasta inn frå denne eininga."
    : "Standardpakka er aktiv."
);
