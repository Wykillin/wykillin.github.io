// js/report.js
// Report generator: assembles HTML from chart data + aspects + patterns +
// the JSON interpretation files, and renders it into a container.
//
// Public API:
//   loadInterpretationData()                       -> Promise<{ planetsInSigns, planetsInHouses, aspects, aspectPatterns }>
//   renderReport(container, { birth, chartData, aspects, patterns, data })
//   fillTemplate(template, vars)

import {
  DATA_FILES, PLANET_GLYPHS, SIGN_GLYPHS, DISPLAY_NAMES, ASPECTS
} from './config.js';
import { aspectMatrix } from './aspects.js';

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

let cache = null;

/** Fetch all interpretation JSON files once and cache them. */
export async function loadInterpretationData(base = '') {
  if (cache) return cache;
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, path]) => {
      const res = await fetch(base + path, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
      return [key, await res.json()];
    })
  );
  cache = Object.fromEntries(entries);
  return cache;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function displayName(name) {
  return DISPLAY_NAMES[name] || name;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map(p => `<p>${esc(p.trim())}</p>`)
    .join('');
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtDegree(d) {
  const deg = Math.floor(d);
  const min = Math.round((d - deg) * 60);
  return `${deg}°${String(min).padStart(2, '0')}'`;
}

/**
 * Fill {variables} in a template string. Unknown variables are removed.
 */
export function fillTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

/** Format a list "a, b and c". */
function joinNatural(list) {
  if (list.length <= 1) return list.join('');
  return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function sectionHeader(birth) {
  const parts = [];
  if (birth?.name) parts.push(el('h2', { text: birth.name }));
  const meta = [];
  if (birth?.dateText) meta.push(el('span', { class: 'rep-meta-item', text: birth.dateText }));
  if (birth?.timeText) meta.push(el('span', { class: 'rep-meta-item', text: birth.timeText }));
  if (birth?.location) meta.push(el('span', { class: 'rep-meta-item', text: birth.location }));
  if (birth?.tz) meta.push(el('span', { class: 'rep-meta-item rep-muted', text: birth.tz }));
  return el('header', { class: 'rep-header' }, [
    el('div', { class: 'rep-kicker', text: 'Natal Chart Report' }),
    ...parts,
    el('div', { class: 'rep-meta' }, meta)
  ]);
}

function sectionPlacements(chartData) {
  const table = el('table', { class: 'rep-table' });
  table.appendChild(el('thead', {}, el('tr', {}, ['Planet', 'Sign', 'Degree', 'House', 'Retrograde']
    .map(h => el('th', { text: h })))));
  const tbody = el('tbody');
  for (const p of chartData) {
    tbody.appendChild(el('tr', {}, [
      el('td', {}, [el('span', { class: 'glyph', text: PLANET_GLYPHS[p.name] || '' }), ' ', displayName(p.name)]),
      el('td', {}, [el('span', { class: 'glyph', text: SIGN_GLYPHS[p.sign] || '' }), ' ', p.sign]),
      el('td', { text: fmtDegree(p.degreeInSign) }),
      el('td', { text: p.house ?? '' }),
      el('td', { class: 'rep-retro', text: p.isAngle ? '—' : (p.retrograde ? '℞' : '') })
    ]));
  }
  table.appendChild(tbody);
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Placements' }),
    el('div', { class: 'rep-scroll' }, table)
  ]);
}

function collapsible(title, subtitle, bodyHtml, keywords = []) {
  const details = el('details', { class: 'rep-collapsible' });
  const summary = el('summary', {}, [
    el('span', { class: 'rep-coll-title', text: title }),
    subtitle ? el('span', { class: 'rep-coll-sub', text: subtitle }) : null
  ]);
  details.appendChild(summary);
  const body = el('div', { class: 'rep-coll-body' });
  if (keywords.length) {
    body.appendChild(el('div', { class: 'rep-keywords' },
      keywords.map(k => el('span', { class: 'rep-chip', text: k }))));
  }
  body.appendChild(el('div', { html: bodyHtml }));
  details.appendChild(body);
  return details;
}

function sectionPlanetsInSigns(chartData, data) {
  const list = el('div', { class: 'rep-collapsibles' });
  for (const p of chartData) {
    if (p.isAngle) continue;                 // angles have no sign interpretation entries
    const key = `${p.name}-${p.sign}`;
    const entry = data?.[key];
    const title = `${PLANET_GLYPHS[p.name] || ''} ${displayName(p.name)} in ${p.sign} ${SIGN_GLYPHS[p.sign] || ''}`.trim();
    if (!entry) {
      list.appendChild(collapsible(title, 'No interpretation available', '<p class="rep-muted">No entry for ' + esc(key) + '.</p>'));
      continue;
    }
    list.appendChild(collapsible(title, entry.theme, paragraphs(entry.interpretation), entry.keywords));
  }
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Planets in Signs' }),
    list
  ]);
}

function sectionPlanetsInHouses(chartData, data) {
  const list = el('div', { class: 'rep-collapsibles' });
  for (const p of chartData) {
    if (!p.house || p.isAngle) continue;     // angles define houses; no interpretation entries
    const key = `${p.name}-${p.house}`;
    const entry = data?.[key];
    const title = `${PLANET_GLYPHS[p.name] || ''} ${displayName(p.name)} in the ${ordinal(p.house)} House`.trim();
    if (!entry) {
      list.appendChild(collapsible(title, 'No interpretation available', '<p class="rep-muted">No entry for ' + esc(key) + '.</p>'));
      continue;
    }
    list.appendChild(collapsible(title, entry.theme, paragraphs(entry.interpretation), entry.keywords));
  }
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Planets in Houses' }),
    list
  ]);
}

// --- Aspect grid + modal -----------------------------------------------------

function ensureModal() {
  let modal = document.getElementById('repAspectModal');
  if (modal) return modal;
  modal = el('div', { id: 'repAspectModal', class: 'rep-modal', hidden: '', role: 'dialog', 'aria-modal': 'true' });
  const card = el('div', { class: 'rep-modal-card' });
  const close = el('button', { class: 'rep-modal-close', type: 'button', 'aria-label': 'Close', text: '×' });
  close.addEventListener('click', () => closeModal(modal));
  card.appendChild(close);
  card.appendChild(el('div', { class: 'rep-modal-content' }));
  modal.appendChild(card);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(modal); });
  document.body.appendChild(modal);
  return modal;
}

function closeModal(modal) {
  modal.hidden = true;
  document.body.classList.remove('rep-modal-open');
}

function openAspectModal(aspect, data) {
  const modal = ensureModal();
  const content = modal.querySelector('.rep-modal-content');
  const entry = data?.[aspect.key];
  const title = `${PLANET_GLYPHS[aspect.body1] || ''} ${displayName(aspect.body1)} ${aspect.glyph} ${displayName(aspect.body2)} ${PLANET_GLYPHS[aspect.body2] || ''}`;
  const detail = `${aspect.label} · orb ${aspect.orb.toFixed(2)}° · ${aspect.applying ? 'applying' : 'separating'}`;
  content.innerHTML = '';
  content.appendChild(el('div', { class: 'rep-kicker', text: detail }));
  content.appendChild(el('h3', { text: title.trim() }));
  if (entry) {
    if (entry.keywords?.length) {
      content.appendChild(el('div', { class: 'rep-keywords' },
        entry.keywords.map(k => el('span', { class: 'rep-chip', text: k }))));
    }
    content.appendChild(el('div', { html: paragraphs(entry.interpretation) }));
  } else {
    content.appendChild(el('p', { class: 'rep-muted', text: `No interpretation entry for "${aspect.key}" yet.` }));
  }
  modal.hidden = false;
  document.body.classList.add('rep-modal-open');
}

function sectionAspectGrid(chartData, aspects, data) {
  const matrix = aspectMatrix(chartData, aspects);
  const names = chartData.map(p => p.name);

  const table = el('table', { class: 'rep-aspect-grid' });
  const thead = el('thead');
  const hr = el('tr', {}, [el('th', { class: 'corner' })]);
  for (const n of names) hr.appendChild(el('th', { title: displayName(n), text: PLANET_GLYPHS[n] || n }));
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const row of names) {
    const tr = el('tr');
    tr.appendChild(el('th', { title: displayName(row), text: PLANET_GLYPHS[row] || row }));
    for (const col of names) {
      if (row === col) { tr.appendChild(el('td', { class: 'diag' })); continue; }
      const a = matrix[row][col];
      if (!a) { tr.appendChild(el('td', { class: 'empty' })); continue; }
      const cell = el('td', {
        class: `asp asp-${a.type}`,
        role: 'button', tabindex: '0',
        title: `${displayName(row)} ${a.label} ${displayName(col)} (orb ${a.orb.toFixed(2)}°)`,
        text: a.glyph
      });
      const open = () => openAspectModal(a, data);
      cell.addEventListener('click', open);
      cell.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      tr.appendChild(cell);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  const legend = el('div', { class: 'rep-legend' },
    Object.entries(ASPECTS).map(([k, d]) => el('span', { class: `rep-legend-item asp-${k}` }, [
      el('span', { class: 'glyph', text: d.glyph }), ' ', d.label
    ])));

  const list = el('ul', { class: 'rep-aspect-list' });
  for (const a of aspects) {
    const li = el('li', {}, [
      el('span', { class: `glyph asp-${a.type}`, text: a.glyph }),
      ` ${displayName(a.body1)} ${a.label.toLowerCase()} ${displayName(a.body2)} `,
      el('span', { class: 'rep-muted', text: `(orb ${a.orb.toFixed(2)}°, ${a.applying ? 'applying' : 'separating'})` })
    ]);
    li.addEventListener('click', () => openAspectModal(a, data));
    list.appendChild(li);
  }

  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Aspects' }),
    el('p', { class: 'rep-muted', text: 'Click a cell to read the interpretation.' }),
    el('div', { class: 'rep-scroll' }, table),
    legend,
    el('details', { class: 'rep-collapsible' }, [
      el('summary', {}, el('span', { class: 'rep-coll-title', text: `All aspects (${aspects.length})` })),
      el('div', { class: 'rep-coll-body' }, list)
    ])
  ]);
}

// --- Patterns ------------------------------------------------------------------

/** Build the template variables for a pattern. */
export function patternVars(pattern) {
  const vars = {
    element: pattern.element,
    modality: pattern.modality,
    sign: pattern.sign || '',
    house: pattern.house ? ordinal(pattern.house) : '',
    leading: pattern.leading ? displayName(pattern.leading) : '',
    trailing: pattern.trailing ? displayName(pattern.trailing) : '',
    handle: pattern.handle ? displayName(pattern.handle) : '',
    span: pattern.span ?? '',
    count: pattern.planets.length,
    planets: joinNatural(pattern.planets.map(p => displayName(p.name))),
    planetsWithSigns: joinNatural(pattern.planets.map(p => `${displayName(p.name)} in ${p.sign}`)),
    apex: pattern.apex ? displayName(pattern.apex) : '',
    wing: pattern.wing ? displayName(pattern.wing) : ''
  };
  pattern.planets.forEach((p, i) => {
    vars[`planet${i + 1}`] = displayName(p.name);
    vars[`sign${i + 1}`] = p.sign;
    vars[`house${i + 1}`] = p.house;
  });
  const apex = pattern.planets.find(p => p.name === pattern.apex);
  if (apex) { vars.apexSign = apex.sign; vars.apexHouse = apex.house; }
  const wing = pattern.planets.find(p => p.name === pattern.wing);
  if (wing) { vars.wingSign = wing.sign; vars.wingHouse = wing.house; }
  // For patterns with an apex, list the non-apex members separately.
  const base = pattern.planets.filter(p => p.name !== pattern.apex && p.name !== pattern.wing);
  base.forEach((p, i) => {
    vars[`base${i + 1}`] = displayName(p.name);
    vars[`baseSign${i + 1}`] = p.sign;
    vars[`baseHouse${i + 1}`] = p.house;
  });
  vars.basePlanets = joinNatural(base.map(p => displayName(p.name)));
  return vars;
}

function sectionPatterns(patterns, data, drawPattern) {
  const list = el('div', { class: 'rep-patterns' });
  if (!patterns.length) {
    list.appendChild(el('p', { class: 'rep-muted', text: 'No major aspect patterns detected in this chart.' }));
  }
  // Group the cards by pattern type, in the order the detector returned them.
  const groups = new Map();
  for (const pat of patterns) {
    if (!groups.has(pat.name)) groups.set(pat.name, []);
    groups.get(pat.name).push(pat);
  }
  const summary = el('div', { class: 'rep-pattern-summary' }, [...groups].map(([name, items]) =>
    el('span', { class: 'rep-chip', text: `${name} × ${items.length}` })));
  if (patterns.length) list.appendChild(summary);
  for (const [groupName, items] of groups) {
    list.appendChild(el('h4', { class: 'rep-pattern-group', text: `${groupName}${items.length > 1 ? ` (${items.length})` : ''}` }));
    for (const pat of items) list.appendChild(patternCard(pat, data, drawPattern));
  }
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Aspect Patterns' }),
    list
  ]);
}

function patternCard(pat, data, drawPattern) {
  {
    const entry = data?.[pat.id] || Object.values(data || {}).find(e => e.name === pat.name);
    const vars = patternVars(pat);
    const members = el('ul', { class: 'rep-pattern-members' }, pat.planets.map(p =>
      el('li', { class: p.name === pat.apex ? 'apex' : '' }, [
        el('span', { class: 'glyph', text: PLANET_GLYPHS[p.name] || '' }),
        ` ${displayName(p.name)} in ${p.sign}${p.house ? `, ${ordinal(p.house)} house` : ''}`,
        p.name === pat.apex ? el('span', { class: 'rep-chip', text: pat.id === 'kite' ? 'tail' : 'apex' }) : null,
        p.name === pat.wing ? el('span', { class: 'rep-chip', text: 'wing' }) : null
      ])));
    const title = el('h4', {}, [pat.name, pat.sign ? ` in ${pat.sign}` : pat.house ? ` in the ${ordinal(pat.house)} house` : (pat.element && pat.element !== 'Mixed' && !pat.isShape ? ` in ${pat.element}` : '')]);
    const wheelBox = el('div', { class: 'rep-pattern-wheel', hidden: '' });
    let drawn = false;
    const head = drawPattern
      ? el('button', { type: 'button', class: 'rep-pattern-head', 'aria-expanded': 'false' }, [
          title, el('span', { class: 'rep-pattern-toggle', text: 'Show on wheel' })])
      : el('div', { class: 'rep-pattern-head' }, title);
    if (drawPattern) {
      head.addEventListener('click', () => {
        const open = wheelBox.hidden;
        if (open && !drawn) {
          try { drawPattern(wheelBox, pat); drawn = true; }
          catch (err) { console.error(err); wheelBox.textContent = 'Could not draw this pattern.'; }
        }
        wheelBox.hidden = !open;
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
        head.querySelector('.rep-pattern-toggle').textContent = open ? 'Hide wheel' : 'Show on wheel';
      });
    }
    const card = el('article', { class: 'rep-pattern' }, [
      head,
      wheelBox,
      members,
      entry ? el('p', { class: 'rep-pattern-desc', text: fillTemplate(entry.template, vars) }) : null,
      entry ? el('details', { class: 'rep-collapsible' }, [
        el('summary', {}, el('span', { class: 'rep-coll-title', text: 'About this pattern' })),
        el('div', { class: 'rep-coll-body', html: paragraphs(entry.meaning) })
      ]) : el('p', { class: 'rep-muted', text: 'No pattern description available.' })
    ]);
    return card;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Render the full report.
 * @param {HTMLElement|string} container element or id
 * @param {object} input
 * @param {object} input.birth      { name, dateText, timeText, location, tz }
 * @param {Array}  input.chartData
 * @param {Array}  input.aspects
 * @param {Array}  input.patterns
 * @param {object} input.data       result of loadInterpretationData()
 * @param {HTMLElement} [input.wheel] the chart wheel section, placed right after the header
 * @param {function} [input.drawPattern] (container, pattern) => draws a mini wheel for a clicked pattern
 */
export function renderReport(container, { birth, chartData, aspects, patterns, data, wheel, drawPattern }) {
  const root = typeof container === 'string' ? document.getElementById(container) : container;
  if (!root) throw new Error('renderReport: container not found');
  root.innerHTML = '';
  root.classList.add('astro-report');

  root.appendChild(sectionHeader(birth));
  if (wheel) root.appendChild(wheel);
  root.appendChild(sectionPlacements(chartData));
  root.appendChild(sectionPlanetsInSigns(chartData, data?.planetsInSigns));
  root.appendChild(sectionPlanetsInHouses(chartData, data?.planetsInHouses));
  root.appendChild(sectionAspectGrid(chartData, aspects, data?.aspects));
  root.appendChild(sectionPatterns(patterns, data?.aspectPatterns, drawPattern));
  return root;
}
