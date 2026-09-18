// Entry point for the browser bundle of NatalEngine (MIT).
// Rebuild with the esbuild command documented in README.md.
// Re-exports the calculators plus the bodygraph geometry so js/bodygraph.js
// can draw the canonical Human Design bodygraph.
export {
  calculateHumanDesign,
  calculateGeneKeys,
  resolveUtcOffset,
  formatUtcOffset,
  GATES,
  CHANNELS,
  CENTERS,
  TYPES,
  PROFILES,
  AUTHORITIES,
  LINE_NAMES,
  longitudeToGate,
  longitudeToLine,
  longitudeToColor,
  longitudeToTone,
  longitudeToBase,
  getZodiacSign,
  GATE_DESCRIPTIONS,
  LINE_DESCRIPTIONS,
  CHANNEL_DESCRIPTIONS,
  HEXAGRAM_DESCRIPTIONS,
  GENE_KEY_DESCRIPTIONS
} from 'natalengine';

export {
  GATE_PATHS,
  CENTER_SHAPES,
  GATE_TEXT_POSITIONS,
  GATE_CIRCLE_POSITIONS,
  VIEWBOX,
  CENTER_NAMES
} from 'natalengine/bodygraph-data';
