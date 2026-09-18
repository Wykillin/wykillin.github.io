// js/hd-detail.js
// Human Design detail panel: gate (with Human Design / I Ching / Gene Keys
// views), centre, channel and incarnation-cross descriptions, using the
// content tables shipped in the NatalEngine bundle.
//
// Public API:
//   createDetailPanel(hd, NE) -> { element, showGate(gate), showCenter(key), showChannel(ch), showCross(), hide() }

import { HD_CENTER_NAMES, HD_PLANET_NAMES, HD_PLANET_GLYPHS, HD_LINE_NAMES } from './config.js';
import { hexagramSvg, trigramsOf, TRIGRAM_NAMES, HEXAGRAM_LINES } from './hexagram.js';

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

const centerLabel = key => HD_CENTER_NAMES[key] || key;

/** All activations of a gate: [{ column: 'personality'|'design', planet, gate, line, ... }] */
export function activationsOf(hd, gate) {
  const out = [];
  for (const column of ['personality', 'design']) {
    for (const [planet, act] of Object.entries(hd?.gates?.[column] || {})) {
      if (act?.gate === gate) out.push({ column, planet, ...act });
    }
  }
  return out;
}

export function createDetailPanel(hd, NE) {
  const panel = el('div', { class: 'hd-detail', hidden: '', role: 'region', 'aria-live': 'polite' });
  const close = el('button', { type: 'button', class: 'hd-detail-close', 'aria-label': 'Close', text: '×' });
  const body = el('div', { class: 'hd-detail-body' });
  panel.appendChild(close);
  panel.appendChild(body);

  const activeGates = new Set(hd?.gates?.all || []);
  const definedChannels = new Map((hd?.channels || []).map(c => [c.gates.join('-'), c]));
  const channelFor = (a, b) => definedChannels.get(`${Math.min(a, b)}-${Math.max(a, b)}`) || null;
  const channelDef = (a, b) => (NE.CHANNELS || []).find(c => c.gates.includes(a) && c.gates.includes(b)) || null;
  let onNavigate = () => {};

  const api = {
    element: panel,
    hide() { panel.hidden = true; onNavigate(null); },
    setNavigateHandler(fn) { onNavigate = fn; },
    showGate(gate) { render(renderGate(gate)); onNavigate({ kind: 'gate', id: gate }); },
    showCenter(key) { render(renderCenter(key)); onNavigate({ kind: 'center', id: key }); },
    showChannel(ch) { render(renderChannel(ch)); onNavigate({ kind: 'channel', id: ch.gates.join('-') }); },
    showCross() { render(renderCross()); onNavigate({ kind: 'cross', id: 'cross' }); }
  };
  close.addEventListener('click', api.hide);

  function render(node) {
    body.innerHTML = '';
    body.appendChild(node);
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const gateLink = (g, text) => el('button', { type: 'button', class: 'hd-link', text: text || `Gate ${g}`, onclick: () => api.showGate(g) });

  // --- Gate -------------------------------------------------------------
  function renderGate(gate) {
    const info = NE.GATES?.[gate] || {};
    const desc = NE.GATE_DESCRIPTIONS?.[gate] || {};
    const hex = NE.HEXAGRAM_DESCRIPTIONS?.[gate] || null;
    const gk = NE.GENE_KEY_DESCRIPTIONS?.[gate] || null;
    const acts = activationsOf(hd, gate);
    const lines = [...new Set(acts.map(a => a.line))].sort();
    const harmonic = desc.harmonic;
    const harmonicActive = harmonic ? activeGates.has(harmonic) : false;
    const chan = harmonic ? channelFor(gate, harmonic) : null;
    const chanDef = harmonic ? channelDef(gate, harmonic) : null;

    const header = [
      el('div', { class: 'rep-kicker', text: `Gate ${gate} — ${info.name || ''}` }),
      el('div', { class: 'hd-detail-activations' }, acts.length
        ? acts.map(a => el('div', { class: a.column }, [
            `${HD_PLANET_GLYPHS[a.planet] || ''} ${a.column === 'design' ? 'Design' : 'Personality'} ${HD_PLANET_NAMES[a.planet] || a.planet} — ${a.gate}.${a.line} — Line ${a.line}, ${HD_LINE_NAMES[a.line] || ''}`
          ]))
        : [el('div', { class: 'hd-muted', text: 'Not activated in this chart — you meet this energy in others.' })]),
      el('div', { class: 'hd-muted hd-small', text: [
        info.center ? `${centerLabel(info.center)} center` : null,
        desc.quarter ? `Quarter of ${desc.quarter}` : null,
        info.iching ? `I Ching: ${info.iching}` : null
      ].filter(Boolean).join(' · ') })
    ];

    const views = {
      hd: () => el('div', {}, [
        el('h4', { class: 'hd-detail-title', text: desc.keynote || info.theme || '' }),
        el('p', { text: desc.description || 'No description available.' }),
        ...lines.map(line => {
          const ld = NE.LINE_DESCRIPTIONS?.[gate]?.[line];
          return ld ? el('div', { class: 'hd-line-box' }, [
            el('strong', { text: `Line ${line} · ${ld.keynote}` }),
            el('span', { text: ld.description })
          ]) : null;
        }),
        harmonic ? el('p', { class: 'hd-muted' }, [
          'Harmonic gate: ', gateLink(harmonic),
          ` (${chan ? `activated — the ${chan.gates.join('-')} Channel of ${chan.name} is defined`
                   : harmonicActive ? 'activated' : 'open — you meet this energy in others'})`
        ]) : null,
        chanDef && !chan ? el('p', { class: 'hd-muted hd-small', text: `Together they would form the ${chanDef.gates.join('-')} Channel of ${chanDef.name}.` }) : null
      ]),
      iching: () => hex ? el('div', {}, [
        el('div', { class: 'hd-hexagram' }, [
          hexagramSvg(gate, { highlight: lines, size: 120, numbers: true }),
          el('div', {}, [
            el('h4', { class: 'hd-detail-title', text: `Hexagram ${gate} — ${hex.name}` }),
            (() => { const t = trigramsOf(gate); return t ? el('div', { class: 'hd-muted hd-small', text: `Upper ${TRIGRAM_NAMES[t.upper]} over lower ${TRIGRAM_NAMES[t.lower]}` }) : null; })(),
            el('div', { class: 'hd-muted hd-small', text: `Lines (bottom to top): ${(HEXAGRAM_LINES[gate] || []).map(l => l ? 'yang' : 'yin').join(' · ')}${lines.length ? ' — activated line' + (lines.length > 1 ? 's' : '') + ' ' + lines.join(', ') + ' in gold' : ''}` })
          ])
        ]),
        el('p', { text: hex.meaning }),
        ...lines.map(line => hex.lines?.[line] ? el('div', { class: 'hd-line-box' }, [
          el('strong', { text: `Line ${line}` }), el('span', { text: hex.lines[line] })
        ]) : null),
        !lines.length ? el('details', { class: 'hd-collapsible' }, [
          el('summary', { text: 'All six lines' }),
          el('div', {}, Object.entries(hex.lines || {}).map(([l, t]) => el('p', {}, [el('strong', { text: `Line ${l}: ` }), t])))
        ]) : null
      ]) : el('p', { class: 'hd-muted', text: 'No I Ching text available.' }),
      genekeys: () => gk ? el('div', {}, [
        el('h4', { class: 'hd-detail-title', text: `Gene Key ${gate}` }),
        el('div', { class: 'hd-spectrum' }, [
          el('span', { class: 'shadow', text: `Shadow: ${gk.shadow}` }),
          el('span', { class: 'gift', text: `Gift: ${gk.gift}` }),
          el('span', { class: 'siddhi', text: `Siddhi: ${gk.siddhi}` })
        ]),
        el('p', { text: gk.description })
      ]) : el('p', { class: 'hd-muted', text: 'No Gene Keys text available.' })
    };
    const content = el('div');
    const tabs = el('div', { class: 'hd-detail-tabs', role: 'tablist' });
    const labels = { hd: 'Human Design', iching: 'I Ching', genekeys: 'Gene Keys' };
    const select = key => {
      for (const b of tabs.children) b.classList.toggle('active', b.dataset.view === key);
      content.innerHTML = '';
      content.appendChild(views[key]());
    };
    for (const key of Object.keys(views)) {
      tabs.appendChild(el('button', { type: 'button', role: 'tab', 'data-view': key, text: labels[key], onclick: () => select(key) }));
    }
    select('hd');
    return el('div', {}, [...header, tabs, content]);
  }

  // --- Incarnation Cross ------------------------------------------------
  function renderCross() {
    const cross = hd?.incarnationCross || {};
    const roles = [
      ['Personality Sun', 'personality', 'sun', 'Conscious purpose — what you are here to radiate'],
      ['Personality Earth', 'personality', 'earth', 'Conscious grounding — how the purpose is anchored'],
      ['Design Sun', 'design', 'sun', "Unconscious drive — the body's theme"],
      ['Design Earth', 'design', 'earth', "Unconscious grounding — the body's foundation"]
    ];
    const cards = roles.map(([label, column, planet, blurb]) => {
      const act = hd?.gates?.[column]?.[planet];
      if (!act) return null;
      const d = NE.GATE_DESCRIPTIONS?.[act.gate] || {};
      const ld = NE.LINE_DESCRIPTIONS?.[act.gate]?.[act.line];
      return el('div', { class: 'hd-cross-gate' }, [
        el('div', { class: `hd-summary-label ${column}`, text: label }),
        gateLink(act.gate, `Gate ${act.gate}.${act.line} — ${NE.GATES?.[act.gate]?.name || ''}`),
        el('div', { class: 'hd-muted hd-small', text: blurb }),
        d.keynote ? el('p', {}, [el('strong', { text: d.keynote + '. ' }), d.description || '']) : null,
        ld ? el('div', { class: 'hd-small hd-muted', text: `Line ${act.line} · ${ld.keynote}` }) : null
      ]);
    });
    const angleText = {
      right: 'A Right Angle cross is a personal destiny: the life is about your own process, and others take part in it as it unfolds.',
      left: 'A Left Angle cross is a transpersonal destiny: the purpose is worked out through encounters with others and is not complete without them.',
      juxtaposition: 'A Juxtaposition cross is a fixed fate: a narrow, specific path that sits between the personal and transpersonal.'
    }[cross.angle] || '';
    return el('div', {}, [
      el('div', { class: 'rep-kicker', text: `Incarnation Cross · ${cross.angleName || ''}` }),
      el('h4', { class: 'hd-detail-title', text: cross.fullName || cross.name || 'Incarnation Cross' }),
      angleText ? el('p', { class: 'hd-muted', text: angleText }) : null,
      el('p', { text: 'The cross is made of the four gates carried by the Sun and Earth in both columns: the Personality pair is what you consciously live out, the Design pair is what your body does regardless. Together they name the theme the whole chart is in service of.' }),
      el('div', { class: 'hd-cross-gates' }, cards),
      cross.gates ? el('p', { class: 'hd-muted hd-small', text: `Gates ${cross.gates.join(' / ')}${cross.gateNames ? ' — ' + cross.gateNames.join(', ') : ''}. Click a gate for its full description, I Ching hexagram and Gene Key.` }) : null
    ]);
  }

  // --- Centre -------------------------------------------------------------
  function renderCenter(key) {
    const c = NE.CENTERS?.[key] || {};
    const defined = (hd?.centers?.definedNames || []).includes(key);
    const open = (hd?.centers?.openNames || []).includes(key);
    const status = defined ? 'defined' : open ? 'open (no activated gates)' : 'undefined';
    const gatesHere = Object.entries(NE.GATES || {}).filter(([, g]) => g.center === key).map(([n]) => Number(n));
    const activeHere = gatesHere.filter(g => activeGates.has(g));
    const meaning = defined ? c.definedMeaning : open ? c.openMeaning : c.undefinedMeaning;
    return el('div', {}, [
      el('div', { class: 'rep-kicker', text: `${centerLabel(key)} center — ${status}` }),
      el('h4', { class: 'hd-detail-title', text: c.theme ? `${c.theme}` : centerLabel(key) }),
      el('div', { class: 'hd-detail-grid' }, [
        ['Biological', c.biological], ['Pressure', c.pressure], ['Motor', c.motor ? 'Yes' : 'No']
      ].filter(([, v]) => v).map(([k, v]) => el('div', { class: 'hd-summary-item' }, [
        el('div', { class: 'hd-summary-label', text: k }), el('div', { text: v })
      ]))),
      meaning ? el('p', { text: meaning }) : null,
      c.notSelfTheme ? el('div', { class: 'hd-line-box' }, [
        el('strong', { text: `Not-self theme: ${c.notSelfTheme}` }),
        el('span', { text: c.notSelfQuestion || '' })
      ]) : null,
      el('p', { class: 'hd-muted hd-small', text: `Activated gates here: ${activeHere.length ? '' : 'none'}` }),
      el('div', { class: 'hd-gate-list' }, activeHere.map(g =>
        el('button', { type: 'button', class: 'hd-chip hd-link', text: `Gate ${g} ${NE.GATES?.[g]?.name || ''}`, onclick: () => api.showGate(g) }))),
      el('details', { class: 'hd-collapsible' }, [
        el('summary', { text: 'All gates of this center' }),
        el('div', { class: 'hd-gate-list' }, gatesHere.map(g => gateLink(g, `${g} ${NE.GATES?.[g]?.name || ''}`)))
      ])
    ]);
  }

  // --- Channel ----------------------------------------------------------
  function renderChannel(ch) {
    const key = ch.gates.join('-');
    const d = NE.CHANNEL_DESCRIPTIONS?.[key] || {};
    const defined = definedChannels.has(key);
    return el('div', {}, [
      el('div', { class: 'rep-kicker', text: `Channel ${key} — ${ch.name}${defined ? '' : ' (not defined)'}` }),
      el('h4', { class: 'hd-detail-title', text: `The Channel of ${ch.name}` }),
      el('div', { class: 'hd-muted', text: [
        (ch.centers || []).map(centerLabel).join(' ↔ '),
        ch.circuit ? `${ch.circuit[0].toUpperCase() + ch.circuit.slice(1)} circuit` : null,
        ch.subcircuit ? ch.subcircuit[0].toUpperCase() + ch.subcircuit.slice(1) : null,
        d.energyType ? `${d.energyType} energy` : null,
        ch.theme ? `Theme: ${ch.theme}` : null
      ].filter(Boolean).join(' · ') }),
      d.description ? el('p', { text: d.description }) : null,
      d.whenDefined ? el('div', { class: 'hd-line-box' }, [el('strong', { text: defined ? 'With this channel defined' : 'When defined' }), el('span', { text: d.whenDefined })]) : null,
      el('p', { class: 'hd-muted' }, ['Gates: ', gateLink(ch.gates[0], `Gate ${ch.gates[0]} ${NE.GATES?.[ch.gates[0]]?.name || ''}`), ' and ', gateLink(ch.gates[1], `Gate ${ch.gates[1]} ${NE.GATES?.[ch.gates[1]]?.name || ''}`)])
    ]);
  }

  return api;
}
