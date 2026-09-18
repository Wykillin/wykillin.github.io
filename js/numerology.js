// js/numerology.js
// Numerology + gematria calculation engine. Pure functions, no DOM.
//
// Public API:
//   calculateNumerology({ name, birth: { year, month, day }, today? })
//   calculateGematria(name)
//   analyzeNumber(n)         -> array of { label, detail }
//   reduce(n, keepMasters?)  -> digital root, keeping 11/22/33 when asked
//   splitName(name)          -> ['Adam', 'John', 'Wykle']
//   composeName(name, middleName) -> inserts the middle name after the first word

import { NUMEROLOGY } from './config.js';

// ---------------------------------------------------------------------------
// Letter tables
// ---------------------------------------------------------------------------

export const PYTHAGOREAN = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
  S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8
};

export const CHALDEAN = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 8, G: 3, H: 5, I: 1,
  J: 1, K: 2, L: 3, M: 4, N: 5, O: 7, P: 8, Q: 1, R: 2,
  S: 3, T: 4, U: 6, V: 6, W: 6, X: 5, Y: 1, Z: 7
};

/** Simple / ordinal gematria: A=1 … Z=26. */
export const SIMPLE = Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c, i) => [c, i + 1]));

/** English gematria (Gematrix convention): ordinal × 6, A=6 … Z=156. */
export const ENGLISH = Object.fromEntries(Object.entries(SIMPLE).map(([c, v]) => [c, v * 6]));

/**
 * Hebrew ("Jewish") gematria as commonly applied to Latin letters: the
 * 1-9 / 10-90 / 100-900 pattern of the Hebrew alphabet mapped onto A-Z.
 */
export const HEBREW = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
  J: 600, K: 10, L: 20, M: 30, N: 40, O: 50, P: 60, Q: 70, R: 80, S: 90,
  T: 100, U: 200, V: 700, W: 900, X: 300, Y: 400, Z: 500
};

export const GEMATRIA_CIPHERS = {
  simple: { label: 'Simple', table: SIMPLE },
  english: { label: 'English', table: ENGLISH },
  hebrew: { label: 'Hebrew', table: HEBREW }
};

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// ---------------------------------------------------------------------------
// Basic helpers
// ---------------------------------------------------------------------------

export const MASTER_NUMBERS = NUMEROLOGY.masterNumbers;

/** Sum of the digits of a non-negative integer. */
export function digitSum(n) {
  return String(Math.abs(Math.trunc(n))).split('').reduce((s, d) => s + Number(d), 0);
}

/**
 * Reduce a number to a single digit. With keepMasters (default true) the
 * master numbers 11, 22 and 33 are returned as-is when reached.
 */
export function reduce(n, keepMasters = true) {
  let v = Math.abs(Math.trunc(n));
  while (v > 9) {
    if (keepMasters && MASTER_NUMBERS.includes(v)) return v;
    v = digitSum(v);
  }
  return v;
}

/** Steps of the reduction as a string, e.g. "1990 → 19 → 10 → 1". */
export function reductionSteps(n, keepMasters = true) {
  const steps = [Math.abs(Math.trunc(n))];
  let v = steps[0];
  while (v > 9 && !(keepMasters && MASTER_NUMBERS.includes(v))) {
    v = digitSum(v);
    steps.push(v);
  }
  return steps;
}

/** Normalise a name to A-Z letters only (diacritics stripped). */
export function lettersOf(word) {
  return String(word || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '');
}

/** Split a full name on whitespace, dropping empty parts. */
export function splitName(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean);
}

/** Insert a middle name after the first word of `name` (if not already present). */
export function composeName(name, middleName) {
  const parts = splitName(name);
  const mid = splitName(middleName);
  if (!mid.length) return parts.join(' ');
  const midUpper = mid.map(m => lettersOf(m));
  const already = parts.some(p => midUpper.includes(lettersOf(p)));
  if (already) return parts.join(' ');
  if (parts.length <= 1) return [...parts, ...mid].join(' ');
  return [parts[0], ...mid, ...parts.slice(1)].join(' ');
}

/**
 * Is the letter at index i a vowel for numerology purposes? A, E, I, O, U
 * always; Y only when it is not next to another vowel (so "Yvonne" and
 * "Lynn" count Y as a vowel, "Yolanda" does not).
 */
export function isVowelAt(letters, i) {
  const c = letters[i];
  if (VOWELS.has(c)) return true;
  if (c !== 'Y') return false;
  const prev = letters[i - 1], next = letters[i + 1];
  return !(VOWELS.has(prev) || VOWELS.has(next));
}

// ---------------------------------------------------------------------------
// Name numbers
// ---------------------------------------------------------------------------

/** Per-letter breakdown of one word under a letter table. */
export function wordBreakdown(word, table = PYTHAGOREAN) {
  const letters = lettersOf(word);
  const items = letters.split('').map((c, i) => ({
    letter: c, value: table[c] || 0, vowel: isVowelAt(letters, i)
  }));
  const total = items.reduce((s, x) => s + x.value, 0);
  const vowels = items.filter(x => x.vowel).reduce((s, x) => s + x.value, 0);
  const consonants = total - vowels;
  return {
    word, letters, items, total, vowels, consonants,
    reduced: reduce(total), vowelsReduced: reduce(vowels), consonantsReduced: reduce(consonants)
  };
}

/**
 * Name-based core numbers. Each word is reduced separately (keeping master
 * numbers), then the reduced values are summed and reduced again — the
 * standard Pythagorean method.
 */
export function nameNumbers(name, table = PYTHAGOREAN) {
  const words = splitName(name).map(w => wordBreakdown(w, table));
  const sumOf = key => words.reduce((s, w) => s + w[key], 0);
  const combine = key => {
    const perWord = words.map(w => reduce(w[key]));
    const sum = perWord.reduce((s, v) => s + v, 0);
    return { perWord, sum, raw: sumOf(key), value: reduce(sum), steps: reductionSteps(sum) };
  };
  return {
    words,
    expression: combine('total'),
    soulUrge: combine('vowels'),
    personality: combine('consonants')
  };
}

/** Frequency of each 1-9 value across the whole name. */
export function letterFrequencies(name, table = PYTHAGOREAN) {
  const counts = {};
  for (let v = 1; v <= 9; v++) counts[v] = 0;
  for (const c of lettersOf(splitName(name).join(''))) {
    const v = table[c];
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Birth-date numbers
// ---------------------------------------------------------------------------

export function lifePath(year, month, day) {
  const m = reduce(month), d = reduce(day), y = reduce(year);
  const sum = m + d + y;
  return {
    value: reduce(sum), sum, parts: { month: m, day: d, year: y },
    steps: reductionSteps(sum),
    calc: `${month} → ${m}, ${day} → ${d}, ${year} → ${y}; ${m} + ${d} + ${y} = ${sum}${sum !== reduce(sum) ? ' → ' + reduce(sum) : ''}`
  };
}

export function personalYear(year, month, day, today) {
  const t = today || new Date();
  const currentYear = t.getFullYear();
  // The personal year turns over on the birthday; before the birthday the previous year still applies.
  const hadBirthday = (t.getMonth() + 1 > month) || (t.getMonth() + 1 === month && t.getDate() >= day);
  const refYear = hadBirthday ? currentYear : currentYear - 1;
  const sum = reduce(month) + reduce(day) + reduce(refYear);
  const value = reduce(sum, false);
  const monthValue = reduce(value + reduce(t.getMonth() + 1), false);
  return { value, sum, year: refYear, personalMonth: monthValue,
    calc: `${reduce(month)} + ${reduce(day)} + ${reduce(refYear)} (${refYear}) = ${sum}${sum !== value ? ' → ' + value : ''}` };
}

export function pinnaclesAndChallenges(year, month, day, lifePathValue) {
  const m = reduce(month, false), d = reduce(day, false), y = reduce(year, false);
  const p1 = reduce(m + d), p2 = reduce(d + y), p3 = reduce(p1 + p2), p4 = reduce(m + y);
  const c1 = Math.abs(m - d), c2 = Math.abs(d - y), c3 = Math.abs(c1 - c2), c4 = Math.abs(m - y);
  const firstEnd = 36 - reduce(lifePathValue, false);
  const ages = [
    `0–${firstEnd}`, `${firstEnd + 1}–${firstEnd + 9}`, `${firstEnd + 10}–${firstEnd + 18}`, `${firstEnd + 19}+`
  ];
  return {
    pinnacles: [p1, p2, p3, p4].map((v, i) => ({ number: i + 1, value: v, ages: ages[i] })),
    challenges: [c1, c2, c3, c4].map((v, i) => ({ number: i + 1, value: v, ages: ages[i] }))
  };
}

// ---------------------------------------------------------------------------
// Full numerology profile
// ---------------------------------------------------------------------------

/**
 * @param {object} input
 * @param {string} input.name   full name used for the name numbers
 * @param {object} input.birth  { year, month, day }
 * @param {Date}   [input.today]
 */
export function calculateNumerology({ name, birth, today }) {
  const { year, month, day } = birth;
  const lp = lifePath(year, month, day);
  const names = nameNumbers(name, PYTHAGOREAN);
  const chaldean = nameNumbers(name, CHALDEAN);
  const birthday = { value: reduce(day), raw: day, steps: reductionSteps(day) };
  const attitudeSum = reduce(month) + reduce(day);
  const attitude = { value: reduce(attitudeSum), sum: attitudeSum, calc: `${reduce(month)} + ${reduce(day)} = ${attitudeSum}` };
  const maturitySum = lp.value + names.expression.value;
  const maturity = { value: reduce(maturitySum), sum: maturitySum, calc: `${lp.value} + ${names.expression.value} = ${maturitySum}` };
  const py = personalYear(year, month, day, today);
  const cycles = pinnaclesAndChallenges(year, month, day, lp.value);

  const freq = letterFrequencies(name);
  const karmicLessons = Object.entries(freq).filter(([, n]) => n === 0).map(([v]) => Number(v));
  const maxCount = Math.max(...Object.values(freq));
  const hiddenPassion = maxCount > 0
    ? Object.entries(freq).filter(([, n]) => n === maxCount).map(([v]) => Number(v))
    : [];
  const totalLetters = Object.values(freq).reduce((s, n) => s + n, 0);
  const planes = {
    mental:    ['A', 'G', 'H', 'I', 'J', 'L', 'N', 'P'],
    physical:  ['D', 'E', 'M', 'W'],
    emotional: ['B', 'I', 'O', 'R', 'S', 'T', 'X', 'Z'],
    intuitive: ['C', 'F', 'K', 'Q', 'U', 'V', 'Y']
  };
  const allLetters = lettersOf(splitName(name).join(''));
  const planesOfExpression = Object.fromEntries(Object.entries(planes).map(([k, set]) =>
    [k, allLetters.split('').filter(c => set.includes(c)).length]));

  const core = {
    lifePath:    { key: 'lifePath',    label: 'Life Path',       value: lp.value, calc: lp.calc, sum: lp.sum },
    birthday:    { key: 'birthday',    label: 'Birthday',        value: birthday.value, calc: `${day}${day > 9 ? ' → ' + birthday.value : ''}`, sum: day },
    expression:  { key: 'expression',  label: 'Expression',      value: names.expression.value, calc: `${names.expression.perWord.join(' + ')} = ${names.expression.sum}${names.expression.sum !== names.expression.value ? ' → ' + names.expression.value : ''}`, sum: names.expression.raw },
    soulUrge:    { key: 'soulUrge',    label: "Soul Urge",       value: names.soulUrge.value, calc: `${names.soulUrge.perWord.join(' + ')} = ${names.soulUrge.sum}${names.soulUrge.sum !== names.soulUrge.value ? ' → ' + names.soulUrge.value : ''}`, sum: names.soulUrge.raw },
    personality: { key: 'personality', label: 'Personality',     value: names.personality.value, calc: `${names.personality.perWord.join(' + ')} = ${names.personality.sum}${names.personality.sum !== names.personality.value ? ' → ' + names.personality.value : ''}`, sum: names.personality.raw },
    maturity:    { key: 'maturity',    label: 'Maturity',        value: maturity.value, calc: maturity.calc, sum: maturity.sum },
    attitude:    { key: 'attitude',    label: 'Attitude',        value: attitude.value, calc: attitude.calc, sum: attitude.sum },
    personalYear:{ key: 'personalYear',label: 'Personal Year',   value: py.value, calc: py.calc, sum: py.sum, extra: `Personal Month ${py.personalMonth}` }
  };

  return {
    name,
    birth: { year, month, day },
    core,
    words: names.words,
    chaldean: { expression: chaldean.expression, words: chaldean.words },
    karmicLessons,
    hiddenPassion,
    letterFrequencies: freq,
    totalLetters,
    planesOfExpression,
    pinnacles: cycles.pinnacles,
    challenges: cycles.challenges,
    masterNumbers: Object.values(core).filter(c => MASTER_NUMBERS.includes(c.value)).map(c => c.label)
  };
}

// ---------------------------------------------------------------------------
// Gematria
// ---------------------------------------------------------------------------

/**
 * Gematria breakdown for each whitespace-separated name and for the whole.
 * @returns {{ words: [{ word, letters, rows: [{letter, simple, english, hebrew}], totals }], totals, ciphers }}
 */
export function calculateGematria(name) {
  const cipherKeys = Object.keys(GEMATRIA_CIPHERS);
  const words = splitName(name).map(word => {
    const letters = lettersOf(word);
    const rows = letters.split('').map(c => {
      const row = { letter: c };
      for (const k of cipherKeys) row[k] = GEMATRIA_CIPHERS[k].table[c] || 0;
      return row;
    });
    const totals = {};
    for (const k of cipherKeys) totals[k] = rows.reduce((s, r) => s + r[k], 0);
    return { word, letters, rows, totals };
  });
  const totals = {};
  for (const k of cipherKeys) totals[k] = words.reduce((s, w) => s + w.totals[k], 0);
  const reduced = Object.fromEntries(cipherKeys.map(k => [k, reduce(totals[k])]));
  return { words, totals, reduced, ciphers: cipherKeys };
}

// ---------------------------------------------------------------------------
// Number properties ("is this number special?")
// ---------------------------------------------------------------------------

export function isPrime(n) {
  if (n < 2 || !Number.isInteger(n)) return false;
  if (n % 2 === 0) return n === 2;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

export function primeFactors(n) {
  const out = [];
  let v = n;
  for (let p = 2; p * p <= v; p++) {
    while (v % p === 0) { out.push(p); v /= p; }
  }
  if (v > 1) out.push(v);
  return out;
}

function nthPrimeIndex(n) {
  // 1-based index of a prime (7 is the 4th prime).
  if (!isPrime(n)) return 0;
  let count = 0;
  for (let i = 2; i <= n; i++) if (isPrime(i)) count++;
  return count;
}

function isFibonacci(n) {
  let a = 0, b = 1;
  while (b < n) [a, b] = [b, a + b];
  return b === n || n === 0;
}

function triangularRoot(n) {
  const k = Math.floor((Math.sqrt(8 * n + 1) - 1) / 2);
  return k * (k + 1) / 2 === n ? k : 0;
}

function isPerfect(n) {
  if (n < 2) return false;
  let s = 1;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) { s += i; if (i !== n / i) s += n / i; }
  return s === n;
}

function divisors(n) {
  const out = [];
  for (let i = 1; i * i <= n; i++) if (n % i === 0) { out.push(i); if (i !== n / i) out.push(n / i); }
  return out.sort((a, b) => a - b);
}

/**
 * List the mathematically and numerologically notable properties of n.
 * @returns {Array<{ label: string, detail: string }>}
 */
export function analyzeNumber(n) {
  const props = [];
  if (!Number.isInteger(n) || n < 0) return props;
  const s = String(n);

  if (MASTER_NUMBERS.includes(n)) props.push({ label: 'Master number', detail: `${n} is a master number and is not reduced further.` });
  if (n > 9 && reduce(n, false) !== n) {
    props.push({ label: 'Digital root', detail: `${reductionSteps(n, false).join(' → ')}` });
  }
  if (s.length > 1 && /^(\d)\1+$/.test(s)) props.push({ label: 'Repdigit', detail: `All digits are ${s[0]} (${s.length} × ${s[0]}); ${n} = ${s[0]} × ${'1'.repeat(s.length)}.` });
  else if (s.length > 1 && s === s.split('').reverse().join('')) props.push({ label: 'Palindrome', detail: `Reads the same backwards.` });
  if (isPrime(n)) props.push({ label: 'Prime', detail: `${n} is the ${ordinal(nthPrimeIndex(n))} prime.` });
  else if (n > 3) {
    const f = primeFactors(n);
    props.push({ label: 'Factors', detail: `${n} = ${f.join(' × ')}` + (divisors(n).length <= 12 ? `; divisors ${divisors(n).join(', ')}` : '') });
  }
  const sq = Math.round(Math.sqrt(n));
  if (sq * sq === n && n > 1) props.push({ label: 'Perfect square', detail: `${n} = ${sq}²` });
  const cb = Math.round(Math.cbrt(n));
  if (cb ** 3 === n && n > 1) props.push({ label: 'Perfect cube', detail: `${n} = ${cb}³` });
  if (n > 1 && (n & (n - 1)) === 0) props.push({ label: 'Power of two', detail: `${n} = 2^${Math.log2(n)}` });
  for (const base of [3, 5, 6, 7, 9, 10, 12]) {
    const e = Math.round(Math.log(n) / Math.log(base));
    if (e >= 2 && base ** e === n) props.push({ label: `Power of ${base}`, detail: `${n} = ${base}^${e}` });
  }
  const tri = triangularRoot(n);
  if (tri > 1) props.push({ label: 'Triangular number', detail: `Sum of 1 through ${tri}.` });
  if (n > 1 && isFibonacci(n)) props.push({ label: 'Fibonacci number', detail: 'Appears in the Fibonacci sequence.' });
  if (isPerfect(n)) props.push({ label: 'Perfect number', detail: 'Equals the sum of its proper divisors.' });
  const ds = digitSum(n);
  if (n > 9 && ds > 0 && n % ds === 0) props.push({ label: 'Harshad number', detail: `Divisible by its digit sum ${ds}.` });
  for (const [k, label] of Object.entries(NUMEROLOGY.notableMultiples)) {
    const m = Number(k);
    if (n > m && n % m === 0) props.push({ label: `Multiple of ${m}`, detail: `${n} = ${m} × ${n / m} (${label}).` });
  }
  if (s.length >= 2 && Number(s.slice(0, -1)) !== 0 && s.endsWith('0')) {
    props.push({ label: 'Round number', detail: `Ends in zero; ${n} = ${Number(s.slice(0, -1))} × 10.` });
  }
  return props;
}

function ordinal(n) {
  const v = n % 100;
  const suffix = (v >= 11 && v <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix}`;
}

/**
 * Collect all "totals" from a numerology profile and gematria breakdown into
 * one list for the significance table.
 * @returns {Array<{ source, value, props, notable }>}
 */
export function collectSignificantValues(profile, gematria, notableTable = {}) {
  const items = [];
  const push = (source, value) => {
    if (!Number.isInteger(value) || value <= 0) return;
    items.push({ source, value, props: analyzeNumber(value), notable: notableTable[String(value)] || null });
  };
  for (const c of Object.values(profile.core)) {
    push(`${c.label} (${c.value})`, c.value);
    if (c.sum && c.sum !== c.value) push(`${c.label} unreduced total`, c.sum);
  }
  push('Birth year', profile.birth.year);
  push('Birth date digits', reduce(profile.birth.year, false) + reduce(profile.birth.month, false) + reduce(profile.birth.day, false));
  for (const w of gematria.words) {
    for (const k of gematria.ciphers) push(`${w.word} — ${GEMATRIA_CIPHERS[k].label} gematria`, w.totals[k]);
  }
  for (const k of gematria.ciphers) push(`Full name — ${GEMATRIA_CIPHERS[k].label} gematria`, gematria.totals[k]);
  // Deduplicate identical value+source pairs, keep order.
  const seen = new Set();
  return items.filter(i => { const key = `${i.source}|${i.value}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

// ---------------------------------------------------------------------------
// Sound analysis (Hebrew consonants + vowel gestures)
// ---------------------------------------------------------------------------

/**
 * Split a word into syllables for sound analysis. Consonants attach to the
 * vowel that follows; a single consonant between vowels starts the next
 * syllable (A-DAM), two or more are split (WYK-LE); trailing consonants stay
 * with the last vowel. Returns arrays of { letter, vowel } items.
 */
export function syllabify(word) {
  const letters = lettersOf(word);
  const items = letters.split('').map((c, i) => ({ letter: c, vowel: isVowelAt(letters, i) }));
  if (!items.length) return [];
  const syllables = [];
  let current = [];
  let seenVowel = false;
  for (const it of items) {
    if (it.vowel && seenVowel && current.length && !current[current.length - 1].vowel) {
      // A consonant cluster sits between two vowels: decide where to split it.
      let clusterStart = current.length;
      while (clusterStart > 0 && !current[clusterStart - 1].vowel) clusterStart--;
      const cluster = current.slice(clusterStart);
      if (cluster.length === 1) {
        syllables.push(current.slice(0, clusterStart));
        current = cluster;
      } else {
        syllables.push(current.slice(0, clusterStart + 1));
        current = cluster.slice(1);
      }
    }
    current.push(it);
    if (it.vowel) seenVowel = true;
  }
  if (current.length) syllables.push(current);
  return syllables.filter(s => s.length);
}

/**
 * Analyse the sounds of a name using the letter-sounds data file.
 * @param {string} name
 * @param {object} sounds  contents of data/letter-sounds.json
 * @returns {{ words: [{ word, syllables: [{ text, parts: [{ letter, kind, info }], combination, summary }] }] }}
 */
export function analyzeSounds(name, sounds) {
  const cons = sounds?.consonants || {};
  const vows = sounds?.vowels || {};
  const combos = sounds?.combinations || {};
  const words = splitName(name).map(word => {
    const syllables = syllabify(word).map(items => {
      const text = items.map(x => x.letter).join('');
      const parts = items.map(x => {
        if (x.vowel) {
          const key = x.letter === 'Y' ? 'I' : x.letter;
          return { letter: x.letter, kind: 'vowel', info: vows[key] || null, mappedTo: x.letter === 'Y' ? 'I' : null };
        }
        return { letter: x.letter, kind: 'consonant', info: cons[x.letter] || null };
      });
      // Combination override: the whole syllable first, then any 3- or 2-letter window inside it.
      let combination = combos[text] ? `${text}: ${combos[text]}` : null;
      for (let len = 3; len >= 2 && !combination; len--) {
        for (let i = 0; i + len <= text.length && !combination; i++) {
          const w = text.slice(i, i + len);
          if (combos[w]) combination = `${w}: ${combos[w]}`;
        }
      }
      const consMeanings = parts.filter(p => p.kind === 'consonant' && p.info).map(p => `${p.info.hebrew} (${p.info.pictograph})`);
      const vowelParts = parts.filter(p => p.kind === 'vowel' && p.info).map(p => p.info.quality);
      const summary = [
        consMeanings.length ? consMeanings.join(' + ') : null,
        vowelParts.length ? `carried by ${vowelParts.join(' and ')}` : null
      ].filter(Boolean).join(' ');
      return { text, parts, combination, summary };
    });
    return { word, syllables };
  });
  return { words };
}
