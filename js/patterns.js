// js/patterns.js
// Aspect pattern detection. Pure functions, no DOM.
//
// Input:  aspects array (from js/aspects.js) and the structured chart data.
// Output: array of patterns
//   [{ id, name, planets: [{ name, sign, house }], apex, wing, element,
//      modality, aspects: [...the aspects that form the pattern] }]
//
// Pattern detection uses its own, somewhat wider orbs (PATTERNS.orbs) and the
// minor aspects it needs (sesquiquadrate for Thor's Hammer, semisextile for
// the Boomerang), so a pattern can be found even when a single tight-orb
// aspect is missing from the main aspect list.

import {
  PATTERNS, ASPECTS, MINOR_ASPECTS, SIGN_ELEMENTS, SIGN_MODALITIES, SIGNS
} from './config.js';
import { calculateAspects, angularSeparation } from './aspects.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildIndex(aspects) {
  const idx = new Map();
  for (const a of aspects) idx.set(pairKey(a.body1, a.body2), a);
  return idx;
}

function get(idx, a, b, type) {
  const asp = idx.get(pairKey(a, b));
  return asp && asp.type === type ? asp : null;
}

function has(idx, a, b, type) {
  return !!get(idx, a, b, type);
}

function planetInfo(chartData, name) {
  const p = chartData.find(x => x.name === name);
  return p ? { name: p.name, sign: p.sign, house: p.house, signIndex: p.signIndex, degreeInSign: p.degreeInSign, longitude: p.longitude }
           : { name, sign: null, house: null, signIndex: null, degreeInSign: null, longitude: null };
}

function dominant(table, signIndexes) {
  const counts = {};
  for (const i of signIndexes) {
    if (i == null) continue;
    counts[table[i]] = (counts[table[i]] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return 'Mixed';
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return 'Mixed';
  return entries[0][0];
}

/** Collect the aspects among a set of members, optionally restricted to types. */
function aspectsAmong(idx, members, types = null) {
  const out = [];
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++) {
      const a = idx.get(pairKey(members[i], members[j]));
      if (a && (!types || types.includes(a.type))) out.push(a);
    }
  return out;
}

function makePattern(idx, id, name, chartData, planetNames, extra = {}, types = null) {
  const planets = planetNames.map(n => planetInfo(chartData, n));
  const signIdx = planets.map(p => p.signIndex);
  return {
    id,
    name,
    planets,
    apex: null,
    element: dominant(SIGN_ELEMENTS, signIdx),
    modality: dominant(SIGN_MODALITIES, signIdx),
    aspects: aspectsAmong(idx, planetNames, types),
    ...extra
  };
}

function sig(p) {
  return `${p.id}:${[...p.planets.map(x => x.name)].sort().join(',')}:${p.apex || ''}:${p.wing || ''}`;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(p => { const s = sig(p); if (seen.has(s)) return false; seen.add(s); return true; });
}

const N = key => PATTERNS.names[key] || key;

// ---------------------------------------------------------------------------
// Closed figures
// ---------------------------------------------------------------------------

export function findGrandTrines(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++)
      for (let k = j + 1; k < names.length; k++) {
        const [a, b, c] = [names[i], names[j], names[k]];
        if (has(idx, a, b, 'trine') && has(idx, b, c, 'trine') && has(idx, a, c, 'trine'))
          out.push(makePattern(idx, 'grandTrine', N('grandTrine'), chartData, [a, b, c], {}, ['trine']));
      }
  return out;
}

export function findGrandCrosses(aspects, chartData) {
  const idx = buildIndex(aspects);
  const opps = aspects.filter(a => a.type === 'opposition');
  const out = [];
  for (let i = 0; i < opps.length; i++)
    for (let j = i + 1; j < opps.length; j++) {
      const o1 = opps[i], o2 = opps[j];
      const members = [o1.body1, o1.body2, o2.body1, o2.body2];
      if (new Set(members).size !== 4) continue;
      const ok = has(idx, o1.body1, o2.body1, 'square') && has(idx, o1.body1, o2.body2, 'square')
              && has(idx, o1.body2, o2.body1, 'square') && has(idx, o1.body2, o2.body2, 'square');
      if (ok) out.push(makePattern(idx, 'grandCross', N('grandCross'), chartData, members, {}, ['opposition', 'square']));
    }
  return out;
}

/** Grand Sextile / Star of David: six planets each sextile to its neighbours around the wheel. */
export function findGrandSextiles(aspects, chartData) {
  const idx = buildIndex(aspects);
  const trines = findGrandTrines(aspects, chartData);
  const out = [];
  for (let i = 0; i < trines.length; i++)
    for (let j = i + 1; j < trines.length; j++) {
      const A = trines[i].planets.map(p => p.name), B = trines[j].planets.map(p => p.name);
      if (A.some(n => B.includes(n))) continue;
      // Every planet of one triangle must sextile two planets of the other and oppose the third.
      const ok = A.every(a => B.filter(b => has(idx, a, b, 'sextile')).length === 2 && B.some(b => has(idx, a, b, 'opposition')));
      if (ok) out.push(makePattern(idx, 'grandSextile', N('grandSextile'), chartData, [...A, ...B], {}, ['sextile', 'trine', 'opposition']));
    }
  return out;
}

// ---------------------------------------------------------------------------
// Opposition-based figures
// ---------------------------------------------------------------------------

export function findTSquares(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const opp of aspects.filter(a => a.type === 'opposition')) {
    for (const apex of names) {
      if (apex === opp.body1 || apex === opp.body2) continue;
      if (has(idx, apex, opp.body1, 'square') && has(idx, apex, opp.body2, 'square'))
        out.push(makePattern(idx, 'tSquare', N('tSquare'), chartData, [opp.body1, opp.body2, apex], { apex }, ['opposition', 'square']));
    }
  }
  return out;
}

/** Wedge (easy opposition): an opposition with a third planet trine one end and sextile the other. */
export function findWedges(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const opp of aspects.filter(a => a.type === 'opposition')) {
    for (const apex of names) {
      if (apex === opp.body1 || apex === opp.body2) continue;
      const t1 = has(idx, apex, opp.body1, 'trine') && has(idx, apex, opp.body2, 'sextile');
      const t2 = has(idx, apex, opp.body2, 'trine') && has(idx, apex, opp.body1, 'sextile');
      if (t1 || t2) out.push(makePattern(idx, 'wedge', N('wedge'), chartData, [opp.body1, opp.body2, apex], { apex }, ['opposition', 'trine', 'sextile']));
    }
  }
  return out;
}

export function findMysticRectangles(aspects, chartData) {
  const idx = buildIndex(aspects);
  const opps = aspects.filter(a => a.type === 'opposition');
  const out = [];
  for (let i = 0; i < opps.length; i++)
    for (let j = i + 1; j < opps.length; j++) {
      const [A, B] = [opps[i].body1, opps[i].body2];
      const [C, D] = [opps[j].body1, opps[j].body2];
      if (new Set([A, B, C, D]).size !== 4) continue;
      const arr1 = has(idx, A, C, 'sextile') && has(idx, B, D, 'sextile') && has(idx, A, D, 'trine') && has(idx, B, C, 'trine');
      const arr2 = has(idx, A, D, 'sextile') && has(idx, B, C, 'sextile') && has(idx, A, C, 'trine') && has(idx, B, D, 'trine');
      if (arr1 || arr2) out.push(makePattern(idx, 'mysticRectangle', N('mysticRectangle'), chartData, [A, B, C, D], {}, ['opposition', 'sextile', 'trine']));
    }
  return out;
}

/** Hard Rectangle: two oppositions joined by semisquares and sesquiquadrates. */
export function findHardRectangles(aspects, chartData) {
  const idx = buildIndex(aspects);
  const opps = aspects.filter(a => a.type === 'opposition');
  const out = [];
  for (let i = 0; i < opps.length; i++)
    for (let j = i + 1; j < opps.length; j++) {
      const [A, B] = [opps[i].body1, opps[i].body2];
      const [C, D] = [opps[j].body1, opps[j].body2];
      if (new Set([A, B, C, D]).size !== 4) continue;
      const arr1 = has(idx, A, C, 'semisquare') && has(idx, B, D, 'semisquare') && has(idx, A, D, 'sesquiquadrate') && has(idx, B, C, 'sesquiquadrate');
      const arr2 = has(idx, A, D, 'semisquare') && has(idx, B, C, 'semisquare') && has(idx, A, C, 'sesquiquadrate') && has(idx, B, D, 'sesquiquadrate');
      if (arr1 || arr2) out.push(makePattern(idx, 'hardRectangle', N('hardRectangle'), chartData, [A, B, C, D], {}, ['opposition', 'semisquare', 'sesquiquadrate']));
    }
  return out;
}

/**
 * Cradle: an opposition A–B plus two planets C and D where C sextiles A and
 * trines B, D trines A and sextiles B, and C sextiles D (four planets in a
 * chain of three sextiles under an opposition).
 */
export function findCradles(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const opp of aspects.filter(a => a.type === 'opposition')) {
    const [A, B] = [opp.body1, opp.body2];
    for (const C of names) {
      if (C === A || C === B) continue;
      for (const D of names) {
        if (D === A || D === B || D === C) continue;
        if (has(idx, C, A, 'sextile') && has(idx, C, B, 'trine')
          && has(idx, D, B, 'sextile') && has(idx, D, A, 'trine')
          && has(idx, C, D, 'sextile')) {
          out.push(makePattern(idx, 'cradle', N('cradle'), chartData, [A, B, C, D], {}, ['opposition', 'sextile', 'trine']));
        }
      }
    }
  }
  return out;
}

export function findKites(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const gt of findGrandTrines(aspects, chartData)) {
    const tri = gt.planets.map(p => p.name);
    for (const fourth of names) {
      if (tri.includes(fourth)) continue;
      for (const vertex of tri) {
        const others = tri.filter(n => n !== vertex);
        if (has(idx, fourth, vertex, 'opposition') && has(idx, fourth, others[0], 'sextile') && has(idx, fourth, others[1], 'sextile'))
          out.push(makePattern(idx, 'kite', N('kite'), chartData, [...tri, fourth], { apex: vertex, wing: fourth }, ['trine', 'opposition', 'sextile']));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sextile / quincunx figures
// ---------------------------------------------------------------------------

export function findYods(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const sex of aspects.filter(a => a.type === 'sextile')) {
    for (const focal of names) {
      if (focal === sex.body1 || focal === sex.body2) continue;
      if (has(idx, focal, sex.body1, 'quincunx') && has(idx, focal, sex.body2, 'quincunx'))
        out.push(makePattern(idx, 'yod', N('yod'), chartData, [sex.body1, sex.body2, focal], { apex: focal }, ['sextile', 'quincunx']));
    }
  }
  return out;
}

/** Boomerang: a Yod plus a planet opposing the apex (it semisextiles the base planets). */
export function findBoomerangs(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const yod of findYods(aspects, chartData)) {
    const base = yod.planets.map(p => p.name).filter(n => n !== yod.apex);
    for (const fourth of names) {
      if (yod.planets.some(p => p.name === fourth)) continue;
      if (has(idx, fourth, yod.apex, 'opposition'))
        out.push(makePattern(idx, 'boomerang', N('boomerang'), chartData, [...base, yod.apex, fourth], { apex: yod.apex, wing: fourth }, ['sextile', 'quincunx', 'opposition', 'semisextile']));
    }
  }
  return out;
}

/** Minor Grand Trine: two planets in trine with a third sextile to both. */
export function findMinorGrandTrines(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const tr of aspects.filter(a => a.type === 'trine')) {
    for (const apex of names) {
      if (apex === tr.body1 || apex === tr.body2) continue;
      if (has(idx, apex, tr.body1, 'sextile') && has(idx, apex, tr.body2, 'sextile'))
        out.push(makePattern(idx, 'minorGrandTrine', N('minorGrandTrine'), chartData, [tr.body1, tr.body2, apex], { apex }, ['trine', 'sextile']));
    }
  }
  return out;
}

/** Thor's Hammer (Fist of God): two planets square, both sesquiquadrate a third. */
export function findThorsHammers(aspects, chartData) {
  const idx = buildIndex(aspects);
  const names = chartData.map(p => p.name);
  const out = [];
  for (const sq of aspects.filter(a => a.type === 'square')) {
    for (const apex of names) {
      if (apex === sq.body1 || apex === sq.body2) continue;
      if (has(idx, apex, sq.body1, 'sesquiquadrate') && has(idx, apex, sq.body2, 'sesquiquadrate'))
        out.push(makePattern(idx, 'thorsHammer', N('thorsHammer'), chartData, [sq.body1, sq.body2, apex], { apex }, ['square', 'sesquiquadrate']));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stelliums
// ---------------------------------------------------------------------------

export function findStelliums(aspects, chartData) {
  const idx = buildIndex(aspects);
  const eligible = chartData.filter(p => PATTERNS.stelliumBodies.includes(p.name));
  const out = [];
  const min = PATTERNS.stelliumMinimum;

  // By sign
  const bySign = new Map();
  for (const p of eligible) { if (!bySign.has(p.sign)) bySign.set(p.sign, []); bySign.get(p.sign).push(p.name); }
  for (const [sign, members] of bySign)
    if (members.length >= min) out.push(makePattern(idx, 'stellium', N('stellium'), chartData, members, { sign }, ['conjunction']));

  // By house
  const byHouse = new Map();
  for (const p of eligible) { if (!p.house) continue; if (!byHouse.has(p.house)) byHouse.set(p.house, []); byHouse.get(p.house).push(p.name); }
  for (const [house, members] of byHouse)
    if (members.length >= min) out.push(makePattern(idx, 'stelliumHouse', N('stelliumHouse'), chartData, members, { house }, ['conjunction']));

  // By conjunction chain (can straddle a sign or house boundary)
  const sorted = [...eligible].sort((a, b) => a.longitude - b.longitude);
  const clusters = [];
  let current = [];
  const maxGap = PATTERNS.orbs?.conjunction ?? 10;
  const flush = () => { if (current.length >= min) clusters.push(current); current = []; };
  for (const p of sorted) {
    if (current.length && angularSeparation(current[current.length - 1].longitude, p.longitude) > maxGap) flush();
    current.push(p);
  }
  // wrap-around: merge the last cluster with the first if they touch across 0°
  if (current.length && clusters.length && sorted.length > 1
      && angularSeparation(current[current.length - 1].longitude, clusters[0][0].longitude) <= maxGap
      && current !== clusters[0]) {
    clusters[0] = [...current, ...clusters[0]];
    current = [];
  }
  flush();
  for (const members of clusters) {
    const names = members.map(p => p.name);
    const same = out.some(p => p.planets.length === names.length && p.planets.every(x => names.includes(x.name)));
    if (!same) out.push(makePattern(idx, 'stelliumCluster', N('stelliumCluster'), chartData, names, {}, ['conjunction']));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chart shapes (Marc Edmund Jones)
// ---------------------------------------------------------------------------

/**
 * Classify the overall distribution of the planets around the wheel.
 * Uses PATTERNS.shapeBodies (the ten classical planets by default).
 */
export function findChartShape(chartData) {
  const bodies = chartData.filter(p => PATTERNS.shapeBodies.includes(p.name))
    .sort((a, b) => a.longitude - b.longitude);
  if (bodies.length < 5) return null;
  const n = bodies.length;
  const gaps = bodies.map((p, i) => {
    const next = bodies[(i + 1) % n];
    const gap = ((next.longitude - p.longitude) + 360) % 360;
    return { from: p, to: next, gap: i === n - 1 && n === 1 ? 360 : gap };
  });
  const largest = [...gaps].sort((a, b) => b.gap - a.gap)[0];
  const span = 360 - largest.gap;             // occupied arc
  const leading = largest.to;                 // first planet after the empty space (zodiacal order)
  const trailing = largest.from;

  // Bucket: nine planets within 180° and one planet in the opposite half.
  for (const handle of bodies) {
    const rest = bodies.filter(p => p !== handle);
    const rGaps = rest.map((p, i) => ((rest[(i + 1) % rest.length].longitude - p.longitude) + 360) % 360);
    const rLargest = Math.max(...rGaps);
    if (360 - rLargest <= 180) {
      const idxL = rGaps.indexOf(rLargest);
      const gapStart = rest[idxL].longitude, gapEnd = rest[(idxL + 1) % rest.length].longitude;
      const inGap = ((handle.longitude - gapStart + 360) % 360) < ((gapEnd - gapStart + 360) % 360);
      const distIn = Math.min(angularSeparation(handle.longitude, gapStart), angularSeparation(handle.longitude, gapEnd));
      if (inGap && distIn >= 30 && span > 180) {
        return shape('shapeBucket', bodies, { handle: handle.name, leading: leading.name, span: Math.round(span) });
      }
    }
  }
  if (span <= 120) return shape('shapeBundle', bodies, { leading: leading.name, trailing: trailing.name, span: Math.round(span) });
  if (span <= 180) return shape('shapeBowl', bodies, { leading: leading.name, trailing: trailing.name, span: Math.round(span) });

  // Count the empty arcs of 60° or more: exactly two means two opposed groups
  // (Seesaw); three or more means several scattered clusters (Splay). These
  // come before the Locomotive test, otherwise a Seesaw with a 220° outer
  // span would read as a Locomotive.
  const bigGaps = gaps.filter(g => g.gap >= 60).length;
  if (bigGaps === 2) return shape('shapeSeesaw', bodies, { leading: leading.name, span: Math.round(span) });
  if (bigGaps >= 3) return shape('shapeSplay', bodies, { leading: leading.name, span: Math.round(span) });
  if (span <= 240) return shape('shapeLocomotive', bodies, { leading: leading.name, trailing: trailing.name, span: Math.round(span) });
  // Evenly spread: no empty arc reaches 60°.
  if (largest.gap < 60) return shape('shapeSplash', bodies, { leading: leading.name, span: Math.round(span) });
  return shape('shapeSplay', bodies, { leading: leading.name, span: Math.round(span) });

  function shape(id, members, extra) {
    const planets = members.map(p => ({ name: p.name, sign: p.sign, house: p.house, signIndex: p.signIndex, degreeInSign: p.degreeInSign, longitude: p.longitude }));
    return { id, name: N(id), planets, apex: null, element: dominant(SIGN_ELEMENTS, planets.map(p => p.signIndex)),
      modality: dominant(SIGN_MODALITIES, planets.map(p => p.signIndex)), aspects: [], isShape: true, ...extra };
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Compute the aspect set used for pattern detection: the chart's aspects
 * recomputed with the pattern orbs and the minor aspects patterns need.
 */
export function patternAspects(chartData) {
  return calculateAspects(chartData, {
    definitions: { ...ASPECTS, ...MINOR_ASPECTS },
    aspectOrbs: PATTERNS.orbs
  });
}

/**
 * Detect all enabled patterns.
 * @param {Array} aspects   from calculateAspects() — used only when PATTERNS.useOwnOrbs is false
 * @param {Array} chartData structured chart data
 * @returns {Array} patterns
 */
export function detectPatterns(aspects, chartData) {
  const en = PATTERNS.enabled;
  const asp = PATTERNS.useOwnOrbs ? patternAspects(chartData) : aspects;
  let all = [];
  const add = (key, fn) => { if (en[key] !== false) all = all.concat(fn(asp, chartData)); };

  add('grandCross', findGrandCrosses);
  add('grandSextile', findGrandSextiles);
  add('kite', findKites);
  add('grandTrine', findGrandTrines);
  add('mysticRectangle', findMysticRectangles);
  add('cradle', findCradles);
  add('hardRectangle', findHardRectangles);
  add('tSquare', findTSquares);
  add('boomerang', findBoomerangs);
  add('yod', findYods);
  add('thorsHammer', findThorsHammers);
  add('stellium', findStelliums);
  add('wedge', findWedges);
  add('minorGrandTrine', findMinorGrandTrines);

  all = dedupe(all);

  if (PATTERNS.suppressSubPatterns) {
    const contains = (bigId, smallId) => {
      const bigSets = all.filter(p => p.id === bigId).map(p => new Set(p.planets.map(x => x.name)));
      all = all.filter(p => p.id !== smallId || !bigSets.some(s => p.planets.every(x => s.has(x.name))));
    };
    contains('grandCross', 'tSquare');        // a Grand Cross is four T-Squares
    contains('grandSextile', 'grandTrine');   // a Grand Sextile is two Grand Trines
    contains('boomerang', 'yod');
    contains('kite', 'wedge');                // the wedge inside a kite is the kite
    contains('cradle', 'wedge');
    contains('mysticRectangle', 'wedge');
  }

  if (en.chartShape !== false) {
    const s = findChartShape(chartData);
    if (s) all.push(s);
  }
  return all;
}

export { SIGNS };
