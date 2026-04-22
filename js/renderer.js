// ===================================================================
// RENDERER — canvas management, drawing, visual effects
// ===================================================================
import { SpiroMath, Camera, hexToRgba } from './spiro-math.js';
import { state } from './state.js';

export const Renderer = {
  curveCanvas: null, overlayCanvas: null, glowCanvas: null, layersCanvas: null,
  curveCtx: null, overlayCtx: null, glowCtx: null, layersCtx: null,
  dpr: 1, width: 0, height: 0, centerX: 0, centerY: 0,
  glowFrame: 0,

  init() {
    this.curveCanvas = document.getElementById('curve-canvas');
    this.overlayCanvas = document.getElementById('overlay-canvas');
    this.glowCanvas = document.getElementById('glow-canvas');
    this.layersCanvas = document.getElementById('layers-canvas');
    this.curveCtx = this.curveCanvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.glowCtx = this.glowCanvas.getContext('2d');
    this.layersCtx = this.layersCanvas.getContext('2d');
    this.resize();
  },

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    for (const c of [this.curveCanvas, this.overlayCanvas, this.glowCanvas, this.layersCanvas]) {
      c.width = this.width * this.dpr;
      c.height = this.height * this.dpr;
      c.style.width = this.width + 'px';
      c.style.height = this.height + 'px';
      c.getContext('2d').scale(this.dpr, this.dpr);
    }
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    this.computeScale();
  },

  computeScale() {
    const maxExt = state.curveType.maxExtent(state);
    const extraZ = state.is3D ? state.h * 0.3 : 0;
    const minDim = Math.min(this.width, this.height);
    state.scale = (minDim * 0.35) / ((maxExt + extraZ) || 1);
  },

  toScreen(p) {
    if (state.is3D) {
      return Camera.project(p, state.scale, this.centerX, this.centerY, state.offsetX, state.offsetY);
    }
    return {
      x: this.centerX + state.offsetX + p.x * state.scale,
      y: this.centerY + state.offsetY - p.y * state.scale,
      depth: 0
    };
  },

  clearCanvas(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
  },

  clearCurve()   { this.clearCanvas(this.curveCtx); },
  clearOverlay() { this.clearCanvas(this.overlayCtx); },
  clearGlow()    { this.clearCanvas(this.glowCtx); },
  clearLayers()  { this.clearCanvas(this.layersCtx); },

  fadeCurve(alpha) {
    const ctx = this.curveCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = hexToRgba(state.bgColor, alpha);
    ctx.fillRect(0, 0, this.width, this.height);
  },

  drawSegment(from, to, color, progress) {
    const ctx = this.curveCtx;
    const a = this.toScreen(from);
    const b = this.toScreen(to);

    let lw = state.lineWidth;
    let alpha = 1;
    if (state.is3D && !state.trailMode) {
      const avgDepth = ((a.depth || 0) + (b.depth || 0)) / 2;
      const norm = (avgDepth + 200) / 400;
      alpha = 0.3 + 0.7 * Math.max(0, Math.min(1, 1 - norm * 0.5));
      lw = state.lineWidth * (0.5 + 1.5 * Math.max(0, Math.min(1, 1 - norm * 0.3)));
    } else if (state.is3D) {
      const avgDepth = ((a.depth || 0) + (b.depth || 0)) / 2;
      const norm = (avgDepth + 200) / 400;
      lw = state.lineWidth * (0.5 + 1.5 * Math.max(0, Math.min(1, 1 - norm * 0.3)));
    }

    if (state.strokeMode === 'tapered' && progress !== undefined) {
      lw *= (1 - progress * 0.7);
    }

    if (state.strokeMode === 'dotted') {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(b.x, b.y, lw * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    if (state.strokeMode === 'dashed') {
      ctx.setLineDash([lw * 3, lw * 2]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (state.strokeMode === 'dashed') ctx.setLineDash([]);
  },

  updateGlow() {
    if (!state.showGlow) return;
    this.glowFrame++;
    if (this.glowFrame % 3 !== 0) return;

    const ctx = this.glowCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (state.trailMode) {
      this.clearGlow();
      return;
    } else {
      ctx.fillStyle = hexToRgba(state.bgColor, 0.15);
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.filter = 'blur(8px)';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3;
    ctx.drawImage(this.curveCanvas, 0, 0, this.width, this.height);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  },

  // t = current parameter value for construction geometry
  drawConstruction(t) {
    if (!state.showFX || state.fxOpacity <= 0) return;
    const ctx = this.overlayCtx;
    const a = state.fxOpacity / 100;

    ctx.lineWidth = 1 + a * 2;

    const drawProjectedCircle = (centerPt, radius, color, segments) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      for (let i = 0; i <= segments; i++) {
        const angle = (2 * Math.PI * i) / segments;
        const pt = {
          x: centerPt.x + radius * Math.cos(angle),
          y: centerPt.y + radius * Math.sin(angle),
          z: centerPt.z || 0
        };
        const sp = this.toScreen(pt);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.stroke();
    };

    drawProjectedCircle({ x: 0, y: 0, z: 0 }, state.R, `rgba(255,255,255,${0.6 * a})`, 64);

    const center = state.curveType.innerCenter(state, t);
    drawProjectedCircle(center, state.r, `rgba(244, 114, 182, ${0.8 * a})`, 48);

    const sc = this.toScreen(center);
    const pen = state.curveType.generatePoint(state, t);
    const sp = this.toScreen(pen);

    ctx.beginPath();
    ctx.moveTo(sc.x, sc.y);
    ctx.lineTo(sp.x, sp.y);
    ctx.strokeStyle = `rgba(251, 191, 36, ${0.9 * a})`;
    ctx.lineWidth = 2 + a;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(244, 114, 182, ${a})`;
    ctx.fill();
  },

  ghostLayer(alpha = 0.15) {
    const ctx = this.layersCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.curveCanvas, 0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
  },

  stampLayer() {
    const ctx = this.layersCtx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(this.curveCanvas, 0, 0, this.width, this.height);
    if (state.showGlow) {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(this.glowCanvas, 0, 0, this.width, this.height);
    }
    ctx.globalAlpha = 1;
  }
};

// ===================================================================
// PEN TRAIL + PARTICLES
// ===================================================================
export const PenTrail = {
  trail: [],
  maxTrail: 12,
  particles: [],
  maxParticles: 40,

  addPoint(screenPt, hue) {
    this.trail.push({ x: screenPt.x, y: screenPt.y, hue });
    if (this.trail.length > this.maxTrail) this.trail.shift();

    for (let i = 0; i < 2; i++) {
      if (this.particles.length >= this.maxParticles) this.particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      this.particles.push({
        x: screenPt.x, y: screenPt.y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 1, hue
      });
    }
  },

  draw(ctx) {
    const now = Date.now();
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const age = i / this.trail.length;
      const r = 1 + age * 4;
      const a = age * 0.7;
      const wobble = 1 + 0.15 * Math.sin(now * 0.008 + i);
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * wobble, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${t.hue % 360}, 90%, 70%, ${a})`;
      ctx.fill();
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5 * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue % 360}, 100%, 80%, ${p.life * 0.6})`;
      ctx.fill();
    }

    if (this.trail.length > 0) {
      const tip = this.trail[this.trail.length - 1];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${tip.hue % 360}, 100%, 80%, 0.9)`;
      ctx.shadowColor = `hsl(${tip.hue % 360}, 100%, 70%)`;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  },

  clear() {
    this.trail = [];
    this.particles = [];
  }
};

// ===================================================================
// RIPPLES
// ===================================================================
export const Ripples = {
  ripples: [],
  maxRipples: 15,

  add(x, y, hue) {
    if (this.ripples.length >= this.maxRipples) this.ripples.shift();
    this.ripples.push({ x, y, radius: 0, opacity: 0.5, hue, maxRadius: 180 });
  },

  burst(x, y, hue, count) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.add(x, y, (hue + i * 40) % 360), i * 80);
    }
  },

  update(ctx) {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += 2.5;
      r.opacity *= 0.97;
      if (r.opacity < 0.01 || r.radius > r.maxRadius) { this.ripples.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${r.hue % 360}, 90%, 65%, ${r.opacity})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `hsla(${r.hue % 360}, 100%, 70%, ${r.opacity * 0.5})`;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
};

// ===================================================================
// ANNOTATIONS — symmetry axes, petal labels, period marker
// ===================================================================
export const Annotations = {
  draw(ctx) {
    const id = state.curveType.id;
    if (!state.showAnnotations || !state.isComplete) return;
    if (id !== 'hypo' && id !== 'epi') return;

    const R = Math.round(state.R), r = Math.round(state.r);
    const n = SpiroMath.loopCount(R, r);
    const totalT = state.totalT;
    const cx = Renderer.centerX + state.offsetX;
    const cy = Renderer.centerY + state.offsetY;

    ctx.save();
    ctx.strokeStyle = 'rgba(136, 136, 160, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    const axisLen = Math.min(Renderer.width, Renderer.height) * 0.42;
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k) / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * axisLen, cy - Math.sin(angle) * axisLen);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const petalT = totalT / n;
    for (let k = 0; k < n; k++) {
      let maxDist = 0, tipPt = null;
      const tStart = k * petalT;
      const tEnd = (k + 1) * petalT;
      const samples = 30;
      for (let s = 0; s <= samples; s++) {
        const t = tStart + (tEnd - tStart) * s / samples;
        const pt = state.curveType.generatePoint(state, t);
        const dist = pt.x * pt.x + pt.y * pt.y + (pt.z || 0) * (pt.z || 0);
        if (dist > maxDist) { maxDist = dist; tipPt = pt; }
      }
      if (tipPt) {
        const sp = Renderer.toScreen(tipPt);
        const dx = sp.x - cx, dy = sp.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const labelX = sp.x + (dx / len) * 14;
        const labelY = sp.y + (dy / len) * 14;
        ctx.fillStyle = 'rgba(200, 200, 220, 0.7)';
        ctx.fillText(k + 1, labelX, labelY);
      }
    }

    const closePt = state.curveType.generatePoint(state, totalT);
    const cp = Renderer.toScreen(closePt);
    ctx.fillStyle = 'rgba(255, 200, 100, 0.8)';
    ctx.beginPath();
    ctx.moveTo(cp.x, cp.y - 5);
    ctx.lineTo(cp.x + 4, cp.y);
    ctx.lineTo(cp.x, cp.y + 5);
    ctx.lineTo(cp.x - 4, cp.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
    ctx.font = '10px SF Mono, monospace';
    ctx.fillText(`t = ${(totalT / Math.PI).toFixed(1)}π`, cp.x + 10, cp.y);

    ctx.restore();
  }
};
