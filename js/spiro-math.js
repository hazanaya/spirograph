// ===================================================================
// SPIROGRAPH MATH — pure functions, no dependencies
// ===================================================================
export const SpiroMath = {
  gcd(a, b) {
    a = Math.round(Math.abs(a)); b = Math.round(Math.abs(b));
    while (b) { [a, b] = [b, a % b]; }
    return a;
  },
  loopCount(R, r) { r = Math.max(r, 1); const g = this.gcd(R, r); return g === 0 ? 1 : r / g; },
  totalT(R, r) { return 2 * Math.PI * this.loopCount(R, r); },

  hypoPoint(R, r, d, t) {
    r = Math.max(r, 0.001);
    const diff = R - r, ratio = diff / r;
    return { x: diff * Math.cos(t) + d * Math.cos(ratio * t), y: diff * Math.sin(t) - d * Math.sin(ratio * t), z: 0 };
  },
  epiPoint(R, r, d, t) {
    r = Math.max(r, 0.001);
    const sum = R + r, ratio = sum / r;
    return { x: sum * Math.cos(t) - d * Math.cos(ratio * t), y: sum * Math.sin(t) - d * Math.sin(ratio * t), z: 0 };
  },

  hypoPoint3D(R, r, d, h, k, t) {
    const p = this.hypoPoint(R, r, d, t);
    p.z = h * Math.sin(k * t);
    return p;
  },
  epiPoint3D(R, r, d, h, k, t) {
    const p = this.epiPoint(R, r, d, t);
    p.z = h * Math.sin(k * t);
    return p;
  },

  // Kept for preset thumbnail rendering (needs explicit mode from preset data)
  point(mode, R, r, d, t, is3D, h, k) {
    if (is3D) return mode === 'hypo' ? this.hypoPoint3D(R, r, d, h, k, t) : this.epiPoint3D(R, r, d, h, k, t);
    return mode === 'hypo' ? this.hypoPoint(R, r, d, t) : this.epiPoint(R, r, d, t);
  },

  innerCenter(mode, R, r, t) {
    if (mode === 'hypo') { const d = R - r; return { x: d * Math.cos(t), y: d * Math.sin(t), z: 0 }; }
    const s = R + r; return { x: s * Math.cos(t), y: s * Math.sin(t), z: 0 };
  },

  maxExtent(mode, R, r, d) { return mode === 'hypo' ? Math.abs(R - r) + d : R + r + d; },
  simplifyFraction(a, b) { const g = this.gcd(a, b); return [a / g, b / g]; }
};

// ===================================================================
// CAMERA — 3D projection + orbit
// ===================================================================
export const Camera = {
  yaw: 0.3, pitch: 0.4,
  targetYaw: 0.3, targetPitch: 0.4,
  velYaw: 0, velPitch: 0,
  camDist: 500, fov: 400,
  friction: 0.96,

  rotatePoint(p) {
    let x = p.x * Math.cos(this.yaw) - p.z * Math.sin(this.yaw);
    let z = p.x * Math.sin(this.yaw) + p.z * Math.cos(this.yaw);
    let y = p.y * Math.cos(this.pitch) - z * Math.sin(this.pitch);
    z = p.y * Math.sin(this.pitch) + z * Math.cos(this.pitch);
    return { x, y, z };
  },

  project(p, scale, centerX, centerY, offsetX, offsetY) {
    const r = this.rotatePoint({ x: p.x * scale, y: p.y * scale, z: p.z * scale });
    const perspective = this.fov / (r.z + this.camDist);
    return {
      x: centerX + offsetX + r.x * perspective,
      y: centerY + offsetY - r.y * perspective,
      depth: r.z
    };
  },

  dragging: false,

  update() {
    this.velYaw *= this.friction;
    this.velPitch *= this.friction;
    this.yaw += this.velYaw;
    this.pitch += this.velPitch;
    if (!this.dragging && Math.abs(this.velYaw) < 0.0001 && Math.abs(this.velPitch) < 0.0001) {
      this.yaw += 0.003;
    }
  }
};

// ===================================================================
// UTILITIES
// ===================================================================
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
