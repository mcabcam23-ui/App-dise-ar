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
  'customArrow',
  'customArrowDirection',
];

export { CANVAS_CUSTOM_PROPS };

/** Compensa que la detección por píxeles subestima el tamaño visual del número. */
export const NUMBER_FONT_BOOST = 2.25;

function measureFontSize(h, overlay, text) {
  const ratio = overlay.fontSizeRatio ?? 0.07;
  const boost = overlay.fontBoost ?? NUMBER_FONT_BOOST;
  const digits = String(text ?? '').trim().length || 3;
  const digitBoost = digits <= 2 ? 1.08 : digits === 3 ? 1 : 0.9;
  return Math.max(8, h * ratio * boost * digitBoost);
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

function resolveArrowDirection(preset, arrowDirection) {
  const dir = arrowDirection === 'left' ? 'left' : 'right';
  if (preset?.arrowOverlay?.[dir]) return dir;
  return preset?.arrowOverlay?.defaultDirection === 'left' ? 'left' : 'right';
}

async function drawArrowOverlay(ctx, preset, w, h, arrowDirection) {
  if (!preset?.customArrow || !preset?.arrowOverlay) return;
  const dir = resolveArrowDirection(preset, arrowDirection);
  const overlay = preset.arrowOverlay[dir];
  if (!overlay?.imageAsset) return;

  const img = await loadImageElement(resolveAssetUrl(overlay.imageAsset));
  const aw = Math.max(1, w * (overlay.widthRatio ?? 0.08));
  const ah = Math.max(1, h * (overlay.heightRatio ?? 0.03));
  const ax = w * (overlay.leftRatio ?? 0.5);
  const ay = h * (overlay.topRatio ?? 0.7);
  ctx.drawImage(img, ax, ay, aw, ah);
}

export async function renderSignalNumberDataUrl(
  imageUrl,
  preset,
  displayW,
  displayH,
  numberText,
  arrowDirection = 'right',
) {
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

  await drawArrowOverlay(ctx, preset, w, h, arrowDirection);

  return canvas.toDataURL('image/png');
}

export async function buildSignalWithNumber(_img, preset, displayW, displayH, numberText, common, arrowDirection) {
  const value = String(numberText ?? '').trim() || '100';
  const dir = preset.customArrow
    ? resolveArrowDirection(preset, arrowDirection ?? preset.arrowOverlay?.defaultDirection)
    : undefined;
  const dataUrl = await renderSignalNumberDataUrl(
    resolveAssetUrl(preset.imageAsset),
    preset,
    displayW,
    displayH,
    value,
    dir,
  );
  const composed = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
  composed.set({
    ...common,
    customNumber: true,
    customNumberValue: value,
    customArrow: Boolean(preset.customArrow),
    customArrowDirection: dir,
    name: `${preset.name} ${value}`,
    objectCaching: false,
  });
  return composed;
}

export async function replaceSignalNumberObject(canvas, obj, preset, options = {}) {
  if (!canvas || !obj || !preset) return null;

  const w = obj.getScaledWidth?.() ?? (obj.width || preset.width) * (obj.scaleX || 1);
  const h = obj.getScaledHeight?.() ?? (obj.height || preset.height) * (obj.scaleY || 1);
  const value = String(options.numberText ?? obj.customNumberValue ?? '').trim();
  if (!value && !preset.customNumber) return null;

  const arrowDirection = options.arrowDirection ?? obj.customArrowDirection ?? preset.arrowOverlay?.defaultDirection ?? 'right';
  const dataUrl = await renderSignalNumberDataUrl(
    resolveAssetUrl(preset.imageAsset),
    preset,
    w,
    h,
    value || '100',
    arrowDirection,
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
    customNumberValue: value || obj.customNumberValue,
    customArrow: Boolean(preset.customArrow),
    customArrowDirection: preset.customArrow ? arrowDirection : undefined,
    name: `${baseName} ${value || obj.customNumberValue}`,
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

export function getArrowOverlayStyle(preset, direction, width, height) {
  if (!preset?.customArrow || !preset?.arrowOverlay) return null;
  const dir = resolveArrowDirection(preset, direction);
  const overlay = preset.arrowOverlay[dir];
  if (!overlay) return null;
  const w = width * (overlay.widthRatio ?? 0.08);
  const h = height * (overlay.heightRatio ?? 0.03);
  return {
    width: `${w}px`,
    height: `${h}px`,
    left: `${(overlay.leftRatio ?? 0.5) * 100}%`,
    top: `${(overlay.topRatio ?? 0.7) * 100}%`,
    objectFit: 'contain',
  };
}
