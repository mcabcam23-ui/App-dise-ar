import { FabricImage } from 'fabric';
import { resolveAssetUrl } from './assetUrl';

const CANVAS_CUSTOM_PROPS = [
  'id',
  'name',
  'strokeOnly',
  'fillOnly',
  'presetId',
  'customNumber',
  'customNumberValue',
];

export { CANVAS_CUSTOM_PROPS };

/** Compensa que la detección por píxeles subestima el tamaño visual del número. */
export const NUMBER_FONT_BOOST = 2.25;

function measureFontSize(h, overlay, text) {
  const ratio = overlay.fontSizeRatio ?? 0.07;
  const digits = String(text ?? '').trim().length || 3;
  const digitBoost = digits <= 2 ? 1.08 : digits === 3 ? 1 : 0.9;
  return Math.max(8, h * ratio * NUMBER_FONT_BOOST * digitBoost);
}

export function previewSignalFontSize(height, overlay, text) {
  return Math.max(8, Math.round(measureFontSize(height, overlay || {}, text)));
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderSignalNumberDataUrl(imageUrl, preset, displayW, displayH, numberText) {
  const overlay = preset.numberOverlay || {};
  const value = String(numberText ?? '').trim() || '100';
  const img = await loadImageElement(imageUrl);
  const w = Math.max(1, Math.round(displayW));
  const h = Math.max(1, Math.round(displayH));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  const fontSize = measureFontSize(h, overlay, value);
  ctx.font = `bold ${fontSize}px ${overlay.fontFamily || 'Arial Black, Arial, sans-serif'}`;
  ctx.fillStyle = overlay.fill || '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, w * (overlay.leftRatio ?? 0.5), h * (overlay.topRatio ?? 0.5));

  return canvas.toDataURL('image/png');
}

export async function buildSignalWithNumber(_img, preset, displayW, displayH, numberText, common) {
  const value = String(numberText ?? '').trim() || '100';
  const dataUrl = await renderSignalNumberDataUrl(
    resolveAssetUrl(preset.imageAsset),
    preset,
    displayW,
    displayH,
    value,
  );
  const composed = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
  composed.set({
    ...common,
    customNumber: true,
    customNumberValue: value,
    name: `${preset.name} ${value}`,
    objectCaching: false,
  });
  return composed;
}

export async function replaceSignalNumberObject(canvas, obj, preset, numberText) {
  if (!canvas || !obj || !preset) return null;

  const w = obj.getScaledWidth?.() ?? (obj.width || preset.width) * (obj.scaleX || 1);
  const h = obj.getScaledHeight?.() ?? (obj.height || preset.height) * (obj.scaleY || 1);
  const value = String(numberText ?? '').trim();
  if (!value) return null;

  const dataUrl = await renderSignalNumberDataUrl(
    resolveAssetUrl(preset.imageAsset),
    preset,
    w,
    h,
    value,
  );
  const composed = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
  const baseName = (obj.name || preset.name || 'Señal').replace(/\s+\d+$/, '').trim() || preset.name;

  composed.set({
    left: obj.left,
    top: obj.top,
    angle: obj.angle ?? 0,
    scaleX: 1,
    scaleY: 1,
    id: obj.id,
    presetId: preset.id,
    customNumber: true,
    customNumberValue: value,
    name: `${baseName} ${value}`,
    objectCaching: false,
    opacity: obj.opacity ?? 1,
  });

  const index = canvas.getObjects().indexOf(obj);
  const wasActive = canvas.getActiveObject() === obj;
  canvas.remove(obj);
  if (index >= 0) canvas.insertAt(index, composed);
  else canvas.add(composed);
  if (wasActive) canvas.setActiveObject(composed);
  canvas.requestRenderAll();
  return composed;
}

export function updateSignalNumber(group, newValue) {
  void group;
  void newValue;
}
