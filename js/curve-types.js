// ===================================================================
// CURVE TYPE ABSTRACTION
// Each curve type implements: generatePoint, totalT, maxExtent, innerCenter
// New curve types (rose, Lissajous, guilloche) can be added as drop-ins.
// ===================================================================
import { SpiroMath } from './spiro-math.js';

class CurveType {
  get id()   { return ''; }
  get name() { return ''; }
  generatePoint(s, t)  { return { x: 0, y: 0, z: 0 }; }
  totalT(s)            { return 0; }
  maxExtent(s)         { return 0; }
  innerCenter(s, t)    { return { x: 0, y: 0, z: 0 }; }
}

class HypotrochoidCurve extends CurveType {
  get id()   { return 'hypo'; }
  get name() { return 'Hypotrochoid'; }

  generatePoint(s, t) {
    return s.is3D
      ? SpiroMath.hypoPoint3D(s.R, s.r, s.d, s.h, s.k, t)
      : SpiroMath.hypoPoint(s.R, s.r, s.d, t);
  }
  totalT(s)      { return SpiroMath.totalT(Math.round(s.R), Math.round(s.r)); }
  maxExtent(s)   { return SpiroMath.maxExtent('hypo', s.R, s.r, s.d); }
  innerCenter(s, t) { return SpiroMath.innerCenter('hypo', s.R, s.r, t); }
}

class EpitrochoidCurve extends CurveType {
  get id()   { return 'epi'; }
  get name() { return 'Epitrochoid'; }

  generatePoint(s, t) {
    return s.is3D
      ? SpiroMath.epiPoint3D(s.R, s.r, s.d, s.h, s.k, t)
      : SpiroMath.epiPoint(s.R, s.r, s.d, t);
  }
  totalT(s)      { return SpiroMath.totalT(Math.round(s.R), Math.round(s.r)); }
  maxExtent(s)   { return SpiroMath.maxExtent('epi', s.R, s.r, s.d); }
  innerCenter(s, t) { return SpiroMath.innerCenter('epi', s.R, s.r, t); }
}

// ===================================================================
// ROSE CURVE (rhodonea)  x = (R·cos(k·t) + d)·cos(t)
// k = petal frequency, R = amplitude, d = inner offset (0 = pure rose)
// ===================================================================
class RoseCurve extends CurveType {
  get id()   { return 'rose'; }
  get name() { return 'Rose'; }

  generatePoint(s, t) {
    const n = Math.max(1, Math.round(s.k));
    const rho = s.R * Math.cos(n * t) + s.d;
    return {
      x: rho * Math.cos(t),
      y: rho * Math.sin(t),
      z: s.is3D ? s.h * Math.sin(n * t) : 0
    };
  }

  totalT(s) {
    const n = Math.max(1, Math.round(s.k));
    // Pure rose (d≈0): π for odd n, 2π for even n
    // With inner offset: always 2π
    return s.d < 2 ? (n % 2 === 1 ? Math.PI : 2 * Math.PI) : 2 * Math.PI;
  }

  maxExtent(s) { return s.R + Math.abs(s.d); }
  innerCenter(s, t) { return { x: 0, y: 0, z: 0 }; }
}

// ===================================================================
// LISSAJOUS CURVE  x = R·sin(t + δ),  y = r·sin(k·t)
// R = x-amplitude, r = y-amplitude, k = freq ratio, d = phase (0–100 → 0–π/2)
// ===================================================================
class LissajousCurve extends CurveType {
  get id()   { return 'lissajous'; }
  get name() { return 'Lissajous'; }

  generatePoint(s, t) {
    const n = Math.max(1, Math.round(s.k));
    const phase = (s.d / 100) * (Math.PI / 2);
    return {
      x: s.R * Math.sin(t + phase),
      y: s.r * Math.sin(n * t),
      z: s.is3D ? s.h * Math.sin(n * t + phase) : 0
    };
  }

  totalT(s) {
    return 2 * Math.PI * Math.max(1, Math.round(s.k));
  }

  maxExtent(s) { return Math.max(s.R, s.r); }

  innerCenter(s, t) {
    const phase = (s.d / 100) * (Math.PI / 2);
    return { x: s.R * Math.sin(t + phase), y: 0, z: 0 };
  }
}

// ===================================================================
// GUILLOCHÉ  ρ(t) = R + r·cos(k·t),  x = ρ·cos(t) + d·cos((k+1)t)
// Always closes at 2π. k = scallop count, d = interlace arm depth.
// ===================================================================
class GuillocheCurve extends CurveType {
  get id()   { return 'guilloche'; }
  get name() { return 'Guilloché'; }

  generatePoint(s, t) {
    const n = Math.max(1, Math.round(s.k));
    const rho = s.R + s.r * Math.cos(n * t);
    return {
      x: rho * Math.cos(t) + s.d * Math.cos((n + 1) * t),
      y: rho * Math.sin(t) + s.d * Math.sin((n + 1) * t),
      z: s.is3D ? s.h * Math.sin(n * t) : 0
    };
  }

  totalT()    { return 2 * Math.PI; }
  maxExtent(s) { return s.R + s.r + s.d; }
  innerCenter(s, t) {
    const n = Math.max(1, Math.round(s.k));
    const rho = s.R + s.r * Math.cos(n * t);
    return { x: rho * Math.cos(t), y: rho * Math.sin(t), z: 0 };
  }
}

export const CURVE_TYPES = {
  hypo:      new HypotrochoidCurve(),
  epi:       new EpitrochoidCurve(),
  rose:      new RoseCurve(),
  lissajous: new LissajousCurve(),
  guilloche: new GuillocheCurve(),
};

export { CurveType };
