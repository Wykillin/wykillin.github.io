// js/hexagram.js
// I Ching hexagram drawing. King Wen hexagram N corresponds to Human Design
// gate N. Lines are stored bottom-to-top (line 1 first): 1 = yang (solid),
// 0 = yin (broken).
//
// Public API:
//   HEXAGRAM_LINES[n] -> [l1..l6]
//   hexagramSvg(n, { highlight: [lines], size }) -> SVGElement

// Trigrams, bottom line first.
const T = {
  qian: [1, 1, 1], kun: [0, 0, 0], zhen: [1, 0, 0], kan: [0, 1, 0],
  gen: [0, 0, 1], xun: [0, 1, 1], li: [1, 0, 1], dui: [1, 1, 0]
};

// King Wen sequence as [lower trigram, upper trigram].
const KING_WEN = [
  null,
  ['qian', 'qian'], ['kun', 'kun'], ['zhen', 'kan'], ['kan', 'gen'], ['qian', 'kan'], ['kan', 'qian'], ['kan', 'kun'], ['kun', 'kan'],
  ['qian', 'xun'], ['dui', 'qian'], ['qian', 'kun'], ['kun', 'qian'], ['li', 'qian'], ['qian', 'li'], ['gen', 'kun'], ['kun', 'zhen'],
  ['zhen', 'dui'], ['xun', 'gen'], ['dui', 'kun'], ['kun', 'xun'], ['zhen', 'li'], ['li', 'gen'], ['kun', 'gen'], ['zhen', 'kun'],
  ['zhen', 'qian'], ['qian', 'gen'], ['zhen', 'gen'], ['xun', 'dui'], ['kan', 'kan'], ['li', 'li'], ['gen', 'dui'], ['xun', 'zhen'],
  ['gen', 'qian'], ['qian', 'zhen'], ['kun', 'li'], ['li', 'kun'], ['li', 'xun'], ['dui', 'li'], ['gen', 'kan'], ['kan', 'zhen'],
  ['dui', 'gen'], ['zhen', 'xun'], ['qian', 'dui'], ['xun', 'qian'], ['kun', 'dui'], ['xun', 'kun'], ['kan', 'dui'], ['xun', 'kan'],
  ['li', 'dui'], ['xun', 'li'], ['zhen', 'zhen'], ['gen', 'gen'], ['gen', 'xun'], ['dui', 'zhen'], ['li', 'zhen'], ['gen', 'li'],
  ['xun', 'xun'], ['dui', 'dui'], ['kan', 'xun'], ['dui', 'kan'], ['dui', 'xun'], ['gen', 'zhen'], ['li', 'kan'], ['kan', 'li']
];

export const TRIGRAM_NAMES = {
  qian: 'Qian ☰ Heaven', kun: 'Kun ☷ Earth', zhen: 'Zhen ☳ Thunder', kan: 'Kan ☵ Water',
  gen: 'Gen ☶ Mountain', xun: 'Xun ☴ Wind', li: 'Li ☲ Fire', dui: 'Dui ☱ Lake'
};

/** Lines of hexagram n, bottom to top. */
export const HEXAGRAM_LINES = KING_WEN.map(pair => pair ? [...T[pair[0]], ...T[pair[1]]] : null);

/** Lower/upper trigram keys of hexagram n. */
export function trigramsOf(n) {
  const pair = KING_WEN[n];
  return pair ? { lower: pair[0], upper: pair[1] } : null;
}

/**
 * Draw hexagram n as an SVG. Highlighted lines (1-6) are drawn in gold.
 * @param {number} n
 * @param {object} [opts]
 * @param {number[]} [opts.highlight]  line numbers to emphasise
 * @param {number} [opts.size]         width in px (height follows)
 * @param {string} [opts.color]        line colour
 * @param {string} [opts.highlightColor]
 * @param {boolean} [opts.numbers]     draw line numbers 1-6 at the left
 */
export function hexagramSvg(n, opts = {}) {
  const lines = HEXAGRAM_LINES[n];
  if (!lines) return null;
  const size = opts.size || 96;
  const color = opts.color || '#E6EDF3';
  const hi = opts.highlightColor || '#C9A84C';
  const highlight = new Set(opts.highlight || []);
  const NS = 'http://www.w3.org/2000/svg';
  const W = 100, H = 100, barH = 9, gapX = 14, left = opts.numbers ? 22 : 6, right = 94, step = 15.5, top = 8;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', 'hexagram-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Hexagram ${n}: ${lines.map(l => l ? 'yang' : 'yin').join(', ')} from the bottom`);
  const mid = (left + right) / 2;
  lines.forEach((yang, i) => {
    const lineNo = i + 1;
    const y = top + (5 - i) * step;
    const fill = highlight.has(lineNo) ? hi : color;
    const rect = (x1, x2) => {
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x1); r.setAttribute('y', y); r.setAttribute('width', x2 - x1); r.setAttribute('height', barH);
      r.setAttribute('rx', 1.5); r.setAttribute('fill', fill);
      if (highlight.has(lineNo)) { r.setAttribute('stroke', hi); r.setAttribute('stroke-width', '1'); }
      svg.appendChild(r);
    };
    if (yang) rect(left, right);
    else { rect(left, mid - gapX / 2); rect(mid + gapX / 2, right); }
    if (opts.numbers) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', 4); t.setAttribute('y', y + barH - 1);
      t.setAttribute('font-size', '9'); t.setAttribute('fill', highlight.has(lineNo) ? hi : '#8B949E');
      t.setAttribute('font-family', 'system-ui, sans-serif');
      t.textContent = String(lineNo);
      svg.appendChild(t);
    }
  });
  return svg;
}

/** Unicode glyph for hexagram n (U+4DC0 is hexagram 1). */
export function hexagramGlyph(n) {
  return n >= 1 && n <= 64 ? String.fromCodePoint(0x4DC0 + n - 1) : '';
}
