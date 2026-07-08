/** Rutas de assets que funcionan en local y en GitHub Pages. */
export function resolveAssetUrl(path) {
  if (!path) return path;
  if (/^(https?:|blob:|data:)/.test(path)) return path;

  const base = import.meta.env.BASE_URL || '/';
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const joined = `${base}${normalized}`;

  if (typeof window !== 'undefined' && window.location?.href) {
    // new URL() ya codifica espacios y acentos; encodeURI() encima rompe las rutas (%20 → %2520).
    return new URL(joined, window.location.href).href;
  }

  return joined
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
    .replace(/^%2E%2F/, './');
}
