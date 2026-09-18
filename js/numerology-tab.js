// js/numerology-tab.js
// Numerology tab rendering: name inputs, core numbers, cycles, gematria tables
// and the significance list. Calculations come from js/numerology.js and all
// interpretive text from data/numerology.json.
//
// Public API:
//   loadNumerologyData()
//   renderNumerologyTab(container, { birth, baseName, data })

import { NUMEROLOGY, LETTER_SOUNDS_FILE } from './config.js';
import { loadHebrewLetters, hebrewGlyph } from './hebrew.js';
import {
  calculateNumerology, calculateGematria, collectSignificantValues,
  composeName, GEMATRIA_CIPHERS, MASTER_NUMBERS, analyzeSounds
} from './numerology.js';

let cache = null;
export async function loadNumerologyData(base = '') {
  if (cache) return cache;
  const [num, sounds, hebrew] = await Promise.all([
    ...[NUMEROLOGY.dataFile, LETTER_SOUNDS_FILE].map(async path => {
      const res = await fetch(base + path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
      return res.json();
    }),
    loadHebrewLetters(base)
  ]);
  cache = { ...num, sounds, hebrew };
  return cache;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

const pad2 = n => String(n).padStart(2, '0');

function table(headers, rows, cls = 'rep-table') {
  const t = el('table', { class: cls });
  t.appendChild(el('thead', {}, el('tr', {}, headers.map(h => el('th', { text: h })))));
  const tb = el('tbody');
  for (const r of rows) {
    tb.appendChild(el('tr', { class: r.cls || '' }, r.cells.map(c =>
      typeof c === 'object' && c !== null && c.nodeType ? el('td', {}, c) : el('td', { text: c ?? '' }))));
  }
  t.appendChild(tb);
  return t;
}

function collapsible(title, bodyNode) {
  return el('details', { class: 'rep-collapsible' }, [
    el('summary', {}, el('span', { class: 'rep-coll-title', text: title })),
    el('div', { class: 'rep-coll-body' }, bodyNode)
  ]);
}

function meaningBlock(data, value) {
  const m = data?.numbers?.[String(value)];
  if (!m) return el('p', { class: 'rep-muted', text: 'No meaning entry for this number.' });
  return el('div', {}, [
    el('div', { class: 'rep-keywords' }, (m.keywords || []).map(k => el('span', { class: 'rep-chip', text: k }))),
    el('p', { text: m.meaning })
  ]);
}

// ---------------------------------------------------------------------------
// sections
// ---------------------------------------------------------------------------

function sectionCore(profile, data) {
  const grid = el('div', { class: 'num-core' });
  for (const c of Object.values(profile.core)) {
    const pos = data?.positions?.[c.key];
    const m = data?.numbers?.[String(c.value)];
    grid.appendChild(el('article', { class: `num-card${MASTER_NUMBERS.includes(c.value) ? ' master' : ''}` }, [
      el('div', { class: 'hd-summary-label', text: pos?.title || c.label }),
      el('div', { class: 'num-value', text: c.value }),
      el('div', { class: 'num-calc rep-muted', text: c.calc }),
      c.extra ? el('div', { class: 'rep-muted', text: c.extra }) : null,
      m ? el('div', { class: 'rep-keywords' }, m.keywords.map(k => el('span', { class: 'rep-chip', text: k }))) : null,
      collapsible('Meaning', el('div', {}, [
        pos ? el('p', { class: 'rep-muted', text: pos.description }) : null,
        meaningBlock(data, c.value)
      ]))
    ]));
  }
  const masters = profile.masterNumbers.length
    ? el('p', { class: 'num-note' }, [el('strong', { text: 'Master numbers present: ' }), profile.masterNumbers.join(', ')])
    : null;
  return el('section', { class: 'rep-section' }, [el('h3', { text: 'Core Numbers' }), grid, masters]);
}

function sectionNameBreakdown(profile) {
  const blocks = profile.words.map(w => {
    const letterRow = el('div', { class: 'num-letters' }, w.items.map(it =>
      el('span', { class: `num-letter${it.vowel ? ' vowel' : ''}`, title: it.vowel ? 'vowel' : 'consonant' }, [
        el('span', { class: 'num-letter-char', text: it.letter }),
        el('span', { class: 'num-letter-val', text: it.value })
      ])));
    return el('div', { class: 'num-word' }, [
      el('div', { class: 'num-word-title' }, [
        el('strong', { text: w.word }),
        el('span', { class: 'rep-muted', text: ` total ${w.total} → ${w.reduced} · vowels ${w.vowels} → ${w.vowelsReduced} · consonants ${w.consonants} → ${w.consonantsReduced}` })
      ]),
      letterRow
    ]);
  });
  const freq = el('div', { class: 'num-freq' }, Object.entries(profile.letterFrequencies).map(([v, n]) =>
    el('span', { class: `num-freq-item${n === 0 ? ' missing' : ''}` }, [el('b', { text: v }), ` × ${n}`])));
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Name Breakdown (Pythagorean)' }),
    el('p', { class: 'rep-muted', text: 'Gold letters are vowels (Soul Urge); the rest are consonants (Personality). Y counts as a vowel when it is not next to another vowel.' }),
    ...blocks,
    el('div', { class: 'num-word-title' }, [el('strong', { text: 'Letter frequencies' }), el('span', { class: 'rep-muted', text: ` (${profile.totalLetters} letters)` })]),
    freq
  ]);
}

function sectionCycles(profile, data) {
  const pos = data?.positions || {};
  const cyc = table(['Period', 'Ages', 'Pinnacle', 'Challenge'],
    profile.pinnacles.map((p, i) => ({ cells: [`${i + 1}`, p.ages, `${p.value}`, `${profile.challenges[i].value}`] })));

  const lessons = profile.karmicLessons.length ? profile.karmicLessons.join(', ') : 'none — every number 1–9 appears in the name';
  const passion = profile.hiddenPassion.join(', ');
  const planes = profile.planesOfExpression;
  const planeTable = table(['Plane', 'Letters'],
    Object.entries(planes).map(([k, n]) => ({ cells: [k[0].toUpperCase() + k.slice(1), `${n}`] })));

  const chald = profile.chaldean.expression;
  const chaldText = `${chald.perWord.join(' + ')} = ${chald.sum}${chald.sum !== chald.value ? ' → ' + chald.value : ''}`;

  const item = (key, valueText, extra) => el('div', { class: 'hd-summary-item' }, [
    el('div', { class: 'hd-summary-label', text: pos[key]?.title || key }),
    el('div', { class: 'hd-summary-value', text: valueText }),
    extra ? el('div', { class: 'rep-muted num-small', text: extra }) : null,
    pos[key]?.description ? collapsible('About', el('p', { text: pos[key].description })) : null
  ]);

  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Cycles & Name Traits' }),
    el('div', { class: 'rep-scroll' }, cyc),
    pos.pinnacles ? el('p', { class: 'rep-muted num-small', text: `${pos.pinnacles.description} ${pos.challenges?.description || ''}` }) : null,
    el('div', { class: 'hd-summary num-traits' }, [
      item('karmicLessons', lessons),
      item('hiddenPassion', passion || '—'),
      item('chaldean', `${chald.value}`, chaldText),
      el('div', { class: 'hd-summary-item' }, [
        el('div', { class: 'hd-summary-label', text: pos.planes?.title || 'Planes of Expression' }),
        planeTable,
        pos.planes?.description ? collapsible('About', el('p', { text: pos.planes.description })) : null
      ])
    ])
  ]);
}

function sectionGematria(gem, data) {
  const ciphers = gem.ciphers;
  const labels = ciphers.map(k => GEMATRIA_CIPHERS[k].label);
  const perWord = gem.words.map(w => el('div', { class: 'num-gem-word' }, [
    el('h4', { text: w.word }),
    el('div', { class: 'rep-scroll' }, table(['Letter', ...labels], [
      ...w.rows.map(r => ({ cells: [r.letter, ...ciphers.map(k => `${r[k]}`)] })),
      { cls: 'num-total', cells: ['Total', ...ciphers.map(k => `${w.totals[k]}`)] }
    ], 'rep-table num-gem-table'))
  ]));
  const summary = table(['Name', ...labels], [
    ...gem.words.map(w => ({ cells: [w.word, ...ciphers.map(k => `${w.totals[k]}`)] })),
    { cls: 'num-total', cells: ['Full name', ...ciphers.map(k => `${gem.totals[k]}`)] },
    { cells: ['Full name reduced', ...ciphers.map(k => `${gem.reduced[k]}`)] }
  ]);
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Gematria' }),
    data?.positions?.gematria ? el('p', { class: 'rep-muted num-small', text: data.positions.gematria.description }) : null,
    el('h4', { text: 'Totals' }),
    el('div', { class: 'rep-scroll' }, summary),
    el('div', { class: 'num-gem-words' }, perWord)
  ]);
}

function sectionSignificance(items, data) {
  const rows = items.map(it => {
    const props = el('div', { class: 'num-props' }, [
      ...it.props.map(p => el('span', { class: 'rep-chip', title: p.detail, text: p.label })),
      it.notable ? el('span', { class: 'rep-chip num-notable', text: 'notable' }) : null
    ]);
    const details = el('div', { class: 'num-prop-details' }, [
      ...it.props.map(p => el('div', { class: 'num-small' }, [el('strong', { text: p.label + ': ' }), p.detail])),
      it.notable ? el('div', { class: 'num-small num-notable-text' }, [el('strong', { text: 'Tradition: ' }), it.notable]) : null
    ]);
    const cell = el('div', {}, [props, (it.props.length || it.notable) ? collapsible('Details', details) : el('span', { class: 'rep-muted', text: '—' })]);
    return { cells: [`${it.value}`, it.source, cell], cls: it.notable ? 'num-row-notable' : '' };
  });
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Significant Values' }),
    data?.positions?.significance ? el('p', { class: 'rep-muted num-small', text: data.positions.significance.description }) : null,
    el('div', { class: 'rep-scroll' }, table(['Value', 'Source', 'Properties'], rows, 'rep-table num-sig-table'))
  ]);
}

function sectionSounds(analysis, sounds, hebrew) {
  const glyphsFor = info => (info?.hebrewKeys || []).map(k => hebrewGlyph(k, hebrew));
  const wordBlocks = analysis.words.map(w => el('div', { class: 'num-sound-word' }, [
    el('h4', { text: w.word }),
    el('div', { class: 'num-syllables' }, w.syllables.map(syl => el('div', { class: 'num-syllable' }, [
      el('div', { class: 'num-syllable-text', text: syl.text }),
      syl.combination ? el('div', { class: 'num-syllable-summary num-combo', text: syl.combination }) : null,
      el('div', { class: 'num-syllable-summary', text: syl.summary || '—' }),
      el('div', { class: 'num-sound-parts' }, syl.parts.map(p => {
        if (!p.info) return el('div', { class: `num-sound-part ${p.kind}`, text: `${p.letter}: no entry` });
        if (p.kind === 'vowel') {
          const trad = Object.entries(p.info.traditions || {}).map(([k, v]) => `${k[0].toUpperCase() + k.slice(1)}: ${v}`).join(' · ');
          return el('div', { class: 'num-sound-part vowel' }, [
            el('b', { text: `${p.letter}${p.mappedTo ? ' (as ' + p.mappedTo + ')' : ''} · ${p.info.sound}` }),
            ` — ${p.info.steiner}. `,
            el('span', { class: 'rep-muted', text: `Gesture: ${p.info.gesture}. ${trad}` })
          ]);
        }
        return el('div', { class: 'num-sound-part consonant' }, [
          el('div', { class: 'num-heb-row' }, glyphsFor(p.info)),
          el('b', { text: `${p.letter} · ${p.info.hebrew} (${p.info.pictograph})` }),
          ` — ${p.info.meaning}. `,
          p.info.note ? el('span', { class: 'rep-muted', text: p.info.note }) : null
        ]);
      }))
    ])))
  ]));

  // Letter reference table for the letters present in the name
  const present = new Set(analysis.words.flatMap(w => w.syllables.flatMap(s => s.parts.map(p => p.letter + (p.kind === 'vowel' ? ':v' : ':c')))));
  const rows = [...present].sort().map(key => {
    const [L, kind] = key.split(':');
    if (kind === 'c') {
      const c = sounds?.consonants?.[L];
      const cell = el('div', {}, [...(c ? glyphsFor(c) : []), el('div', { class: 'rep-muted num-small', text: c?.hebrew || '' })]);
      return { cells: [L, cell, c?.pictograph || '', c?.meaning || ''] };
    }
    const v = sounds?.vowels?.[L === 'Y' ? 'I' : L];
    return { cells: [L, v ? `vowel (${v.sound})` : '', v?.gesture || '', v?.steiner || ''] };
  });

  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Sound Analysis' }),
    sounds?.intro ? el('p', { class: 'rep-muted num-small', text: sounds.intro }) : null,
    hebrew ? el('p', { class: 'rep-muted num-small', text: 'Each consonant shows its Hebrew root letter in block and cursive script. Click a letter for its number, pictograph, Sefer Yetzirah and Tarot keys and spiritual meaning.' }) : null,
    sounds?.method ? el('p', { class: 'rep-muted num-small', text: sounds.method }) : null,
    ...wordBlocks,
    collapsible('Letter reference for this name', el('div', { class: 'rep-scroll' },
      table(['Letter', 'Root', 'Pictograph / gesture', 'Meaning'], rows, 'rep-table num-letter-table')))
  ]);
}

// ---------------------------------------------------------------------------
// entry point
// ---------------------------------------------------------------------------

/**
 * Render the Numerology tab.
 * @param {HTMLElement|string} container
 * @param {object} opts
 * @param {object} opts.birth     { year, month, day, name?, city? }
 * @param {string} opts.baseName  name from the birth form (may be empty)
 * @param {object} opts.data      contents of data/numerology.json
 */
export function renderNumerologyTab(container, { birth, baseName, data }) {
  const root = typeof container === 'string' ? document.getElementById(container) : container;
  if (!root) throw new Error('renderNumerologyTab: container not found');
  root.innerHTML = '';
  root.classList.add('num-panel');

  const nameInput = el('input', { type: 'text', id: 'numName', placeholder: 'First and last name', autocomplete: 'off' });
  nameInput.value = baseName || '';
  const middleInput = el('input', { type: 'text', id: 'numMiddle', placeholder: 'Middle name (optional)', autocomplete: 'off' });
  const calculatedName = el('div', { class: 'num-calculated', 'aria-live': 'polite' });
  const results = el('div', { class: 'num-results' });

  root.appendChild(el('header', { class: 'rep-header' }, [
    el('div', { class: 'rep-kicker', text: 'Numerology' }),
    el('div', { class: 'rep-meta' }, [
      el('span', { text: `Born ${birth.year}-${pad2(birth.month)}-${pad2(birth.day)}` }),
      birth.city ? el('span', { text: birth.city }) : null
    ])
  ]));

  root.appendChild(el('section', { class: 'rep-section num-namebox' }, [
    el('h3', { text: 'Name' }),
    el('div', { class: 'num-inputs' }, [
      el('label', {}, [el('span', { text: 'Name' }), nameInput]),
      el('label', {}, [el('span', { text: 'Middle name' }), middleInput])
    ]),
    el('div', { class: 'hd-summary-label', text: 'Calculated name' }),
    calculatedName,
    el('p', { class: 'rep-muted num-small', text: 'Use the full name as written on the birth certificate for the birth-name numbers. The middle name is inserted after the first name.' })
  ]));
  root.appendChild(results);

  function recompute() {
    const full = composeName(nameInput.value, middleInput.value);
    calculatedName.textContent = full ? full.toUpperCase() : '—';
    results.innerHTML = '';
    if (!full) {
      results.appendChild(el('p', { class: 'rep-muted', text: 'Enter a name to calculate the name numbers and gematria.' }));
      return;
    }
    const profile = calculateNumerology({ name: full, birth });
    const gem = calculateGematria(full);
    const sig = collectSignificantValues(profile, gem, data?.notable || {});
    results.appendChild(sectionCore(profile, data));
    results.appendChild(sectionNameBreakdown(profile));
    results.appendChild(sectionCycles(profile, data));
    results.appendChild(sectionGematria(gem, data));
    results.appendChild(sectionSignificance(sig, data));
    results.appendChild(sectionSounds(analyzeSounds(full, data?.sounds), data?.sounds, data?.hebrew));
  }

  let timer;
  const onInput = () => { clearTimeout(timer); timer = setTimeout(recompute, 200); };
  nameInput.addEventListener('input', onInput);
  middleInput.addEventListener('input', onInput);
  recompute();
  return root;
}
