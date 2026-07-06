/** Rutas de assets que funcionan en local y en GitHub Pages. */
export function resolveAssetUrl(path) {
  if (!path) return path;
  if (/^(https?:|blob:|data:)/.test(path)) return path;

  const base = import.meta.env.BASE_URL || '/';
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return encodeURI(`${base}${normalized}`).replace(/#/g, '%23');
}
