// js/config.js
// All configurable values for the chart interpretation layer live here.
// Orbs, aspect definitions, pattern definitions, sign/element tables and
// display glyphs. Nothing interpretive belongs in this file — that lives in
// the data/*.json files.

/** Zodiac signs in order, index 0 = Aries. */
export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

/** Element of each sign, by sign index. */
export const SIGN_ELEMENTS = [
  'Fire', 'Earth', 'Air', 'Water', 'Fire', 'Earth',
  'Air', 'Water', 'Fire', 'Earth', 'Air', 'Water'
];

/** Modality of each sign, by sign index. */
export const SIGN_MODALITIES = [
  'Cardinal', 'Fixed', 'Mutable', 'Cardinal', 'Fixed', 'Mutable',
  'Cardinal', 'Fixed', 'Mutable', 'Cardinal', 'Fixed', 'Mutable'
];

/** Body names in canonical display order (matches the bodies calculated in chart.html). */
export const BODIES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'NNode', 'Chiron', 'Vulcan'
];

/** Chart angles included in aspect and pattern calculations (drawn as axes, not as planets). */
export const ANGLES = ['Ascendant', 'MC'];

/** Bodies that never appear retrograde in a meaningful way (luminaries). */
export const NEVER_RETROGRADE = ['Sun', 'Moon'];

/**
 * Orb allowance per body, in degrees. When two bodies aspect each other the
 * larger of the two orbs is used (a common mainstream convention).
 */
export const ORBS = {
  Sun: 8, Moon: 8,
  Mercury: 6, Venus: 6, Mars: 6,
  Jupiter: 4, Saturn: 4, Uranus: 4, Neptune: 4, Pluto: 4,
  NNode: 4, Chiron: 4, Vulcan: 4,
  Ascendant: 6, MC: 6
};

/** Fallback orb for any body not listed in ORBS. */
export const DEFAULT_ORB = 4;

/** How the orb for a pair is chosen: 'max' | 'min' | 'mean'. */
export const ORB_RULE = 'max';

/** Aspect definitions: key, exact angle, glyph and a display label. */
export const ASPECTS = {
  conjunction: { angle: 0,   glyph: '☌', label: 'Conjunction', nature: 'neutral' },
  sextile:     { angle: 60,  glyph: '⚹', label: 'Sextile',     nature: 'harmonious' },
  square:      { angle: 90,  glyph: '□', label: 'Square',      nature: 'challenging' },
  trine:       { angle: 120, glyph: '△', label: 'Trine',       nature: 'harmonious' },
  opposition:  { angle: 180, glyph: '☍', label: 'Opposition',  nature: 'challenging' },
  quincunx:    { angle: 150, glyph: '⚻', label: 'Quincunx',    nature: 'adjusting' }
};

/**
 * Minor aspects used only by pattern detection (Thor's Hammer, Boomerang,
 * Hard Rectangle). They are not drawn on the wheel or shown in the grid.
 */
export const MINOR_ASPECTS = {
  semisextile:    { angle: 30,  glyph: '⚺', label: 'Semisextile',    nature: 'minor' },
  semisquare:     { angle: 45,  glyph: '∠', label: 'Semisquare',     nature: 'minor' },
  sesquiquadrate: { angle: 135, glyph: '⚼', label: 'Sesquiquadrate', nature: 'minor' }
};

/**
 * Optional per-aspect orb multipliers. Minor aspects usually get tighter orbs.
 * 1 = use the body orb as-is.
 */
export const ASPECT_ORB_FACTORS = {
  conjunction: 1,
  sextile: 0.75,
  square: 1,
  trine: 1,
  opposition: 1,
  quincunx: 0.5
};

/** Colour of each aspect type, used for the wheel lines and the aspect grid. */
export const ASPECT_COLORS = {
  conjunction: '#E6EDF3',
  sextile: '#79C0FF',
  square: '#FF7B72',
  trine: '#56D364',
  opposition: '#F0883E',
  quincunx: '#D2A8FF'
};

/** Planet glyphs used in the aspect grid and tables. */
export const PLANET_GLYPHS = {
  Sun: '☉', Moon: '☽', Mercury: '☿', Venus: '♀', Mars: '♂',
  Jupiter: '♃', Saturn: '♄', Uranus: '♅', Neptune: '♆', Pluto: '♇',
  NNode: '☊', Chiron: '⚷', Vulcan: '⚶',
  Ascendant: 'AC', MC: 'MC'
};

/** Sign glyphs. */
export const SIGN_GLYPHS = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓'
};

/** Human-readable display names (NNode → North Node, etc.). */
export const DISPLAY_NAMES = {
  NNode: 'North Node',
  MC: 'Midheaven'
};

/**
 * Chart wheel drawing settings.
 * - size: the astrochart canvas size (the SVG is scaled to fit its container)
 * - lineStyles: aspect line intensity by orb; solid for tight orbs, dashed for wide
 * - defaultAspects / defaultBodies: initial state of the settings menu toggles
 * - astrochartSettings: colour overrides so the wheel fits the dark report theme
 */
export const WHEEL = {
  size: 800,
  lineStyles: {
    exact: { maxOrb: 1, width: 2.6, dash: null, opacity: 1 },
    tight: { maxOrb: 3, width: 1.7, dash: null, opacity: 0.95 },
    wide:  { maxOrb: Infinity, width: 1.2, dash: '7 5', opacity: 0.8 }
  },
  defaultAspects: { conjunction: true, sextile: true, square: true, trine: true, opposition: true, quincunx: true },
  defaultBodies: {},                       // everything on by default; set a name to false to hide it initially
  astrochartSettings: {
    COLOR_BACKGROUND: '#161B22',
    CIRCLE_COLOR: '#8B949E',
    LINE_COLOR: '#8B949E',
    POINTS_COLOR: '#E6EDF3',
    SIGNS_COLOR: '#0D1117',
    CUSPS_FONT_COLOR: '#C9A84C',
    SYMBOL_AXIS_FONT_COLOR: '#C9A84C',
    COLORS_SIGNS: ['#FF7B72', '#C9A84C', '#79C0FF', '#56D364',
                   '#FF7B72', '#C9A84C', '#79C0FF', '#56D364',
                   '#FF7B72', '#C9A84C', '#79C0FF', '#56D364'],
    SHOW_DIGNITIES_TEXT: false
  }
};

/**
 * Pattern detection settings.
 * - enabled: toggle individual pattern detectors
 * - stelliumMinimum: how many bodies in one sign count as a stellium
 * - stelliumBodies: which bodies count toward a stellium (points like the
 *   Node are excluded by mainstream convention)
 */
export const PATTERNS = {
  enabled: {
    grandTrine: true,
    tSquare: true,
    grandCross: true,
    grandSextile: true,
    yod: true,
    boomerang: true,
    stellium: true,           // sign, house and conjunction-chain stelliums
    mysticRectangle: true,
    hardRectangle: true,
    cradle: true,
    kite: true,
    wedge: true,
    minorGrandTrine: true,
    thorsHammer: true,
    chartShape: true          // Jones chart shape (Bowl, Bucket, ...)
  },
  /**
   * Pattern detection recomputes the aspects with these orbs (per aspect
   * type, in degrees) instead of the tighter per-body orbs used for the main
   * aspect list. Set useOwnOrbs to false to detect only from the main list.
   */
  useOwnOrbs: true,
  orbs: {
    conjunction: 10, opposition: 8, square: 8, trine: 8, sextile: 6, quincunx: 3,
    semisextile: 2, semisquare: 2.5, sesquiquadrate: 2.5
  },
  /** Hide a pattern that is fully contained in a larger one (T-Square inside a Grand Cross, ...). */
  suppressSubPatterns: true,
  stelliumMinimum: 3,
  stelliumBodies: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter',
    'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron', 'Vulcan'],
  /** Bodies used for the Jones chart-shape classification. */
  shapeBodies: ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'],
  /** Canonical pattern names as they appear in data/aspect-patterns.json. */
  names: {
    grandTrine: 'Grand Trine',
    tSquare: 'T-Square',
    grandCross: 'Grand Cross',
    grandSextile: 'Grand Sextile',
    yod: 'Yod',
    boomerang: 'Boomerang',
    stellium: 'Stellium',
    stelliumHouse: 'House Stellium',
    stelliumCluster: 'Conjunction Cluster',
    mysticRectangle: 'Mystic Rectangle',
    hardRectangle: 'Hard Rectangle',
    cradle: 'Cradle',
    kite: 'Kite',
    wedge: 'Wedge',
    minorGrandTrine: 'Minor Grand Trine',
    thorsHammer: "Thor's Hammer",
    shapeBundle: 'Bundle Chart',
    shapeBowl: 'Bowl Chart',
    shapeBucket: 'Bucket Chart',
    shapeLocomotive: 'Locomotive Chart',
    shapeSeesaw: 'Seesaw Chart',
    shapeSplash: 'Splash Chart',
    shapeSplay: 'Splay Chart'
  }
};

/** Bodies that have entries in data/aspects.json (Vulcan and NNode are added manually later). */
export const ASPECT_DATA_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'];

/** Paths to the interpretation data files, relative to chart.html. */
export const DATA_FILES = {
  planetsInSigns: 'data/planets-in-signs.json',
  planetsInHouses: 'data/planets-in-houses.json',
  aspects: 'data/aspects.json',
  aspectPatterns: 'data/aspect-patterns.json'
};

/** Human Design planet order and glyphs for the activations table. */
export const HD_PLANET_ORDER = [
  'sun', 'earth', 'northNode', 'southNode', 'moon', 'mercury',
  'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
];

export const HD_PLANET_NAMES = {
  sun: 'Sun', earth: 'Earth', moon: 'Moon', northNode: 'North Node',
  southNode: 'South Node', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune',
  pluto: 'Pluto'
};

export const HD_PLANET_GLYPHS = {
  sun: '☉', earth: '⊕', moon: '☽', northNode: '☊', southNode: '☋',
  mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃', saturn: '♄',
  uranus: '♅', neptune: '♆', pluto: '♇'
};

/** Traditional colours for defined Human Design centres. */
export const HD_CENTER_COLORS = {
  head: '#F2D34C',     // yellow
  ajna: '#5EBD6E',     // green
  throat: '#A8724A',   // brown
  g: '#F2D34C',        // yellow
  heart: '#E04A3A',    // red
  spleen: '#A8724A',   // brown
  solar: '#A8724A',    // brown
  sacral: '#E04A3A',   // red
  root: '#A8724A'      // brown
};

/** Channel colours on the bodygraph. */
export const HD_CHANNEL_COLORS = {
  personality: '#111111', // black (conscious)
  design: '#D7263D',      // red (unconscious)
  inactive: '#3A424D',
  undefinedCenter: '#FFFFFF',
  centerStroke: '#8B949E'
};

/** Display names for centre keys returned by NatalEngine. */
export const HD_CENTER_NAMES = {
  head: 'Head', ajna: 'Ajna', throat: 'Throat', g: 'G Center',
  heart: 'Will (Heart/Ego)', spleen: 'Spleen', solar: 'Solar Plexus',
  sacral: 'Sacral', root: 'Root'
};

/** Numerology settings. Interpretive text lives in data/numerology.json. */
export const NUMEROLOGY = {
  masterNumbers: [11, 22, 33],
  /** Divisors flagged as significant when a value is a multiple of them. */
  notableMultiples: {
    7: 'seven, completion and the sacred week',
    9: 'nine, completion of the cycle',
    12: 'twelve, the zodiac and the tribes',
    13: 'thirteen, transformation',
    36: 'thirty-six, a tenth of the circle',
    72: 'seventy-two, the names of God and the precessional degree',
    108: 'one hundred and eight, the sacred count of the mala',
    144: 'one hundred and forty-four, twelve squared'
  },
  dataFile: 'data/numerology.json'
};

/** Which aspect types make up each pattern (used for the per-pattern mini wheel). */
export const PATTERN_ASPECT_TYPES = {
  grandTrine: ['trine'],
  tSquare: ['opposition', 'square'],
  grandCross: ['opposition', 'square'],
  grandSextile: ['sextile', 'trine', 'opposition'],
  yod: ['sextile', 'quincunx'],
  boomerang: ['sextile', 'quincunx', 'opposition'],
  stellium: ['conjunction'],
  stelliumHouse: ['conjunction'],
  stelliumCluster: ['conjunction'],
  mysticRectangle: ['opposition', 'sextile', 'trine'],
  hardRectangle: ['opposition'],
  cradle: ['opposition', 'sextile', 'trine'],
  kite: ['trine', 'opposition', 'sextile'],
  wedge: ['opposition', 'trine', 'sextile'],
  minorGrandTrine: ['trine', 'sextile'],
  thorsHammer: ['square']
};

/** The small wheel drawn inside a clicked aspect-pattern card. */
export const PATTERN_WHEEL = {
  size: 600,
  /** Height of the mini wheel as a CSS length; tweak to taste. */
  height: 'clamp(240px, 32vh, 440px)'
};

/** Numerology sound analysis data file (Hebrew consonant + vowel-sound meanings). */
export const LETTER_SOUNDS_FILE = 'data/letter-sounds.json';

/** Human Design line names (1-6) used in the detail panel. */
export const HD_LINE_NAMES = {
  1: 'the Investigator', 2: 'the Hermit', 3: 'the Martyr',
  4: 'the Opportunist', 5: 'the Heretic', 6: 'the Role Model'
};

/** Hebrew letter reference data (block/cursive glyphs and esoteric meanings). */
export const HEBREW_LETTERS_FILE = 'data/hebrew-letters.json';

/** Tree of Life data (sefirot, paths, tarot keys). */
export const TREE_FILE = 'data/tree-of-life.json';
