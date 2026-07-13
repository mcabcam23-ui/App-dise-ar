import { OVERLAY_OBJECT_NAME } from './pageOverlay';

export const PROJECT_SCHEMA_VERSION = 2;

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

export function captureSheetFromCanvas(canvas, customProps, meta) {
  if (!canvas) return null;

  const canvasJson = stripOverlayFromFabricJson(canvas.toJSON(customProps));
  const bg = canvas.backgroundColor;
  const bgString = typeof bg === 'string'
    ? bg
    : bg?.toHex?.() ?? meta.backgroundColor ?? '#ffffff';

  return {
    id: meta.sheetId,
    name: meta.sheetName || 'Hoja 1',
    pageSizeKey: meta.pageSizeKey,
    backgroundColor: canvas.backgroundImage ? (meta.backgroundColor ?? '') : bgString,
    pageOverlayType: meta.pageOverlayType,
    pageOverlaySpacing: meta.pageOverlaySpacing,
    pageOverlayColor: meta.pageOverlayColor,
    canvas: canvasJson,
  };
}

/** Proyectos v1 (una sola hoja) → lista de hojas. */
export function normalizeProjectSheets(project) {
  if (!project) return [];
  if (Array.isArray(project.sheets) && project.sheets.length) {
    return project.sheets.map((sheet, index) => ({
      id: sheet.id || `sheet-${index + 1}`,
      name: sheet.name || `Hoja ${index + 1}`,
      pageSizeKey: sheet.pageSizeKey,
      backgroundColor: sheet.backgroundColor,
      pageOverlayType: sheet.pageOverlayType,
      pageOverlaySpacing: sheet.pageOverlaySpacing,
      pageOverlayColor: sheet.pageOverlayColor,
      canvas: sheet.canvas,
    }));
  }
  if (!project.canvas) return [];
  return [{
    id: `${project.id || 'project'}-sheet-1`,
    name: 'Hoja 1',
    pageSizeKey: project.pageSizeKey,
    backgroundColor: project.backgroundColor,
    pageOverlayType: project.pageOverlayType,
    pageOverlaySpacing: project.pageOverlaySpacing,
    pageOverlayColor: project.pageOverlayColor,
    canvas: project.canvas,
  }];
}

export async function buildProjectFromSheets({
  projectId,
  name,
  activeSheetId,
  sheets,
}) {
  const embeddedSheets = await Promise.all(
    sheets.map(async (sheet) => {
      const rawCanvas = typeof sheet.canvas === 'string'
        ? JSON.parse(sheet.canvas)
        : sheet.canvas;
      return {
        ...sheet,
        canvas: await embedImagesInFabricJson(stripOverlayFromFabricJson(rawCanvas)),
      };
    }),
  );

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: projectId,
    name,
    activeSheetId,
    sheets: embeddedSheets,
    updatedAt: new Date().toISOString(),
  };
}

/** @deprecated Usar buildProjectFromSheets con varias hojas. */
export async function buildProjectSnapshot({
  canvas,
  customProps,
  meta,
}) {
  if (!canvas) return null;

  const sheet = captureSheetFromCanvas(canvas, customProps, {
    sheetId: `${meta.id || 'project'}-sheet-1`,
    sheetName: 'Hoja 1',
    pageSizeKey: meta.pageSizeKey,
    backgroundColor: meta.backgroundColor,
    pageOverlayType: meta.pageOverlayType,
    pageOverlaySpacing: meta.pageOverlaySpacing,
    pageOverlayColor: meta.pageOverlayColor,
  });
  if (!sheet) return null;

  const embedded = await embedImagesInFabricJson(sheet.canvas);
  return buildProjectFromSheets({
    projectId: canvas.projectId || meta.id,
    name: meta.name,
    activeSheetId: sheet.id,
    sheets: [{ ...sheet, canvas: embedded }],
  });
}
