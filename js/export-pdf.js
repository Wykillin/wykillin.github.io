// js/export-pdf.js
// "Export PDF": renders the four tabs (Astrology, Human Design, Numerology,
// Kabbalah) in order, with every collapsible expanded, into a PDF and opens
// it in a new tab. Everything happens in the browser: html2canvas rasterises
// the report section by section and jsPDF assembles the pages. Rendering in
// blocks avoids the browser canvas size limit that blanks out very long
// single-canvas renders.
//
// Public API:
//   setupPdfExport({ button, ensureAllTabs, panels, filename, onStatus })

const LIBS = [
  ['html2canvas', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'],
  ['jspdf', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js']
];

const PAGE = { w: 210, h: 297, margin: 8 };          // A4 portrait, mm
const RENDER_WIDTH = 960;                            // CSS px width of the export document
const SCALE = 1.5;                                   // raster scale
const MAX_BLOCK_PX = 1400;                           // split blocks taller than this into their children
const BG = '#0D1117';

function loadScript(globalName, url) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = () => resolve(window[globalName]);
    s.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.appendChild(s);
  });
}
async function loadLibs() {
  for (const [g, url] of LIBS) await loadScript(g, url);
  return { html2canvas: window.html2canvas, jsPDF: window.jspdf.jsPDF };
}

/** Clone the panels into an export document with everything expanded. */
function buildExportDocument(panels, title) {
  const wrap = document.createElement('div');
  wrap.className = 'pdf-export';
  if (title) {
    const h = document.createElement('div');
    h.className = 'pdf-title';
    h.textContent = title;
    wrap.appendChild(h);
  }
  for (const panel of panels) {
    if (!panel || !panel.children.length) continue;
    const clone = panel.cloneNode(true);
    clone.removeAttribute('id');
    clone.removeAttribute('hidden');
    clone.classList.remove('tab-panel');
    clone.classList.add('pdf-page');
    for (const d of clone.querySelectorAll('details')) d.open = true;
    for (const junk of clone.querySelectorAll('.rep-gear, .rep-wheel-settings, .hd-detail-close, .rep-pattern-toggle, .num-inputs, .rep-settings-actions, .rep-modal, .tree-controls'))
      junk.remove();
    for (const w of clone.querySelectorAll('.rep-pattern-wheel[hidden]')) w.hidden = false;
    for (const d of clone.querySelectorAll('.hd-detail[hidden]')) d.remove();
    wrap.appendChild(clone);
  }
  document.body.appendChild(wrap);
  return wrap;
}

/** Leaf blocks to rasterise: panel children, split while taller than MAX_BLOCK_PX. */
function collectBlocks(wrap) {
  const blocks = [];
  const visit = (node, depth) => {
    if (!(node instanceof HTMLElement)) return;
    const h = node.offsetHeight;
    if (h === 0) return;
    const kids = [...node.children].filter(k => k instanceof HTMLElement);
    if (h > MAX_BLOCK_PX && kids.length > 1 && depth < 6) kids.forEach(k => visit(k, depth + 1));
    else blocks.push(node);
  };
  for (const page of wrap.children) {
    if (page.classList.contains('pdf-title')) { blocks.push(page); continue; }
    // page = cloned panel wrapper (section) -> inner panel div -> its sections
    const inner = page.firstElementChild && page.children.length === 1 ? page.firstElementChild : page;
    for (const child of inner.children) visit(child, 0);
    blocks[blocks.length - 1].dataset.pageEnd = '1';
  }
  return blocks;
}

async function renderToPdf({ html2canvas, jsPDF }, wrap, onStatus) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const contentW = PAGE.w - PAGE.margin * 2;
  const contentH = PAGE.h - PAGE.margin * 2;
  let y = PAGE.margin;
  const paintBg = () => { pdf.setFillColor(BG); pdf.rect(0, 0, PAGE.w, PAGE.h, 'F'); };
  const newPage = () => { pdf.addPage(); paintBg(); y = PAGE.margin; };
  paintBg();

  // Measure and split while the full document is attached, then detach it:
  // html2canvas clones the whole document on every call, so each block is
  // rendered from a small staging container instead.
  const blocks = collectBlocks(wrap).map(b => ({
    el: b,
    panelClass: (b.closest('.astro-report, .hd-panel, .num-panel, .tree-panel')?.className || '').split(' ')[0],
    pageEnd: !!b.dataset.pageEnd
  }));
  wrap.remove();
  const staging = document.createElement('div');
  staging.className = 'pdf-export pdf-staging';
  const inner = document.createElement('div');
  staging.appendChild(inner);
  document.body.appendChild(staging);

  for (let i = 0; i < blocks.length; i++) {
    const { el: block, panelClass, pageEnd } = blocks[i];
    onStatus(`Rendering PDF… ${i + 1} / ${blocks.length}`);
    inner.className = panelClass || '';
    inner.innerHTML = '';
    inner.appendChild(block);
    let canvas;
    try {
      canvas = await html2canvas(block, { scale: SCALE, backgroundColor: BG, useCORS: true, logging: false, windowWidth: RENDER_WIDTH, scrollX: 0, scrollY: 0 });
    } catch (err) {
      console.warn('PDF block failed', err);
      continue;
    }
    if (!canvas || !canvas.width || !canvas.height) continue;
    const imgH = canvas.height * contentW / canvas.width;   // mm
    if (imgH <= contentH) {
      if (y + imgH > PAGE.h - PAGE.margin && y > PAGE.margin) newPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', PAGE.margin, y, contentW, imgH, undefined, 'FAST');
      y += imgH + 3;
    } else {
      // Slice a tall block into page-height strips.
      const stripPx = Math.floor(contentH * canvas.width / contentW);
      let offset = 0;
      if (y > PAGE.margin) newPage();
      while (offset < canvas.height) {
        const h = Math.min(stripPx, canvas.height - offset);
        const strip = document.createElement('canvas');
        strip.width = canvas.width; strip.height = h;
        strip.getContext('2d').drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h);
        const hMm = h * contentW / canvas.width;
        pdf.addImage(strip.toDataURL('image/jpeg', 0.9), 'JPEG', PAGE.margin, PAGE.margin, contentW, hMm, undefined, 'FAST');
        offset += h;
        if (offset < canvas.height) newPage(); else y = PAGE.margin + hMm + 3;
      }
    }
    if (pageEnd && i < blocks.length - 1) newPage();
    await new Promise(r => setTimeout(r, 0));
  }
  staging.remove();
  return pdf;
}

export function setupPdfExport({ button, ensureAllTabs, panels, filename = 'soul-blueprint.pdf', onStatus = () => {} }) {
  async function exportPdf() {
    // Open the tab synchronously inside the click so popup blockers allow it.
    const win = window.open('', '_blank');
    if (win) {
      win.document.write('<title>Preparing PDF…</title><body style="background:#0D1117;color:#E6EDF3;font-family:system-ui;padding:40px">Preparing your PDF, this can take a minute or two for a full report…</body>');
    }
    button.disabled = true;
    let wrap = null;
    try {
      onStatus('Loading PDF libraries…');
      const libs = await loadLibs();
      onStatus('Preparing all sections…');
      await ensureAllTabs();
      const opened = [];
      for (const head of document.querySelectorAll('.rep-pattern-head[aria-expanded="false"]')) { head.click(); opened.push(head); }
      await new Promise(r => setTimeout(r, 200));
      wrap = buildExportDocument(panels.map(p => (typeof p === 'string' ? document.getElementById(p) : p)),
        document.querySelector('.rep-header h2')?.textContent || '');
      for (const head of opened) head.click();
      document.body.classList.add('pdf-exporting');
      await new Promise(r => setTimeout(r, 100));
      // html2canvas clones the whole document for every block, so take the live
      // page out of the DOM while rendering and put it back afterwards.
      const container = document.querySelector('.container');
      const containerParent = container?.parentNode, containerNext = container?.nextSibling;
      if (container) containerParent.removeChild(container);
      let pdf;
      try {
        pdf = await renderToPdf(libs, wrap, onStatus);
      } finally {
        if (container) {
          const anchor = containerNext && containerNext.parentNode === containerParent ? containerNext : null;
          containerParent.insertBefore(container, anchor);
        }
      }
      pdf.setProperties({ title: filename.replace(/\.pdf$/, '') });
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      if (win && !win.closed) win.location.href = url;
      else window.open(url, '_blank');
      onStatus('');
    } catch (err) {
      console.error(err);
      onStatus(`PDF export failed: ${err.message}`, true);
      if (win && !win.closed) win.close();
    } finally {
      if (wrap) wrap.remove();
      document.body.classList.remove('pdf-exporting');
      button.disabled = false;
    }
  }
  button.addEventListener('click', exportPdf);
  return { exportPdf };
}
