// Fixed, cross-theme decorative color set — the one sanctioned exception to the
// "colors come from token" rule. These are iridescent mesh/aurora gradients used
// for note covers, welcome cards, empty states, and chart series. Vivid on
// purpose; they read as playful accents over the restrained neutral shell.

// 8 mesh/aurora accents spanning warm orange → rose → purple → indigo → cyan →
// emerald → lemon. Mix of linear & radial for variety.
export const GRADIENT_ACCENTS: string[] = [
  'linear-gradient(135deg, #FF8A4C 0%, #FF5E8A 100%)', // warm orange → rose
  'linear-gradient(135deg, #FF5E8A 0%, #A24BFF 100%)', // rose → violet
  'linear-gradient(135deg, #7C5CFF 0%, #4C9AFF 100%)', // purple → indigo
  'radial-gradient(120% 120% at 20% 10%, #4C9AFF 0%, #2DD4BF 100%)', // indigo → teal
  'linear-gradient(135deg, #21D4FD 0%, #3B82F6 100%)', // cyan → blue
  'linear-gradient(135deg, #2DD4BF 0%, #5BD672 100%)', // teal → emerald
  // lemon → green and amber → orange are deepened a luminance notch from their
  // candy-bright origins so GradientThumb's fixed white ink stays ≥3:1 legible
  // across the whole cover (the bright originals dropped to ~1.5:1). Hues/sat held.
  'radial-gradient(120% 120% at 80% 15%, #72A00D 0%, #0EAA2A 100%)', // lemon → green
  'linear-gradient(135deg, #B8880F 0%, #ED6C26 100%)', // amber → orange
];

// 6 coordinated vivid data-series colors.
export const CHART_COLORS: string[] = [
  '#FF8A4C',
  '#7C5CFF',
  '#4C9AFF',
  '#2DD4BF',
  '#5BD672',
  '#FF5E8A',
];

// Stable string/number → gradient mapping (same seed always same gradient).
// Simple deterministic hash; never Math.random.
export function pickGradient(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return GRADIENT_ACCENTS[Math.abs(h) % GRADIENT_ACCENTS.length];
}
