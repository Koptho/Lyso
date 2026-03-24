const worlds = [
  {
    id: "soleng",
    title: "Solenga",
    goal: 2,
    accent: "#ffb347",
    levels: [
      { consonant: "S", vowel: "O", consonantPhoneme: "s", vowelPhoneme: "o", label: "SO" },
      { consonant: "M", vowel: "A", consonantPhoneme: "m", vowelPhoneme: "a", label: "MA" }
    ]
  },
  {
    id: "lysskog",
    title: "Lysskogen",
    goal: 2,
    accent: "#35c26b",
    levels: [
      { consonant: "L", vowel: "E", consonantPhoneme: "l", vowelPhoneme: "e", label: "LE" },
      { consonant: "N", vowel: "I", consonantPhoneme: "n", vowelPhoneme: "i", label: "NI" }
    ]
  },
  {
    id: "stjernesjo",
    title: "Stjernesjoen",
    goal: 1,
    accent: "#30bced",
    levels: [
      { consonant: "R", vowel: "O", consonantPhoneme: "r", vowelPhoneme: "o", label: "RO" }
    ]
  }
];

const allLevels = worlds.flatMap((world, worldIndex) =>
  world.levels.map((level, levelIndex) => ({
    ...level,
    id: level.label.toLowerCase(),
    worldIndex,
    levelIndex,
    consonantAudio: `./sounds/phonemes/${level.consonantPhoneme}.mp3`,
    vowelAudio: `./sounds/phonemes/${level.vowelPhoneme}.mp3`,
    syllableAudio: `./sounds/syllables/${level.label.toLowerCase()}.mp3`
  }))
);

const state = {
  levelIndex: 0,
  stars: 0,
  streak: 0,
  rescued: 0,
  progress: 0,
  isDragging: false,
  hasMerged: false,
  pointerStartCoord: 0,
  progressStart: 0,
  completed: new Set(),
  unlockedWorlds: 1,
  audioReady: false,
  audio: null,
  audioAssets: new Map(),
  usingRealAudio: false
};

const draggableLetter = document.getElementById("draggableLetter");
const vowelLetter = document.getElementById("vowelLetter");
const consonantChar = document.getElementById("consonantChar");
const vowelChar = document.getElementById("vowelChar");
const consonantSound = document.getElementById("consonantSound");
const vowelSound = document.getElementById("vowelSound");
const mergeZone = document.getElementById("mergeZone");
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
const audioMode = document.getElementById("audioMode");

function currentLevel() {
  return allLevels[state.levelIndex];
}

function currentWorld() {
  return worlds[currentLevel().worldIndex];
}

function phonemeLabel(symbol) {
  return `/${symbol}/`;
}

function loadAudioAsset(path) {
  if (state.audioAssets.has(path)) {
    return state.audioAssets.get(path);
  }

  const audio = new Audio(path);
  audio.preload = "auto";
  const record = { audio, loaded: false, failed: false, pending: null };
  record.pending = new Promise((resolve) => {
    audio.addEventListener("canplaythrough", () => {
      record.loaded = true;
      resolve(record);
    }, { once: true });

    audio.addEventListener("error", () => {
      record.failed = true;
      resolve(record);
    }, { once: true });

    audio.load();
  });

  state.audioAssets.set(path, record);
  return record;
}

async function ensureLevelAudio(level) {
  const records = [
    loadAudioAsset(level.consonantAudio),
    loadAudioAsset(level.vowelAudio),
    loadAudioAsset(level.syllableAudio)
  ];
  await Promise.all(records.map((record) => record.pending));
  const ready = records.every((record) => record.loaded && !record.failed);
  state.usingRealAudio = ready;
  audioMode.textContent = ready ? "Ekte lydfiler frå sounds/" : "Innebygd lydmotor";
  if (ready) {
    audioNote.textContent = "Ekte lydfiler er funne og brukte i denne runda.";
  }
  return ready;
}

function ensureAudio() {
  if (state.audioReady) {
    return;
  }

  const AudioContextRef = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextRef) {
    audioNote.textContent = "Denne nettlesaren støttar ikkje lydmotoren. Du kan framleis dra bokstavane.";
    return;
  }

  const audioContext = new AudioContextRef();
  const master = audioContext.createGain();
  master.gain.value = 0.2;
  master.connect(audioContext.destination);

  state.audio = {
    context: audioContext,
    master,
    sourceNodes: [],
    htmlLoops: []
  };
  state.audioReady = true;
  audioNote.textContent = "Lydmotoren er klar. Trykk og dra for å høyre bokstavlyden.";
}

function stopHtmlLoops() {
  if (!state.audio?.htmlLoops) {
    return;
  }

  state.audio.htmlLoops.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
  state.audio.htmlLoops = [];
}

function stopAudio() {
  stopHtmlLoops();

  if (!state.audioReady) {
    return;
  }

  state.audio.sourceNodes.forEach((node) => {
    try {
      node.stop?.();
    } catch (error) {
      // Ignore stop errors for already stopped nodes.
    }
    node.disconnect?.();
  });
  state.audio.sourceNodes = [];
}

function shapedNoise(context, type = "bandpass", frequency = 900, q = 8) {
  const bufferSize = context.sampleRate * 1.2;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;

  source.connect(filter);
  return { source, output: filter };
}

function createConsonantNode(context, phoneme) {
  const gain = context.createGain();
  gain.gain.value = 0.001;

  if (phoneme === "s") {
    const { source, output } = shapedNoise(context, "bandpass", 4800, 4);
    output.connect(gain);
    return { source, gain };
  }

  const oscillator = context.createOscillator();
  const toneGain = context.createGain();
  oscillator.type = phoneme === "r" ? "sawtooth" : "triangle";
  oscillator.frequency.value = phoneme === "m" ? 180 : phoneme === "n" ? 220 : phoneme === "l" ? 250 : 200;
  toneGain.gain.value = phoneme === "r" ? 0.35 : 0.26;
  oscillator.connect(toneGain);
  toneGain.connect(gain);

  if (phoneme === "m" || phoneme === "n") {
    const lowpass = context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = phoneme === "m" ? 550 : 800;
    toneGain.disconnect();
    oscillator.connect(lowpass);
    lowpass.connect(gain);
  }

  if (phoneme === "l") {
    const formant = context.createBiquadFilter();
    formant.type = "bandpass";
    formant.frequency.value = 1200;
    formant.Q.value = 1.2;
    toneGain.disconnect();
    oscillator.connect(formant);
    formant.connect(gain);
  }

  return { source: oscillator, gain };
}

function createVowelNode(context, phoneme) {
  const oscillator = context.createOscillator();
  const formantOne = context.createBiquadFilter();
  const formantTwo = context.createBiquadFilter();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 230;
  gain.gain.value = 0.001;

  const formants = {
    a: [850, 1350],
    e: [500, 2000],
    i: [300, 2400],
    o: [450, 800]
  };

  const [first, second] = formants[phoneme] || [600, 1200];
  formantOne.type = "bandpass";
  formantOne.frequency.value = first;
  formantOne.Q.value = 3;
  formantTwo.type = "bandpass";
  formantTwo.frequency.value = second;
  formantTwo.Q.value = 3;

  oscillator.connect(formantOne);
  oscillator.connect(formantTwo);
  formantOne.connect(gain);
  formantTwo.connect(gain);

  return { source: oscillator, gain };
}

async function startRealAudioLoops(level) {
  const ready = await ensureLevelAudio(level);
  if (!ready) {
    return false;
  }

  stopHtmlLoops();
  const consonant = loadAudioAsset(level.consonantAudio).audio.cloneNode();
  const vowel = loadAudioAsset(level.vowelAudio).audio.cloneNode();
  consonant.loop = true;
  vowel.loop = true;
  consonant.volume = 0.3;
  vowel.volume = 0;
  await consonant.play().catch(() => {});
  await vowel.play().catch(() => {});
  state.audio.htmlLoops = [consonant, vowel];
  return true;
}

function updateRealAudioVolumes(progress) {
  const [consonant, vowel] = state.audio?.htmlLoops || [];
  if (!consonant || !vowel) {
    return;
  }

  consonant.volume = Math.max(0.06, 0.38 - progress * 0.25);
  vowel.volume = Math.max(0, progress * 0.42);
}

async function playStretch(progress) {
  const level = currentLevel();
  if (state.usingRealAudio) {
    if (!state.audio?.htmlLoops?.length) {
      ensureAudio();
      await startRealAudioLoops(level);
    }
    updateRealAudioVolumes(progress);
    return;
  }

  ensureAudio();
  if (!state.audioReady) {
    return;
  }

  const { context, master } = state.audio;
  if (context.state === "suspended") {
    context.resume();
  }

  if (!state.audio.consonantNode) {
    const consonantNode = createConsonantNode(context, level.consonantPhoneme);
    const vowelNode = createVowelNode(context, level.vowelPhoneme);
    consonantNode.gain.connect(master);
    vowelNode.gain.connect(master);
    consonantNode.source.start();
    vowelNode.source.start();
    state.audio.sourceNodes.push(consonantNode.source, vowelNode.source);
    state.audio.consonantNode = consonantNode;
    state.audio.vowelNode = vowelNode;
  }

  const now = context.currentTime;
  const consonantLevel = Math.max(0.06, 0.34 - progress * 0.22);
  const vowelLevel = Math.max(0.001, progress * 0.36);
  state.audio.consonantNode.gain.gain.cancelScheduledValues(now);
  state.audio.vowelNode.gain.gain.cancelScheduledValues(now);
  state.audio.consonantNode.gain.gain.linearRampToValueAtTime(consonantLevel, now + 0.04);
  state.audio.vowelNode.gain.gain.linearRampToValueAtTime(vowelLevel, now + 0.04);
}

function playSyllableClip(level) {
  const record = loadAudioAsset(level.syllableAudio);
  if (!record.loaded || record.failed) {
    return false;
  }

  const audio = record.audio.cloneNode();
  audio.volume = 0.75;
  audio.play().catch(() => {});
  state.audio.htmlLoops = [audio];
  return true;
}

function releaseStretch(playSyllable = false) {
  if (state.usingRealAudio) {
    stopHtmlLoops();
    if (playSyllable) {
      playSyllableClip(currentLevel());
    }
  }

  if (!state.audioReady || !state.audio?.consonantNode || !state.audio?.vowelNode) {
    return;
  }

  const { context, consonantNode, vowelNode } = state.audio;
  const now = context.currentTime;
  consonantNode.gain.gain.cancelScheduledValues(now);
  vowelNode.gain.gain.cancelScheduledValues(now);
  consonantNode.gain.gain.linearRampToValueAtTime(0.001, now + 0.07);
  vowelNode.gain.gain.linearRampToValueAtTime(playSyllable ? 0.24 : 0.001, now + 0.07);

  if (playSyllable) {
    vowelNode.gain.gain.linearRampToValueAtTime(0.001, now + 0.48);
  }

  window.setTimeout(() => {
    stopAudio();
    if (state.audio) {
      state.audio.consonantNode = null;
      state.audio.vowelNode = null;
    }
  }, playSyllable ? 520 : 160);
}

function unlockedLevelCount() {
  const count = Math.min(allLevels.length, state.completed.size + 1);
  return Math.max(1, count);
}

function updateJourneyMap() {
  journeyMap.innerHTML = "";

  worlds.forEach((world, worldIndex) => {
    const worldDone = world.levels.every((level) => state.completed.has(level.label.toLowerCase()));
    const unlocked = worldIndex < state.unlockedWorlds;

    const card = document.createElement("div");
    card.className = "journey-node";
    if (unlocked) {
      card.classList.add("unlocked");
    }
    if (worldDone) {
      card.classList.add("done");
    }
    if (worldIndex === currentLevel().worldIndex) {
      card.classList.add("current");
    }
    card.style.setProperty("--node-accent", world.accent);

    const title = document.createElement("p");
    title.className = "journey-node-title";
    title.textContent = world.title;

    const trail = document.createElement("div");
    trail.className = "journey-mini-trail";
    world.levels.forEach((level) => {
      const bead = document.createElement("span");
      bead.className = "journey-bead";
      if (state.completed.has(level.label.toLowerCase())) {
        bead.classList.add("done");
      }
      if (currentLevel().label === level.label) {
        bead.classList.add("current");
      }
      trail.appendChild(bead);
    });

    const meta = document.createElement("p");
    meta.className = "journey-node-meta";
    meta.textContent = unlocked ? `Opna ${world.levels.length} lydsteg` : `Låst til ${world.goal} rette`;

    card.append(title, trail, meta);
    journeyMap.appendChild(card);
  });
}

function nextLockedWorld() {
  return worlds[state.unlockedWorlds] || null;
}

function updateGoalText() {
  const nextWorld = nextLockedWorld();
  const frontierWorldIndex = Math.min(state.unlockedWorlds - 1, worlds.length - 1);
  const frontierWorld = worlds[frontierWorldIndex];
  const completedInWorld = frontierWorld.levels.filter((level) =>
    state.completed.has(level.label.toLowerCase())
  ).length;

  if (nextWorld) {
    const remaining = Math.max(0, frontierWorld.goal - completedInWorld);
    goalText.textContent = remaining > 0
      ? `Bygg ${remaining} til i ${frontierWorld.title} for å opne ${nextWorld.title}.`
      : `${nextWorld.title} er klar til å opnast.`;
    return;
  }

  goalText.textContent = "Du er på siste lydsti. Samle fleire stjerner og øv på dei opna stavingane.";
}

function updateChoiceList() {
  const limit = unlockedLevelCount();
  choicesList.innerHTML = "";

  allLevels.slice(0, limit).forEach((level, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-pill";
    button.textContent = `${level.label} · ${worlds[level.worldIndex].title}`;
    if (index === state.levelIndex) {
      button.classList.add("active");
    }
    if (state.completed.has(level.id)) {
      button.classList.add("done");
    }
    button.addEventListener("click", () => {
      state.levelIndex = index;
      state.hasMerged = false;
      loadLevel();
    });
    choicesList.appendChild(button);
  });
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

function refreshScoreboard() {
  starCount.textContent = String(state.stars);
  roundCount.textContent = String(state.levelIndex + 1);
  streakCount.textContent = String(state.streak);
  rescuedCount.textContent = String(state.rescued);
  updateJourneyMap();
  updateGoalText();
  updateChoiceList();
}

function unlockWorldsIfNeeded() {
  worlds.forEach((world, index) => {
    const completedInWorld = world.levels.filter((level) => state.completed.has(level.label.toLowerCase())).length;
    if (completedInWorld >= world.goal) {
      state.unlockedWorlds = Math.max(state.unlockedWorlds, index + 2);
    }
  });
  state.unlockedWorlds = Math.min(state.unlockedWorlds, worlds.length);
}

async function loadLevel() {
  const level = currentLevel();
  releaseStretch(false);
  await ensureLevelAudio(level);
  state.progress = 0;
  state.hasMerged = false;
  state.isDragging = false;
  state.progressStart = 0;
  draggableLetter.style.transform = "translate(0px, -50%)";
  draggableLetter.setAttribute("aria-valuenow", "0");
  draggableLetter.classList.remove("fusing", "dragging");
  vowelLetter.classList.remove("fusing");
  mergeZone.classList.remove("active");
  fusionFill.style.width = "0%";
  consonantChar.textContent = level.consonant;
  vowelChar.textContent = level.vowel;
  consonantSound.textContent = phonemeLabel(level.consonantPhoneme);
  vowelSound.textContent = phonemeLabel(level.vowelPhoneme);
  mergeSyllable.textContent = level.label;
  successText.textContent = `Dra ${level.consonant} roleg mot ${level.vowel} og høyr ${level.label}.`;
  buddyStatus.textContent = "Lyso ventar på hjelp.";
  helperBanner.textContent = `Trykk på ${level.consonant} og dra roleg mot ${level.vowel}.`;
  successCard.style.background = "linear-gradient(180deg, #fef9d9, #ffffff)";
  refreshScoreboard();
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, number));
}

function getMaxDrag() {
  const isMobileStack = window.matchMedia("(max-width: 620px)").matches;
  if (isMobileStack) {
    const vowelTop = vowelLetter.offsetTop;
    const consonantTop = draggableLetter.offsetTop;
    return Math.max(0, vowelTop - consonantTop - 10);
  }
  return Math.max(0, vowelLetter.offsetLeft - draggableLetter.offsetLeft - 150);
}

function applyDragPosition(progress) {
  const isMobileStack = window.matchMedia("(max-width: 620px)").matches;
  if (isMobileStack) {
    const y = progress * getMaxDrag();
    draggableLetter.style.transform = `translate(0px, calc(-50% + ${y}px))`;
  } else {
    const x = progress * getMaxDrag();
    draggableLetter.style.transform = `translate(${x}px, -50%)`;
  }

  fusionFill.style.width = `${Math.round(progress * 100)}%`;
  draggableLetter.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  mergeZone.classList.toggle("active", progress > 0.62);
  draggableLetter.classList.toggle("fusing", progress > 0.55);
  vowelLetter.classList.toggle("fusing", progress > 0.7);
}

function findNextLevelIndex() {
  const limit = unlockedLevelCount();
  for (let index = 0; index < limit; index += 1) {
    if (!state.completed.has(allLevels[index].id)) {
      return index;
    }
  }
  return (state.levelIndex + 1) % limit;
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
  unlockWorldsIfNeeded();
  successCard.style.background = "linear-gradient(180deg, #d7ffd9, #fff8d4)";
  successText.textContent = `${level.label}! Du hjelpte Lyso og fekk 3 stjerner.`;
  helperBanner.textContent = `Hurra! ${level.label} blei til ei stavelse.`;
  buddy.classList.remove("saved");
  void buddy.offsetWidth;
  buddy.classList.add("saved");
  buddyStatus.textContent = `Hurra! ${level.label} er redda.`;
  spawnStarBurst();
  releaseStretch(true);
  refreshScoreboard();

  window.setTimeout(() => {
    state.levelIndex = findNextLevelIndex();
    loadLevel();
  }, 1600);
}

function setProgress(progress) {
  state.progress = clamp(progress, 0, 1);
  applyDragPosition(state.progress);
  playStretch(state.progress);
  if (state.progress > 0.93) {
    completeMerge();
  }
}

function handlePointerMove(event) {
  if (!state.isDragging || state.hasMerged) {
    return;
  }

  const isMobileStack = window.matchMedia("(max-width: 620px)").matches;
  const maxDrag = getMaxDrag();
  if (isMobileStack) {
    const delta = event.clientY - state.pointerStartCoord;
    setProgress(state.progressStart + delta / Math.max(maxDrag, 1));
    return;
  }

  const delta = event.clientX - state.pointerStartCoord;
  setProgress(state.progressStart + delta / Math.max(maxDrag, 1));
}

function handlePointerUp() {
  if (!state.isDragging) {
    return;
  }

  state.isDragging = false;
  state.progressStart = state.progress;
  draggableLetter.classList.remove("dragging");

  if (!state.hasMerged) {
    releaseStretch(false);
    state.progress = 0;
    state.streak = 0;
    applyDragPosition(0);
    buddyStatus.textContent = "Prøv ein gong til. Dra roleg heilt fram.";
    helperBanner.textContent = "Fin øving. La oss prøve ein gong til heilt fram til vokalen.";
    refreshScoreboard();
  }
}

function onPointerDown(event) {
  ensureAudio();
  state.isDragging = true;
  state.hasMerged = false;
  state.progressStart = state.progress;
  successText.textContent = "Høyr lyden strekkje seg heilt til bokstavane møtest.";
  helperBanner.textContent = "Ja, slik. Hald fram roleg mot vokalen.";
  draggableLetter.classList.add("dragging");
  const isMobileStack = window.matchMedia("(max-width: 620px)").matches;
  state.pointerStartCoord = isMobileStack ? event.clientY : event.clientX;
  draggableLetter.setPointerCapture(event.pointerId);
}

function playExample() {
  ensureAudio();
  loadLevel();
  helperBanner.textContent = "Eg viser eit lydeksempel no.";
  const steps = [0.08, 0.2, 0.35, 0.52, 0.68, 0.82, 0.96];
  let index = 0;

  const advance = () => {
    if (index >= steps.length) {
      completeMerge();
      return;
    }
    setProgress(steps[index]);
    index += 1;
    window.setTimeout(advance, 220);
  };

  advance();
}

function handleKeyboard(event) {
  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
    return;
  }

  event.preventDefault();
  ensureAudio();

  if (event.key === "Enter" || event.key === " ") {
    helperBanner.textContent = "Eg viser eit lydeksempel no.";
    playExample();
    return;
  }

  const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -0.12 : 0.12;
  setProgress(state.progress + direction);
  if (state.progress <= 0.01) {
    releaseStretch(false);
  }
}

draggableLetter.addEventListener("pointerdown", onPointerDown);
draggableLetter.addEventListener("pointermove", handlePointerMove);
draggableLetter.addEventListener("pointerup", handlePointerUp);
draggableLetter.addEventListener("pointercancel", handlePointerUp);
draggableLetter.addEventListener("keydown", handleKeyboard);

playExampleButton.addEventListener("click", playExample);
repeatButton.addEventListener("click", () => {
  releaseStretch(false);
  loadLevel();
});

window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("resize", () => applyDragPosition(state.progress));

loadLevel();
