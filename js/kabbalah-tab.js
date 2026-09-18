// js/kabbalah-tab.js
// Kabbalah tab: draws the Tree of Life as an SVG map of the natal chart,
// with selectable sefirot and paths, a detail panel, Tarot birth cards and
// the numerology mapping.
//
// Public API:
//   renderKabbalahTab(container, { birth, chartData, aspects, patterns, profile, tree, hebrew })

import { ASPECT_COLORS, PLANET_GLYPHS, DISPLAY_NAMES, SIGN_GLYPHS } from './config.js';
import { sefirahActivity, pathActivity, aspectLinks, birthCards, numerologyOnTree, elementCounts } from './kabbalah.js';
import { hebrewGlyph } from './hebrew.js';

const NS = 'http://www.w3.org/2000/svg';
const POS = {
  kether: [200, 48], chokmah: [322, 128], binah: [78, 128], daat: [200, 208],
  chesed: [322, 268], geburah: [78, 268], tiphareth: [200, 348],
  netzach: [322, 448], hod: [78, 448], yesod: [200, 528], malkuth: [200, 612]
};
const R = 27;

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
function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'text') n.textContent = v; else n.setAttribute(k, v); }
  return n;
}
const dn = n => DISPLAY_NAMES[n] || n;
const ordinal = n => n + (([11, 12, 13].includes(n % 100)) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));

// ---------------------------------------------------------------------------
// Tree SVG
// ---------------------------------------------------------------------------

function drawTree(state, onSelect) {
  const { tree, activity, paths, links, numMap, cards, showLinks } = state;
  const svg = svgEl('svg', { viewBox: '0 0 400 660', class: 'tree-svg', role: 'img', 'aria-label': 'Tree of Life with the natal chart mapped onto it' });
  const defs = svgEl('defs');
  const glow = svgEl('filter', { id: 'tree-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  glow.appendChild(svgEl('feGaussianBlur', { stdDeviation: '4', result: 'b' }));
  const merge = svgEl('feMerge');
  merge.appendChild(svgEl('feMergeNode', { in: 'b' })); merge.appendChild(svgEl('feMergeNode', { in: 'SourceGraphic' }));
  glow.appendChild(merge); defs.appendChild(glow); svg.appendChild(defs);

  // Pillars (faint)
  for (const x of [78, 200, 322]) svg.appendChild(svgEl('line', { x1: x, y1: 30, x2: x, y2: 630, stroke: '#1F2630', 'stroke-width': 1 }));

  // Paths
  const cardPaths = new Set(cards.cards.map(c => Object.entries(tree.paths).find(([, p]) => p.tarot === c)?.[0]).filter(Boolean));
  const gPaths = svgEl('g', { class: 'tree-paths' });
  for (const [no, p] of Object.entries(tree.paths)) {
    const [x1, y1] = POS[p.from], [x2, y2] = POS[p.to];
    const st = paths[no];
    const linked = st.aspect;
    const line = svgEl('line', {
      x1, y1, x2, y2,
      stroke: linked ? (ASPECT_COLORS[linked.type] || '#C9A84C') : st.active ? '#C9A84C' : '#3A424D',
      'stroke-width': linked ? 4 : st.active ? 3 : 1.5,
      'stroke-opacity': st.active || linked ? 0.95 : 0.6,
      'stroke-dasharray': linked && linked.orb > 3 ? '7 5' : null,
      class: `tree-path${st.active ? ' active' : ''}${cardPaths.has(no) ? ' card' : ''}`,
      'data-path': no, tabindex: '0', role: 'button'
    });
    if (!line.getAttribute('stroke-dasharray')) line.removeAttribute('stroke-dasharray');
    line.appendChild(svgEl('title', { text: `Path ${no} · ${tree.sefirot[p.from].name} – ${tree.sefirot[p.to].name} · ${p.attribution}` }));
    line.addEventListener('click', () => onSelect({ kind: 'path', id: no }));
    line.addEventListener('keydown', e => { if (e.key === 'Enter') onSelect({ kind: 'path', id: no }); });
    gPaths.appendChild(line);
    // Letter label at the midpoint, offset from the line
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const label = svgEl('text', {
      x: mx, y: my + 4, 'text-anchor': 'middle', 'font-size': '11', 'pointer-events': 'none',
      fill: st.active || linked ? '#E6EDF3' : '#8B949E', 'font-family': "'Noto Sans Hebrew', system-ui, sans-serif"
    });
    label.textContent = state.hebrew?.letters?.[p.letter]?.block || '';
    const bg = svgEl('circle', { cx: mx, cy: my, r: 9, fill: '#0D1117', 'pointer-events': 'none', stroke: cardPaths.has(no) ? '#C9A84C' : 'none', 'stroke-width': 1.5 });
    gPaths.appendChild(bg); gPaths.appendChild(label);
  }
  svg.appendChild(gPaths);

  // Aspect links between sefirot not joined by a path (curved, dashed)
  if (showLinks) {
    const gLinks = svgEl('g', { class: 'tree-links' });
    for (const l of links) {
      if (l.path) continue;
      const [x1, y1] = POS[l.from], [x2, y2] = POS[l.to];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const off = 40;
      const cx = mx - dy / len * off, cy = my + dx / len * off;
      const path = svgEl('path', {
        d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`, fill: 'none',
        stroke: ASPECT_COLORS[l.aspect.type] || '#999', 'stroke-width': 1.6, 'stroke-opacity': 0.7,
        'stroke-dasharray': '4 4', class: 'tree-link'
      });
      path.appendChild(svgEl('title', { text: `${dn(l.aspect.body1)} ${l.aspect.label.toLowerCase()} ${dn(l.aspect.body2)}` }));
      gLinks.appendChild(path);
    }
    svg.appendChild(gLinks);
  }

  // Sefirot
  const gSef = svgEl('g', { class: 'tree-sefirot' });
  for (const [key, s] of Object.entries(tree.sefirot)) {
    const [cx, cy] = POS[key];
    const a = activity[key];
    const g = svgEl('g', { class: `tree-sefirah${a.norm > 0.66 ? ' strong' : ''}`, 'data-sefirah': key, tabindex: '0', role: 'button' });
    const isDaat = key === 'daat';
    g.appendChild(svgEl('circle', {
      cx, cy, r: R, fill: s.color, 'fill-opacity': (0.25 + 0.75 * a.norm).toFixed(2),
      stroke: a.norm > 0.66 ? '#C9A84C' : '#8B949E', 'stroke-width': a.norm > 0.66 ? 2.5 : 1.2,
      'stroke-dasharray': isDaat ? '4 3' : null, filter: a.norm > 0.66 ? 'url(#tree-glow)' : null
    }));
    for (const c of g.querySelectorAll('circle')) { if (!c.getAttribute('stroke-dasharray')) c.removeAttribute('stroke-dasharray'); if (!c.getAttribute('filter')) c.removeAttribute('filter'); }
    if (numMap.lifePath === key) g.appendChild(svgEl('circle', { cx, cy, r: R + 6, fill: 'none', stroke: '#C9A84C', 'stroke-width': 2, 'stroke-dasharray': '3 3' }));
    if (numMap.expression === key) g.appendChild(svgEl('circle', { cx: cx + R - 4, cy: cy - R + 4, r: 5, fill: '#C9A84C' }));
    const dark = ['kether', 'tiphareth'].includes(key);
    g.appendChild(svgEl('text', { x: cx, y: cy - 3, 'text-anchor': 'middle', 'font-size': '11', 'font-weight': '700', fill: dark && a.norm > 0.4 ? '#0D1117' : '#E6EDF3', 'pointer-events': 'none', 'font-family': 'system-ui, sans-serif', text: s.name }));
    const planetLabel = (s.planets || []).map(p => PLANET_GLYPHS[p] || p).join(' ');
    g.appendChild(svgEl('text', { x: cx, y: cy + 11, 'text-anchor': 'middle', 'font-size': '11', fill: dark && a.norm > 0.4 ? '#0D1117' : '#E6EDF3', 'pointer-events': 'none', text: planetLabel }));
    g.appendChild(svgEl('title', { text: `${s.name} (${s.title}) — ${s.planets?.join(', ') || ''} · strength ${a.score}` }));
    g.addEventListener('click', () => onSelect({ kind: 'sefirah', id: key }));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect({ kind: 'sefirah', id: key }); } });
    gSef.appendChild(g);
  }
  svg.appendChild(gSef);
  return svg;
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function factsGrid(pairs) {
  return el('div', { class: 'hd-detail-grid' }, pairs.filter(([, v]) => v).map(([k, v]) => el('div', { class: 'hd-summary-item' }, [
    el('div', { class: 'hd-summary-label', text: k }), el('div', { class: 'tree-fact', text: v })
  ])));
}

function placementText(p) {
  if (!p) return '—';
  return `${SIGN_GLYPHS[p.sign] || ''} ${p.sign} ${Math.floor(p.degreeInSign)}°${p.house ? `, ${ordinal(p.house)} house` : ''}${p.retrograde ? ' ℞' : ''}`;
}

function renderSefirah(key, state, onSelect) {
  const { tree, activity, paths } = state;
  const s = tree.sefirot[key];
  const a = activity[key];
  const connected = Object.entries(tree.paths).filter(([, p]) => p.from === key || p.to === key);
  return el('div', {}, [
    el('div', { class: 'rep-kicker', text: `Sefirah ${s.number || '(hidden)'} · ${s.pillar} pillar · ${s.world}` }),
    el('h4', { class: 'hd-detail-title', text: `${s.name} (${s.title})` }),
    el('p', { text: s.meaning }),
    factsGrid([
      ['Astrological association', s.astrological],
      ['Divine name', s.divineName],
      ['Archangel', s.archangel],
      ['Angelic order', s.order],
      ['Spiritual experience', s.experience],
      ['Virtue', s.virtue],
      ['Vice', s.vice]
    ]),
    el('div', { class: 'hd-line-box' }, [el('strong', { text: 'Astrological meaning' }), el('span', { text: s.astrologicalMeaning })]),
    el('h4', { text: 'In this chart' }),
    el('div', { class: 'hd-detail-grid' }, [
      el('div', { class: 'hd-summary-item' }, [el('div', { class: 'hd-summary-label', text: a.planet ? dn(a.planet) : 'Planet' }), el('div', { text: placementText(a.placement) })]),
      el('div', { class: 'hd-summary-item' }, [el('div', { class: 'hd-summary-label', text: 'Strength' }), el('div', { text: `${a.score} — ${a.reasons.join('; ') || 'quiet'}` })])
    ]),
    a.aspects.length ? el('div', {}, [
      el('div', { class: 'hd-summary-label', text: 'Aspects' }),
      el('ul', { class: 'rep-aspect-list' }, a.aspects.map(x => el('li', {}, [
        el('span', { class: `glyph asp-${x.type}`, text: x.glyph }),
        ` ${dn(x.body1)} ${x.label.toLowerCase()} ${dn(x.body2)} `,
        el('span', { class: 'rep-muted', text: `(orb ${x.orb.toFixed(1)}°)` })
      ])))
    ]) : null,
    a.patterns.length ? el('p', { class: 'rep-muted' }, ['Patterns: ', a.patterns.map(p => p.name).join(', ')]) : null,
    el('div', { class: 'hd-summary-label', text: 'Paths from here' }),
    el('div', { class: 'hd-gate-list' }, connected.map(([no, p]) => {
      const other = p.from === key ? p.to : p.from;
      const st = paths[no];
      return el('button', { type: 'button', class: `hd-chip hd-link${st.active || st.aspect ? '' : ' hd-chip-muted'}`,
        text: `${no} · ${tree.sefirot[other].name} · ${p.attribution}${st.aspect ? ' ' + st.aspect.glyph : ''}`,
        onclick: () => onSelect({ kind: 'path', id: no }) });
    }))
  ]);
}

function renderPath(no, state, onSelect) {
  const { tree, paths, hebrew } = state;
  const p = tree.paths[no];
  const st = paths[no];
  const card = tree.tarot[String(p.tarot)];
  const L = hebrew?.letters?.[p.letter];
  return el('div', {}, [
    el('div', { class: 'rep-kicker', text: `Path ${no} · ${tree.sefirot[p.from].name} – ${tree.sefirot[p.to].name}` }),
    el('div', { class: 'tree-path-head' }, [
      hebrew ? hebrewGlyph(p.letter, hebrew) : null,
      el('h4', { class: 'hd-detail-title', text: `${L?.name || p.letter} · ${p.attribution}${card ? ' · ' + card.name : ''}` })
    ]),
    factsGrid([
      ['Attribution', `${p.attribution} (${p.kind})`],
      ['Tarot key', card ? `${p.tarot} — ${card.name}` : null],
      ['Letter meaning', L?.meaning || null],
      ['Status', st.active ? 'Lit' : st.aspect ? 'Linked by aspect' : 'Quiet']
    ]),
    st.reasons.length ? el('p', { class: 'rep-muted', text: st.reasons.join(' · ') }) : el('p', { class: 'rep-muted', text: 'Nothing in the chart occupies this path.' }),
    card ? el('div', { class: 'hd-line-box' }, [el('strong', { text: `${card.name}: ${card.keywords.join(', ')}` }), el('span', { text: card.purpose })]) : null,
    L ? el('p', { class: 'rep-muted num-small', text: 'Click the Hebrew letter for its full esoteric entry.' }) : null,
    el('div', { class: 'hd-gate-list' }, [p.from, p.to].map(k => el('button', { type: 'button', class: 'hd-chip hd-link', text: `${tree.sefirot[k].name} (${tree.sefirot[k].title})`, onclick: () => onSelect({ kind: 'sefirah', id: k }) })))
  ]);
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function sectionPurpose(state) {
  const { tree, activity, chartData, numMap, profile } = state;
  const ranked = Object.values(activity).filter(a => a.planet).sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, 3);
  const find = n => chartData.find(p => p.name === n);
  const keyPoints = [
    ['Sun · Tiphareth', find('Sun'), 'the conscious purpose and the centre the life organises around'],
    ['Moon · Yesod', find('Moon'), 'the inherited foundation, what the soul brings from the past'],
    ['Ascendant · Malkuth', find('Ascendant'), 'the vehicle of incarnation, the body and circumstances taken on'],
    ['North Node', find('NNode'), 'the direction of growth the soul is moving toward'],
    ['Saturn · Binah', find('Saturn'), 'the form-giving limitation through which the work matures'],
    ['Neptune · Kether', find('Neptune'), 'where the boundary to the source is thinnest']
  ].filter(([, p]) => p);
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Purpose Keys' }),
    el('div', { class: 'hd-summary' }, [
      el('div', { class: 'hd-summary-item' }, [
        el('div', { class: 'hd-summary-label', text: 'Strongest sefirot' }),
        el('div', { class: 'hd-summary-value', text: top.map(a => tree.sefirot[a.key].name).join(' · ') }),
        el('div', { class: 'rep-muted num-small', text: top.map(a => `${tree.sefirot[a.key].name} ${a.score}`).join(', ') })
      ]),
      numMap.lifePath ? el('div', { class: 'hd-summary-item' }, [
        el('div', { class: 'hd-summary-label', text: 'Life Path on the Tree' }),
        el('div', { class: 'hd-summary-value', text: `${profile.core.lifePath.value} → ${tree.sefirot[numMap.lifePath].name}` }),
        el('div', { class: 'rep-muted num-small', text: tree.sefirot[numMap.lifePath].title })
      ]) : null,
      numMap.expression ? el('div', { class: 'hd-summary-item' }, [
        el('div', { class: 'hd-summary-label', text: 'Expression on the Tree' }),
        el('div', { class: 'hd-summary-value', text: `${profile.core.expression.value} → ${tree.sefirot[numMap.expression].name}` }),
        el('div', { class: 'rep-muted num-small', text: tree.sefirot[numMap.expression].title })
      ]) : null
    ]),
    el('div', { class: 'rep-scroll', style: 'margin-top:12px' }, (() => {
      const t = el('table', { class: 'rep-table' });
      t.appendChild(el('thead', {}, el('tr', {}, ['Key', 'Placement', 'Reading'].map(h => el('th', { text: h })))));
      const tb = el('tbody');
      for (const [label, p, reading] of keyPoints) tb.appendChild(el('tr', {}, [el('td', { text: label }), el('td', { text: placementText(p) }), el('td', { class: 'tree-wrap', text: reading })]));
      t.appendChild(tb);
      return t;
    })())
  ]);
}

function sectionBirthCards(state, onSelect) {
  const { tree, cards, birth } = state;
  const items = cards.cards.map((n, i) => {
    const card = tree.tarot[String(n)];
    const pathNo = Object.entries(tree.paths).find(([, p]) => p.tarot === n)?.[0];
    const role = cards.cards.length === 1 ? 'Personality & Soul' : i === 0 ? 'Personality' : i === cards.cards.length - 1 ? 'Soul' : 'Bridge';
    return el('div', { class: 'num-card' }, [
      el('div', { class: 'hd-summary-label', text: role },),
      el('div', { class: 'num-value tree-card-no', text: String(n) }),
      el('div', { class: 'hd-summary-value', text: card?.name || `Key ${n}` }),
      card ? el('div', { class: 'rep-keywords' }, card.keywords.map(k => el('span', { class: 'rep-chip', text: k }))) : null,
      card ? el('p', { class: 'num-small', text: card.purpose }) : null,
      pathNo ? el('button', { type: 'button', class: 'hd-link', text: `Path ${pathNo} · ${tree.paths[pathNo].attribution}`, onclick: () => onSelect({ kind: 'path', id: pathNo }) }) : null
    ]);
  });
  return el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Tarot Birth Cards' }),
    el('p', { class: 'rep-muted num-small', text: `${birth.month} + ${birth.day} + ${birth.year} = ${cards.steps.join(' → ')}. ${tree.birthCards}` }),
    el('div', { class: 'num-core' }, items)
  ]);
}

function sectionLegend(state) {
  return el('div', { class: 'rep-legend tree-legend' }, [
    el('span', { class: 'rep-legend-item' }, [el('i', { class: 'rep-line-swatch', style: 'background:#C9A84C' }), ' lit path / strong sefirah']),
    el('span', { class: 'rep-legend-item' }, [el('i', { class: 'rep-line-swatch', style: 'background:#3A424D' }), ' quiet path']),
    ...Object.entries(ASPECT_COLORS).map(([k, c]) => el('span', { class: 'rep-legend-item' }, [el('i', { class: 'rep-line-swatch', style: `background:${c}` }), ` ${k} link`])),
    el('span', { class: 'rep-legend-item rep-muted', text: 'dashed ring = Life Path · dot = Expression · gold letter ring = birth card' })
  ]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function renderKabbalahTab(container, { birth, chartData, aspects, patterns, profile, tree, hebrew }) {
  const root = typeof container === 'string' ? document.getElementById(container) : container;
  if (!root) throw new Error('renderKabbalahTab: container not found');
  root.innerHTML = '';
  root.classList.add('tree-panel');

  const activity = sefirahActivity(tree, chartData, aspects, patterns);
  const elements = elementCounts(chartData);
  const paths = pathActivity(tree, chartData, aspects, activity, elements);
  const links = aspectLinks(tree, aspects);
  const cards = birthCards(birth.year, birth.month, birth.day);
  const numMap = numerologyOnTree(profile);
  const state = { tree, hebrew, activity, paths, links, cards, numMap, chartData, aspects, profile, birth, showLinks: true };

  root.appendChild(el('header', { class: 'rep-header' }, [
    el('div', { class: 'rep-kicker', text: 'Kabbalah · Tree of Life' }),
    birth.name ? el('h2', { text: birth.name }) : null,
    el('div', { class: 'rep-meta' }, [
      el('span', { text: `Born ${birth.year}-${String(birth.month).padStart(2, '0')}-${String(birth.day).padStart(2, '0')}` }),
      birth.city ? el('span', { text: birth.city }) : null,
      elements.dominant ? el('span', { class: 'rep-muted', text: `Dominant element: ${elements.dominant}` }) : null
    ])
  ]));

  const detail = el('div', { class: 'hd-detail', hidden: '' });
  const closeBtn = el('button', { type: 'button', class: 'hd-detail-close', 'aria-label': 'Close', text: '×', onclick: () => { detail.hidden = true; clearSelection(); } });
  const detailBody = el('div');
  detail.appendChild(closeBtn); detail.appendChild(detailBody);

  const treeBox = el('div', { class: 'tree-box' });
  let svg = null;
  const clearSelection = () => svg?.querySelectorAll('.selected').forEach(n => n.classList.remove('selected'));
  const onSelect = sel => {
    detailBody.innerHTML = '';
    detailBody.appendChild(sel.kind === 'sefirah' ? renderSefirah(sel.id, state, onSelect) : renderPath(sel.id, state, onSelect));
    detail.hidden = false;
    clearSelection();
    const target = sel.kind === 'sefirah' ? svg.querySelector(`[data-sefirah="${sel.id}"]`) : svg.querySelector(`[data-path="${sel.id}"]`);
    target?.classList.add('selected');
    detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const redraw = () => { treeBox.innerHTML = ''; svg = drawTree(state, onSelect); treeBox.appendChild(svg); };
  redraw();

  const toggle = el('label', { class: 'rep-setting' }, [
    (() => { const i = el('input', { type: 'checkbox' }); i.checked = true; i.addEventListener('change', () => { state.showLinks = i.checked; redraw(); }); return i; })(),
    el('span', { text: 'Show aspect links between sefirot' })
  ]);

  root.appendChild(el('section', { class: 'rep-section' }, [
    el('h3', { text: 'Tree of Life' }),
    el('p', { class: 'rep-muted num-small', text: tree.intro }),
    el('div', { class: 'tree-controls' }, [toggle, el('span', { class: 'rep-muted num-small', text: 'Click a sefirah or a path.' })]),
    el('div', { class: 'tree-layout' }, [treeBox, detail]),
    sectionLegend(state),
    el('details', { class: 'rep-collapsible' }, [
      el('summary', {}, el('span', { class: 'rep-coll-title', text: 'How the map is lit' })),
      el('div', { class: 'rep-coll-body' }, [el('p', { text: tree.activity }), el('p', { text: tree.numerologyMap })])
    ])
  ]));

  root.appendChild(sectionPurpose(state));
  root.appendChild(sectionBirthCards(state, onSelect));

  // Sefirot table for the record / PDF
  const t = el('table', { class: 'rep-table' });
  t.appendChild(el('thead', {}, el('tr', {}, ['Sefirah', 'Planet', 'Placement', 'Strength', 'Why'].map(h => el('th', { text: h })))));
  const tb = el('tbody');
  for (const [key, s] of Object.entries(tree.sefirot)) {
    const a = activity[key];
    tb.appendChild(el('tr', {}, [el('td', { text: `${s.name} (${s.title})` }), el('td', { text: a.planet ? dn(a.planet) : '' }), el('td', { text: placementText(a.placement) }), el('td', { text: String(a.score) }), el('td', { class: 'tree-wrap', text: a.reasons.join('; ') })]));
  }
  t.appendChild(tb);
  root.appendChild(el('section', { class: 'rep-section' }, [el('h3', { text: 'Sefirot in this chart' }), el('div', { class: 'rep-scroll' }, t)]));
  return root;
}
