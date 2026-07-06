const STORAGE_KEY = 'estudio-saved-colors';
export const MAX_SAVED_COLORS = 20;

export const DEFAULT_SAVED_COLORS = [
  '#222222',
  '#000000',
  '#ffffff',
  '#e60000',
  '#ffd800',
  '#00a651',
  '#005bbb',
  '#ff8c00',
];

export function normalizeHex(color) {
  if (!color || color === 'transparent') return null;
  const raw = color.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return null;
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function loadSavedColors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_SAVED_COLORS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_SAVED_COLORS];
    const colors = parsed.map(normalizeHex).filter(Boolean);
    return colors.length ? colors : [...DEFAULT_SAVED_COLORS];
  } catch {
    return [...DEFAULT_SAVED_COLORS];
  }
}

export function persistSavedColors(colors) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

/** Muestra del lienzo renderizado en el punto del clic. */
export function sampleColorFromCanvas(fabricCanvas, domEvent) {
  const el = fabricCanvas?.lowerCanvasEl;
  if (!el) return null;

  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const scaleX = el.width / rect.width;
  const scaleY = el.height / rect.height;
  const x = Math.floor((domEvent.clientX - rect.left) * scaleX);
  const y = Math.floor((domEvent.clientY - rect.top) * scaleY);

  if (x < 0 || y < 0 || x >= el.width || y >= el.height) return null;

  const ctx = el.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
  if (a < 8) return null;

  return rgbToHex(r, g, b);
}
