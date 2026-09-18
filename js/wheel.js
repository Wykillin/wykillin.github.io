// js/wheel.js
// Chart wheel rendering with aspect lines, plus the wheel settings menu.
//
// Public API:
//   loadWheelSettings() / saveWheelSettings(settings)
//   createWheelSection(onChange) -> { element, chartEl }
//   drawWheel(chartEl, { chartData, cusps, aspects }, settings)
//
// Uses the global `astrochart` (@astrodraw/astrochart) loaded in chart.html.

import {
  ASPECTS, ASPECT_COLORS, WHEEL, BODIES, ANGLES, DISPLAY_NAMES, PLANET_GLYPHS,
  PATTERN_ASPECT_TYPES, PATTERN_WHEEL
} from './config.js';

const STORAGE_KEY = 'chartWheelSettings';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function defaultSettings() {
  const aspects = {};
  for (const type of Object.keys(ASPECTS)) aspects[type] = WHEEL.defaultAspects[type] !== false;
  const bodies = {};
  for (const name of [...BODIES, ...ANGLES]) bodies[name] = WHEEL.defaultBodies[name] !== false;
  return { aspects, bodies };
}

/** Load settings from localStorage, merged over the defaults. */
export function loadWheelSettings() {
  const def = defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return def;
    const saved = JSON.parse(raw);
    return {
      aspects: { ...def.aspects, ...(saved.aspects || {}) },
      bodies: { ...def.bodies, ...(saved.bodies || {}) }
    };
  } catch {
    return def;
  }
}

export function saveWheelSettings(settings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* private mode etc. */ }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
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

const label = name => DISPLAY_NAMES[name] || name;

// ---------------------------------------------------------------------------
// Wheel section (toolbar + settings panel + drawing container)
// ---------------------------------------------------------------------------

/**
 * Build the wheel section once. `onChange(settings)` is called whenever the
 * user toggles something in the settings menu (after the change is saved).
 */
export function createWheelSection(onChange) {
  let settings = loadWheelSettings();
  const chartEl = el('div', { id: 'chart', class: 'rep-wheel-canvas' });

  const panel = el('div', { class: 'rep-wheel-settings', hidden: '', role: 'dialog', 'aria-label': 'Chart drawing settings' });

  const checkbox = (group, key, text, extraClass = '') => {
    const input = el('input', { type: 'checkbox' });
    input.checked = settings[group][key] !== false;
    input.addEventListener('change', () => {
      settings[group][key] = input.checked;
      saveWheelSettings(settings);
      onChange(settings);
    });
    return el('label', { class: `rep-setting ${extraClass}`.trim() }, [input, el('span', { text })]);
  };

  const rebuildPanel = () => {
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'rep-settings-head' }, [
      el('strong', { text: 'Chart drawing settings' }),
      el('button', { type: 'button', class: 'rep-settings-close', 'aria-label': 'Close settings', text: '×',
        onclick: () => togglePanel(false) })
    ]));
    panel.appendChild(el('fieldset', {}, [
      el('legend', { text: 'Aspect lines' }),
      ...Object.entries(ASPECTS).map(([type, d]) =>
        checkbox('aspects', type, `${d.glyph} ${d.label}`, `asp-${type}`))
    ]));
    panel.appendChild(el('fieldset', {}, [
      el('legend', { text: 'Placements' }),
      ...BODIES.map(name => checkbox('bodies', name, `${PLANET_GLYPHS[name] || ''} ${label(name)}`.trim()))
    ]));
    panel.appendChild(el('fieldset', {}, [
      el('legend', { text: 'Angles (aspect lines only; the axes are always drawn)' }),
      ...ANGLES.map(name => checkbox('bodies', name, `${PLANET_GLYPHS[name] || ''} ${label(name)}`.trim()))
    ]));
    panel.appendChild(el('div', { class: 'rep-settings-actions' }, [
      el('button', { type: 'button', class: 'rep-btn', text: 'Reset to defaults', onclick: () => {
        settings = defaultSettings();
        saveWheelSettings(settings);
        rebuildPanel();
        onChange(settings);
      } })
    ]));
  };

  const gear = el('button', {
    type: 'button', class: 'rep-gear', 'aria-expanded': 'false', 'aria-label': 'Chart drawing settings'
  }, ['⚙ ', el('span', { text: 'Settings' })]);

  const togglePanel = (show) => {
    const open = show ?? panel.hidden;
    panel.hidden = !open;
    gear.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  gear.addEventListener('click', () => togglePanel());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) togglePanel(false); });

  rebuildPanel();

  const element = el('section', { class: 'rep-section rep-wheel' }, [
    el('div', { class: 'rep-wheel-toolbar' }, [
      el('h3', { text: 'Chart Wheel' }),
      gear
    ]),
    panel,
    chartEl,
    el('div', { class: 'rep-wheel-legend' }, [
      ...Object.entries(ASPECTS).map(([type, d]) =>
        el('span', { class: 'rep-legend-item' }, [
          el('i', { class: 'rep-line-swatch', style: `background:${ASPECT_COLORS[type]}` }), ` ${d.label}`
        ])),
      el('span', { class: 'rep-legend-item rep-muted', text: `solid = orb ≤ ${WHEEL.lineStyles.tight.maxOrb}°, dashed = wider orb` })
    ])
  ]);

  return { element, chartEl, getSettings: () => settings };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

/** Pick a line style for an aspect based on its orb (intensity). */
export function lineStyleFor(orb) {
  const s = WHEEL.lineStyles;
  if (orb <= s.exact.maxOrb) return s.exact;
  if (orb <= s.tight.maxOrb) return s.tight;
  return s.wide;
}

/**
 * Draw the wheel with aspect lines into `chartEl` (must have an id).
 * Angles (Ascendant/MC) are not passed as planets — astrochart already draws
 * the axes from the cusps — but their aspect lines are drawn.
 */
export function drawWheel(chartEl, { chartData, cusps, aspects }, settings, options = {}) {
  if (typeof astrochart === 'undefined') throw new Error('astrochart library not loaded');
  if (!chartEl.id) chartEl.id = 'chart';
  chartEl.innerHTML = '';                              // don't stack charts on repeat draws
  const size = options.size || WHEEL.size;

  const enabled = name => settings.bodies[name] !== false;
  const byName = Object.fromEntries(chartData.map(p => [p.name, p]));

  const data = { planets: {}, cusps };
  for (const p of chartData) {
    if (p.isAngle || !enabled(p.name)) continue;
    data.planets[p.name] = [p.longitude];              // astrodraw wants [longitude]
  }

  const chart = new astrochart.Chart(chartEl.id, size, size, { ...WHEEL.astrochartSettings, ...(options.astrochartSettings || {}) });
  const radix = chart.radix(data);

  const custom = aspects
    .filter(a => settings.aspects[a.type] !== false && enabled(a.body1) && enabled(a.body2))
    .map(a => ({
      point:   { name: a.body1, position: byName[a.body1].longitude },
      toPoint: { name: a.body2, position: byName[a.body2].longitude },
      aspect:  { name: a.type, degree: a.angle, color: ASPECT_COLORS[a.type] || '#999' },
      precision: a.orb
    }));
  radix.aspects(custom);

  // Style each line by intensity (orb): width + solid/dashed.
  for (const line of chartEl.querySelectorAll('line[data-precision]')) {
    const orb = Number(line.getAttribute('data-precision'));
    const style = lineStyleFor(orb);
    line.setAttribute('stroke-width', style.width);
    if (style.dash) line.setAttribute('stroke-dasharray', style.dash);
    else line.removeAttribute('stroke-dasharray');
    line.setAttribute('stroke-opacity', style.opacity ?? 1);
    line.setAttribute('stroke-linecap', 'round');
    const a = line.getAttribute('data-name');
    line.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'title'), {
      textContent: `${label(line.getAttribute('data-point'))} ${ASPECTS[a]?.label || a} ${label(line.getAttribute('data-toPoint'))} (orb ${orb.toFixed(2)}°)`
    }));
  }

  // Make the SVG scale to its container.
  const svg = chartEl.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }
  return radix;
}

/**
 * Draw a small wheel showing only the planets of one aspect pattern and the
 * aspect lines that make up that pattern.
 * @param {HTMLElement} container  element to draw into (gets an id if it has none)
 * @param {object} state           { chartData, cusps, aspects } of the full chart
 * @param {object} pattern         a pattern from detectPatterns()
 */
export function drawPatternWheel(container, state, pattern) {
  if (!container.id) container.id = `pattern-wheel-${Math.random().toString(36).slice(2, 8)}`;
  const members = new Set(pattern.planets.map(p => p.name));
  const types = PATTERN_ASPECT_TYPES[pattern.id] || Object.keys(ASPECTS);
  const chartData = state.chartData.filter(p => members.has(p.name));
  // Patterns carry the aspects that formed them (found with the pattern orbs);
  // fall back to the chart's aspect list filtered by type.
  const source = pattern.aspects && pattern.aspects.length ? pattern.aspects : state.aspects;
  const aspects = source.filter(a => members.has(a.body1) && members.has(a.body2)
    && (pattern.aspects?.length ? ASPECTS[a.type] : types.includes(a.type)));
  const settings = {
    aspects: Object.fromEntries(Object.keys(ASPECTS).map(k => [k, true])),
    bodies: Object.fromEntries([...BODIES, ...ANGLES].map(n => [n, true]))
  };
  return drawWheel(container, { chartData, cusps: state.cusps, aspects }, settings, { size: PATTERN_WHEEL.size });
}
