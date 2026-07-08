import { OVERLAY_OBJECT_NAME } from './pageOverlay';

export const PROJECT_SCHEMA_VERSION = 1;

const PREFAB_PATH = '/assets/prefabricados/';

export function sanitizeFilename(name, ext) {
  const safeExt = String(ext || 'bin').replace(/^\./, '');
  const base = String(name || 'proyecto')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'proyecto';
  return `${base}.${safeExt}`;
}

export function createExportFilter() {
  return (obj) => !obj?.overlayLayer && obj?.name !== OVERLAY_OBJECT_NAME;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function fileToDataUrl(file) {
  return blobToDataUrl(file);
}

export async function ensurePersistedImageSrc(src) {
  if (!src || typeof src !== 'string') return src;
  if (src.startsWith('data:')) return src;

  if (src.startsWith('blob:')) {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      return blobToDataUrl(blob);
    } catch {
      return src;
    }
  }

  const prefabIdx = src.indexOf(PREFAB_PATH);
  if (prefabIdx >= 0) {
    return src.slice(prefabIdx);
  }

  try {
    const absolute = src.startsWith('http') || src.startsWith('blob:') || src.startsWith('data:')
      ? src
      : new URL(src, window.location.href).href;
    const res = await fetch(absolute);
    if (!res.ok) return src;
    const blob = await res.blob();
    return blobToDataUrl(blob);
  } catch {
    return src;
  }
}

async function embedImagesInObject(obj) {
  if (!obj || typeof obj !== 'object') return;

  if (obj.type === 'image' && obj.src) {
    obj.src = await ensurePersistedImageSrc(obj.src);
  }

  if (Array.isArray(obj.objects)) {
    for (const child of obj.objects) {
      await embedImagesInObject(child);
    }
  }
}

function isOverlayObject(obj) {
  return Boolean(obj?.overlayLayer || obj?.name === OVERLAY_OBJECT_NAME);
}

function stripOverlayFromFabricJson(json) {
  if (!json || typeof json !== 'object') return json;
  if (Array.isArray(json.objects)) {
    json.objects = json.objects.filter((obj) => !isOverlayObject(obj));
  }
  return json;
}

export async function embedImagesInFabricJson(json) {
  if (!json || typeof json !== 'object') return json;

  if (json.backgroundImage?.src) {
    json.backgroundImage.src = await ensurePersistedImageSrc(json.backgroundImage.src);
  }

  if (Array.isArray(json.objects)) {
    for (const obj of json.objects) {
      await embedImagesInObject(obj);
    }
  }

  return json;
}

export async function buildProjectSnapshot({
  canvas,
  customProps,
  meta,
}) {
  if (!canvas) return null;

  const canvasJson = stripOverlayFromFabricJson(canvas.toJSON(customProps));
  await embedImagesInFabricJson(canvasJson);

  const bg = canvas.backgroundColor;
  const bgString = typeof bg === 'string'
    ? bg
    : bg?.toHex?.() ?? meta.backgroundColor ?? '#ffffff';

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: canvas.projectId || meta.id,
    name: meta.name,
    pageSizeKey: meta.pageSizeKey,
    backgroundColor: bgString,
    pageOverlayType: meta.pageOverlayType,
    pageOverlaySpacing: meta.pageOverlaySpacing,
    pageOverlayColor: meta.pageOverlayColor,
    canvas: canvasJson,
    updatedAt: new Date().toISOString(),
  };
}
