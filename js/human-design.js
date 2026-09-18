// js/human-design.js
// Human Design tab: converts the shared birth data into NatalEngine input,
// calculates the chart and renders summary, bodygraph, activations table,
// channels and variable/PHS sections.
//
// Public API:
//   toNatalEngineInput(lifeDeets, NE) -> { birthDate, birthHour, timezone }
//   computeHumanDesign(lifeDeets, NE) -> hd chart
//   renderHumanDesign(container, hd, birth, NE)

import { HD_PLANET_ORDER, HD_PLANET_NAMES, HD_PLANET_GLYPHS, HD_CENTER_NAMES } from './config.js';
import { renderBodygraph } from './bodygraph.js';
import { createDetailPanel } from './hd-detail.js';

const pad2 = n => String(n).padStart(2, '0');

/**
 * Convert the birth data captured by the chart.html form into the arguments
 * NatalEngine expects.
 * @param {object} lifeDeets { year, month, day, hour, min, tz (IANA) }
 * @param {object} NE NatalEngine bundle namespace
 */
export function toNatalEngineInput(lifeDeets, NE) {
  const birthDate = `${lifeDeets.year}-${pad2(lifeDeets.month)}-${pad2(lifeDeets.day)}`;
  const timeStr = `${pad2(lifeDeets.hour)}:${pad2(lifeDeets.min)}`;
  const birthHour = lifeDeets.hour + lifeDeets.min / 60;
  const timezone = NE.resolveUtcOffset(birthDate, timeStr, lifeDeets.tz);
  return { birthDate, birthHour, timezone, timeStr };
}

/** Calculate the Human Design chart from the shared birth data. */
export function computeHumanDesign(lifeDeets, NE) {
  const input = toNatalEngineInput(lifeDeets, NE);
  const hd = NE.calculateHumanDesign(input.birthDate, input.birthHour, input.timezone);
  hd._input = input;
  return hd;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

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

function centerLabel(key) {
  return HD_CENTER_NAMES[key] || key;
}

function titleCase(s) {
  return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}

// --- Sections ------------------------------------------------------------------

function sectionSummary(hd, birth, detail) {
  const items = [
    ['Type', hd.type?.name],
    ['Strategy', hd.type?.strategy],
    ['Authority', hd.authority?.name],
    ['Profile', hd.profile ? `${hd.profile.numbers} — ${hd.profile.name}` : null],
    ['Definition', hd.definition],
    ['Incarnation Cross', hd.incarnationCross?.fullName || hd.incarnationCross?.name],
    ['Not-Self Theme', hd.type?.notSelf],
    ['Signature', hd.type?.signature]
  ].filter(([, v]) => v);

  const header = el('header', { class: 'hd-header' }, [
    el('div', { class: 'hd-kicker', text: 'Human Design' }),
    birth?.name ? el('h2', { text: birth.name }) : null,
    el('div', { class: 'hd-meta' }, [
      birth?.dateText ? el('span', { text: birth.dateText }) : null,
      birth?.timeText ? el('span', { text: birth.timeText }) : null,
      birth?.location ? el('span', { text: birth.location }) : null,
      hd._input ? el('span', { class: 'hd-muted', text: `UTC${hd._input.timezone >= 0 ? '+' : ''}${hd._input.timezone}` }) : null
    ])
  ]);

  const block = el('div', { class: 'hd-summary' }, items.map(([k, v]) => {
    const isCross = k === 'Incarnation Cross' && detail;
    const item = el('div', { class: `hd-summary-item${isCross ? ' hd-clickable' : ''}`, ...(isCross ? { role: 'button', tabindex: '0', title: 'Click for the four gates of the cross' } : {}) }, [
      el('div', { class: 'hd-summary-label', text: k }),
      el('div', { class: 'hd-summary-value', text: v }),
      isCross ? el('div', { class: 'hd-muted hd-small', text: 'Click to explore the four gates' }) : null
    ]);
    if (isCross) {
      item.addEventListener('click', () => detail.showCross());
      item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); detail.showCross(); } });
    }
    return item;
  }));

  return el('section', { class: 'hd-section' }, [header, block]);
}

function sectionBodygraph(hd, NE, detail) {
  const wrap = el('div', { class: 'hd-bodygraph-wrap' });
  const svg = renderBodygraph(wrap, hd, NE, {
    onGateClick: g => detail.showGate(g),
    onCenterClick: k => detail.showCenter(k)
  });
  // Highlight the selected element on the graph.
  detail.setNavigateHandler(sel => {
    svg.querySelectorAll('.selected').forEach(n => n.classList.remove('selected'));
    if (!sel) return;
    if (sel.kind === 'gate') svg.querySelector(`.hd-gate[data-gate="${sel.id}"]`)?.classList.add('selected');
    if (sel.kind === 'center') svg.querySelector(`.hd-center[data-center="${sel.id}"]`)?.classList.add('selected');
  });
  const centersRow = (label, keys) => el('div', { class: 'hd-chips' }, [
    el('strong', { text: label }),
    ...keys.map(k => el('button', { type: 'button', class: 'hd-chip hd-clickable', text: centerLabel(k),
      onclick: () => detail.showCenter(k) })),
    keys.length ? null : el('span', { class: 'hd-muted', text: 'none' })
  ]);
  const centers = el('div', { class: 'hd-centers-list' }, [
    centersRow('Defined: ', hd.centers?.definedNames || []),
    centersRow('Undefined: ', hd.centers?.allUndefinedNames || hd.centers?.undefinedNames || [])
  ]);
  return el('section', { class: 'hd-section' }, [
    el('h3', { text: 'Bodygraph' }),
    el('p', { class: 'hd-muted hd-small', text: 'Click a gate, center or channel for its description.' }),
    wrap,
    centers
  ]);
}

function activationCell(act, positions, planet) {
  if (!act) return el('td', { text: '—' });
  const sign = positions?.[planet]?.sign || '';
  return el('td', {}, [
    el('span', { class: 'hd-gateline', text: `${act.gate}.${act.line}` }),
    act.name ? el('span', { class: 'hd-muted hd-gatename', text: ` ${act.name}` }) : null
  ]);
}

function sectionActivations(hd, detail) {
  const table = el('table', { class: 'hd-table hd-activations' });
  table.appendChild(el('thead', {}, [
    el('tr', {}, [
      el('th', { colspan: '3', class: 'hd-col-personality', text: 'Personality (conscious)' }),
      el('th', { class: 'hd-col-planet' }),
      el('th', { colspan: '3', class: 'hd-col-design', text: 'Design (unconscious)' })
    ]),
    el('tr', {}, ['Sign', 'Gate.Line', 'Planet', '', 'Planet', 'Gate.Line', 'Sign']
      .map(h => el('th', { text: h })))
  ]));
  const tbody = el('tbody');
  for (const planet of HD_PLANET_ORDER) {
    const p = hd.gates?.personality?.[planet];
    const d = hd.gates?.design?.[planet];
    tbody.appendChild(el('tr', {}, [
      el('td', { class: 'hd-sign', text: hd.positions?.personality?.[planet]?.sign || '' }),
      el('td', { class: 'hd-col-personality' }, [gateButton(p, detail)]),
      el('td', { class: 'hd-planet', text: `${HD_PLANET_GLYPHS[planet] || ''} ${HD_PLANET_NAMES[planet] || planet}` }),
      el('td', { class: 'hd-col-planet hd-muted', text: '' }),
      el('td', { class: 'hd-planet', text: `${HD_PLANET_GLYPHS[planet] || ''} ${HD_PLANET_NAMES[planet] || planet}` }),
      el('td', { class: 'hd-col-design' }, [gateButton(d, detail)]),
      el('td', { class: 'hd-sign', text: hd.positions?.design?.[planet]?.sign || '' })
    ]));
  }
  table.appendChild(tbody);

  // Secondary details: colour / tone / base per activation, collapsed.
  const substructure = el('details', { class: 'hd-collapsible' }, [
    el('summary', { text: 'Colour · Tone · Base for every activation' }),
    el('div', { class: 'hd-scroll' }, buildSubstructureTable(hd))
  ]);

  return el('section', { class: 'hd-section' }, [
    el('h3', { text: 'Planetary Activations' }),
    el('div', { class: 'hd-scroll' }, table),
    substructure
  ]);
}

function gateButton(act, detail) {
  if (!act) return el('span', { class: 'hd-gateline', text: '—' });
  const b = el('button', { type: 'button', class: 'hd-gateline hd-clickable hd-link', text: `${act.gate}.${act.line}`, title: `Gate ${act.gate} — ${act.name || ''}` });
  if (detail) b.addEventListener('click', () => detail.showGate(act.gate));
  return b;
}

function buildSubstructureTable(hd) {
  const table = el('table', { class: 'hd-table hd-substructure' });
  table.appendChild(el('thead', {}, el('tr', {}, ['Column', 'Planet', 'Gate', 'Line', 'Color', 'Tone', 'Base']
    .map(h => el('th', { text: h })))));
  const tbody = el('tbody');
  for (const col of ['personality', 'design']) {
    for (const planet of HD_PLANET_ORDER) {
      const a = hd.gates?.[col]?.[planet];
      if (!a) continue;
      tbody.appendChild(el('tr', { class: `hd-row-${col}` }, [
        el('td', { text: titleCase(col) }),
        el('td', { text: HD_PLANET_NAMES[planet] || planet }),
        el('td', { text: a.gate }), el('td', { text: a.line }),
        el('td', { text: a.color ?? '' }), el('td', { text: a.tone ?? '' }), el('td', { text: a.base ?? '' })
      ]));
    }
  }
  table.appendChild(tbody);
  return table;
}

function sectionChannels(hd, detail) {
  const list = el('div', { class: 'hd-channels' });
  const channels = hd.channels || [];
  if (!channels.length) list.appendChild(el('p', { class: 'hd-muted', text: 'No complete channels (Reflector).' }));
  for (const ch of channels) {
    const card = el('article', { class: 'hd-channel hd-clickable', tabindex: '0', role: 'button' }, [
      el('div', { class: 'hd-channel-gates', text: ch.gates.join(' – ') }),
      el('div', { class: 'hd-channel-body' }, [
        el('div', { class: 'hd-channel-name', text: `Channel of ${ch.name}` }),
        el('div', { class: 'hd-muted', text: (ch.centers || []).map(centerLabel).join(' ↔ ') }),
        el('div', { class: 'hd-chips' }, [
          ch.circuit ? el('span', { class: 'hd-chip', text: `${titleCase(ch.circuit)} circuit` }) : null,
          ch.subcircuit ? el('span', { class: 'hd-chip', text: titleCase(ch.subcircuit) }) : null,
          ch.theme ? el('span', { class: 'hd-chip hd-chip-muted', text: ch.theme }) : null
        ])
      ])
    ]);
    if (detail) {
      card.addEventListener('click', () => detail.showChannel(ch));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); detail.showChannel(ch); } });
    }
    list.appendChild(card);
  }
  const circ = hd.circuitAnalysis?.dominant
    ? el('p', { class: 'hd-muted' }, [`Dominant circuitry: ${hd.circuitAnalysis.dominant.name}`,
        hd.circuitAnalysis.dominant.theme ? ` — ${hd.circuitAnalysis.dominant.theme}` : ''])
    : null;
  return el('section', { class: 'hd-section' }, [
    el('h3', { text: 'Channels' }),
    list,
    circ
  ]);
}

function arrowGlyph(arrow) {
  return arrow === 'left' ? '←' : arrow === 'right' ? '→' : '';
}

function sectionVariable(hd) {
  const v = hd.variable;
  if (!v) return null;
  const rows = [
    ['Determination', v.determination, 'Design Sun · Color', true],
    ['Environment', v.environment, 'Design Nodes · Color', false],
    ['Motivation', v.motivation, 'Personality Sun · Color', false],
    ['Perspective', v.perspective, 'Personality Nodes · Color', false]
  ];
  const grid = el('div', { class: 'hd-variable' }, rows.map(([label, item, source, hasCognition]) => item
    ? el('div', { class: 'hd-variable-item' }, [
        el('div', { class: 'hd-variable-arrow', text: arrowGlyph(item.arrow) }),
        el('div', {}, [
          el('div', { class: 'hd-summary-label', text: label }),
          el('div', { class: 'hd-summary-value', text: item.name || '' }),
          el('div', { class: 'hd-muted', text: `${titleCase(item.arrow)} · Color ${item.color} · Tone ${item.tone}` }),
          item.description ? el('div', { class: 'hd-variable-desc', text: item.description }) : null,
          hasCognition && item.cognition
            ? el('div', { class: 'hd-variable-desc' }, [el('strong', { text: 'Cognition: ' }), `${item.cognition.name}${item.cognition.description ? ' — ' + item.cognition.description : ''}`])
            : null,
          el('div', { class: 'hd-muted hd-small', text: source })
        ])
      ])
    : null));
  return el('section', { class: 'hd-section' }, [
    el('h3', { text: 'Variable / PHS' }),
    v.notation ? el('div', { class: 'hd-notation', text: v.notation }) : null,
    grid
  ]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Render the Human Design tab.
 * @param {HTMLElement|string} container
 * @param {object} hd     chart from computeHumanDesign()
 * @param {object} birth  { name, dateText, timeText, location }
 * @param {object} NE     NatalEngine namespace
 */
export function renderHumanDesign(container, hd, birth, NE) {
  const root = typeof container === 'string' ? document.getElementById(container) : container;
  if (!root) throw new Error('renderHumanDesign: container not found');
  root.innerHTML = '';
  root.classList.add('hd-panel');
  const detail = createDetailPanel(hd, NE);
  root.appendChild(sectionSummary(hd, birth, detail));
  root.appendChild(detail.element);
  root.appendChild(sectionBodygraph(hd, NE, detail));
  root.appendChild(sectionActivations(hd, detail));
  root.appendChild(sectionChannels(hd, detail));
  const variable = sectionVariable(hd);
  if (variable) root.appendChild(variable);
  return root;
}
