import { jsPDF } from 'jspdf';

const DEFAULT_MULTIPLIER = 3;

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

export async function exportCanvasRaster(canvas, format, filename, options = {}) {
  const { width, height } = getCanvasBaseSize(canvas);
  const {
    multiplier = DEFAULT_MULTIPLIER,
    quality = format === 'jpeg' ? 0.92 : 1,
  } = options;

  const dataUrl = canvas.toDataURL({
    format,
    quality,
    multiplier,
    enableRetinaScaling: true,
    width,
    height,
  });
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  downloadBlob(blob, filename);
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
  const svg = canvas.toSVG({
    viewBox: { x: 0, y: 0, width, height },
    width: `${width}`,
    height: `${height}`,
  });
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

export async function exportCanvasPDF(canvas, filename = 'ficha.pdf', multiplier = DEFAULT_MULTIPLIER) {
  const { width, height } = getCanvasBaseSize(canvas);
  const dataUrl = canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier,
    enableRetinaScaling: true,
    width,
    height,
  });
  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  pdf.save(filename);
}

export function exportProjectJSON(project, filename = 'proyecto.json') {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}
