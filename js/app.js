// ===================================================================
// APP — entry point, animation loop, UI wiring, state management
// ===================================================================
import { SpiroMath, Camera, hexToRgba } from './spiro-math.js';
import { CURVE_TYPES } from './curve-types.js';
import { state } from './state.js';
import { Renderer, PenTrail, Ripples, Annotations } from './renderer.js';

function curveColor(hue) {
  return `hsl(${hue % 360}, ${state.saturation}%, ${state.lightness}%)`;
}

// ===================================================================
// APP STATE SNAPSHOTS
// ===================================================================
const HISTORY_STATE_KEYS = [
  'R', 'r', 'd', 'is3D', 'h', 'k',
  'speed', 'lineWidth', 'hueStart', 'hueSweep',
  'colorMode', 'saturation', 'lightness', 'strokeMode',
  'showFX', 'showGlow', 'fxOpacity',
  'loopStyle', 'trailLength',
  'bgColor', 'onionSkin', 'showAnnotations',
  'symmetryLock', 'targetPetals',
  'offsetX', 'offsetY', 'soundOn'
];

const PERSISTED_STATE_KEYS = HISTORY_STATE_KEYS.filter(key =>
  !['offsetX', 'offsetY', 'soundOn'].includes(key)
);

function captureStateSnapshot({ includeLayers = false, includeLFO = false } = {}) {
  const snap = { curveType: state.curveType.id };
  HISTORY_STATE_KEYS.forEach(key => { snap[key] = state[key]; });
  if (includeLayers) {
    snap.layerCount = state.layerCount;
    snap.layerData = state.layerCount > 0 ? Renderer.layersCanvas.toDataURL() : null;
  }
  if (includeLFO && typeof LFOEngine !== 'undefined') {
    snap.lfo = LFOEngine.capture();
  }
  return snap;
}

function applyStateSnapshot(snap, { restoreLayers = false, restart = false, fromSettings = false } = {}) {
  if (!snap) return;

  HISTORY_STATE_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(snap, key)) state[key] = snap[key];
  });

  const curveId = snap.curveType ?? snap.mode;
  if (curveId) state.curveType = CURVE_TYPES[curveId] ?? CURVE_TYPES.hypo;

  if (fromSettings || (state.soundOn && typeof Sound !== 'undefined' && !Sound.initialized)) {
    state.soundOn = false;
  }

  state.colorMode = state.colorMode || (state.hueSweep === 0 ? 'solid' : 'gradient');
  state.showGlow = state.showFX;
  if (state.layerCount > 0 && state.loopStyle === 'trail') state.loopStyle = 'wipe';

  if (snap.lfo && typeof LFOEngine !== 'undefined') {
    LFOEngine.restore(snap.lfo);
  }

  document.body.style.background = state.bgColor;
  document.documentElement.style.setProperty('--bg', state.bgColor);

  if (restoreLayers) restoreLayerSnapshot(snap);

  syncUIToState();
  if (restart) Animator.restart();
}

function comparableSnapshot(snap) {
  const copy = { ...snap };
  delete copy.layerData;
  return JSON.stringify(copy);
}

function restoreLayerSnapshot(snap) {
  if (snap.layerData) {
    const img = new Image();
    img.onload = () => {
      Renderer.layersCtx.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
      Renderer.layersCtx.clearRect(0, 0, Renderer.width, Renderer.height);
      Renderer.layersCtx.drawImage(img, 0, 0, Renderer.width, Renderer.height);
    };
    img.src = snap.layerData;
    state.layerCount = snap.layerCount || 0;
  } else {
    Renderer.layersCtx.clearRect(0, 0, Renderer.width, Renderer.height);
    state.layerCount = 0;
  }
  updateLayerBadge();
}

// ===================================================================
// UNDO / REDO
// ===================================================================
const History = {
  stack: [],
  index: -1,
  maxSize: 50,
  ignoreNext: false,

  captureState() {
    return captureStateSnapshot({ includeLayers: true, includeLFO: true });
  },

  push() {
    if (this.ignoreNext) { this.ignoreNext = false; return; }
    const snap = this.captureState();
    if (this.index >= 0) {
      const prev = this.stack[this.index];
      if (comparableSnapshot(prev) === comparableSnapshot(snap)) return;
    }
    this.stack.length = this.index + 1;
    this.stack.push(snap);
    if (this.stack.length > this.maxSize) this.stack.shift();
    this.index = this.stack.length - 1;
  },

  restore(snap) {
    this.ignoreNext = true;
    applyStateSnapshot(snap, { restoreLayers: true, restart: true });
  },

  undo() {
    if (this.index <= 0) return;
    this.index--;
    this.restore(this.stack[this.index]);
  },

  redo() {
    if (this.index >= this.stack.length - 1) return;
    this.index++;
    this.restore(this.stack[this.index]);
  }
};

// ===================================================================
// SOUND
// ===================================================================
const Sound = {
  ctx: null, osc: null, gain: null, filter: null,
  initialized: false,

  init() {
    if (this.initialized) return;
    if (!window.AudioContext && !window.webkitAudioContext) throw new Error('AudioContext unavailable');
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.osc = this.ctx.createOscillator();
    this.filter = this.ctx.createBiquadFilter();
    this.gain = this.ctx.createGain();

    this.osc.type = 'sine';
    this.osc.frequency.value = 220;
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 800;
    this.filter.Q.value = 2;
    this.gain.gain.value = 0;

    this.osc.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.osc.start();
    this.initialized = true;
  },

  update(penDist, maxDist, hue) {
    if (!state.soundOn || !this.initialized) return;
    const freq = 120 + (penDist / (maxDist || 1)) * 500;
    this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    const cutoff = 400 + (hue / 360) * 1200;
    this.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.05);
  },

  fadeIn() {
    if (!this.initialized) return;
    this.gain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.3);
  },

  fadeOut() {
    if (!this.initialized) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  },

  toggle() {
    state.soundOn = !state.soundOn;
    if (state.soundOn) {
      try {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (state.isPlaying) this.fadeIn();
      } catch {
        state.soundOn = false;
      }
    } else {
      this.fadeOut();
    }
    this.syncUI();
  },

  syncUI() {
    const btn = document.getElementById('btn-sound');
    if (btn) btn.classList.toggle('active', state.soundOn && this.initialized);
  }
};

// ===================================================================
// IDLE ANIMATION (breathing)
// ===================================================================
const IdleAnim = {
  active: false,
  angle: 0,
  hueShift: 0,

  tick() {
    if (!this.active) this.active = true;
    this.angle += 0.06;
    this.hueShift += 0.12;
    const container = document.getElementById('canvas-container');
    container.style.transform = `rotate(${this.angle}deg)`;
    container.style.filter = `hue-rotate(${this.hueShift}deg)`;

    if (state.showGlow && !state.isEvolving) {
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.002);
      Renderer.glowCanvas.style.opacity = pulse;
    }
  },

  reset() {
    if (!this.active) return;
    this.active = false;
    document.getElementById('canvas-container').style.transform = '';
    document.getElementById('canvas-container').style.filter = '';
  },

  stop()  { this.reset(); },
  start() { this.active = true; }
};

// ===================================================================
// AUTO-EVOLVE
// ===================================================================
const Evolve = {
  targets: null,
  nextChangeTime: 0,

  start() {
    state.isEvolving = true;
    this.pickTargets();
    this.nextChangeTime = Date.now() + 6000;
    document.getElementById('btn-evolve').classList.add('active');
    if (!state.isPlaying) Animator.start();
  },

  stop() {
    state.isEvolving = false;
    document.getElementById('btn-evolve').classList.remove('active');
  },

  toggle() {
    state.isEvolving ? this.stop() : this.start();
  },

  pickTargets() {
    this.targets = {
      R: 50 + Math.random() * 130,
      r: 10 + Math.random() * 80,
      d: 10 + Math.random() * 80
    };
  },

  update() {
    if (!state.isEvolving) return;

    state.R += (this.targets.R - state.R) * 0.003;
    state.r += (this.targets.r - state.r) * 0.003;
    state.d += (this.targets.d - state.d) * 0.003;

    document.getElementById('slider-R').value = Math.round(state.R);
    document.getElementById('val-R').textContent = Math.round(state.R);
    document.getElementById('slider-r').value = Math.round(state.r);
    document.getElementById('val-r').textContent = Math.round(state.r);
    document.getElementById('slider-d').value = Math.round(state.d);
    document.getElementById('val-d').textContent = Math.round(state.d);

    if (Date.now() > this.nextChangeTime) {
      this.pickTargets();
      this.nextChangeTime = Date.now() + 6000 + Math.random() * 4000;
    }

    Renderer.fadeCurve(0.008);
    Renderer.computeScale();
  }
};

// ===================================================================
// RECORDER
// ===================================================================
const Recorder = {
  frames: [],
  recState: 'idle',
  intervalId: null,
  playTimeout: null,
  playIndex: 0,
  INTERVAL_MS: 150,

  _capture() {
    this.frames.push({
      R: state.R, r: state.r, d: state.d,
      curveTypeId: state.curveType.id, is3D: state.is3D,
      h: state.h, k: state.k,
      hueStart: state.hueStart, hueSweep: state.hueSweep,
      lineWidth: state.lineWidth
    });
  },

  startRecording() {
    this.frames = [];
    this.recState = 'recording';
    this._capture();
    this.intervalId = setInterval(() => this._capture(), this.INTERVAL_MS);
    this._updateUI();
  },

  stopRecording() {
    clearInterval(this.intervalId);
    this.recState = this.frames.length > 1 ? 'ready' : 'idle';
    this._updateUI();
  },

  startPlayback() {
    if (this.frames.length < 2) return;
    this.recState = 'playing';
    this.playIndex = 0;
    this._updateUI();
    this._playStep();
  },

  _playStep() {
    if (this.recState !== 'playing') return;
    if (this.playIndex >= this.frames.length) {
      this.recState = 'ready';
      this._updateUI();
      return;
    }
    const f = this.frames[this.playIndex++];
    state.R = f.R; state.r = f.r; state.d = f.d;
    state.curveType = CURVE_TYPES[f.curveTypeId] ?? CURVE_TYPES.hypo;
    state.is3D = f.is3D;
    state.h = f.h; state.k = f.k;
    state.hueStart = f.hueStart; state.hueSweep = f.hueSweep;
    state.lineWidth = f.lineWidth;
    updateAllSliderUI();
    document.getElementById('curve-type-select').value = state.curveType.id;
    document.querySelectorAll('.dim-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.dim === (f.is3D ? '3d' : '2d')));
    document.getElementById('controls-panel').classList.toggle('show-3d', f.is3D);
    Animator.livePreview();
    this.playTimeout = setTimeout(() => this._playStep(), this.INTERVAL_MS);
  },

  stopPlayback() {
    clearTimeout(this.playTimeout);
    this.recState = 'ready';
    this._updateUI();
  },

  toggle() {
    if      (this.recState === 'idle')      this.startRecording();
    else if (this.recState === 'recording') this.stopRecording();
    else if (this.recState === 'ready')     this.startPlayback();
    else if (this.recState === 'playing')   this.stopPlayback();
  },

  _updateUI() {
    const btn = document.getElementById('btn-rec');
    const icon = document.getElementById('rec-icon');
    const label = document.getElementById('rec-label');
    if (!btn) return;
    btn.classList.remove('active', 'rec-active');
    switch (this.recState) {
      case 'idle':
        icon.innerHTML = '&#9679;'; label.textContent = 'Rec'; break;
      case 'recording':
        icon.innerHTML = '&#9632;'; label.textContent = 'Stop';
        btn.classList.add('rec-active'); break;
      case 'ready':
        icon.innerHTML = '&#9654;'; label.textContent = 'Play'; break;
      case 'playing':
        icon.innerHTML = '&#9632;'; label.textContent = 'Stop';
        btn.classList.add('active'); break;
    }
  }
};

// ===================================================================
// ANIMATOR — unified RAF loop
// ===================================================================
const Animator = {
  stepsPerFrame: 8,
  running: false,
  idleAge: 0,
  rewindT: null,
  lastFrameTs: 0,

  beginLoop() {
    if (this.running) return;
    this.running = true;
    this._frame();
  },

  _frame(ts = performance.now()) {
    const frameDt = this.lastFrameTs ? Math.min((ts - this.lastFrameTs) / 1000, 0.1) : 0;
    this.lastFrameTs = ts;

    if (state.is3D) Camera.update();

    Evolve.update();

    const lfoDirty = LFOEngine.update(frameDt);
    if (lfoDirty) this.renderCurrentState();

    if (state.isPlaying && !state.isComplete) {
      const dt = state.speed * 0.015;
      const totalT = state.isEvolving ? state.curveType.totalT(state) : state.totalT;

      for (let i = 0; i < this.stepsPerFrame; i++) {
        if (!state.isEvolving && state.loopStyle !== 'trail' && state.currentT >= totalT) {
          state.isComplete = true;
          state.isPlaying = false;
          this.idleAge = 0;
          this.rewindT = null;
          this.onComplete();
          this.updatePlayButton();
          break;
        }

        if (state.erasing) {
          state.eraseT = Math.min(state.eraseT + dt, state.totalT);
          if (state.eraseT >= state.totalT) {
            state.erasing = false;
            state.eraseT = 0;
            state.currentT = 0;
            state.prevPoint = null;
          }
        } else if (state.loopStyle === 'trail' && !state.isEvolving) {
          state.currentT += dt;
          // Normalize to keep floats healthy; stays in [totalT, 2·totalT]
          if (state.currentT > totalT * 2) state.currentT -= totalT;
        } else {
          state.currentT = state.isEvolving
            ? state.currentT + dt
            : Math.min(state.currentT + dt, totalT);
          if (state.isEvolving && state.currentT > totalT * 2) {
            state.currentT = 0;
          }
        }
      }

      if (state.loopStyle !== 'trail') {
        const drawFrom = state.erasing ? state.eraseT : 0;
        const drawTo = state.erasing ? state.totalT : state.currentT;
        this._redrawUpTo(drawTo, drawFrom);
      } else {
        const trailWindow = state.totalT * (state.trailLength / 100);
        const trailStart = Math.max(0, state.currentT - trailWindow);
        this._redrawTrailWindow(trailStart, state.currentT, trailWindow);
      }

      if (state.currentT > 0) {
        const tPen = state.loopStyle === 'trail' ? state.currentT % (state.totalT || 1) : state.currentT;
        const pt = state.curveType.generatePoint(state, tPen);
        const sp = Renderer.toScreen(pt);
        const progress = totalT > 0 ? (state.currentT % totalT) / totalT : 0;
        const hue = state.hueStart + progress * state.hueSweep;
        PenTrail.addPoint(sp, hue);
        const dist = Math.sqrt(pt.x * pt.x + pt.y * pt.y + (pt.z || 0) * (pt.z || 0));
        Sound.update(dist, state.curveType.maxExtent(state), hue);
      }
    }

    if (state.isComplete && !state.isPlaying) {
      this.idleAge++;

      if (state.loopStyle === 'rewind') {
        if (this.rewindT === null) this.rewindT = state.totalT;
        if (this.rewindT > 0) {
          const rewindDt = state.totalT / (60 * 3);
          this.rewindT = Math.max(0, this.rewindT - rewindDt);
          this._redrawUpTo(this.rewindT, 0);
          Renderer.clearGlow();
        } else {
          this.restart();
          return;
        }
      } else {
        if (state.is3D) {
          this._3dFrame = (this._3dFrame || 0) + 1;
          if (this._3dFrame % 2 === 0) this._redrawComplete();
        }
        if (this.idleAge > 120) {
          IdleAnim.tick();
        }
      }
    }

    Renderer.clearOverlay();
    if (state.showFX && state.isPlaying) {
      Renderer.drawConstruction(state.currentT);
    }
    if (state.isPlaying) PenTrail.draw(Renderer.overlayCtx);
    Ripples.update(Renderer.overlayCtx);
    Annotations.draw(Renderer.overlayCtx);
    if (state.loopStyle === 'trail') {
      Renderer.glowCanvas.style.visibility = 'hidden';
      Renderer.layersCanvas.style.visibility = 'hidden';
      Renderer.overlayCanvas.style.visibility = '';
    } else {
      Renderer.glowCanvas.style.visibility = '';
      Renderer.layersCanvas.style.visibility = '';
      Renderer.overlayCanvas.style.visibility = '';
      Renderer.updateGlow();
    }

    if (state.isPlaying) MathPanel.updateProgress();

    this._saveFrame = (this._saveFrame || 0) + 1;
    if (this._saveFrame % 120 === 0) saveSettings();

    requestAnimationFrame(ts => this._frame(ts));
  },

  start() {
    if (state.isPlaying) return;
    if (state.isComplete) this.beginDraw();
    state.isPlaying = true;
    this.updatePlayButton();
    if (state.soundOn) Sound.fadeIn();
  },

  pause() {
    state.isPlaying = false;
    this.updatePlayButton();
    if (state.soundOn) Sound.fadeOut();
  },

  toggle() { state.isPlaying ? this.pause() : this.start(); },

  beginDraw() {
    Camera.dragging = false;
    state.erasing = false;
    state.eraseT = 0;
    if (state.onionSkin && !state.onionCaptured && state.isComplete) {
      state.onionCaptured = true;
      Renderer.ghostLayer(0.18);
    }
    Renderer.fadeCurve(0.3);
    if (state.showGlow) {
      const ctx = Renderer.glowCtx;
      ctx.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
      ctx.fillStyle = hexToRgba(state.bgColor, 0.4);
      ctx.fillRect(0, 0, Renderer.width, Renderer.height);
    }
    state.currentT = 0;
    state.prevPoint = null;
    state.isComplete = false;
    this.idleAge = 0;
    this.rewindT = null;
    PenTrail.clear();
    IdleAnim.reset();
    state.totalT = state.curveType.totalT(state);
    Renderer.computeScale();
    MathPanel.update();
  },

  restart() {
    state.onionCaptured = false;
    this.beginDraw();
    state.isPlaying = true;
    this.updatePlayButton();
    if (state.soundOn) Sound.fadeIn();
  },

  softReset() {
    this.beginDraw();
    state.isPlaying = true;
    this.updatePlayButton();
  },

  renderCurrentState() {
    state.totalT = state.curveType.totalT(state);
    Renderer.computeScale();
    if (state.isPlaying && !state.isComplete) {
      MathPanel.update();
      return;
    }
    if (state.isComplete) this._redrawComplete();
    else if (state.currentT > 0) this._redrawUpTo(state.currentT, state.erasing ? state.eraseT : 0);
    MathPanel.update();
  },

  reset() {
    this.pause();
    state.currentT = 0;
    state.prevPoint = null;
    state.isComplete = false;
    this.idleAge = 0;
    Renderer.clearCurve();
    Renderer.clearGlow();
    Renderer.clearOverlay();
    PenTrail.clear();
    IdleAnim.reset();
    MathPanel.update();
  },

  onComplete() {
    if (navigator.vibrate) navigator.vibrate([15, 50, 15]);
    MathPanel.update();

    if (state.showGlow) {
      let pulseCount = 0;
      const pulseInterval = setInterval(() => {
        const v = 0.5 + 0.5 * Math.sin(pulseCount * 0.3);
        Renderer.glowCanvas.style.opacity = v;
        pulseCount++;
        if (pulseCount > 30) {
          clearInterval(pulseInterval);
          Renderer.glowCanvas.style.opacity = 1;
        }
      }, 50);
    }

    Ripples.burst(Renderer.centerX, Renderer.centerY, state.hueStart, 5);

    if (state.loopStyle === 'wipe') {
      state.erasing = true;
      state.eraseT = 0;
      state.isComplete = false;
      state.isPlaying = true;
      this.rewindT = null;
      this.updatePlayButton();
    }
  },

  updatePlayButton() {
    const btn = document.getElementById('btn-play');
    const icon = btn.querySelector('.btn-icon');
    const label = btn.querySelector('.btn-label');
    if (state.isPlaying) {
      icon.innerHTML = '&#9646;&#9646;'; label.textContent = 'Pause'; btn.classList.add('active');
    } else {
      icon.innerHTML = '&#9654;'; label.textContent = 'Play'; btn.classList.remove('active');
    }
  },

  livePreview() {
    if (state.onionSkin && !state.onionCaptured && state.isComplete) {
      state.onionCaptured = true;
      Renderer.ghostLayer(0.18);
    }
    state.isPlaying = false;
    Renderer.clearCurve();
    Renderer.clearGlow();
    Renderer.clearOverlay();
    PenTrail.clear();
    IdleAnim.reset();

    const totalT = state.curveType.totalT(state);
    state.totalT = totalT;
    Renderer.computeScale();
    const dt = Math.max(0.02, totalT / 4000);
    let prev = null;
    for (let t = 0; t < totalT; t += dt) {
      const pt = state.curveType.generatePoint(state, t);
      if (prev) {
        const progress = t / totalT;
        const hue = state.hueStart + progress * state.hueSweep;
        Renderer.drawSegment(prev, pt, curveColor(hue), progress);
      }
      prev = pt;
    }
    if (prev) {
      const finalPt = state.curveType.generatePoint(state, totalT);
      Renderer.drawSegment(prev, finalPt, curveColor(state.hueStart + state.hueSweep), 1);
      state.prevPoint = finalPt;
    }
    state.currentT = totalT;
    state.isComplete = true;
    this.idleAge = 0;
    if (state.showGlow) {
      const ctx = Renderer.glowCtx;
      ctx.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
      ctx.filter = 'blur(8px)';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(Renderer.curveCanvas, 0, 0, Renderer.width, Renderer.height);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    this.updatePlayButton();
    MathPanel.update();
    Annotations.draw(Renderer.overlayCtx);
  },

  _redrawTrailWindow(startT, endT, trailWindow) {
    const cCtx = Renderer.curveCtx;
    cCtx.save();
    cCtx.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
    cCtx.globalCompositeOperation = 'copy';
    cCtx.fillStyle = state.bgColor;
    cCtx.fillRect(0, 0, Renderer.width, Renderer.height);
    cCtx.restore();
    const totalT = state.totalT || 1;
    const dt = Math.max(0.02, totalT / 4000);

    // Use t % totalT for point generation so the trail wraps seamlessly.
    // Track prevTWrapped to detect the seam and skip the crossing segment.
    const startWrapped = startT % totalT;
    let prev = startT > 0 ? state.curveType.generatePoint(state, startWrapped) : null;
    let prevTWrapped = startT > 0 ? startWrapped : -1;

    for (let t = startT; t < endT; t += dt) {
      const tWrapped = t % totalT;
      const pt = state.curveType.generatePoint(state, tWrapped);
      if (prev && tWrapped >= prevTWrapped - dt * 0.5) {
        const progress = tWrapped / totalT;
        Renderer.drawSegment(prev, pt, curveColor(state.hueStart + progress * state.hueSweep), progress);
      }
      prev = pt;
      prevTWrapped = tWrapped;
    }

    if (state.showGlow) {
      const gCtx = Renderer.glowCtx;
      gCtx.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
      gCtx.clearRect(0, 0, Renderer.width, Renderer.height);
      let p2 = startT > 0 ? state.curveType.generatePoint(state, startWrapped) : null;
      let p2TWrapped = startT > 0 ? startWrapped : -1;
      for (let t2 = startT; t2 < endT; t2 += dt * 3) {
        const tWrapped2 = t2 % totalT;
        const pt2 = state.curveType.generatePoint(state, tWrapped2);
        if (p2 && tWrapped2 >= p2TWrapped - dt * 3 * 0.5) {
          const sp1 = Renderer.toScreen(p2), sp2 = Renderer.toScreen(pt2);
          const prog2 = tWrapped2 / totalT;
          gCtx.beginPath();
          gCtx.moveTo(sp1.x, sp1.y);
          gCtx.lineTo(sp2.x, sp2.y);
          gCtx.strokeStyle = curveColor(state.hueStart + prog2 * state.hueSweep);
          gCtx.lineWidth = state.lineWidth * 2;
          gCtx.lineCap = 'round';
          gCtx.stroke();
        }
        p2 = pt2;
        p2TWrapped = tWrapped2;
      }
      const cCtx2 = Renderer.curveCtx;
      cCtx2.save();
      cCtx2.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
      cCtx2.filter = 'blur(8px)';
      cCtx2.globalCompositeOperation = 'lighter';
      cCtx2.globalAlpha = 0.3;
      cCtx2.drawImage(Renderer.glowCanvas, 0, 0, Renderer.width, Renderer.height);
      cCtx2.filter = 'none';
      cCtx2.globalCompositeOperation = 'source-over';
      cCtx2.globalAlpha = 1;
      cCtx2.restore();
    }
  },

  _redrawUpTo(targetT, startT) {
    Renderer.clearCurve();
    const totalT = state.totalT || state.curveType.totalT(state);
    const dt = Math.max(0.02, totalT / 4000);
    const from = startT || 0;
    let prev = null;
    if (from > 0) {
      prev = state.curveType.generatePoint(state, from);
    }
    for (let t = from; t < targetT; t += dt) {
      const pt = state.curveType.generatePoint(state, t);
      if (prev) {
        const progress = totalT > 0 ? t / totalT : 0;
        const hue = state.hueStart + progress * state.hueSweep;
        Renderer.drawSegment(prev, pt, curveColor(hue), progress);
      }
      prev = pt;
    }
  },

  _redrawComplete() {
    Renderer.clearCurve();
    Renderer.clearGlow();
    const totalT = state.totalT;
    const dt = Math.max(0.02, totalT / 4000);
    let prev = null;
    for (let t = 0; t <= totalT; t += dt) {
      const pt = state.curveType.generatePoint(state, t);
      if (prev) {
        const progress = t / totalT;
        const hue = state.hueStart + progress * state.hueSweep;
        Renderer.drawSegment(prev, pt, curveColor(hue), progress);
      }
      prev = pt;
    }
    if (state.showGlow) {
      const ctx = Renderer.glowCtx;
      ctx.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
      ctx.filter = 'blur(8px)';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(Renderer.curveCanvas, 0, 0, Renderer.width, Renderer.height);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  },

  drawInstant() {
    this.reset();
    state.totalT = state.curveType.totalT(state);
    Renderer.computeScale();
    const totalT = state.totalT;
    const dt = 0.02;
    let t = 0, prev = null;
    while (t < totalT) {
      const pt = state.curveType.generatePoint(state, t);
      if (prev) {
        const progress = t / totalT;
        const hue = state.hueStart + progress * state.hueSweep;
        Renderer.drawSegment(prev, pt, curveColor(hue), progress);
      }
      prev = pt; t += dt;
    }
    const finalPt = state.curveType.generatePoint(state, totalT);
    if (prev) Renderer.drawSegment(prev, finalPt, curveColor(state.hueStart + state.hueSweep), 1);
    state.currentT = totalT;
    state.prevPoint = finalPt;
    state.isComplete = true;
    this.idleAge = 0;
    if (state.showGlow) {
      const ctx = Renderer.glowCtx;
      ctx.setTransform(Renderer.dpr, 0, 0, Renderer.dpr, 0, 0);
      ctx.filter = 'blur(8px)';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(Renderer.curveCanvas, 0, 0, Renderer.width, Renderer.height);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    MathPanel.update();
  }
};

// ===================================================================
// MATH PANEL
// ===================================================================
const MathPanel = {
  update() {
    this.updateClassification();
    this.updateEquations();
    this.updateProperties();
    this.updateProgress();
  },

  updateClassification() {
    const el = document.getElementById('classification');
    if (!el) return;
    const dim = state.is3D ? ' (3D)' : '';
    const id = state.curveType.id;
    let desc = '';
    if (id === 'hypo' || id === 'epi') {
      const R = Math.round(state.R), r = Math.round(state.r);
      const loops = SpiroMath.loopCount(R, r);
      const cusps = Math.round(state.d) === r ? 'cusps' : 'petals';
      desc = `with <span class="highlight">${loops}</span> ${cusps}`;
    } else if (id === 'rose') {
      const n = Math.max(1, Math.round(state.k));
      const petals = n % 2 === 1 ? n : 2 * n;
      desc = `with <span class="highlight">${petals}</span> petals`;
    } else if (id === 'lissajous') {
      const n = Math.max(1, Math.round(state.k));
      desc = `frequency ratio <span class="highlight">1:${n}</span>`;
    } else if (id === 'guilloche') {
      const n = Math.max(1, Math.round(state.k));
      desc = `with <span class="highlight">${n}</span> scallops`;
    }
    el.innerHTML = `A <span class="highlight">${state.curveType.name}${dim}</span> ${desc}`;
  },

  updateEquations() {
    const el = document.getElementById('equation-block');
    if (!el) return;
    const id = state.curveType.id;
    const z3d = (expr) => state.is3D
      ? `<div style="margin-top:4px"><span class="eq-func">z</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = </span>${expr}</div>`
      : '';

    if (id === 'hypo' || id === 'epi') {
      const R = Math.round(state.R), r = Math.round(state.r), d = Math.round(state.d);
      const sign = id === 'hypo' ? '&minus;' : '+';
      const combo = id === 'hypo' ? R - r : R + r;
      const ratioStr = combo + '/' + r;
      const zExpr = `<span class="eq-h">${state.h}</span><span class="eq-op">&middot;sin(${state.k}</span><span class="eq-t">t</span><span class="eq-op">)</span>`;
      el.innerHTML = `
        <div><span class="eq-func">x</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = (</span><span class="eq-R">${R}</span><span class="eq-op"> ${sign} </span><span class="eq-r">${r}</span><span class="eq-op">)cos</span><span class="eq-t">t</span><span class="eq-op"> + </span><span class="eq-d">${d}</span><span class="eq-op">&middot;cos(${ratioStr}</span><span class="eq-t"> t</span><span class="eq-op">)</span></div>
        <div style="margin-top:4px"><span class="eq-func">y</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = (</span><span class="eq-R">${R}</span><span class="eq-op"> ${sign} </span><span class="eq-r">${r}</span><span class="eq-op">)sin</span><span class="eq-t">t</span><span class="eq-op"> &minus; </span><span class="eq-d">${d}</span><span class="eq-op">&middot;sin(${ratioStr}</span><span class="eq-t"> t</span><span class="eq-op">)</span></div>
        ${z3d(zExpr)}
        <div style="margin-top:8px; font-size:11px; color:var(--text-dim);">where <span class="eq-R">R</span>=<span class="eq-R">${R}</span>, <span class="eq-r">r</span>=<span class="eq-r">${r}</span>, <span class="eq-d">d</span>=<span class="eq-d">${d}</span></div>
      `;
    } else if (id === 'rose') {
      const R = Math.round(state.R), d = Math.round(state.d), n = Math.max(1, Math.round(state.k));
      const rhoStr = d !== 0
        ? `(<span class="eq-R">${R}</span>·cos(<span class="eq-op">${n}</span><span class="eq-t">t</span>) + <span class="eq-d">${d}</span>)`
        : `<span class="eq-R">${R}</span>·cos(<span class="eq-op">${n}</span><span class="eq-t">t</span>)`;
      const zExpr = `<span class="eq-h">${state.h}</span><span class="eq-op">&middot;sin(${n}</span><span class="eq-t">t</span><span class="eq-op">)</span>`;
      el.innerHTML = `
        <div style="margin-bottom:4px; font-size:11px; color:var(--text-dim);">&rho;(<span class="eq-t">t</span>) = ${rhoStr}</div>
        <div><span class="eq-func">x</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = &rho;·cos</span><span class="eq-t">t</span></div>
        <div style="margin-top:4px"><span class="eq-func">y</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = &rho;·sin</span><span class="eq-t">t</span></div>
        ${z3d(zExpr)}
        <div style="margin-top:8px; font-size:11px; color:var(--text-dim);"><span class="eq-op">${n % 2 === 1 ? n : 2 * n}</span> petals, <span class="eq-op">k</span>=<span class="eq-R">${n}</span></div>
      `;
    } else if (id === 'lissajous') {
      const R = Math.round(state.R), r = Math.round(state.r), d = Math.round(state.d);
      const n = Math.max(1, Math.round(state.k));
      const phaseStr = d > 0 ? ` + ${((d / 100) * 90).toFixed(0)}&deg;` : '';
      const zExpr = `<span class="eq-h">${state.h}</span><span class="eq-op">&middot;sin(${n}</span><span class="eq-t">t</span><span class="eq-op"> + &delta;)</span>`;
      el.innerHTML = `
        <div><span class="eq-func">x</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = </span><span class="eq-R">${R}</span><span class="eq-op">&middot;sin(</span><span class="eq-t">t</span><span class="eq-op">${phaseStr})</span></div>
        <div style="margin-top:4px"><span class="eq-func">y</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = </span><span class="eq-r">${r}</span><span class="eq-op">&middot;sin(</span><span class="eq-op">${n}</span><span class="eq-t">t</span><span class="eq-op">)</span></div>
        ${z3d(zExpr)}
        <div style="margin-top:8px; font-size:11px; color:var(--text-dim);">ratio 1:<span class="eq-op">${n}</span>, &delta;=${((d / 100) * 90).toFixed(0)}&deg;</div>
      `;
    } else if (id === 'guilloche') {
      const R = Math.round(state.R), r = Math.round(state.r), d = Math.round(state.d);
      const n = Math.max(1, Math.round(state.k));
      const zExpr = `<span class="eq-h">${state.h}</span><span class="eq-op">&middot;sin(${n}</span><span class="eq-t">t</span><span class="eq-op">)</span>`;
      el.innerHTML = `
        <div style="margin-bottom:4px; font-size:11px; color:var(--text-dim);">&rho;(<span class="eq-t">t</span>) = <span class="eq-R">${R}</span> + <span class="eq-r">${r}</span>·cos(<span class="eq-op">${n}</span><span class="eq-t">t</span>)</div>
        <div><span class="eq-func">x</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = &rho;·cos</span><span class="eq-t">t</span><span class="eq-op"> + </span><span class="eq-d">${d}</span><span class="eq-op">·cos(${n + 1}</span><span class="eq-t">t</span><span class="eq-op">)</span></div>
        <div style="margin-top:4px"><span class="eq-func">y</span><span class="eq-op">(</span><span class="eq-t">t</span><span class="eq-op">) = &rho;·sin</span><span class="eq-t">t</span><span class="eq-op"> + </span><span class="eq-d">${d}</span><span class="eq-op">·sin(${n + 1}</span><span class="eq-t">t</span><span class="eq-op">)</span></div>
        ${z3d(zExpr)}
        <div style="margin-top:8px; font-size:11px; color:var(--text-dim);"><span class="eq-op">${n}</span> scallops, closes at 2&pi;</div>
      `;
    }
  },

  updateProperties() {
    const el = document.getElementById('math-properties');
    if (!el) return;
    const id = state.curveType.id;
    const totalT = state.curveType.totalT(state);
    const period = (totalT / Math.PI).toFixed(1);

    let rows = '';
    if (id === 'hypo' || id === 'epi') {
      const R = Math.round(state.R), r = Math.round(state.r), d = Math.round(state.d);
      const g = SpiroMath.gcd(R, r);
      const loops = SpiroMath.loopCount(R, r);
      const [fn, fd] = SpiroMath.simplifyFraction(R, r);
      rows = `
        <div class="math-row"><span class="math-label">GCD(<span class="eq-R">R</span>, <span class="eq-r">r</span>)</span><span class="math-value">${g}</span></div>
        <div class="math-row"><span class="math-label">Loops</span><span class="math-value">${r}/${g} = <span class="eq-R">${loops}</span></span></div>
        <div class="math-row"><span class="math-label">Ratio <span class="eq-R">R</span>/<span class="eq-r">r</span></span><span class="math-value">${fn}/${fd}</span></div>
        <div class="math-row"><span class="math-label"><span class="eq-d">d</span>/<span class="eq-r">r</span></span><span class="math-value">${(d / r).toFixed(3)}</span></div>
        <div class="math-row"><span class="math-label">Symmetry</span><span class="math-value">${loops}-fold</span></div>
      `;
    } else if (id === 'rose') {
      const n = Math.max(1, Math.round(state.k));
      const petals = n % 2 === 1 ? n : 2 * n;
      rows = `
        <div class="math-row"><span class="math-label">Petals</span><span class="math-value">${petals}</span></div>
        <div class="math-row"><span class="math-label">Freq <span class="eq-op">k</span></span><span class="math-value">${n}</span></div>
        <div class="math-row"><span class="math-label">Amplitude <span class="eq-R">R</span></span><span class="math-value">${Math.round(state.R)}</span></div>
        <div class="math-row"><span class="math-label">Offset <span class="eq-d">d</span></span><span class="math-value">${Math.round(state.d)}</span></div>
        <div class="math-row"><span class="math-label">Symmetry</span><span class="math-value">${petals}-fold</span></div>
      `;
    } else if (id === 'lissajous') {
      const n = Math.max(1, Math.round(state.k));
      const phase = ((state.d / 100) * 90).toFixed(0);
      rows = `
        <div class="math-row"><span class="math-label">Freq ratio</span><span class="math-value">1 : ${n}</span></div>
        <div class="math-row"><span class="math-label">Phase &delta;</span><span class="math-value">${phase}&deg;</span></div>
        <div class="math-row"><span class="math-label"><span class="eq-R">R</span> (x-amp)</span><span class="math-value">${Math.round(state.R)}</span></div>
        <div class="math-row"><span class="math-label"><span class="eq-r">r</span> (y-amp)</span><span class="math-value">${Math.round(state.r)}</span></div>
        <div class="math-row"><span class="math-label">Nodes</span><span class="math-value">${2 * n}</span></div>
      `;
    } else if (id === 'guilloche') {
      const n = Math.max(1, Math.round(state.k));
      rows = `
        <div class="math-row"><span class="math-label">Scallops <span class="eq-op">k</span></span><span class="math-value">${n}</span></div>
        <div class="math-row"><span class="math-label">Base radius <span class="eq-R">R</span></span><span class="math-value">${Math.round(state.R)}</span></div>
        <div class="math-row"><span class="math-label">Modulation <span class="eq-r">r</span></span><span class="math-value">${Math.round(state.r)}</span></div>
        <div class="math-row"><span class="math-label">Arm depth <span class="eq-d">d</span></span><span class="math-value">${Math.round(state.d)}</span></div>
        <div class="math-row"><span class="math-label">Symmetry</span><span class="math-value">${n}-fold</span></div>
      `;
    }

    const extra3D = state.is3D ? `
      <div class="math-row"><span class="math-label"><span class="eq-h">h</span> (3D height)</span><span class="math-value">${state.h}</span></div>
      <div class="math-row"><span class="math-label"><span class="eq-h">k</span> (z freq)</span><span class="math-value">${state.k}</span></div>
    ` : '';

    el.innerHTML = rows + `
      <div class="math-row"><span class="math-label">Period</span><span class="math-value">${period}&pi; rad</span></div>
      ${extra3D}
    `;
  },

  updateProgress() {
    const totalT = state.totalT || state.curveType.totalT(state);
    const progress = totalT > 0 ? Math.min(state.currentT / totalT, 1) : 0;
    const pct = (progress * 100).toFixed(1);
    const el = document.getElementById('progress-info');
    if (el) {
      el.innerHTML = `
        <div class="math-row"><span class="math-label">Parameter <span class="eq-t">t</span></span><span class="math-value">${state.currentT.toFixed(1)} / ${totalT.toFixed(1)}</span></div>
        <div class="math-row"><span class="math-label">Completion</span><span class="math-value">${pct}%</span></div>
      `;
    }
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = pct + '%';
  }
};

// ===================================================================
// PRESETS
// ===================================================================
const PRESETS = [
  { name: 'Rose',        R: 100, r: 60,  d: 50,  mode: 'hypo',      hue: 330, sweep: 360 },
  { name: 'Astroid',     R: 100, r: 25,  d: 25,  mode: 'hypo',      hue: 180, sweep: 180 },
  { name: 'Deltoid',     R: 100, r: 33,  d: 33,  mode: 'hypo',      hue: 120, sweep: 240 },
  { name: 'Pentaflower', R: 100, r: 60,  d: 60,  mode: 'hypo',      hue: 0,   sweep: 360 },
  { name: 'Starfish',    R: 100, r: 40,  d: 35,  mode: 'hypo',      hue: 200, sweep: 300 },
  { name: 'Cardioid',    R: 100, r: 100, d: 100, mode: 'epi',       hue: 0,   sweep: 180 },
  { name: 'Nephroid',    R: 100, r: 50,  d: 50,  mode: 'epi',       hue: 280, sweep: 360 },
  { name: 'Trefoil',     R: 100, r: 33,  d: 40,  mode: 'epi',       hue: 60,  sweep: 540 },
  { name: 'Lace',        R: 120, r: 84,  d: 60,  mode: 'hypo',      hue: 160, sweep: 360 },
  { name: 'Atom',        R: 80,  r: 48,  d: 70,  mode: 'hypo',      hue: 30,  sweep: 180 },
  { name: 'Cosmos',      R: 100, r: 63,  d: 50,  mode: 'epi',       hue: 240, sweep: 540 },
  { name: 'Bloom',       R: 150, r: 37,  d: 30,  mode: 'hypo',      hue: 0,   sweep: 720 },
  // Rose curve presets
  { name: 'Rhodonea 5',  R: 100, r: 60,  d: 0,   mode: 'rose',      hue: 320, sweep: 360, k: 5 },
  { name: 'Rhodonea 7',  R: 100, r: 60,  d: 0,   mode: 'rose',      hue: 200, sweep: 540, k: 7 },
  { name: 'Limaçon',     R: 100, r: 60,  d: 40,  mode: 'rose',      hue: 30,  sweep: 360, k: 3 },
  { name: 'Star Burst',  R: 100, r: 60,  d: 0,   mode: 'rose',      hue: 50,  sweep: 720, k: 8 },
  // Lissajous presets
  { name: 'Figure-8',    R: 100, r: 80,  d: 25,  mode: 'lissajous', hue: 180, sweep: 360, k: 2 },
  { name: 'Clover',      R: 100, r: 100, d: 0,   mode: 'lissajous', hue: 120, sweep: 360, k: 3 },
  { name: 'Web',         R: 100, r: 80,  d: 50,  mode: 'lissajous', hue: 260, sweep: 540, k: 5 },
  { name: 'Bowline',     R: 100, r: 70,  d: 33,  mode: 'lissajous', hue: 0,   sweep: 360, k: 4 },
  // Guilloché presets
  { name: 'Engine Turn', R: 100, r: 30,  d: 0,   mode: 'guilloche', hue: 45,  sweep: 360, k: 7 },
  { name: 'Lace Ring',   R: 100, r: 25,  d: 20,  mode: 'guilloche', hue: 280, sweep: 540, k: 9 },
  { name: 'Ribbon',      R: 80,  r: 40,  d: 35,  mode: 'guilloche', hue: 160, sweep: 360, k: 5 },
  { name: 'Banknote',    R: 90,  r: 20,  d: 25,  mode: 'guilloche', hue: 30,  sweep: 720, k: 12 },
];

function renderPresetThumbnail(preset, size) {
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr; canvas.height = size * dpr;
  canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const ct = CURVE_TYPES[preset.mode] ?? CURVE_TYPES.hypo;
  const ps = { R: preset.R, r: preset.r, d: preset.d, h: preset.h || 0, k: preset.k || 3, is3D: false };
  const totalT = ct.totalT(ps);
  const maxExt = ct.maxExtent(ps);
  const s = (size * 0.42) / (maxExt || 1);
  const cx = size / 2, cy = size / 2;
  const dt = 0.03; let t = 0, prev = null;
  ctx.lineWidth = 1; ctx.lineCap = 'round';
  while (t < totalT) {
    const pt = ct.generatePoint(ps, t);
    if (prev) {
      const h = preset.hue + (t / totalT) * preset.sweep;
      ctx.beginPath();
      ctx.moveTo(cx + prev.x * s, cy - prev.y * s);
      ctx.lineTo(cx + pt.x * s, cy - pt.y * s);
      ctx.strokeStyle = `hsl(${h % 360}, 85%, 58%)`; ctx.stroke();
    }
    prev = pt; t += dt;
  }
  return canvas;
}

function buildPresetGallery() {
  const gallery = document.getElementById('preset-gallery');
  gallery.innerHTML = '';
  const currentId = state.curveType.id;
  PRESETS.forEach((preset, i) => {
    if (preset.mode !== currentId) return;
    const item = document.createElement('div');
    item.className = 'preset-item';
    item.appendChild(renderPresetThumbnail(preset, 80));
    const nameEl = document.createElement('div');
    nameEl.className = 'preset-name';
    nameEl.textContent = preset.name;
    item.appendChild(nameEl);
    item.addEventListener('click', () => loadPreset(i));
    gallery.appendChild(item);
  });
}

function loadPreset(index) {
  const p = PRESETS[index];
  state.R = p.R; state.r = p.r; state.d = p.d;
  if (p.k !== undefined) state.k = p.k;
  if (p.h !== undefined) state.h = p.h;
  state.curveType = CURVE_TYPES[p.mode] ?? CURVE_TYPES.hypo;
  state.hueStart = p.hue; state.hueSweep = p.sweep;
  state.colorMode = p.sweep === 0 ? 'solid' : 'gradient';
  LFOEngine.syncDisabledBasesFromState();
  syncUIToState();
  Animator.restart();
  History.push();
}

function speedToSliderValue(s) {
  if (s <= 0.1) return 50 * Math.log10(Math.max(0.01, s) / 0.01);
  return 50 + 50 * Math.log10(s / 0.1) / 2;
}

function updateAllSliderUI() {
  document.getElementById('slider-R').value = Math.round(state.R);
  document.getElementById('val-R').textContent = Math.round(state.R);
  document.getElementById('slider-r').value = Math.round(state.r);
  document.getElementById('val-r').textContent = Math.round(state.r);
  document.getElementById('slider-d').value = Math.round(state.d);
  document.getElementById('val-d').textContent = Math.round(state.d);
  document.getElementById('slider-h').value = Math.round(state.h);
  document.getElementById('val-h').textContent = Math.round(state.h);
  document.getElementById('slider-k').value = state.k;
  document.getElementById('val-k').textContent = Number.isInteger(state.k) ? state.k : state.k.toFixed(1);
  document.getElementById('slider-width').value = state.lineWidth;
  document.getElementById('val-width').textContent = Number.isInteger(state.lineWidth) ? state.lineWidth : state.lineWidth.toFixed(1);
  document.getElementById('slider-hue').value = state.hueStart;
  document.getElementById('val-hue').textContent = Math.round(state.hueStart) + '\u00b0';
  document.getElementById('slider-sweep').value = state.hueSweep;
  document.getElementById('val-sweep').textContent = Math.round(state.hueSweep) + '\u00b0';
  document.getElementById('slider-sat').value = state.saturation;
  document.getElementById('val-sat').textContent = Math.round(state.saturation) + '%';
  document.getElementById('slider-lit').value = state.lightness;
  document.getElementById('val-lit').textContent = Math.round(state.lightness) + '%';
  document.getElementById('slider-speed').value = speedToSliderValue(state.speed);
  document.getElementById('val-speed').textContent = state.speed < 1 ? state.speed.toFixed(2) : state.speed.toFixed(1);
}

const VALID_LOOP_STYLES = new Set(['once', 'wipe', 'rewind', 'trail']);

function syncColorModeUI() {
  if (!['solid', 'gradient', 'rainbow'].includes(state.colorMode)) {
    state.colorMode = state.hueSweep === 0 ? 'solid' : 'gradient';
  }

  document.querySelectorAll('.color-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === state.colorMode);
  });

  const hueGroup = document.getElementById('group-hue');
  const sweepGroup = document.getElementById('group-sweep');
  if (hueGroup) hueGroup.style.display = state.colorMode === 'rainbow' ? 'none' : '';
  if (sweepGroup) sweepGroup.style.display = state.colorMode === 'gradient' ? '' : 'none';
}

function syncLoopStyleControls() {
  if (!VALID_LOOP_STYLES.has(state.loopStyle)) state.loopStyle = 'trail';
  if (state.layerCount > 0 && state.loopStyle === 'trail') state.loopStyle = 'wipe';

  const select = document.getElementById('loop-style-select');
  const group = document.getElementById('group-trail');
  const layerLocked = state.layerCount > 0;
  if (select) {
    select.value = state.loopStyle;
    select.title = layerLocked ? 'Trail is unavailable while layers are visible' : '';
    const trailOption = select.querySelector('option[value="trail"]');
    if (trailOption) trailOption.disabled = layerLocked;
  }
  if (group) group.style.display = state.loopStyle === 'trail' ? '' : 'none';
}

function setLoopStyle(style, { restartIfComplete = true } = {}) {
  const next = state.layerCount > 0 && style === 'trail' ? 'wipe' : style;
  const normalized = VALID_LOOP_STYLES.has(next) ? next : 'trail';
  const changed = state.loopStyle !== normalized;
  state.loopStyle = normalized;
  syncLoopStyleControls();
  if (!changed) return false;

  if (state.isComplete && restartIfComplete) {
    Animator.restart();
  } else if (state.loopStyle === 'trail' && !state.isPlaying) {
    Animator.restart();
  } else if (state.loopStyle !== 'trail' && (state.isComplete || !state.isPlaying)) {
    Animator.livePreview();
  }
  return true;
}

function isCompactLayout() {
  return window.matchMedia ? window.matchMedia('(max-width: 600px)').matches : window.innerWidth <= 600;
}

function setPanelCollapsed(panelId, toggleId, collapsed) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);
  if (!panel || !toggle) return;
  panel.classList.toggle('collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));

  if (!collapsed && isCompactLayout()) {
    if (panelId !== 'controls-panel') setPanelCollapsed('controls-panel', 'controls-toggle', true);
    if (panelId !== 'math-panel') setPanelCollapsed('math-panel', 'math-toggle', true);
    setLFODrawerCollapsed(true);
  }
}

function setLFODrawerCollapsed(collapsed) {
  const drawer = document.getElementById('lfo-drawer');
  const tab = document.getElementById('lfo-tab');
  if (!drawer) return;
  drawer.classList.toggle('lfo-collapsed', collapsed);
  if (tab) tab.setAttribute('aria-expanded', String(!collapsed));

  if (!collapsed && isCompactLayout()) {
    setPanelCollapsed('controls-panel', 'controls-toggle', true);
    setPanelCollapsed('math-panel', 'math-toggle', true);
  }
}

// ===================================================================
// SHUFFLE
// ===================================================================
function doShuffle() {
  if (state.isShuffling) return;
  state.isShuffling = true;
  Evolve.stop();
  IdleAnim.stop();

  let cycles = 0;
  const maxCycles = 18;
  const interval = setInterval(() => {
    const R = 60 + Math.floor(Math.random() * 100);
    const r = 10 + Math.floor(Math.random() * (R - 15));
    const g = SpiroMath.gcd(R, r);
    const loops = r / g;
    if (loops > 15) { return; }
    const d = Math.floor(r * (0.3 + Math.random() * 0.7));
    const modeId = Math.random() > 0.5 ? 'epi' : 'hypo';
    const hue = Math.floor(Math.random() * 360);
    const sweep = 180 + Math.floor(Math.random() * 540);

    state.R = R; state.r = r; state.d = d;
    state.curveType = CURVE_TYPES[modeId];
    state.hueStart = hue; state.hueSweep = sweep;
    state.colorMode = 'gradient';
    updateAllSliderUI();

    Animator.drawInstant();

    cycles++;
    if (cycles >= maxCycles) {
      clearInterval(interval);
      const flash = document.getElementById('flash-overlay');
      flash.classList.add('flash');
      setTimeout(() => flash.classList.remove('flash'), 100);

      state.isShuffling = false;
      document.getElementById('curve-type-select').value = state.curveType.id;
      LFOEngine.syncDisabledBasesFromState();
      syncUIToState();
      Animator.restart();
      History.push();
    }
  }, 80);
}

// ===================================================================
// CANVAS TOUCH INTERACTIONS
// ===================================================================
function wireCanvasTouch() {
  const canvas = document.getElementById('overlay-canvas');
  let touchStartAngle = 0;
  let touchStartDist = 0;
  let isDragging = false;
  let lastTouchX = 0, lastTouchY = 0;
  let twoFingerStart = null;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - Renderer.centerX;
      const dy = t.clientY - Renderer.centerY;
      touchStartDist = Math.hypot(dx, dy);
      touchStartAngle = Math.atan2(dy, dx);
      isDragging = true;
      lastTouchX = t.clientX;
      lastTouchY = t.clientY;

      IdleAnim.stop();
      clearTimeout(state.idleTimer);

      const tapAngle = ((Math.atan2(dy, dx) / Math.PI) + 1) * 180;
      Ripples.add(t.clientX, t.clientY, tapAngle);

      if (state.isComplete && !state.is3D) {
        const diff = ((tapAngle - state.hueStart + 540) % 360) - 180;
        state.hueStart = ((state.hueStart + diff * 0.15) + 360) % 360;
        document.getElementById('slider-hue').value = Math.round(state.hueStart);
        document.getElementById('val-hue').textContent = Math.round(state.hueStart) + '\u00b0';
        Animator.livePreview();
      }

    } else if (e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      twoFingerStart = {
        dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        scale: state.scale,
        midX: (t1.clientX + t2.clientX) / 2,
        midY: (t1.clientY + t2.clientY) / 2,
        offX: state.offsetX, offY: state.offsetY
      };
      isDragging = false;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - Renderer.centerX;
      const dy = t.clientY - Renderer.centerY;

      if (state.is3D) {
        const deltaX = t.clientX - lastTouchX;
        const deltaY = t.clientY - lastTouchY;
        Camera.velYaw = deltaX * 0.005;
        Camera.velPitch = deltaY * 0.005;
        Camera.yaw += Camera.velYaw;
        Camera.pitch += Camera.velPitch;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        Camera.dragging = true;
      } else {
        const dist = Math.hypot(dx, dy);
        const deltaX = t.clientX - lastTouchX;
        const deltaY = t.clientY - lastTouchY;

        const radialVec = dist > 10 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 };
        const radialDelta = deltaX * radialVec.x + deltaY * radialVec.y;
        const tangentialDelta = -deltaX * radialVec.y + deltaY * radialVec.x;

        const newD = Math.max(1, Math.min(195, state.d + radialDelta * 0.5));
        state.d = Math.round(newD);
        document.getElementById('slider-d').value = state.d;
        document.getElementById('val-d').textContent = state.d;

        if (Math.abs(tangentialDelta) > 0.5 && !state.symmetryLock) {
          const newR = Math.max(3, Math.min(195, state.r + tangentialDelta * 0.3));
          state.r = Math.round(newR);
          document.getElementById('slider-r').value = state.r;
          document.getElementById('val-r').textContent = state.r;
        }

        lastTouchX = t.clientX;
        lastTouchY = t.clientY;

        if (state.isPlaying || state.isComplete) {
          Animator.livePreview();
        }
      }
    } else if (e.touches.length === 2 && twoFingerStart) {
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const mid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      state.scale = twoFingerStart.scale * (dist / twoFingerStart.dist);
      state.offsetX = twoFingerStart.offX + (mid.x - twoFingerStart.midX);
      state.offsetY = twoFingerStart.offY + (mid.y - twoFingerStart.midY);
      if (!state.is3D && (state.isComplete || !state.isPlaying)) Animator.livePreview();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (isDragging && !state.is3D) {
      Animator.restart();
      updateSymmetryInfo();
    }
    isDragging = false;
    if (e.touches.length < 2) twoFingerStart = null;
    if (state.is3D) Camera.dragging = false;
  });

  canvas.addEventListener('click', (e) => {
    if (e.target === canvas) {
      const dx = e.clientX - Renderer.centerX;
      const dy = e.clientY - Renderer.centerY;
      const tapAngle = ((Math.atan2(dy, dx) / Math.PI) + 1) * 180;
      Ripples.add(e.clientX, e.clientY, tapAngle);

      if (state.isComplete && !state.is3D) {
        const diff = ((tapAngle - state.hueStart + 540) % 360) - 180;
        state.hueStart = ((state.hueStart + diff * 0.15) + 360) % 360;
        document.getElementById('slider-hue').value = Math.round(state.hueStart);
        document.getElementById('val-hue').textContent = Math.round(state.hueStart) + '\u00b0';
        Animator.livePreview();
      }
    }
  });

  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    lastTouchX = e.clientX;
    lastTouchY = e.clientY;
    if (state.is3D) {
      Camera.dragging = true;
      IdleAnim.stop();
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (mouseDown && state.is3D) {
      const deltaX = e.clientX - lastTouchX;
      const deltaY = e.clientY - lastTouchY;
      Camera.velYaw = deltaX * 0.005;
      Camera.velPitch = deltaY * 0.005;
      Camera.yaw += Camera.velYaw;
      Camera.pitch += Camera.velPitch;
      lastTouchX = e.clientX;
      lastTouchY = e.clientY;
    }
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
    if (state.is3D) Camera.dragging = false;
  });
}

// ===================================================================
// LFO ENGINE — low-frequency oscillator modulation for parameters
// ===================================================================
const LFOEngine = {
  params: {
    R:         { base: 100, rate: 0.50, depth: 0.30, wave: 'sine',     enabled: false, min: 20,   max: 200 },
    r:         { base:  63, rate: 0.40, depth: 0.30, wave: 'sine',     enabled: false, min: 3,    max: 195 },
    d:         { base:  50, rate: 0.60, depth: 0.40, wave: 'sine',     enabled: false, min: 1,    max: 195 },
    lineWidth: { base: 1.5, rate: 1.00, depth: 0.50, wave: 'sine',     enabled: false, min: 0.5,  max: 10  },
    drawSpeed: { base: 0.1, rate: 0.20, depth: 0.50, wave: 'sine',     enabled: false, min: 0.01, max: 10  },
    hue:       { base:   0, rate: 0.10, depth: 1.00, wave: 'saw',      enabled: false, min: 0,    max: 360 },
    hueSweep:  { base: 360, rate: 0.30, depth: 0.50, wave: 'triangle', enabled: false, min: 0,    max: 720 },
    camH:      { base:  40, rate: 0.20, depth: 0.50, wave: 'sine',     enabled: false, min: 0,    max: 120 },
    camK:      { base:   3, rate: 0.30, depth: 0.40, wave: 'triangle', enabled: false, min: 1,    max: 20  },
  },

  STATE_MAP: {
    R: 'R', r: 'r', d: 'd', lineWidth: 'lineWidth', drawSpeed: 'speed',
    hue: 'hueStart', hueSweep: 'hueSweep', camH: 'h', camK: 'k'
  },

  globalTime: 0, _frame: 0,
  FRAME_SKIP: 2,

  waveforms: {
    sine:     x => Math.sin(2 * Math.PI * x),
    triangle: x => 1 - 4 * Math.abs(((x + 0.25) % 1 + 1) % 1 - 0.5),
    saw:      x => 2 * ((x % 1 + 1) % 1) - 1,
    square:   x => Math.sign(Math.sin(2 * Math.PI * x)) || 1,
  },

  capture() {
    const snap = {};
    Object.entries(this.params).forEach(([key, p]) => {
      snap[key] = {
        base: p.base,
        rate: p.rate,
        depth: p.depth,
        wave: p.wave,
        enabled: p.enabled
      };
    });
    return snap;
  },

  restore(snap) {
    if (!snap) return;
    Object.entries(snap).forEach(([key, saved]) => {
      const p = this.params[key];
      if (!p || !saved) return;
      const base = parseFloat(saved.base);
      const rate = parseFloat(saved.rate);
      const depth = parseFloat(saved.depth);
      if (Number.isFinite(base)) p.base = Math.max(p.min, Math.min(p.max, base));
      if (Number.isFinite(rate)) p.rate = Math.max(0.05, Math.min(4, rate));
      if (Number.isFinite(depth)) p.depth = Math.max(0, Math.min(1, depth));
      if (this.waveforms[saved.wave]) p.wave = saved.wave;
      p.enabled = !!saved.enabled;
      if (!p.enabled) state[this.STATE_MAP[key]] = p.base;
    });
    this.globalTime = 0;
    this._frame = 0;
  },

  syncUI() {
    Object.entries(this.params).forEach(([key, p]) => {
      const base = document.getElementById('lfo-base-' + key);
      const rate = document.getElementById('lfo-rate-' + key);
      const depth = document.getElementById('lfo-depth-' + key);
      const rateVal = document.getElementById('lfo-rateval-' + key);
      const depthVal = document.getElementById('lfo-depthval-' + key);
      if (base) base.value = p.enabled ? state[this.STATE_MAP[key]] : p.base;
      if (rate) rate.value = p.rate;
      if (depth) depth.value = p.depth;
      if (rateVal) rateVal.textContent = p.rate.toFixed(2) + ' Hz';
      if (depthVal) depthVal.textContent = Math.round(p.depth * 100) + '%';
      this._updateLiveLabel(key, p.enabled ? state[this.STATE_MAP[key]] : p.base);
      this._refreshToggle(key);
      document.querySelectorAll(`.lfo-wave-btn[data-key="${key}"]`).forEach(btn =>
        btn.classList.toggle('active', btn.dataset.wave === p.wave));
    });
  },

  anyActive() { return Object.values(this.params).some(p => p.enabled); },
  start() { this._frame = 0; },
  stop() { this._frame = 0; },

  syncDisabledBasesFromState() {
    Object.entries(this.params).forEach(([key, p]) => {
      if (!p.enabled) p.base = state[this.STATE_MAP[key]] ?? p.base;
    });
  },

  update(dt) {
    if (!this.anyActive()) return false;
    this.globalTime += dt;
    if (++this._frame % this.FRAME_SKIP !== 0) return false;

    let dirty = false;
    Object.entries(this.params).forEach(([key, p]) => {
      if (!p.enabled) return;
      dirty = true;
      const range = p.max - p.min;
      const offset = p.depth * (range * 0.5) * this.waveforms[p.wave](p.rate * this.globalTime);
      const live = Math.max(p.min, Math.min(p.max, p.base + offset));
      state[this.STATE_MAP[key]] = live;
      this._updateLiveLabel(key, live);
    });

    if (dirty) updateAllSliderUI();
    return dirty;
  },

  enableLFO(key) {
    const p = this.params[key];
    p.base = state[this.STATE_MAP[key]];
    p.enabled = true;
    const bs = document.getElementById('lfo-base-' + key);
    if (bs) bs.value = p.base;
    this.start();
    this._refreshToggle(key);
  },

  disableLFO(key) {
    this.params[key].enabled = false;
    state[this.STATE_MAP[key]] = this.params[key].base;
    if (!this.anyActive()) this.stop();
    this._refreshToggle(key);
    updateAllSliderUI();
    Animator.renderCurrentState();
  },

  toggleLFO(key) { this.params[key].enabled ? this.disableLFO(key) : this.enableLFO(key); },

  setBase(key, value) {
    this.params[key].base = value;
    if (!this.params[key].enabled) state[this.STATE_MAP[key]] = value;
  },

  _formatLive(key, value) {
    if (key === 'lineWidth' || key === 'camK') return value.toFixed(1);
    if (key === 'drawSpeed') return value.toFixed(2);
    if (key === 'hue' || key === 'hueSweep') return Math.round(value) + '°';
    return Math.round(value);
  },

  _updateLiveLabel(key, value) {
    const el = document.getElementById('lfo-live-' + key);
    if (el) el.textContent = this._formatLive(key, value);
  },

  _refreshToggle(key) {
    const btn = document.getElementById('lfo-toggle-' + key);
    if (btn) btn.classList.toggle('lfo-enabled', this.params[key].enabled);
    const exp = document.getElementById('lfo-exp-' + key);
    if (exp) exp.classList.toggle('collapsed', !this.params[key].enabled);
  }
};

function buildLFOPanel() {
  const content = document.getElementById('lfo-content');
  if (!content) return;
  content.innerHTML = '';

  const ROWS = [
    { key: 'R',         label: 'R',      min: 20,   max: 200, step: 1,    fmt: v => Math.round(v)     },
    { key: 'r',         label: 'r',      min: 3,    max: 195, step: 1,    fmt: v => Math.round(v)     },
    { key: 'd',         label: 'd',      min: 1,    max: 195, step: 1,    fmt: v => Math.round(v)     },
    { key: 'lineWidth', label: 'Width',  min: 0.5,  max: 10,  step: 0.5,  fmt: v => v.toFixed(1)      },
    { key: 'drawSpeed', label: 'Speed',  min: 0.01, max: 10,  step: 0.01, fmt: v => v.toFixed(2)      },
    { key: 'hue',       label: 'Hue',    min: 0,    max: 360, step: 1,    fmt: v => Math.round(v)+'°' },
    { key: 'hueSweep',  label: 'Sweep',  min: 0,    max: 720, step: 1,    fmt: v => Math.round(v)+'°' },
    { key: 'camH',      label: 'Height', min: 0,    max: 120, step: 1,    fmt: v => Math.round(v)     },
    { key: 'camK',      label: 'Z Freq', min: 1,    max: 20,  step: 0.1,  fmt: v => v.toFixed(1)      },
  ];

  const WAVES = [
    { id: 'sine',     icon: '∿', name: 'sine' },
    { id: 'triangle', icon: '△', name: 'triangle' },
    { id: 'saw',      icon: '/', name: 'saw' },
    { id: 'square',   icon: '⊓', name: 'square' },
  ];

  ROWS.forEach(({ key, label, min, max, step, fmt }) => {
    const p = LFOEngine.params[key];
    const curBase = state[LFOEngine.STATE_MAP[key]] ?? p.base;

    const row = document.createElement('div');
    row.className = 'lfo-row';
    row.innerHTML = `
      <div class="lfo-row-header">
        <span class="lfo-param-name">${label}</span>
        <span class="lfo-live-val" id="lfo-live-${key}">${fmt(curBase)}</span>
        <input type="range" class="lfo-base-slider" id="lfo-base-${key}"
               min="${min}" max="${max}" step="${step}" value="${curBase}"
               aria-label="${label} modulation base">
        <button class="lfo-toggle${p.enabled ? ' lfo-enabled' : ''}"
                id="lfo-toggle-${key}" type="button"
                aria-label="Toggle ${label} modulation"
                title="Toggle ${label} modulation">∿</button>
      </div>
      <div class="lfo-expanded${p.enabled ? '' : ' collapsed'}" id="lfo-exp-${key}">
        <div class="lfo-sub-row">
          <span class="lfo-sub-label">Rate</span>
          <input type="range" class="lfo-sub-slider" id="lfo-rate-${key}"
                 min="0.05" max="4" step="0.05" value="${p.rate}"
                 aria-label="${label} modulation rate">
          <span class="lfo-sub-val" id="lfo-rateval-${key}">${p.rate.toFixed(2)} Hz</span>
        </div>
        <div class="lfo-sub-row">
          <span class="lfo-sub-label">Depth</span>
          <input type="range" class="lfo-sub-slider" id="lfo-depth-${key}"
                 min="0" max="1" step="0.01" value="${p.depth}"
                 aria-label="${label} modulation depth">
          <span class="lfo-sub-val" id="lfo-depthval-${key}">${Math.round(p.depth * 100)}%</span>
        </div>
        <div class="lfo-wave-row">
          ${WAVES.map(w =>
            `<button class="lfo-wave-btn${p.wave === w.id ? ' active' : ''}"
                     type="button" data-wave="${w.id}" data-key="${key}"
                     aria-label="Use ${w.name} wave for ${label} modulation"
                     title="${w.name} wave">${w.icon}</button>`
          ).join('')}
        </div>
      </div>`;
    content.appendChild(row);

    row.querySelector('#lfo-base-' + key).addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      LFOEngine.setBase(key, v);
      document.getElementById('lfo-live-' + key).textContent = fmt(v);
      if (!LFOEngine.params[key].enabled) {
        updateAllSliderUI();
        Animator.renderCurrentState();
      }
    });
    row.querySelector('#lfo-base-' + key).addEventListener('change', () => History.push());

    row.querySelector('#lfo-toggle-' + key).addEventListener('click', () => {
      LFOEngine.toggleLFO(key);
      History.push();
    });

    row.querySelector('#lfo-rate-' + key).addEventListener('input', e => {
      LFOEngine.params[key].rate = parseFloat(e.target.value);
      document.getElementById('lfo-rateval-' + key).textContent =
        LFOEngine.params[key].rate.toFixed(2) + ' Hz';
    });
    row.querySelector('#lfo-rate-' + key).addEventListener('change', () => History.push());

    row.querySelector('#lfo-depth-' + key).addEventListener('input', e => {
      LFOEngine.params[key].depth = parseFloat(e.target.value);
      document.getElementById('lfo-depthval-' + key).textContent =
        Math.round(LFOEngine.params[key].depth * 100) + '%';
    });
    row.querySelector('#lfo-depth-' + key).addEventListener('change', () => History.push());

    row.querySelectorAll('.lfo-wave-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        LFOEngine.params[key].wave = btn.dataset.wave;
        row.querySelectorAll('.lfo-wave-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.wave === btn.dataset.wave));
        History.push();
      });
    });
  });
  LFOEngine.syncUI();
}

// ===================================================================
// CUSTOM PRESETS (localStorage)
// ===================================================================
const CUSTOM_PRESETS_KEY = 'spirograph-custom-presets';

function getCustomPresets() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]'); }
  catch { return []; }
}

function saveCustomPreset() {
  const name = window.prompt('Name this preset:', 'My Pattern');
  if (!name) return;
  const presets = getCustomPresets();
  presets.push({
    name: name.trim() || 'Untitled',
    R: Math.round(state.R), r: Math.round(state.r), d: Math.round(state.d),
    mode: state.curveType.id,
    hue: Math.round(state.hueStart), sweep: Math.round(state.hueSweep),
    colorMode: state.colorMode,
    saturation: Math.round(state.saturation), lightness: Math.round(state.lightness),
    strokeMode: state.strokeMode, lineWidth: state.lineWidth, bgColor: state.bgColor,
    is3D: state.is3D, h: state.h, k: state.k
  });
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  buildMyPresetGallery();
}

function deleteCustomPreset(index) {
  const presets = getCustomPresets();
  presets.splice(index, 1);
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  buildMyPresetGallery();
}

function loadCustomPreset(p) {
  state.R = p.R; state.r = p.r; state.d = p.d;
  state.curveType = CURVE_TYPES[p.mode] ?? CURVE_TYPES.hypo;
  state.hueStart = p.hue; state.hueSweep = p.sweep;
  state.colorMode = p.colorMode || (p.sweep === 0 ? 'solid' : 'gradient');
  if (p.saturation !== undefined) state.saturation = p.saturation;
  if (p.lightness !== undefined) state.lightness = p.lightness;
  if (p.strokeMode) state.strokeMode = p.strokeMode;
  if (p.lineWidth !== undefined) state.lineWidth = p.lineWidth;
  if (p.bgColor) {
    state.bgColor = p.bgColor;
    document.body.style.background = p.bgColor;
    document.documentElement.style.setProperty('--bg', p.bgColor);
  }
  state.is3D = !!p.is3D; state.h = p.h || 40; state.k = p.k || 3;
  updateAllSliderUI();
  syncColorModeUI();
  document.getElementById('curve-type-select').value = state.curveType.id;
  document.querySelectorAll('.dim-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.dim === (state.is3D ? '3d' : '2d')));
  document.getElementById('controls-panel').classList.toggle('show-3d', state.is3D);
  Animator.restart();
  History.push();
}

function buildMyPresetGallery() {
  const gallery = document.getElementById('my-preset-gallery');
  const section = document.getElementById('my-presets-section');
  const presets = getCustomPresets();
  gallery.innerHTML = '';
  section.style.display = presets.length ? '' : 'none';
  presets.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'preset-item';
    const thumb = renderPresetThumbnail({ R: p.R, r: p.r, d: p.d, mode: p.mode, hue: p.hue, sweep: p.sweep }, 80);
    item.appendChild(thumb);
    const nameEl = document.createElement('div');
    nameEl.className = 'preset-name';
    nameEl.textContent = p.name;
    item.appendChild(nameEl);
    const del = document.createElement('button');
    del.style.cssText = 'position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:50%;background:rgba(239,68,68,0.85);border:none;color:white;font-size:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;-webkit-tap-highlight-color:transparent';
    del.innerHTML = '&#10005;';
    del.addEventListener('click', e => { e.stopPropagation(); deleteCustomPreset(i); });
    item.appendChild(del);
    item.addEventListener('click', () => loadCustomPreset(p));
    gallery.appendChild(item);
  });
}

// ===================================================================
// URL SHARING
// ===================================================================
function encodeStateToHash() {
  const p = new URLSearchParams({
    R:    Math.round(state.R),
    r:    Math.round(state.r),
    d:    Math.round(state.d),
    m:    state.curveType.id,
    hue:  Math.round(state.hueStart),
    sw:   Math.round(state.hueSweep),
    cm:   state.colorMode,
    sat:  Math.round(state.saturation),
    lit:  Math.round(state.lightness),
    lw:   state.lineWidth,
    st:   state.strokeMode,
    bg:   state.bgColor,
    ls:   state.loopStyle,
    tr:   Math.round(state.trailLength),
    '3d': state.is3D ? 1 : 0,
    h:    state.h,
    k:    state.k
  });
  return '#' + p.toString();
}

function loadStateFromHash() {
  if (!location.hash || location.hash.length < 3) return;
  try {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.has('R'))   state.R   = parseFloat(p.get('R'));
    if (p.has('r'))   state.r   = parseFloat(p.get('r'));
    if (p.has('d'))   state.d   = parseFloat(p.get('d'));
    if (p.has('m'))   state.curveType = CURVE_TYPES[p.get('m')] ?? CURVE_TYPES.hypo;
    if (p.has('hue')) state.hueStart  = parseFloat(p.get('hue'));
    if (p.has('sw'))  state.hueSweep  = parseFloat(p.get('sw'));
    if (p.has('cm'))  state.colorMode = p.get('cm');
    if (p.has('sat')) state.saturation = parseFloat(p.get('sat'));
    if (p.has('lit')) state.lightness = parseFloat(p.get('lit'));
    if (p.has('lw'))  state.lineWidth = parseFloat(p.get('lw'));
    if (p.has('st'))  state.strokeMode = p.get('st');
    if (p.has('bg')) {
      state.bgColor = p.get('bg');
      document.body.style.background = state.bgColor;
      document.documentElement.style.setProperty('--bg', state.bgColor);
    }
    if (p.has('ls'))  state.loopStyle = p.get('ls');
    if (p.has('tr'))  state.trailLength = parseFloat(p.get('tr'));
    if (p.has('3d'))  state.is3D = p.get('3d') === '1';
    if (p.has('h'))   state.h = parseFloat(p.get('h'));
    if (p.has('k'))   state.k = parseFloat(p.get('k'));
    syncColorModeUI();
    syncLoopStyleControls();
  } catch { return; }
}

function shareURL() {
  const hash = encodeStateToHash();
  history.replaceState(null, '', hash);
  const url = location.href;
  const copy = () => {
    const ta = document.createElement('textarea');
    ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
  };
  (navigator.clipboard ? navigator.clipboard.writeText(url).catch(copy) : Promise.resolve(copy()));
  const btn = document.getElementById('btn-share');
  const label = btn.querySelector('.btn-label');
  const prev = label.textContent;
  label.textContent = 'Copied!';
  btn.classList.add('active');
  setTimeout(() => { label.textContent = prev; btn.classList.remove('active'); }, 1500);
}

// ===================================================================
// EXPORT
// ===================================================================
function exportPNG(scale) {
  if (scale <= 1) {
    const c = document.createElement('canvas');
    const dpr = Renderer.dpr;
    c.width = Renderer.width * dpr; c.height = Renderer.height * dpr;
    const ctx = c.getContext('2d');
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(Renderer.layersCanvas, 0, 0);
    ctx.drawImage(Renderer.glowCanvas, 0, 0);
    ctx.drawImage(Renderer.curveCanvas, 0, 0);
    const link = document.createElement('a');
    link.download = `spirograph-${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  } else {
    const W = Renderer.width * scale;
    const H = Renderer.height * scale;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = state.bgColor;
    ctx.fillRect(0, 0, W, H);

    const totalT = state.curveType.totalT(state);
    const maxExt = state.curveType.maxExtent(state);
    const s = (Math.min(W, H) * 0.35) / (maxExt || 1);
    const cx = W / 2 + state.offsetX * scale;
    const cy = H / 2 + state.offsetY * scale;

    ctx.lineWidth = state.lineWidth * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const dt = 0.02;
    let prev = null;
    for (let t = 0; t <= totalT; t += dt) {
      const pt = state.curveType.generatePoint(state, t);
      if (prev) {
        const hue = state.hueStart + (t / totalT) * state.hueSweep;
        ctx.strokeStyle = curveColor(hue);
        ctx.beginPath();
        if (state.is3D) {
          const sp = Camera.project(pt, s / scale, cx / scale, cy / scale, 0, 0);
          const spPrev = Camera.project(prev, s / scale, cx / scale, cy / scale, 0, 0);
          ctx.moveTo(spPrev.x * scale, spPrev.y * scale);
          ctx.lineTo(sp.x * scale, sp.y * scale);
        } else {
          ctx.moveTo(cx + prev.x * s, cy - prev.y * s);
          ctx.lineTo(cx + pt.x * s, cy - pt.y * s);
        }
        ctx.stroke();
      }
      prev = pt;
    }

    const link = document.createElement('a');
    link.download = `spirograph-${scale}x-${Date.now()}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  }
}

function exportSVG() {
  const W = Renderer.width, H = Renderer.height;
  const totalT = state.curveType.totalT(state);
  const dt = Math.max(0.02, totalT / 2000);

  const colorPaths = {};
  let prev = null;

  for (let t = 0; t < totalT; t += dt) {
    const pt = state.curveType.generatePoint(state, t);
    const sp = Renderer.toScreen(pt);
    if (prev) {
      const rawHue = state.hueStart + (t / totalT) * state.hueSweep;
      const hue = ((Math.round(rawHue) % 360) + 360) % 360;
      if (!colorPaths[hue]) colorPaths[hue] = '';
      colorPaths[hue] += `M${prev.x.toFixed(1)},${prev.y.toFixed(1)}L${sp.x.toFixed(1)},${sp.y.toFixed(1)} `;
    }
    prev = { x: sp.x, y: sp.y };
  }

  const lw = state.lineWidth.toFixed(1);
  const pathEls = Object.entries(colorPaths)
    .map(([hue, d]) =>
      `  <path d="${d.trim()}" stroke="hsl(${hue},${state.saturation}%,${state.lightness}%)" stroke-width="${lw}" stroke-linecap="round" fill="none"/>`)
    .join('\n');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${state.bgColor}"/>
${pathEls}
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `spirograph-${Date.now()}.svg`;
  a.href = url;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===================================================================
// SYMMETRY LOCK
// ===================================================================
function findRForPetals(R, n) {
  R = Math.round(R);
  let best = null, bestDist = Infinity;
  for (let r = 3; r <= 195; r++) {
    if (SpiroMath.loopCount(R, r) === n) {
      const dist = Math.abs(r - state.r);
      if (dist < bestDist) { bestDist = dist; best = r; }
    }
  }
  return best;
}

function applySymmetryLock() {
  if (!state.symmetryLock) return;
  const r = findRForPetals(state.R, state.targetPetals);
  if (r !== null) {
    state.r = r;
    document.getElementById('slider-r').value = r;
    document.getElementById('val-r').textContent = r;
  }
  updateSymmetryInfo();
}

function updateSymmetryInfo() {
  const info = document.getElementById('symmetry-info');
  let loops;
  const id = state.curveType.id;
  if (id === 'rose') {
    const n = Math.max(1, Math.round(state.k));
    loops = n % 2 === 1 ? n : 2 * n;
  } else if (id === 'lissajous') {
    loops = Math.max(1, Math.round(state.k));
  } else if (id === 'guilloche') {
    loops = Math.max(1, Math.round(state.k));
  } else {
    loops = SpiroMath.loopCount(Math.round(state.R), Math.round(state.r));
  }
  if (state.symmetryLock && (id === 'hypo' || id === 'epi')) {
    info.textContent = loops + '-fold';
    info.style.color = 'var(--accent)';
  } else {
    const label = id === 'lissajous' ? ' nodes' : id === 'guilloche' ? ' scallops' : ' petals';
    info.textContent = loops + label;
    info.style.color = 'var(--text-dim)';
  }
}

// ===================================================================
// UI WIRING
// ===================================================================
const COLOR_PALETTES = [
  { name: 'Neon',   hue: 0,   sweep: 360, sat: 100, lit: 55 },
  { name: 'Pastel', hue: 0,   sweep: 360, sat: 50,  lit: 75 },
  { name: 'Mono',   hue: 220, sweep: 0,   sat: 15,  lit: 70 },
  { name: 'Warm',   hue: 0,   sweep: 60,  sat: 90,  lit: 58 },
  { name: 'Cool',   hue: 180, sweep: 120, sat: 80,  lit: 55 },
  { name: 'Ocean',  hue: 160, sweep: 80,  sat: 85,  lit: 50 },
  { name: 'Sunset', hue: 330, sweep: 90,  sat: 95,  lit: 55 },
];

function buildPaletteSwatches() {
  const row = document.getElementById('palette-row');
  row.innerHTML = '';
  COLOR_PALETTES.forEach((p, i) => {
    const swatch = document.createElement('div');
    swatch.className = 'palette-swatch';
    swatch.title = p.name;
    const stops = [];
    for (let j = 0; j <= 4; j++) {
      const h = (p.hue + (p.sweep * j / 4)) % 360;
      stops.push(`hsl(${h}, ${p.sat}%, ${p.lit}%) ${j * 25}%`);
    }
    swatch.style.background = p.sweep > 0
      ? `conic-gradient(${stops.join(', ')})`
      : `hsl(${p.hue}, ${p.sat}%, ${p.lit}%)`;
    swatch.addEventListener('click', () => {
      state.hueStart = p.hue; state.hueSweep = p.sweep;
      state.saturation = p.sat; state.lightness = p.lit;
      state.colorMode = p.sweep === 0 ? 'solid' : 'gradient';
      updateAllSliderUI();
      syncColorModeUI();
      document.getElementById('slider-sat').value = p.sat;
      document.getElementById('val-sat').textContent = p.sat + '%';
      document.getElementById('slider-lit').value = p.lit;
      document.getElementById('val-lit').textContent = p.lit + '%';
      document.querySelectorAll('.palette-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      if (state.isComplete || !state.isPlaying) Animator.livePreview();
      History.push();
    });
    row.appendChild(swatch);
  });
}

function wireControls() {
  const paramSliders = [
    { id: 'slider-R', val: 'val-R', key: 'R', fmt: v => v, isShapeParam: true },
    { id: 'slider-r', val: 'val-r', key: 'r', fmt: v => v, isShapeParam: true },
    { id: 'slider-d', val: 'val-d', key: 'd', fmt: v => v, isShapeParam: true },
    { id: 'slider-h', val: 'val-h', key: 'h', fmt: v => v, isShapeParam: true },
    { id: 'slider-k', val: 'val-k', key: 'k', fmt: v => v, isShapeParam: true },
    { id: 'slider-width', val: 'val-width', key: 'lineWidth', fmt: v => v, isColorParam: true },
    { id: 'slider-hue', val: 'val-hue', key: 'hueStart', fmt: v => v + '\u00b0', isColorParam: true },
    { id: 'slider-sweep', val: 'val-sweep', key: 'hueSweep', fmt: v => v + '\u00b0', isColorParam: true },
    { id: 'slider-sat', val: 'val-sat', key: 'saturation', fmt: v => v + '%', isColorParam: true },
    { id: 'slider-lit', val: 'val-lit', key: 'lightness', fmt: v => v + '%', isColorParam: true },
  ];

  paramSliders.forEach(({ id, val, key, fmt, isShapeParam, isColorParam }) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(val);
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      state[key] = v;
      if (key === 'hueSweep') state.colorMode = v === 0 ? 'solid' : 'gradient';
      display.textContent = fmt(v);
      IdleAnim.stop();
      clearTimeout(state.idleTimer);
      if (state.isPlaying) {
        if (isShapeParam && !state.isEvolving) {
          state.totalT = state.curveType.totalT(state);
          Renderer.computeScale();
        }
      } else if (isShapeParam && !state.isEvolving) {
        Animator.livePreview();
      } else if (isColorParam) {
        Animator.livePreview();
      }
    });
    slider.addEventListener('change', () => {
      if (isShapeParam && !state.isEvolving) Animator.restart();
      if (isColorParam) syncColorModeUI();
      LFOEngine.syncDisabledBasesFromState();
      History.push();
    });
  });

  // Tap-to-type on slider values
  paramSliders.forEach(({ id, val, key, fmt, isShapeParam, isColorParam }) => {
    const display = document.getElementById(val);
    const slider = document.getElementById(id);
    display.addEventListener('click', (e) => {
      e.stopPropagation();
      if (display.querySelector('input')) return;
      const current = state[key];
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'slider-inline-input';
      input.value = typeof current === 'number' ? (Number.isInteger(current) ? current : current.toFixed(1)) : current;
      input.min = slider.min;
      input.max = slider.max;
      input.step = slider.step;
      display.textContent = '';
      display.appendChild(input);
      input.focus();
      input.select();
      const commit = () => {
        let v = parseFloat(input.value);
        if (isNaN(v)) v = current;
        v = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
        state[key] = v;
        slider.value = v;
        display.textContent = fmt(v);
        if (isShapeParam) {
          if (state.symmetryLock && key === 'R') applySymmetryLock();
          Animator.restart();
          updateSymmetryInfo();
        } else if (isColorParam) {
          if (key === 'hueSweep') state.colorMode = v === 0 ? 'solid' : 'gradient';
          syncColorModeUI();
          if (state.isComplete || !state.isPlaying) Animator.livePreview();
        }
        LFOEngine.syncDisabledBasesFromState();
        History.push();
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e2) => {
        if (e2.key === 'Enter') { e2.preventDefault(); input.blur(); }
        if (e2.key === 'Escape') { display.textContent = fmt(current); }
      });
    });
  });

  // Speed slider — log-scale
  const speedSlider = document.getElementById('slider-speed');
  const speedDisplay = document.getElementById('val-speed');
  function sliderToSpeed(v) {
    if (v <= 50) return 0.01 * Math.pow(10, v / 50);
    return 0.1 * Math.pow(100, (v - 50) / 50);
  }
  speedSlider.addEventListener('input', () => {
    state.speed = sliderToSpeed(parseFloat(speedSlider.value));
    speedDisplay.textContent = state.speed < 1 ? state.speed.toFixed(2) : state.speed.toFixed(1);
  });
  speedSlider.addEventListener('change', () => {
    LFOEngine.syncDisabledBasesFromState();
    History.push();
  });

  // R/r changes: apply symmetry lock + update petal info
  document.getElementById('slider-R').addEventListener('input', () => {
    if (state.symmetryLock) applySymmetryLock();
    updateSymmetryInfo();
  });
  document.getElementById('slider-r').addEventListener('input', () => {
    updateSymmetryInfo();
  });

  // Symmetry lock toggle
  document.getElementById('btn-symmetry').addEventListener('click', () => {
    state.symmetryLock = !state.symmetryLock;
    document.getElementById('btn-symmetry').classList.toggle('active', state.symmetryLock);
    document.getElementById('petals-slider-group').style.display = state.symmetryLock ? '' : 'none';
    document.getElementById('slider-r').disabled = state.symmetryLock;
    if (state.symmetryLock) {
      state.targetPetals = SpiroMath.loopCount(Math.round(state.R), Math.round(state.r));
      const clamped = Math.max(2, Math.min(30, state.targetPetals));
      state.targetPetals = clamped;
      document.getElementById('slider-petals').value = clamped;
      document.getElementById('val-petals').textContent = clamped;
      applySymmetryLock();
      Animator.livePreview();
    }
    updateSymmetryInfo();
    History.push();
  });

  // Petals slider
  document.getElementById('slider-petals').addEventListener('input', () => {
    state.targetPetals = parseInt(document.getElementById('slider-petals').value);
    document.getElementById('val-petals').textContent = state.targetPetals;
    applySymmetryLock();
    Animator.livePreview();
  });
  document.getElementById('slider-petals').addEventListener('change', () => {
    if (!state.isEvolving) Animator.restart();
    History.push();
  });

  updateSymmetryInfo();

  // Curve type selector (replaces hypo/epi mode buttons)
  document.getElementById('curve-type-select').addEventListener('change', e => {
    state.curveType = CURVE_TYPES[e.target.value] ?? CURVE_TYPES.hypo;
    if (state.symmetryLock) applySymmetryLock();
    buildPresetGallery();
    Animator.softReset();
    History.push();
  });

  // 2D/3D toggle
  document.querySelectorAll('.dim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dim-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.is3D = btn.dataset.dim === '3d';
      document.getElementById('controls-panel').classList.toggle('show-3d', state.is3D);
      Animator.restart();
      History.push();
    });
  });

  // Color mode toggle
  document.querySelectorAll('.color-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.colorMode = btn.dataset.color;
      if (state.colorMode === 'rainbow') {
        state.hueStart = 0; state.hueSweep = 360;
        document.getElementById('slider-hue').value = 0;
        document.getElementById('val-hue').textContent = '0\u00b0';
        document.getElementById('slider-sweep').value = 360;
        document.getElementById('val-sweep').textContent = '360\u00b0';
      } else if (state.colorMode === 'solid') {
        state.hueSweep = 0;
        document.getElementById('slider-sweep').value = 0;
        document.getElementById('val-sweep').textContent = '0\u00b0';
      }
      syncColorModeUI();
      if (state.isComplete || !state.isPlaying) Animator.livePreview();
      History.push();
    });
  });

  // Loop style selector
  document.getElementById('loop-style-select').addEventListener('change', e => {
    setLoopStyle(e.target.value);
    History.push();
  });

  // Guide geometry opacity
  document.getElementById('slider-fx-opacity').addEventListener('input', () => {
    state.fxOpacity = parseFloat(document.getElementById('slider-fx-opacity').value);
    document.getElementById('val-fx-opacity').textContent = Math.round(state.fxOpacity) + '%';
  });
  document.getElementById('slider-fx-opacity').addEventListener('change', () => History.push());

  // Trail length
  document.getElementById('slider-trail').addEventListener('input', () => {
    state.trailLength = parseFloat(document.getElementById('slider-trail').value);
    document.getElementById('val-trail').textContent = Math.round(state.trailLength) + '%';
  });
  document.getElementById('slider-trail').addEventListener('change', () => History.push());

  // Stroke mode toggle
  document.querySelectorAll('.stroke-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stroke-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.strokeMode = btn.dataset.stroke;
      if (state.isComplete || !state.isPlaying) Animator.livePreview();
      History.push();
    });
  });

  // Background color
  document.getElementById('bg-color').addEventListener('input', (e) => {
    state.bgColor = e.target.value;
    document.body.style.background = state.bgColor;
    document.documentElement.style.setProperty('--bg', state.bgColor);
    if (state.isComplete) Animator.livePreview();
  });
  document.getElementById('bg-color').addEventListener('change', () => History.push());

  // Action buttons
  document.getElementById('btn-play').addEventListener('click', () => Animator.toggle());
  document.getElementById('btn-clear').addEventListener('click', () => {
    Animator.reset();
    Renderer.clearLayers();
    state.layerCount = 0;
    state.onionCaptured = false;
    updateLayerBadge();
    History.push();
  });

  document.getElementById('btn-fx').addEventListener('click', () => {
    state.showFX = !state.showFX;
    state.showGlow = state.showFX;
    document.getElementById('btn-fx').classList.toggle('active', state.showFX);
    if (!state.showFX) { Renderer.clearOverlay(); Renderer.clearGlow(); }
    else if (state.isComplete) Animator.livePreview();
    History.push();
  });

  document.getElementById('btn-save').addEventListener('click', () => exportPNG(1));

  let saveTimer = null;
  const saveBtn = document.getElementById('btn-save');
  saveBtn.addEventListener('mousedown', () => {
    saveTimer = setTimeout(() => { saveTimer = 'fired'; exportPNG(4); }, 600);
  });
  saveBtn.addEventListener('mouseup', () => {
    if (saveTimer && saveTimer !== 'fired') { clearTimeout(saveTimer); }
    saveTimer = null;
  });
  saveBtn.addEventListener('touchstart', (e) => {
    saveTimer = setTimeout(() => { saveTimer = 'fired'; e.preventDefault(); exportPNG(4); }, 600);
  }, { passive: false });
  saveBtn.addEventListener('touchend', () => {
    if (saveTimer && saveTimer !== 'fired') { clearTimeout(saveTimer); }
    saveTimer = null;
  });

  document.getElementById('btn-svg').addEventListener('click', exportSVG);

  document.getElementById('btn-annotate').addEventListener('click', () => {
    state.showAnnotations = !state.showAnnotations;
    document.getElementById('btn-annotate').classList.toggle('active', state.showAnnotations);
    if (state.isComplete) {
      Renderer.clearOverlay();
      Annotations.draw(Renderer.overlayCtx);
    }
    History.push();
  });

  document.getElementById('btn-onion').addEventListener('click', () => {
    state.onionSkin = !state.onionSkin;
    state.onionCaptured = false;
    document.getElementById('btn-onion').classList.toggle('active', state.onionSkin);
    History.push();
  });

  document.getElementById('btn-sound').addEventListener('click', () => {
    Sound.toggle();
    History.push();
  });

  document.getElementById('btn-layer').addEventListener('click', () => {
    if (state.loopStyle === 'trail') {
      setLoopStyle('wipe', { restartIfComplete: false });
      Animator.livePreview();
    }
    Renderer.stampLayer();
    state.layerCount++;
    updateLayerBadge();
    state.hueStart = (state.hueStart + 137.508) % 360;
    document.getElementById('slider-hue').value = Math.round(state.hueStart);
    document.getElementById('val-hue').textContent = Math.round(state.hueStart) + '\u00b0';
    Animator.reset();
    Animator.start();
    History.push();
  });

  document.getElementById('btn-save-preset').addEventListener('click', saveCustomPreset);
  document.getElementById('btn-share').addEventListener('click', shareURL);
  document.getElementById('btn-rec').addEventListener('click', () => Recorder.toggle());
  document.getElementById('btn-shuffle').addEventListener('click', doShuffle);
  document.getElementById('btn-evolve').addEventListener('click', () => Evolve.toggle());

  // Panel toggles
  document.getElementById('controls-toggle').addEventListener('click', () => {
    const panel = document.getElementById('controls-panel');
    setPanelCollapsed('controls-panel', 'controls-toggle', !panel.classList.contains('collapsed'));
  });
  document.getElementById('math-toggle').addEventListener('click', () => {
    const panel = document.getElementById('math-panel');
    setPanelCollapsed('math-panel', 'math-toggle', !panel.classList.contains('collapsed'));
    MathPanel.update();
  });
  document.getElementById('lfo-tab').addEventListener('click', () => {
    const drawer = document.getElementById('lfo-drawer');
    setLFODrawerCollapsed(!drawer.classList.contains('lfo-collapsed'));
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); History.undo(); return; }
    if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); History.redo(); return; }
    if (mod && e.key === 's') { e.preventDefault(); exportPNG(1); return; }
    if (mod && e.shiftKey && e.key === 'S') { e.preventDefault(); exportPNG(4); return; }

    switch (e.key) {
      case ' ': e.preventDefault(); Animator.toggle(); break;
      case 'r': case 'R': doShuffle(); break;
      case 'e': case 'E': Evolve.toggle(); break;
      case 'l': case 'L': document.getElementById('btn-layer').click(); break;
      case 'a': case 'A': document.getElementById('btn-annotate').click(); break;
      case 'f': case 'F': document.getElementById('btn-fx').click(); break;
      case 'm': case 'M': document.getElementById('math-toggle').click(); break;
      case 'Escape':
        setPanelCollapsed('controls-panel', 'controls-toggle', true);
        setPanelCollapsed('math-panel', 'math-toggle', true);
        setLFODrawerCollapsed(true);
        break;
      case '1': case '2': case '3': case '4': case '5':
      case '6': case '7': case '8': case '9': {
        const idx = parseInt(e.key) - 1;
        if (idx < PRESETS.length) loadPreset(idx);
        break;
      }
      case '0':
        if (PRESETS.length >= 10) loadPreset(9);
        break;
    }
  });

  // Shake to randomize
  if (window.DeviceMotionEvent) {
    let lastShake = 0;
    const registerShakeListener = () => {
      window.addEventListener('devicemotion', (e) => {
        const a = e.accelerationIncludingGravity;
        if (!a) return;
        const force = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
        if (force > 25 && Date.now() - lastShake > 2000) {
          lastShake = Date.now();
          doShuffle();
        }
      });
    };
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      const requestMotion = () => {
        DeviceMotionEvent.requestPermission()
          .then(response => { if (response === 'granted') registerShakeListener(); })
          .catch(() => {});
        document.removeEventListener('touchstart', requestMotion);
      };
      document.addEventListener('touchstart', requestMotion, { once: true });
    } else {
      registerShakeListener();
    }
  }
}

function updateLayerBadge() {
  const badge = document.getElementById('layer-badge');
  if (state.layerCount > 0) {
    badge.classList.add('show');
    badge.textContent = state.layerCount;
  } else {
    badge.classList.remove('show');
    badge.textContent = '0';
  }
  syncLoopStyleControls();
}

// ===================================================================
// RESIZE
// ===================================================================
let resizeTimer;
function handleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    Renderer.resize();
    if (state.isComplete) Animator.livePreview();
  }, 150);
}

// ===================================================================
// SETTINGS PERSISTENCE
// ===================================================================
const SETTINGS_KEY = 'spirograph-settings';

function saveSettings() {
  const settings = { curveType: state.curveType.id };
  PERSISTED_STATE_KEYS.forEach(key => { settings[key] = state[key]; });
  settings.lfo = LFOEngine.capture();
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!s) return false;
    if (!s.curveType && s.mode) s.curveType = s.mode;
    if (!s.loopStyle && (s.trailMode !== undefined || s.loopMode !== undefined)) {
      if (s.trailMode) s.loopStyle = 'trail';
      else if (s.loopMode) s.loopStyle = 'wipe';
      else s.loopStyle = 'once';
    }
    applyStateSnapshot(s, { fromSettings: true });
    return true;
  } catch { return false; }
}

function syncUIToState() {
  updateAllSliderUI();
  document.getElementById('curve-type-select').value = state.curveType.id;
  document.querySelectorAll('.dim-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.dim === (state.is3D ? '3d' : '2d')));
  document.querySelectorAll('.stroke-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.stroke === state.strokeMode));
  syncColorModeUI();
  syncLoopStyleControls();
  document.getElementById('controls-panel').classList.toggle('show-3d', state.is3D);
  document.getElementById('btn-fx').classList.toggle('active', state.showFX);
  document.getElementById('btn-onion').classList.toggle('active', state.onionSkin);
  document.getElementById('btn-annotate').classList.toggle('active', state.showAnnotations);
  document.getElementById('btn-symmetry').classList.toggle('active', state.symmetryLock);
  document.getElementById('petals-slider-group').style.display = state.symmetryLock ? '' : 'none';
  document.getElementById('slider-r').disabled = state.symmetryLock;
  document.getElementById('slider-petals').value = state.targetPetals;
  document.getElementById('val-petals').textContent = state.targetPetals;
  document.getElementById('slider-fx-opacity').value = state.fxOpacity;
  document.getElementById('val-fx-opacity').textContent = Math.round(state.fxOpacity) + '%';
  document.getElementById('slider-trail').value = state.trailLength;
  document.getElementById('val-trail').textContent = Math.round(state.trailLength) + '%';
  document.getElementById('slider-width').value = state.lineWidth;
  document.getElementById('val-width').textContent = state.lineWidth;
  document.getElementById('slider-sat').value = state.saturation;
  document.getElementById('val-sat').textContent = state.saturation + '%';
  document.getElementById('slider-lit').value = state.lightness;
  document.getElementById('val-lit').textContent = state.lightness + '%';
  document.getElementById('bg-color').value = state.bgColor;
  updateSymmetryInfo();
  updateLayerBadge();
  Sound.syncUI();
  LFOEngine.syncUI();
}

// ===================================================================
// INIT
// ===================================================================
function init() {
  Renderer.init();
  Animator.beginLoop();
  wireControls();
  wireCanvasTouch();
  buildPresetGallery();
  buildMyPresetGallery();
  buildPaletteSwatches();

  loadSettings();

  const hasHash = window.location.hash.length > 1;
  loadStateFromHash();
  LFOEngine.syncDisabledBasesFromState();
  buildLFOPanel();
  MathPanel.update();
  window.addEventListener('resize', handleResize);
  window.addEventListener('orientationchange', handleResize);

  if (hasHash) {
    syncUIToState();
    History.push();
    Animator.restart();
  } else {
    const randR = 60 + Math.floor(Math.random() * 100);
    let randR2, loops;
    do {
      randR2 = 10 + Math.floor(Math.random() * (randR - 15));
      loops = SpiroMath.loopCount(randR, randR2);
    } while (loops > 15);
    state.R = randR; state.r = randR2;
    state.d = Math.floor(state.r * (0.3 + Math.random() * 0.7));
    state.curveType = Math.random() > 0.5 ? CURVE_TYPES.epi : CURVE_TYPES.hypo;
    state.h = 20 + Math.floor(Math.random() * 80);
    state.k = 1 + Math.floor(Math.random() * 12);
    state.hueStart = Math.floor(Math.random() * 360);
    state.hueSweep = 180 + Math.floor(Math.random() * 540);
    state.colorMode = 'gradient';
    LFOEngine.syncDisabledBasesFromState();
    syncUIToState();

    setPanelCollapsed('controls-panel', 'controls-toggle', true);
    History.push();
    Animator.restart();

    setTimeout(() => {
      document.getElementById('controls-toggle').classList.add('hint-pulse');
      setTimeout(() => document.getElementById('controls-toggle').classList.remove('hint-pulse'), 4500);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
