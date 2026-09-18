// js/hebrew.js
// Hebrew letter reference: block + cursive glyphs and a detail modal with the
// esoteric material from data/hebrew-letters.json.
//
// Public API:
//   loadHebrewLetters()                 -> Promise<data>
//   hebrewGlyph(key, data, opts?)       -> clickable element showing block + cursive forms
//   showHebrewLetter(key, data)         -> opens the modal
//
// Cursive Hebrew has no separate Unicode code points; the cursive form is the
// same character rendered in a handwriting font (Gveret Levin AlefAlefAlef,
// loaded from Google Fonts in chart.html). If the font is unavailable the
// browser falls back to the block form.

import { HEBREW_LETTERS_FILE } from './config.js';

let cache = null;
export async function loadHebrewLetters(base = '') {
  if (cache) return cache;
  const res = await fetch(base + HEBREW_LETTERS_FILE, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load ${HEBREW_LETTERS_FILE}: ${res.status}`);
  cache = await res.json();
  return cache;
}

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

/** Block + cursive glyph pair for a letter key ('chet', 'bet', ...). Clickable. */
export function hebrewGlyph(key, data, opts = {}) {
  const L = data?.letters?.[key];
  if (!L) return el('span', { class: 'heb-glyph-missing', text: key });
  const btn = el('button', {
    type: 'button', class: 'heb-glyph', title: `${L.name} — click for details`,
    'aria-label': `${L.name}, Hebrew letter, details`,
    onclick: () => showHebrewLetter(key, data)
  }, [
    el('span', { class: 'heb-block', text: L.block + (L.final && opts.showFinal ? ' ' + L.final : '') }),
    el('span', { class: 'heb-cursive', text: L.block }),
    opts.showName !== false ? el('span', { class: 'heb-name', text: L.name }) : null
  ]);
  return btn;
}

function ensureModal() {
  let modal = document.getElementById('hebModal');
  if (modal) return modal;
  modal = el('div', { id: 'hebModal', class: 'rep-modal', hidden: '', role: 'dialog', 'aria-modal': 'true' });
  const card = el('div', { class: 'rep-modal-card heb-card' });
  card.appendChild(el('button', { class: 'rep-modal-close', type: 'button', 'aria-label': 'Close', text: '×',
    onclick: () => close(modal) }));
  card.appendChild(el('div', { class: 'rep-modal-content' }));
  modal.appendChild(card);
  modal.addEventListener('click', e => { if (e.target === modal) close(modal); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(modal); });
  document.body.appendChild(modal);
  return modal;
}

function close(modal) {
  modal.hidden = true;
  document.body.classList.remove('rep-modal-open');
}

/** Open the letter detail modal. */
export function showHebrewLetter(key, data) {
  const L = data?.letters?.[key];
  if (!L) return;
  const modal = ensureModal();
  const c = modal.querySelector('.rep-modal-content');
  c.innerHTML = '';
  const facts = [
    ['Numeric value', String(L.value)],
    ['Transliteration', L.translit],
    ['Pronunciation', L.pronunciation],
    ['Pictograph', L.pictograph],
    ['Sefer Yetzirah', [L.class, L.element ? `element ${L.element}` : null, L.planetSY ? `planet ${L.planetSY}` : null, L.zodiac ? `sign ${L.zodiac}` : null].filter(Boolean).join(' · ')],
    ['Golden Dawn', [L.tarot ? `Tarot: ${L.tarot}` : null, L.planetGD ? `planet ${L.planetGD}` : null].filter(Boolean).join(' · ')]
  ].filter(([, v]) => v);

  c.appendChild(el('div', { class: 'rep-kicker', text: `Hebrew letter · ${L.class} letter` }));
  c.appendChild(el('div', { class: 'heb-hero' }, [
    el('div', { class: 'heb-hero-glyphs' }, [
      el('div', { class: 'heb-hero-form' }, [el('span', { class: 'heb-block big', text: L.block }), el('span', { class: 'heb-label', text: 'block' })]),
      el('div', { class: 'heb-hero-form' }, [el('span', { class: 'heb-cursive big', text: L.block }), el('span', { class: 'heb-label', text: 'cursive' })]),
      L.final ? el('div', { class: 'heb-hero-form' }, [el('span', { class: 'heb-block big', text: L.final }), el('span', { class: 'heb-label', text: 'final form' })]) : null,
      L.final ? el('div', { class: 'heb-hero-form' }, [el('span', { class: 'heb-cursive big', text: L.final }), el('span', { class: 'heb-label', text: 'final cursive' })]) : null
    ]),
    el('div', {}, [
      el('h3', { text: L.name }),
      el('p', { class: 'heb-meaning', text: L.meaning })
    ])
  ]));
  c.appendChild(el('div', { class: 'heb-facts' }, facts.map(([k, v]) => el('div', { class: 'hd-summary-item' }, [
    el('div', { class: 'hd-summary-label', text: k }), el('div', { text: v })
  ]))));
  c.appendChild(el('h4', { text: 'Spiritual meaning' }));
  c.appendChild(el('p', { text: L.spiritual }));
  if (L.words) c.appendChild(el('p', { class: 'rep-muted' }, [el('strong', { text: 'Words: ' }), L.words]));
  modal.hidden = false;
  document.body.classList.add('rep-modal-open');
}
