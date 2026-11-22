// "How old is this?" in whole units, floor-rounded so we never understate age.
export function ageParts(iso, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (s < 3600) return [Math.floor(s / 60), 'min'];
  if (s < 86400) return [Math.floor(s / 3600), 'h'];
  if (s < 86400 * 60) return [Math.floor(s / 86400), 'd'];
  if (s < 86400 * 730) return [Math.floor(s / (86400 * 30.44)), 'mo'];
  return [Math.floor(s / (86400 * 365.25)), 'y'];
}
// Freshness for a feed that should update every `expectH` hours.
export const freshness = (iso, expectH, now = Date.now()) =>
  !iso ? 'none' : (now - Date.parse(iso)) / 3.6e6 <= expectH ? 'fresh' : 'stale';
