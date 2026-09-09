const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

// Minimal DOM and virtual time let us exercise the actual app event handlers
// without browser dependencies or waiting through real reading pauses.
function setup({ width = 768, stored = {}, storageBlocked = false, hidden = false } = {}) {
  class Element {
    constructor() {
      this.children = []; this.attrs = {}; this.handlers = {}; this.captured = new Set();
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.classes = new Set(); this.clientWidth = width; this.scrollLeft = 0;
      this.value = ''; this.hidden = false; this.checked = true;
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        toggle: (name, yes) => yes ? this.classes.add(name) : this.classes.delete(name)
      };
    }
    set className(value) { this.classes = new Set(value.split(' ')); }
    setAttribute(name, value) { this.attrs[name] = value; }
    appendChild(element) { this.children.push(element); }
    replaceChildren(...children) { this.children = children; }
    querySelectorAll(selector) { return this.children.filter(child => child.classes.has(selector.slice(1))); }
    addEventListener(name, callback) { (this.handlers[name] ||= []).push(callback); }
    dispatch(name, event = {}) { for (const callback of this.handlers[name] || []) callback(event); }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); this.dispatch('lostpointercapture', { pointerId: id }); }
    closest(selector) { return this.editable && selector.includes('textarea') ? this : null; }
  }
  const ids = [...fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').matchAll(/id="([^"]+)"/g)].map(match => match[1]);
  const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
  elements.syllableInput.editable = true;
  const document = new Element();
  document.hidden = hidden;
  document.getElementById = id => elements[id];
  document.createElement = () => new Element();
  let clock = 0, timerId = 0;
  const timers = new Map();
  const window = new Element();
  window.setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: clock + delay }); return id; };
  window.clearTimeout = id => timers.delete(id);
  window.requestAnimationFrame = callback => window.setTimeout(callback, 16);
  window.cancelAnimationFrame = window.clearTimeout;
  window.localStorage = {
    getItem(key) { if (storageBlocked) throw Error('blocked'); return stored[key] ?? null; },
    setItem(key, value) { if (storageBlocked) throw Error('blocked'); stored[key] = value; },
    removeItem(key) { if (storageBlocked) throw Error('blocked'); delete stored[key]; }
  };
  const context = vm.createContext({ window, document });
  vm.runInContext(source, context);
  const read = expr => vm.runInContext(expr, context);
  const tick = duration => {
    const end = clock + duration;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, timer] = next; timers.delete(id); clock = timer.at; timer.callback();
    }
    clock = end;
  };
  const pointer = (name, x, { id = 1, primary = true, button = 0 } = {}) => {
    elements.draggableLetter.dispatch(name, { pointerId: id, clientX: x, clientY: 110, isPrimary: primary, button, preventDefault() {} });
  };
  const words = text => { elements.syllableInput.value = text; elements.saveConfigButton.dispatch('click'); };
  const drag = () => { pointer('pointerdown', 100); pointer('pointerup', 100 + read('state.step')); };
  return { read, tick, pointer, words, drag, elements, window, document, stored };
}

test('whole words, Norwegian letters, normalization and legacy storage survive', () => {
  const app = setup({ stored: { 'lyso-weekly-syllables': 'so\nma' } });
  assert.equal(app.read('currentWord()'), 'so');
  app.words(' LESE \r\nskule\nbla\u030a\nærleg\nøy\nlese\nòg\nfôr');
  assert.equal(app.read('state.words.join(",")'), 'lese,skule,blå,ærleg,øy,òg,fôr');
  assert.equal(app.stored['lyso-weekly-syllables'], 'lese\nskule\nblå\nærleg\nøy\nòg\nfôr');
});

test('invalid lines are explained and never silently truncated or joined', () => {
  const app = setup(); app.words('lese\nhei du\na\nfoo-bar');
  assert.equal(app.read('currentWord()'), 'so');
  assert.match(app.elements.configStatus.textContent, /2, 3, 4/);
});

test('lese has every station, a pause at each, and only one final reward', () => {
  const app = setup(); app.words('lese\nskule');
  for (let station = 1; station <= 3; station++) {
    app.drag();
    assert.equal(app.read('state.station'), station);
    assert.equal(app.elements.builtWord.textContent, 'lese'.slice(0, station + 1));
    assert.equal(app.elements.reward.hidden, station !== 3);
    if (station < 3) {
      app.drag(); assert.equal(app.read('state.station'), station);
      app.tick(549); assert.equal(app.read('state.locked'), true);
      app.tick(1); assert.equal(app.read('state.locked'), false);
    }
  }
  assert.equal(app.read('state.completed.size'), 1);
  app.drag(); app.tick(5999); assert.equal(app.read('currentWord()'), 'lese');
  app.tick(1); assert.equal(app.read('currentWord()'), 'skule');
});

test('fast flick and release before an animation frame still reaches one station', () => {
  const app = setup(); app.words('lese');
  app.pointer('pointerdown', 100); app.pointer('pointermove', 1000);
  app.pointer('pointerup', 1000);
  assert.equal(app.read('state.station'), 1);
  app.tick(1000); assert.equal(app.read('state.station'), 1);
  assert.equal(app.read('state.finished'), false);
});

test('partial release, cancellation and lost capture retain progress for another drag', () => {
  const app = setup(); app.words('lese');
  const step = app.read('state.step');
  app.pointer('pointerdown', 100); app.pointer('pointerup', 100 + step * .4);
  assert.ok(Math.abs(app.read('state.progress') - .4) < .001);
  app.pointer('pointerdown', 200); app.pointer('pointermove', 200 + step * .2); app.tick(16);
  app.pointer('pointercancel', 0);
  assert.ok(Math.abs(app.read('state.progress') - .6) < .001);
  assert.equal(app.read('state.pointerId'), null);
  app.pointer('pointerdown', 300); app.pointer('pointerup', 300 + step * .4);
  assert.equal(app.read('state.station'), 1);
});

test('second finger, wrong release and right mouse button do not hijack the drag', () => {
  const app = setup();
  app.pointer('pointerdown', 100, { button: 2 }); assert.equal(app.read('state.pointerId'), null);
  app.pointer('pointerdown', 100);
  app.pointer('pointerdown', 500, { id: 2, primary: false });
  app.pointer('pointerup', 500, { id: 2, primary: false });
  assert.equal(app.read('state.pointerId'), 1);
  app.pointer('pointerup', 100 + app.read('state.step'));
  assert.equal(app.read('state.finished'), true);
});

test('switching words cancels old reward timers, station timers and animation frames', () => {
  const app = setup(); app.words('so\nlese'); app.drag();
  app.elements.choicesList.children[1].dispatch('click');
  app.tick(10000); assert.equal(app.read('currentWord()'), 'lese');
  assert.equal(app.read('state.finished'), false);
  app.drag(); app.elements.choicesList.children[0].dispatch('click'); app.tick(550);
  assert.equal(app.read('currentWord()'), 'so'); assert.equal(app.read('state.station'), 0);
  app.pointer('pointerdown', 10); app.pointer('pointermove', 800);
  app.elements.choicesList.children[1].dispatch('click'); app.tick(16);
  assert.equal(app.read('state.station'), 0);
});

test('long words keep large tiles and reveal the next station as reading progresses', () => {
  const app = setup({ width: 280 }); app.words('sommarferie');
  assert.equal(app.read('state.tileSize'), 88);
  for (let station = 1; station < 11; station++) {
    app.drag(); app.tick(550);
    if (station < 10) {
      const left = app.read('state.inset + state.station * state.step');
      const right = left + app.read('state.step + state.tileSize');
      assert.ok(left >= app.elements.trackViewport.scrollLeft);
      assert.ok(right <= app.elements.trackViewport.scrollLeft + 280);
    }
  }
  assert.equal(app.read('state.finished'), true);
});

test('rotation cancels the active touch and preserves the same reading progress', () => {
  const app = setup(); app.words('lese');
  app.pointer('pointerdown', 100); app.pointer('pointermove', 150); app.tick(16);
  const before = app.read('state.progress');
  app.elements.trackViewport.clientWidth = 320; app.window.dispatch('resize');
  assert.equal(app.read('state.pointerId'), null);
  assert.equal(app.read('state.progress'), before);
  assert.equal(app.read('state.tileSize'), 88);
  app.drag(); assert.equal(app.read('state.station'), 1);
});

test('manual pace and hidden tabs never advance unexpectedly', () => {
  const app = setup();
  app.elements.autoAdvance.checked = false; app.elements.autoAdvance.dispatch('change');
  app.drag(); app.elements.nextWordButton.dispatch('click');
  assert.equal(app.read('currentWord()'), 'so');
  app.tick(60000); assert.equal(app.read('currentWord()'), 'so');
  app.elements.nextWordButton.dispatch('click'); assert.equal(app.read('currentWord()'), 'ma');
  const background = setup({ hidden: true }); background.drag(); background.tick(6000);
  assert.equal(background.read('currentWord()'), 'so');
  assert.equal(background.elements.nextWordButton.disabled, true);
  background.document.hidden = false; background.document.dispatch('visibilitychange');
  background.tick(5999); assert.equal(background.read('currentWord()'), 'so');
  background.tick(1); assert.equal(background.read('currentWord()'), 'ma');
});

test('storage failure does not stop practice or accepting this session’s words', () => {
  const app = setup({ storageBlocked: true }); app.words('lese');
  assert.equal(app.read('currentWord()'), 'lese');
  assert.match(app.elements.configStatus.textContent, /kunne ikkje lagre/);
  app.drag(); assert.equal(app.read('state.station'), 1);
});

test('native selection is blocked for letters and allowed for the adult editor', () => {
  const app = setup(); let blocked = false;
  app.document.dispatch('selectstart', { target: app.elements.draggableLetter, preventDefault() { blocked = true; } });
  assert.equal(blocked, true); blocked = false;
  app.document.dispatch('selectstart', { target: app.elements.syllableInput, preventDefault() { blocked = true; } });
  assert.equal(blocked, false);
});

test('keyboard access respects intermediate stops and never exceeds the word', () => {
  const app = setup(); app.words('lese');
  const key = (repeat = false) => app.elements.draggableLetter.dispatch('keydown', { key: 'Enter', repeat, preventDefault() {} });
  key(); assert.equal(app.read('state.station'), 1);
  app.tick(550); key(true); assert.equal(app.read('state.station'), 1);
  key(); app.tick(550); key(); key();
  assert.equal(app.read('state.station'), 3); assert.equal(app.read('state.finished'), true);
});

test('one held touch completes lese with capture, snap, colours and final reward intact', () => {
  const app = setup(); app.words('lese');
  const step = app.read('state.step');
  app.pointer('pointerdown', 74);
  for (let station = 1; station <= 3; station++) {
    app.pointer('pointermove', 74 + station * step); app.tick(16);
    assert.equal(app.read('state.station'), station);
    assert.equal(app.elements.reward.hidden, station < 3);
    assert.equal(app.elements.stations.children[station - 1].classes.has('visited'), true);
    if (station < 3) {
      assert.equal(app.elements.draggableLetter.hasPointerCapture(1), true);
      assert.equal(app.elements.stations.children[station + 1].classes.has('next'), true);
      app.tick(550);
      assert.equal(app.read('state.station'), station);
      assert.equal(app.read('state.progress'), 0);
    }
  }
  assert.equal(app.read('state.finished'), true);
  assert.equal(app.elements.draggableLetter.hasPointerCapture(1), false);
  assert.equal(app.read('state.pointerId'), null);
});

test('movement during a station pause continues without another pointer event', () => {
  const app = setup(); app.words('lese'); const step = app.read('state.step');
  app.pointer('pointerdown', 50); app.pointer('pointermove', 50 + step); app.tick(16);
  app.pointer('pointermove', 50 + step * 1.5); app.tick(549);
  assert.equal(app.read('state.progress'), 0);
  app.tick(1);
  assert.ok(Math.abs(app.read('state.progress') - .5) < .001);
  assert.equal(app.read('state.pointerId'), 1);
});

test('large movement during a pause reaches only one new station and preserves its pause', () => {
  const app = setup(); app.words('lese'); const step = app.read('state.step');
  app.pointer('pointerdown', 50); app.pointer('pointermove', 50 + step); app.tick(16);
  app.pointer('pointermove', 2000); app.tick(550);
  assert.equal(app.read('state.station'), 2);
  assert.equal(app.read('state.locked'), true);
  assert.match(app.elements.helperBanner.textContent, /Stopp litt/);
  app.tick(2000);
  assert.equal(app.read('state.station'), 2);
  assert.equal(app.read('state.progress'), 0);
  assert.equal(app.elements.reward.hidden, true);
});

for (const end of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  test(`${end} during a held pause prevents delayed advancement`, () => {
    const app = setup(); app.words('lese'); const step = app.read('state.step');
    app.pointer('pointerdown', 50); app.pointer('pointermove', 50 + step); app.tick(16);
    app.pointer('pointermove', 50 + step * 2);
    app.pointer(end, 50 + step * 2);
    app.tick(1000);
    assert.equal(app.read('state.station'), 1);
    assert.equal(app.read('state.progress'), 0);
    assert.equal(app.read('state.pointerId'), null);
    app.drag(); assert.equal(app.read('state.station'), 2);
  });
}

test('latest movement during a pause wins; moving left allows immediate forward response', () => {
  const app = setup(); app.words('lese'); const step = app.read('state.step');
  app.pointer('pointerdown', 50); app.pointer('pointermove', 50 + step); app.tick(16);
  app.pointer('pointermove', 50 + step * 2);
  app.pointer('pointermove', 40); app.tick(550);
  assert.equal(app.read('state.station'), 1);
  assert.equal(app.read('state.progress'), 0);
  app.pointer('pointermove', 40 + step * .25); app.tick(16);
  assert.ok(Math.abs(app.read('state.progress') - .25) < .001);
});

test('long word can complete with one held touch staying inside a narrow screen', () => {
  const app = setup({ width: 280 }); app.words('sommarferie');
  const step = app.read('state.step');
  app.pointer('pointerdown', 60);
  for (let station = 1; station < 11; station++) {
    app.pointer('pointermove', 60 + step); app.tick(16);
    assert.equal(app.read('state.station'), station);
    if (station < 10) {
      app.pointer('pointermove', 60); app.tick(550);
      assert.equal(app.read('state.pointerId'), 1);
      assert.equal(app.read('state.progress'), 0);
      assert.equal(app.read('state.station'), station);
    }
  }
  assert.ok(app.elements.trackViewport.scrollLeft > 0);
  assert.equal(app.read('state.finished'), true);
});

test('word change during a held pause cancels capture and any recorded movement', () => {
  const app = setup(); app.words('lese\nskule');
  app.pointer('pointerdown', 50); app.pointer('pointermove', 50 + app.read('state.step')); app.tick(16);
  app.pointer('pointermove', 1000);
  app.elements.choicesList.children[1].dispatch('click');
  assert.equal(app.elements.draggableLetter.hasPointerCapture(1), false);
  app.tick(5000);
  assert.equal(app.read('currentWord()'), 'skule');
  assert.equal(app.read('state.station'), 0);
  assert.equal(app.read('state.progress'), 0);
});
