import { jsPDF } from 'jspdf';
import { createExportFilter, sanitizeFilename } from './projectPersistence';

const DEFAULT_MULTIPLIER = 3;

export { sanitizeFilename };

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getCanvasBaseSize(canvas) {
  const zoom = canvas.getZoom?.() || 1;
  return {
    width: canvas.baseWidth ?? canvas.getWidth() / zoom,
    height: canvas.baseHeight ?? canvas.getHeight() / zoom,
  };
}

function getBackgroundColor(canvas) {
  const bg = canvas.backgroundColor;
  if (!bg) return '#ffffff';
  if (typeof bg === 'string') return bg;
  return bg.toHex?.() ?? '#ffffff';
}

/** Normaliza zoom, tamaño y oculta guías antes de exportar; devuelve función restore(). */
export function beginCanvasExport(canvas) {
  const { width, height } = getCanvasBaseSize(canvas);
  const session = {
    prevWidth: canvas.getWidth(),
    prevHeight: canvas.getHeight(),
    prevVt: canvas.viewportTransform?.slice() ?? [1, 0, 0, 1, 0, 0],
    prevBg: canvas.backgroundColor,
    overlays: [],
  };

  canvas.getObjects().forEach((obj) => {
    if (obj.overlayLayer || obj.name === '__pageOverlay') {
      session.overlays.push({ obj, visible: obj.visible });
      obj.set('visible', false);
    }
  });

  canvas.setDimensions({ width, height });
  canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
  canvas.calcOffset();
  canvas.backgroundColor = getBackgroundColor(canvas);
  canvas.requestRenderAll();

  return () => {
    session.overlays.forEach(({ obj, visible }) => obj.set('visible', visible));
    canvas.setDimensions({ width: session.prevWidth, height: session.prevHeight });
    canvas.setViewportTransform(session.prevVt);
    canvas.backgroundColor = session.prevBg;
    canvas.calcOffset();
    canvas.requestRenderAll();
  };
}

export async function exportCanvasRaster(canvas, format, filename, options = {}) {
  const { width, height } = getCanvasBaseSize(canvas);
  const {
    multiplier = DEFAULT_MULTIPLIER,
    quality = format === 'jpeg' ? 0.92 : 1,
  } = options;
  const filter = createExportFilter();
  const restore = beginCanvasExport(canvas);

  try {
    const dataUrl = canvas.toDataURL({
      format,
      quality,
      multiplier,
      enableRetinaScaling: false,
      left: 0,
      top: 0,
      width,
      height,
      filter,
    });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    downloadBlob(blob, filename);
  } finally {
    restore();
  }
}

export async function exportCanvasPNG(canvas, filename = 'ficha.png', multiplier = DEFAULT_MULTIPLIER) {
  await exportCanvasRaster(canvas, 'png', filename, { multiplier, quality: 1 });
}

export async function exportCanvasJPEG(canvas, filename = 'ficha.jpg', multiplier = DEFAULT_MULTIPLIER) {
  await exportCanvasRaster(canvas, 'jpeg', filename, { multiplier, quality: 0.92 });
}

export async function exportCanvasWebP(canvas, filename = 'ficha.webp', multiplier = DEFAULT_MULTIPLIER) {
  await exportCanvasRaster(canvas, 'webp', filename, { multiplier, quality: 0.92 });
}

export function exportCanvasSVG(canvas, filename = 'ficha.svg') {
  const { width, height } = getCanvasBaseSize(canvas);
  const restore = beginCanvasExport(canvas);

  try {
    const svg = canvas.toSVG({
      viewBox: { x: 0, y: 0, width, height },
      width: `${width}`,
      height: `${height}`,
    });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, filename);
  } finally {
    restore();
  }
}

export async function exportCanvasPDF(canvas, filename = 'ficha.pdf', multiplier = DEFAULT_MULTIPLIER) {
  const { width, height } = getCanvasBaseSize(canvas);
  const filter = createExportFilter();
  const restore = beginCanvasExport(canvas);

  try {
    const dataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier,
      enableRetinaScaling: false,
      left: 0,
      top: 0,
      width,
      height,
      filter,
    });
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(filename);
  } finally {
    restore();
  }
}

export function exportProjectJSON(project, filename = 'proyecto.json') {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}
