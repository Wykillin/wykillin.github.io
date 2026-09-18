# adamwykle.com

Static site hosted on GitHub Pages. No server, no backend, no build step for
the site itself.

## Chart calculator (`chart.html`)

`chart.html` is a single-page natal chart calculator with two tabs that share
one birth-data form:

- **Esoteric Astrology** — Swiss Ephemeris (WASM, from jsDelivr) computes 13
  bodies (Sun through Pluto, True Node, Chiron, Vulcan) and Placidus houses.
  The wheel is drawn with `@astrodraw/astrochart` (unpkg). Below the wheel a
  report is generated client-side: placements, planet-in-sign and
  planet-in-house interpretations, an aspect grid, and detected aspect patterns.
- **Human Design** — [NatalEngine](https://github.com/Unforced-Dev/natalengine)
  (MIT) computes the full Human Design chart from the same birth data; the tab
  renders a summary block, an SVG bodygraph, the activations table, channels
  and Variable/PHS.
- **Kabbalah** — the Tree of Life drawn as an SVG map of the chart: each
  sefirah lit by the strength of its planet, paths lit by sign occupancy,
  planetary strength or dominant element, aspect links between sefirot, a
  detail panel per sefirah (divine name, archangel, order, experience,
  astrological meaning) and per path (Hebrew letter, attribution, Tarot key),
  plus Tarot birth cards and the numerology numbers placed on the Tree
  (`js/kabbalah.js`, `js/kabbalah-tab.js`, `data/tree-of-life.json`).
- **Numerology** — Pythagorean core numbers from the birth date and name
  (Life Path, Birthday, Expression, Soul Urge, Personality, Maturity, Attitude,
  Personal Year), Pinnacles and Challenges, Karmic Lessons, Hidden Passion,
  Planes of Expression and the Chaldean name number; then Simple, English and
  Hebrew gematria per name and for the full name; then a list of the
  mathematical and traditional properties of every total. The name box at the
  top takes the form's name and an optional middle name and recalculates live.

### File layout

```
chart.html                  page: form, geocoding, WASM init, wheel, tab bar, pipeline calls
js/config.js                all configurable values (orbs, aspects, pattern settings, glyphs, colours)
js/aspects.js               aspect calculation engine
js/patterns.js              aspect pattern detection (Grand Trine, T-Square, Grand Cross, Yod, Stellium, Mystic Rectangle, Kite)
js/report.js                report generator (renders into <div id="report">)
js/wheel.js                 chart wheel with aspect lines, the drawing settings menu, and the per-pattern mini wheel
js/hd-detail.js             Human Design detail panel (gate / I Ching / Gene Keys, centers, channels)
js/human-design.js          Human Design tab: birth-data conversion + rendering
js/numerology.js            numerology + gematria + number-property engine (pure functions)
js/numerology-tab.js        Numerology tab rendering
js/hebrew.js                Hebrew letter glyphs (block + cursive) and detail modal
js/export-pdf.js            Export PDF (html2pdf.js render of all four tabs, opened in a new tab)
js/hexagram.js              King Wen hexagram line data + SVG drawing for the I Ching view
js/kabbalah.js              Tree of Life calculations (sefirah/path activity, birth cards, numerology map)
js/kabbalah-tab.js          Kabbalah tab rendering (SVG tree, detail panel, purpose keys)
js/bodygraph.js             SVG bodygraph renderer
js/natalengine.bundle.js    pre-built browser bundle of NatalEngine (IIFE, global `NatalEngine`)
build/natalengine-entry.js  entry file used to build the bundle
data/planets-in-signs.json  156 entries keyed "Sun-Aries" ...
data/planets-in-houses.json 156 entries keyed "Sun-1" ...
data/aspects.json           330 entries keyed "Mars-Saturn-square" (alphabetical planet order)
data/aspect-patterns.json   one entry per pattern type with a runtime-filled template
data/numerology.json        number meanings (1-9, 11, 22, 33), position descriptions, notable-number lore
data/letter-sounds.json     Hebrew consonant meanings, vowel gestures (Steiner + traditions), syllable overrides
data/hebrew-letters.json    the 22 Hebrew letters: forms, values, pictographs, mystical keys, meanings
data/tree-of-life.json      sefirot, the 22 paths with letters/attributions/Tarot keys, Major Arcana meanings
css/chart-report.css        dark theme for the tab bar, report and Human Design tab
```

All interpretive text lives in the `data/*.json` files. Replace their contents
freely; the keys must stay the same.

### Pipeline (Esoteric Astrology tab)

1. Form submit → geocode city (Open-Meteo) → IANA timezone, lat/lon.
2. Wall-clock time → Julian Day (UT) → Swiss Ephemeris positions with speeds.
3. Placidus cusps → structured chart data array (`name, longitude, sign, signIndex, degreeInSign, house, retrograde, speed`), plus the Ascendant and MC as angle entries (`isAngle: true`).
4. `calculateAspects()` → `detectPatterns()` → `loadInterpretationData()` → `renderReport()`.
5. The wheel is drawn by `js/wheel.js` inside the report (between the birth details and the placements table) with aspect lines coloured like the aspect grid: solid for tight orbs, dashed for wide ones (`WHEEL.lineStyles` in `js/config.js`).

The ⚙ Settings button above the wheel opens a menu to hide individual aspect
types and placements from the drawing. Choices persist in `localStorage`.

Pattern detection (`js/patterns.js`) covers Grand Trine, Kite, T-Square,
Grand Cross, Grand Sextile, Yod, Boomerang, Mystic Rectangle, Hard Rectangle,
Cradle, Wedge, Minor Grand Trine, Thor's Hammer, stelliums by sign, by house
and by conjunction chain, and the Jones chart shape (Bundle, Bowl, Bucket,
Locomotive, Seesaw, Splash, Splay). Patterns are found with their own, wider
orbs (`PATTERNS.orbs` in `js/config.js`) so a single tight-orb aspect does not
hide a figure; set `PATTERNS.useOwnOrbs` to false to detect only from the main
aspect list. `PATTERNS.suppressSubPatterns` hides a T-Square inside a Grand
Cross, a Yod inside a Boomerang, and so on. Each detector can be switched off
in `PATTERNS.enabled`.

Clicking an aspect-pattern card draws a small wheel inside the card with only
that pattern's placements and aspect lines (`PATTERN_ASPECT_TYPES` and
`PATTERN_WHEEL` in `js/config.js`; the height is the `.rep-pattern-wheel svg`
rule in the CSS).

Orbs, aspect set, aspect colours, wheel line styles, and pattern toggles are in
`js/config.js`. Aspects to the Ascendant and MC have no entries in
`data/aspects.json` yet; their keys follow the same alphabetical rule
(`Ascendant-Sun-conjunction`, `MC-Moon-square`).

### Human Design tab

`js/human-design.js` converts the form data to NatalEngine's inputs:

- `birthDate`: `YYYY-MM-DD`
- `birthHour`: decimal hours (14.5 = 2:30 PM)
- `timezone`: numeric UTC offset from `NatalEngine.resolveUtcOffset(birthDate, "HH:MM", ianaZone)`

Then `NatalEngine.calculateHumanDesign(birthDate, birthHour, timezone)`.

### Numerology tab

Letter tables and the reduction rules are in `js/numerology.js`; master
numbers and the "multiple of" list are in `NUMEROLOGY` in `js/config.js`.
Gematria ciphers: Simple (A=1 … Z=26), English (ordinal × 6) and Hebrew
(the 1-9 / 10-90 / 100-900 Hebrew pattern mapped onto A-Z, the common
"Jewish gematria" table). Y counts as a vowel when it is not adjacent to
another vowel. All meanings and notable-number lore live in
`data/numerology.json`.

### Sound analysis (Numerology tab)

`data/letter-sounds.json` drives the Sound Analysis section. Each consonant
is mapped to the Hebrew letter it descends from (glyph, pictograph, meaning,
optional note); each vowel has its Steiner eurythmy gesture plus Sanskrit,
Greek and Hebrew readings; `combinations` holds hand-written meanings for
specific syllables (`BA`, `ER`, ...) that override the composed text when
that syllable, or a 2-3 letter window inside it, matches. Syllables are split
by the rule in `syllabify()` in `js/numerology.js` (single consonant between
vowels starts the next syllable; clusters are split; trailing consonants stay).
Edit the JSON freely; nothing in the JS carries meanings.

### Human Design detail panel

Clicking a gate (on the bodygraph or in the activations table), a center, or a
channel opens a detail panel with the text tables that ship inside
NatalEngine: gate keynote and description, the activated line(s), the harmonic
gate and its status, plus I Ching and Gene Keys views; center meanings by
defined / undefined / open state; channel descriptions. These tables are
exported from `build/natalengine-entry.js` and land in the bundle.

### Export PDF

The ⬇ Export PDF button renders whichever tabs have not been calculated yet,
clones the four panels (Astrology, Human Design, Numerology, Kabbalah) with
every collapsible expanded and every pattern wheel drawn, renders them to a
PDF with html2pdf.js (html2canvas + jsPDF, loaded from cdnjs on first use)
and opens the PDF in a new tab. Rendering a full report takes some seconds.
The `.pdf-export` rules in `css/chart-report.css` control the export layout;
the `@media print` rules remain so Ctrl+P also produces a clean printout.

### Hebrew letters

`data/hebrew-letters.json` holds the 22 letters: block form, final form,
numeric value, pictograph, Sefer Yetzirah class/element/planet/sign, the
Golden Dawn Tarot key, meaning, spiritual meaning and example words. The
cursive form is the same character in the handwritten font "Gveret Levin
AlefAlefAlef" (Google Fonts); without the font the block form shows. Each
consonant in `data/letter-sounds.json` lists its `hebrewKeys`, which drive the
clickable glyphs in the Numerology sound section (`js/hebrew.js`).

### Rebuilding the NatalEngine bundle

The bundle is a one-time build artifact committed as a static file. Rebuild it
only if you want to update NatalEngine. Requires Node 20+.

```bash
npm install --no-save natalengine esbuild
```

```bash
npx esbuild build/natalengine-entry.js --bundle --format=iife --global-name=NatalEngine --minify --target=es2020 --outfile=js/natalengine.bundle.js
```

`build/natalengine-entry.js` re-exports the calculators plus the bodygraph
geometry (`GATE_PATHS`, `CENTER_SHAPES`, `GATE_CIRCLE_POSITIONS`, ...) that
`js/bodygraph.js` uses. `node_modules` is git-ignored; nothing from npm is
needed at runtime.

### Local preview

Because `chart.html` uses ES modules and `fetch()` for the JSON data, open it
through a local HTTP server rather than as a `file://` URL, for example:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080/chart.html`.
