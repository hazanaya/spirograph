// ===================================================================
// SHARED STATE — imported as a singleton by renderer.js and app.js
// ===================================================================
import { CURVE_TYPES } from './curve-types.js';

export const state = {
  curveType: CURVE_TYPES.hypo,  // CurveType instance; replaces state.mode string
  is3D: true,
  R: 100, r: 63, d: 50,
  h: 40, k: 3,
  speed: 0.1, lineWidth: 1.5,
  hueStart: 0, hueSweep: 360,
  showFX: true, showGlow: true, fxOpacity: 100,
  soundOn: false,
  isPlaying: false, currentT: 0, totalT: 0,
  scale: 1, offsetX: 0, offsetY: 0,
  prevPoint: null, animId: null, isComplete: false,
  layerCount: 0,
  isEvolving: false,
  isShuffling: false,
  canvasDragging: false,
  onionSkin: false, onionCaptured: false,
  symmetryLock: false, targetPetals: 7,
  loopStyle: 'trail', trailLength: 50,
  erasing: false, eraseT: 0,
  bgColor: '#07070d',
  colorMode: 'gradient',
  saturation: 90, lightness: 60, strokeMode: 'solid',
  showAnnotations: false
};
