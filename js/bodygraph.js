// js/bodygraph.js
// SVG Human Design bodygraph renderer.
//
// Geometry (center shapes, gate/half-channel paths, gate label positions) is
// taken from the NatalEngine bundle (window.NatalEngine.GATE_PATHS etc.),
// which carries the canonical hdkit layout also used by open-human-design.
// Each channel is drawn as two half-channel paths, one per gate, so a channel
// can be black on one side and red on the other.
//
// Public API:
//   renderBodygraph(container, hdChart, NE, options?)
//     container : HTMLElement or element id
//     hdChart   : result of NatalEngine.calculateHumanDesign()
//     NE        : the NatalEngine global (bundle namespace)

import { HD_CENTER_COLORS, HD_CHANNEL_COLORS, HD_CENTER_NAMES } from './config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Map the bundle's shape keys to NatalEngine centre keys. */
const SHAPE_TO_CENTER = {
  Head: 'head', Ajna: 'ajna', Throat: 'throat', G: 'g', Ego: 'heart',
  Sacral: 'sacral', Spleen: 'spleen', SolarPlexus: 'solar', Root: 'root'
};

/** Draw order so centres overlap channel paths correctly. */
const CENTER_ORDER = ['Head', 'Ajna', 'Throat', 'G', 'Ego', 'Spleen', 'SolarPlexus', 'Sacral', 'Root'];

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  return node;
}

/**
 * Collect activation maps from a chart.
 * @returns {{ personality: Map<number, string[]>, design: Map<number, string[]> }}
 */
export function activationMaps(hd) {
  const personality = new Map();
  const design = new Map();
  const add = (map, planet, act) => {
    if (!act || !act.gate) return;
    if (!map.has(act.gate)) map.set(act.gate, []);
    map.get(act.gate).push(`${planet} ${act.gate}.${act.line}`);
  };
  for (const [planet, act] of Object.entries(hd?.gates?.personality || {})) add(personality, planet, act);
  for (const [planet, act] of Object.entries(hd?.gates?.design || {})) add(design, planet, act);
  return { personality, design };
}

/**
 * Render the bodygraph into `container`.
 * @param {HTMLElement|string} container
 * @param {object} hd  NatalEngine Human Design chart
 * @param {object} NE  NatalEngine bundle namespace (needs GATE_PATHS, CENTER_SHAPES, GATE_CIRCLE_POSITIONS, GATES, CHANNELS)
 * @param {object} [options]
 * @param {boolean} [options.showLegend=true]
 * @param {function} [options.onGateClick]   (gateNumber) => void
 * @param {function} [options.onCenterClick] (centerKey) => void
 */
export function renderBodygraph(container, hd, NE, options = {}) {
  const root = typeof container === 'string' ? document.getElementById(container) : container;
  if (!root) throw new Error('renderBodygraph: container not found');
  if (!NE?.GATE_PATHS || !NE?.CENTER_SHAPES) throw new Error('renderBodygraph: NatalEngine geometry not available');

  root.innerHTML = '';
  root.classList.add('hd-bodygraph');

  const { personality, design } = activationMaps(hd);
  const active = new Set([...personality.keys(), ...design.keys()]);
  const defined = new Set(hd?.centers?.definedNames || []);
  const definedChannels = new Set((hd?.channels || []).map(c => c.gates.join('-')));

  const colors = HD_CHANNEL_COLORS;
  const pad = 20;
  const vb = NE.VIEWBOX || { width: 851.41, height: 1309.4 };
  const svg = svgEl('svg', {
    class: 'hd-bodygraph-svg',
    viewBox: `${-pad} ${-pad} ${vb.width + pad * 2} ${1309.4 + pad * 2}`,
    role: 'img',
    'aria-label': describe(hd),
    preserveAspectRatio: 'xMidYMid meet'
  });

  // --- defs: stripe pattern for gates activated by both columns ---------
  const defs = svgEl('defs');
  const pattern = svgEl('pattern', {
    id: 'hd-stripe-both', width: '10', height: '10',
    patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
  });
  pattern.appendChild(svgEl('rect', { width: '10', height: '10', fill: colors.personality }));
  pattern.appendChild(svgEl('rect', { width: '5', height: '10', fill: colors.design }));
  defs.appendChild(pattern);
  svg.appendChild(defs);

  const gateFill = gate => {
    const p = personality.has(gate);
    const d = design.has(gate);
    if (p && d) return 'url(#hd-stripe-both)';
    if (p) return colors.personality;
    if (d) return colors.design;
    return colors.inactive;
  };

  // --- half-channel paths (one per gate) -------------------------------
  // Inactive paths are drawn first and dimmed; active ones on top.
  const pathsInactive = svgEl('g', { class: 'hd-paths hd-paths-inactive' });
  const pathsActive = svgEl('g', { class: 'hd-paths hd-paths-active' });
  const channelOf = gate => (NE.CHANNELS || []).filter(c => c.gates.includes(gate));
  for (const [gateStr, d] of Object.entries(NE.GATE_PATHS)) {
    const gate = Number(gateStr);
    const isActive = active.has(gate);
    const inDefinedChannel = channelOf(gate).some(c => definedChannels.has(c.gates.join('-')));
    const path = svgEl('path', {
      d,
      fill: gateFill(gate),
      opacity: isActive ? '1' : '0.35',
      'data-gate': gate,
      class: `hd-gate-path${isActive ? ' active' : ''}${inDefinedChannel ? ' channel' : ''}`
    });
    if (isActive) {
      // Hanging gates (active but not part of a defined channel) get a subtle outline
      // so defined channels read as the solid structure of the graph.
      if (!inDefinedChannel) path.setAttribute('opacity', '0.85');
      const t = svgEl('title', { text: gateTitle(gate, NE, personality, design) });
      path.appendChild(t);
      if (options.onGateClick) path.addEventListener('click', () => options.onGateClick(gate));
    }
    (isActive ? pathsActive : pathsInactive).appendChild(path);
  }
  svg.appendChild(pathsInactive);
  svg.appendChild(pathsActive);

  // --- centres ---------------------------------------------------------
  const centersGroup = svgEl('g', { class: 'hd-centers' });
  for (const shapeKey of CENTER_ORDER) {
    const shape = NE.CENTER_SHAPES[shapeKey];
    const key = SHAPE_TO_CENTER[shapeKey];
    if (!shape || !key) continue;
    const isDefined = defined.has(key);
    const path = svgEl('path', {
      d: shape.path,
      fill: isDefined ? HD_CENTER_COLORS[key] : colors.undefinedCenter,
      stroke: isDefined ? '#1b1f24' : colors.centerStroke,
      'stroke-width': '2.5',
      'data-center': key,
      class: `hd-center ${isDefined ? 'defined' : 'undefined'}`
    });
    path.appendChild(svgEl('title', { text: `${HD_CENTER_NAMES[key] || key} — ${isDefined ? 'defined' : 'undefined'}` }));
    if (options.onCenterClick) {
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', 'button');
      path.addEventListener('click', () => options.onCenterClick(key));
      path.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); options.onCenterClick(key); } });
    }
    centersGroup.appendChild(path);
  }
  svg.appendChild(centersGroup);

  // --- gate circles + numbers -------------------------------------------
  const gatesGroup = svgEl('g', { class: 'hd-gates' });
  for (const [gateStr, c] of Object.entries(NE.GATE_CIRCLE_POSITIONS)) {
    const gate = Number(gateStr);
    const isActive = active.has(gate);
    const g = svgEl('g', { class: `hd-gate${isActive ? ' active' : ''}`, 'data-gate': gate });
    g.appendChild(svgEl('circle', {
      cx: c.cx, cy: c.cy, r: c.r || 12.3,
      fill: isActive ? gateFill(gate) : '#ffffff',
      'fill-opacity': isActive ? '1' : '0.9',
      stroke: isActive ? '#ffffff' : colors.centerStroke,
      'stroke-width': isActive ? '1.5' : '1'
    }));
    g.appendChild(svgEl('text', {
      x: c.cx, y: c.cy + 4,
      'text-anchor': 'middle',
      'font-size': '11',
      'font-weight': isActive ? '700' : '500',
      'font-family': 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      fill: isActive ? '#ffffff' : '#30363D',
      'pointer-events': 'none',
      text: String(gate)
    }));
    g.appendChild(svgEl('title', { text: gateTitle(gate, NE, personality, design) }));
    if (options.onGateClick) {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => options.onGateClick(gate));
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); options.onGateClick(gate); } });
    }
    gatesGroup.appendChild(g);
  }
  svg.appendChild(gatesGroup);

  root.appendChild(svg);

  if (options.showLegend !== false) {
    const legend = document.createElement('div');
    legend.className = 'hd-legend';
    legend.innerHTML = `
      <span><i class="hd-swatch" style="background:${colors.personality}"></i> Personality (conscious)</span>
      <span><i class="hd-swatch" style="background:${colors.design}"></i> Design (unconscious)</span>
      <span><i class="hd-swatch hd-swatch-both"></i> Both</span>
      <span><i class="hd-swatch" style="background:#fff;border:1px solid ${colors.centerStroke}"></i> Undefined centre</span>`;
    root.appendChild(legend);
  }

  return svg;
}

function gateTitle(gate, NE, personality, design) {
  const info = NE.GATES?.[gate];
  const bits = [`Gate ${gate}${info?.name ? ' — ' + info.name : ''}`];
  if (personality.has(gate)) bits.push('Personality: ' + personality.get(gate).join(', '));
  if (design.has(gate)) bits.push('Design: ' + design.get(gate).join(', '));
  return bits.join('\n');
}

function describe(hd) {
  const bits = ['Human Design bodygraph.'];
  if (hd?.type?.name) bits.push(`Type: ${hd.type.name}.`);
  if (hd?.profile?.numbers) bits.push(`Profile ${hd.profile.numbers}.`);
  if (hd?.centers?.definedNames?.length) {
    bits.push('Defined centers: ' + hd.centers.definedNames.map(k => HD_CENTER_NAMES[k] || k).join(', ') + '.');
  }
  return bits.join(' ');
}
