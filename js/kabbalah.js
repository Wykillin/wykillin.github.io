// js/kabbalah.js
// Tree of Life calculations: which sefirot and paths the natal chart lights
// up, aspect links between sefirot, Tarot birth cards and the numerology
// mapping. Pure functions, no DOM. All names/text come from
// data/tree-of-life.json.
//
// Public API:
//   loadTree()                                       -> Promise<data>
//   sefirahActivity(tree, chartData, aspects, patterns)
//   pathActivity(tree, chartData, aspects, activity, elementCounts)
//   aspectLinks(tree, aspects)
//   birthCards(year, month, day)
//   numerologyOnTree(profile)
//   elementCounts(chartData)

import { TREE_FILE, SIGN_ELEMENTS, PATTERNS } from './config.js';
import { digitSum } from './numerology.js';

let cache = null;
export async function loadTree(base = '') {
  if (cache) return cache;
  const res = await fetch(base + TREE_FILE, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${TREE_FILE}: ${res.status}`);
  cache = await res.json();
  return cache;
}

/** Traditional rulerships (modern rulers included) used for dignity. */
export const RULERSHIPS = {
  Sun: ['Leo'], Moon: ['Cancer'], Mercury: ['Gemini', 'Virgo'], Venus: ['Taurus', 'Libra'],
  Mars: ['Aries', 'Scorpio'], Jupiter: ['Sagittarius', 'Pisces'], Saturn: ['Capricorn', 'Aquarius'],
  Uranus: ['Aquarius'], Neptune: ['Pisces'], Pluto: ['Scorpio']
};

const ANGULAR = [1, 4, 7, 10];

function byName(chartData, name) {
  return chartData.find(p => p.name === name) || null;
}

function aspectsOf(aspects, name) {
  return aspects.filter(a => a.body1 === name || a.body2 === name);
}

/** Count of the ten planets by element. */
export function elementCounts(chartData) {
  const counts = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  for (const p of chartData) {
    if (!PATTERNS.shapeBodies.includes(p.name)) continue;
    counts[SIGN_ELEMENTS[p.signIndex]]++;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { counts, dominant: dominant[0][1] > dominant[1][1] ? dominant[0][0] : null };
}

/**
 * Strength of each sefirah from its planet's condition in the chart.
 * @returns {{ [key]: { key, planet, placement, score, norm, reasons, aspects, patterns } }}
 */
export function sefirahActivity(tree, chartData, aspects, patterns = []) {
  const out = {};
  let max = 0;
  for (const [key, s] of Object.entries(tree.sefirot)) {
    const planet = s.planets?.[0];
    const placement = planet ? byName(chartData, planet) : null;
    const reasons = [];
    let score = 0;
    let pAspects = [];
    let pPatterns = [];
    if (placement) {
      pAspects = aspectsOf(aspects, planet);
      if (pAspects.length) { score += pAspects.length; reasons.push(`${pAspects.length} aspect${pAspects.length === 1 ? '' : 's'}`); }
      if (ANGULAR.includes(placement.house) && !placement.isAngle) { score += 2; reasons.push(`angular (${ordinal(placement.house)} house)`); }
      if ((RULERSHIPS[planet] || []).includes(placement.sign)) { score += 2; reasons.push(`in its own sign (${placement.sign})`); }
      const onAngle = pAspects.find(a => a.type === 'conjunction' && (['Ascendant', 'MC'].includes(a.body1) || ['Ascendant', 'MC'].includes(a.body2)));
      if (onAngle && !placement.isAngle) { score += 2; reasons.push(`conjunct the ${onAngle.body1 === planet ? onAngle.body2 : onAngle.body1}`); }
      pPatterns = patterns.filter(p => !p.isShape && p.planets.some(x => x.name === planet));
      if (pPatterns.length) { score += pPatterns.length; reasons.push(`in ${pPatterns.length} aspect pattern${pPatterns.length === 1 ? '' : 's'}`); }
      if (placement.isAngle) { score += 2; reasons.push('the Ascendant itself: the point of incarnation'); }
      if (placement.retrograde) reasons.push('retrograde (interiorised)');
    } else {
      reasons.push('planet not in this chart');
    }
    max = Math.max(max, score);
    out[key] = { key, planet, placement, score, reasons, aspects: pAspects, patterns: pPatterns, norm: 0 };
  }
  for (const v of Object.values(out)) v.norm = max ? v.score / max : 0;
  return out;
}

/**
 * Which paths are lit: sign paths by occupancy, planet paths by strength,
 * element paths by the dominant element. Also records an aspect between the
 * two end sefirot's planets when one exists.
 */
export function pathActivity(tree, chartData, aspects, activity, elements) {
  const out = {};
  for (const [no, path] of Object.entries(tree.paths)) {
    const reasons = [];
    let bodies = [];
    let active = false;
    if (path.kind === 'sign') {
      bodies = chartData.filter(p => p.sign === path.attribution).map(p => p.name);
      if (bodies.length) { active = true; reasons.push(`${bodies.join(', ')} in ${path.attribution}`); }
    } else if (path.kind === 'planet') {
      const p = byName(chartData, path.attribution);
      if (p) {
        const strong = ANGULAR.includes(p.house) || (RULERSHIPS[path.attribution] || []).includes(p.sign)
          || aspects.some(a => a.type === 'conjunction' && [a.body1, a.body2].includes(path.attribution) && [a.body1, a.body2].some(n => ['Ascendant', 'MC'].includes(n)));
        if (strong) { active = true; reasons.push(`${path.attribution} is strongly placed (${p.sign}, ${ordinal(p.house)} house)`); }
        else reasons.push(`${path.attribution} in ${p.sign}, ${ordinal(p.house)} house`);
      }
    } else if (path.kind === 'element') {
      if (elements?.dominant === path.attribution) { active = true; reasons.push(`${path.attribution} is the dominant element (${elements.counts[path.attribution]} planets)`); }
      else reasons.push(`${elements?.counts?.[path.attribution] ?? 0} planets in ${path.attribution}`);
    }
    const pa = tree.sefirot[path.from]?.planets?.[0], pb = tree.sefirot[path.to]?.planets?.[0];
    const link = pa && pb ? aspects.find(a => (a.body1 === pa && a.body2 === pb) || (a.body1 === pb && a.body2 === pa)) : null;
    if (link) reasons.push(`${pa} ${link.label.toLowerCase()} ${pb} (orb ${link.orb.toFixed(1)}°)`);
    out[no] = { no, active, reasons, bodies, aspect: link || null };
  }
  return out;
}

/** Aspects between the planets of any two sefirot, with the joining path when there is one. */
export function aspectLinks(tree, aspects) {
  const planetToSefirah = {};
  for (const [key, s] of Object.entries(tree.sefirot)) for (const p of s.planets || []) planetToSefirah[p] = key;
  const pathBetween = (a, b) => Object.entries(tree.paths).find(([, p]) => (p.from === a && p.to === b) || (p.from === b && p.to === a))?.[0] || null;
  const links = [];
  for (const a of aspects) {
    const s1 = planetToSefirah[a.body1], s2 = planetToSefirah[a.body2];
    if (!s1 || !s2 || s1 === s2) continue;
    links.push({ from: s1, to: s2, aspect: a, path: pathBetween(s1, s2) });
  }
  return links;
}

/** Tarot birth cards after Mary K. Greer. Returns card numbers (0 = Fool). */
export function birthCards(year, month, day) {
  let sum = Number(month) + Number(day) + Number(year);
  const steps = [sum];
  while (sum > 22) { sum = digitSum(sum); steps.push(sum); }
  const cards = [];
  let n = sum === 22 ? 0 : sum;
  cards.push(n);
  while (n > 9) { n = digitSum(n); cards.push(n); }
  // 19 -> 10 -> 1 gives three cards; 10..18, 20, 21 give two.
  return { sum: steps[0], steps, personality: cards[0], soul: cards[cards.length - 1], cards: [...new Set(cards)] };
}

const NUMBER_TO_SEFIRAH = { 1: 'kether', 2: 'chokmah', 3: 'binah', 4: 'chesed', 5: 'geburah', 6: 'tiphareth', 7: 'netzach', 8: 'hod', 9: 'yesod', 10: 'malkuth', 11: 'daat', 22: 'chokmah', 33: 'binah' };

/** Map core numerology numbers onto sefirot. */
export function numerologyOnTree(profile) {
  if (!profile) return {};
  const pick = key => profile.core?.[key] ? NUMBER_TO_SEFIRAH[profile.core[key].value] || null : null;
  return { lifePath: pick('lifePath'), expression: pick('expression'), soulUrge: pick('soulUrge'), personality: pick('personality'), maturity: pick('maturity') };
}

function ordinal(n) {
  const v = n % 100;
  return n + ((v >= 11 && v <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
}
