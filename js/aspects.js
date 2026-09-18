// js/aspects.js
// Aspect calculation engine. Pure functions, no DOM.
//
// Input:  structured chart data array (see chart.html buildChartData)
//         [{ name, longitude, sign, signIndex, degreeInSign, house, retrograde, speed }, ...]
// Output: array of aspects
//         [{ body1, body2, type, glyph, label, angle, exact, orb, separation,
//            applying, key }, ...]

import { ASPECTS, ORBS, DEFAULT_ORB, ORB_RULE, ASPECT_ORB_FACTORS } from './config.js';

/** Normalise any angle into [0, 360). */
export function normalize(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Shortest-arc angular separation between two ecliptic longitudes.
 * Always returns a value in [0, 180].
 */
export function angularSeparation(lon1, lon2) {
  const diff = Math.abs(normalize(lon1) - normalize(lon2));
  return diff > 180 ? 360 - diff : diff;
}

/** Orb allowance for a pair of bodies, following ORB_RULE. */
export function orbFor(body1, body2, aspectType) {
  const o1 = ORBS[body1] ?? DEFAULT_ORB;
  const o2 = ORBS[body2] ?? DEFAULT_ORB;
  let orb;
  if (ORB_RULE === 'min') orb = Math.min(o1, o2);
  else if (ORB_RULE === 'mean') orb = (o1 + o2) / 2;
  else orb = Math.max(o1, o2);
  return orb * (ASPECT_ORB_FACTORS[aspectType] ?? 1);
}

/**
 * Build a consistent lookup key for an aspect: the two body names sorted
 * alphabetically, then the aspect type. e.g. "Mars-Saturn-square".
 */
export function aspectKey(body1, body2, type) {
  const [a, b] = [body1, body2].sort((x, y) => x.localeCompare(y));
  return `${a}-${b}-${type}`;
}

/**
 * Is the aspect applying (moving toward exact) or separating?
 *
 * Uses the daily speeds: the separation between the two bodies changes at a
 * rate given by the difference in speed. If the separation is currently
 * larger than the exact aspect angle and shrinking (or smaller and growing),
 * the aspect is applying.
 */
export function isApplying(p1, p2, exactAngle) {
  const s1 = Number.isFinite(p1.speed) ? p1.speed : 0;
  const s2 = Number.isFinite(p2.speed) ? p2.speed : 0;
  const now = angularSeparation(p1.longitude, p2.longitude);
  // Advance both bodies by a small step and see whether the separation
  // moves closer to the exact angle.
  const step = 0.01; // days
  const next = angularSeparation(p1.longitude + s1 * step, p2.longitude + s2 * step);
  return Math.abs(next - exactAngle) < Math.abs(now - exactAngle);
}

/**
 * Find every aspect between every pair of bodies.
 * @param {Array} chartData
 * @param {object} [options]
 * @param {string[]} [options.types]        restrict to these aspect types
 * @param {object}   [options.orbs]         override the per-body ORBS map
 * @param {object}   [options.definitions]  aspect definitions to use (default ASPECTS; patterns add minor aspects)
 * @param {object}   [options.aspectOrbs]   absolute orb per aspect type; overrides body orbs when present
 */
export function calculateAspects(chartData, options = {}) {
  const defs = options.definitions || ASPECTS;
  const types = options.types || Object.keys(defs);
  const found = [];

  for (let i = 0; i < chartData.length; i++) {
    for (let j = i + 1; j < chartData.length; j++) {
      const p1 = chartData[i];
      const p2 = chartData[j];
      const sep = angularSeparation(p1.longitude, p2.longitude);

      let best = null;
      for (const type of types) {
        const def = defs[type];
        if (!def) continue;
        let orbAllowed;
        if (options.aspectOrbs && options.aspectOrbs[type] != null) orbAllowed = options.aspectOrbs[type];
        else if (options.orbs) orbAllowed = Math.max(options.orbs[p1.name] ?? DEFAULT_ORB, options.orbs[p2.name] ?? DEFAULT_ORB) * (ASPECT_ORB_FACTORS[type] ?? 1);
        else orbAllowed = orbFor(p1.name, p2.name, type);
        const orb = Math.abs(sep - def.angle);
        if (orb <= orbAllowed && (!best || orb < best.orb)) {
          best = { type, def, orb, orbAllowed };
        }
      }
      if (!best) continue;

      found.push({
        body1: p1.name,
        body2: p2.name,
        type: best.type,
        glyph: best.def.glyph,
        label: best.def.label,
        nature: best.def.nature,
        angle: best.def.angle,           // the ideal angle
        separation: round(sep, 3),       // measured shortest-arc separation
        exact: best.orb < 0.01,
        orb: round(best.orb, 3),         // distance from exact
        orbAllowed: best.orbAllowed,
        applying: isApplying(p1, p2, best.def.angle),
        key: aspectKey(p1.name, p2.name, best.type)
      });
    }
  }

  found.sort((a, b) => a.orb - b.orb);
  return found;
}

/** Find one aspect between two named bodies, if present. */
export function findAspect(aspects, body1, body2, type) {
  return aspects.find(a =>
    ((a.body1 === body1 && a.body2 === body2) || (a.body1 === body2 && a.body2 === body1))
    && (!type || a.type === type)) || null;
}

/** Build a symmetric matrix { [body]: { [body]: aspect } } for grid rendering. */
export function aspectMatrix(chartData, aspects) {
  const m = {};
  for (const p of chartData) m[p.name] = {};
  for (const a of aspects) {
    m[a.body1][a.body2] = a;
    m[a.body2][a.body1] = a;
  }
  return m;
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
