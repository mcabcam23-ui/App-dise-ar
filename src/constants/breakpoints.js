/** Breakpoints alineados con CSS (@media) y matchMedia en JS. */
export const BREAKPOINTS = {
  compact: 1024,
  phone: 480,
};

export const COMPACT_MQ = `(max-width: ${BREAKPOINTS.compact}px)`;
export const PHONE_MQ = `(max-width: ${BREAKPOINTS.phone}px)`;
export const TOUCH_UI_MQ = '(hover: none) and (pointer: coarse)';

export function isCompactViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(COMPACT_MQ).matches;
}

/** Móvil/tablet táctil: layout compacto aunque el ancho supere 1024px (p. ej. iPad horizontal). */
export function isTouchUiPreferred() {
  if (typeof window === 'undefined') return false;
  return isCompactViewport() || window.matchMedia(TOUCH_UI_MQ).matches;
}
