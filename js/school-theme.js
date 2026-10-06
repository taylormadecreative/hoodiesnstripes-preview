export const INK = '#0d0d0d';
export const PAPER = '#ffffff';

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function inkFor(bg) {
  return contrast(bg, INK) >= contrast(bg, PAPER) ? INK : PAPER;
}

export function themeVars(s) {
  return {
    '--school-primary': s.primary,
    '--school-secondary': s.secondary,
    '--school-on-primary': inkFor(s.primary),
    '--school-on-secondary': inkFor(s.secondary),
  };
}

export function applySchool(el, slug, s) {
  for (const [k, v] of Object.entries(themeVars(s))) el.style.setProperty(k, v);
  el.dataset.school = slug;
}
