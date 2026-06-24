// Fixed, cross-theme decorative color set — the one sanctioned exception to the
// "colors come from token" rule. These are iridescent mesh/aurora gradients used
// for note covers, welcome cards, empty states, and chart series. Vivid on
// purpose; they read as playful accents over the restrained neutral shell.

// Two warm, low-key accent gradients — soft amber→orange large blocks that sit
// quietly with the brand. Kept as a small set so nothing reads as neon confetti.
export const GRADIENT_ACCENTS: string[] = [
  'linear-gradient(135deg, #D98A4E 0%, #C2703D 100%)', // soft amber → brand orange
  'linear-gradient(135deg, #C99A5A 0%, #B5713A 100%)', // wheat → terracotta
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
