/** Breakpoints alineados con CSS (@media) y matchMedia en JS. */
export const BREAKPOINTS = {
  compact: 1024,
  phone: 480,
};

export const COMPACT_MQ = `(max-width: ${BREAKPOINTS.compact}px)`;
export const PHONE_MQ = `(max-width: ${BREAKPOINTS.phone}px)`;

export function isCompactViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(COMPACT_MQ).matches;
}
