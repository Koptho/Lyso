const syllables = [
  { consonant: "S", vowel: "O", consonantPhoneme: "s", vowelPhoneme: "o", label: "SO" },
  { consonant: "M", vowel: "A", consonantPhoneme: "m", vowelPhoneme: "a", label: "MA" },
  { consonant: "L", vowel: "E", consonantPhoneme: "l", vowelPhoneme: "e", label: "LE" },
  { consonant: "N", vowel: "I", consonantPhoneme: "n", vowelPhoneme: "i", label: "NI" },
  { consonant: "R", vowel: "O", consonantPhoneme: "r", vowelPhoneme: "o", label: "RO" }
];

const state = {
  round: 0,
  stars: 0,
  progress: 0,
  isDragging: false,
  hasMerged: false,
  dragX: 0,
  pointerStartCoord: 0,
  progressStart: 0,
  audioReady: false,
  audio: null
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
const track = document.getElementById("track");

function phonemeLabel(symbol) {
  return `/${symbol}/`;
}

function ensureAudio() {
  if (state.audioReady) {
    return;
  }

  const AudioContextRef = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextRef) {
    return;
  }
  const audioContext = new AudioContextRef();
  const master = audioContext.createGain();
  master.gain.value = 0.2;
  master.connect(audioContext.destination);

  state.audio = {
    context: audioContext,
    master,
    sourceNodes: []
  };
  state.audioReady = true;
}

function stopAudio() {
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

function playStretch(progress) {
  ensureAudio();
  if (!state.audioReady) {
    return;
  }

  const syllable = syllables[state.round];
  const { context, master } = state.audio;
  if (context.state === "suspended") {
    context.resume();
  }

  if (!state.audio.consonantNode) {
    const consonantNode = createConsonantNode(context, syllable.consonantPhoneme);
    const vowelNode = createVowelNode(context, syllable.vowelPhoneme);
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

function releaseStretch(playSyllable = false) {
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

function updateChoiceList() {
  choicesList.innerHTML = "";
  syllables.forEach((syllable, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-pill";
    button.textContent = syllable.label;
    if (index === state.round) {
      button.classList.add("active");
    }
    if (index < state.round) {
      button.classList.add("done");
    }
    button.addEventListener("click", () => {
      state.round = index;
      state.hasMerged = false;
      loadRound();
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

function loadRound() {
  const current = syllables[state.round];
  releaseStretch(false);
  state.progress = 0;
  state.dragX = 0;
  state.hasMerged = false;
  state.isDragging = false;
  state.progressStart = 0;
  draggableLetter.style.transform = "translate(0px, -50%)";
  draggableLetter.setAttribute("aria-valuenow", "0");
  draggableLetter.classList.remove("fusing", "dragging");
  vowelLetter.classList.remove("fusing");
  mergeZone.classList.remove("active");
  fusionFill.style.width = "0%";
  consonantChar.textContent = current.consonant;
  vowelChar.textContent = current.vowel;
  consonantSound.textContent = phonemeLabel(current.consonantPhoneme);
  vowelSound.textContent = phonemeLabel(current.vowelPhoneme);
  mergeSyllable.textContent = current.label;
  roundCount.textContent = String(state.round + 1);
  successText.textContent =
    `Dra ${current.consonant} roleg mot ${current.vowel} og høyr ${current.label}.`;
  buddyStatus.textContent = "Lyso ventar på hjelp.";
  updateChoiceList();
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
    const maxDrag = getMaxDrag();
    const y = progress * maxDrag;
    draggableLetter.style.transform = `translate(0px, calc(-50% + ${y}px))`;
  } else {
    const maxDrag = getMaxDrag();
    const x = progress * maxDrag;
    draggableLetter.style.transform = `translate(${x}px, -50%)`;
  }

  fusionFill.style.width = `${Math.round(progress * 100)}%`;
  draggableLetter.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
  mergeZone.classList.toggle("active", progress > 0.62);
  draggableLetter.classList.toggle("fusing", progress > 0.55);
  vowelLetter.classList.toggle("fusing", progress > 0.7);
}

function completeMerge() {
  if (state.hasMerged) {
    return;
  }

  state.hasMerged = true;
  state.isDragging = false;
  state.stars += 3;
  starCount.textContent = String(state.stars);
  successCard.style.background = "linear-gradient(180deg, #d7ffd9, #fff8d4)";
  successText.textContent = `${syllables[state.round].label}! Du hjelpte Lyso og fekk 3 stjerner.`;
  buddy.classList.remove("saved");
  void buddy.offsetWidth;
  buddy.classList.add("saved");
  buddyStatus.textContent = `Hurra! ${syllables[state.round].label} er redda.`;
  spawnStarBurst();
  releaseStretch(true);

  const nextRound = (state.round + 1) % syllables.length;
  window.setTimeout(() => {
    successCard.style.background = "linear-gradient(180deg, #fef9d9, #ffffff)";
    state.round = nextRound;
    loadRound();
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
    const next = clamp(state.progressStart + delta / Math.max(maxDrag, 1), 0, 1);
    setProgress(next);
    return;
  }

  const delta = event.clientX - state.pointerStartCoord;
  const next = clamp(state.progressStart + delta / Math.max(maxDrag, 1), 0, 1);
  setProgress(next);
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
    applyDragPosition(0);
    buddyStatus.textContent = "Prøv ein gong til. Dra roleg heilt fram.";
  }
}

function onPointerDown(event) {
  ensureAudio();
  state.isDragging = true;
  state.hasMerged = false;
  state.progressStart = state.progress;
  successText.textContent = "Høyr lyden strekkje seg heilt til bokstavane møtest.";
  draggableLetter.classList.add("dragging");
  const isMobileStack = window.matchMedia("(max-width: 620px)").matches;
  state.pointerStartCoord = isMobileStack ? event.clientY : event.clientX;
  draggableLetter.setPointerCapture(event.pointerId);
}

function playExample() {
  ensureAudio();
  loadRound();
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
  loadRound();
});

window.addEventListener("pointermove", handlePointerMove);
window.addEventListener("pointerup", handlePointerUp);
window.addEventListener("resize", () => applyDragPosition(state.progress));

loadRound();
