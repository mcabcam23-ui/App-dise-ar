import { FabricImage } from 'fabric';
import { resolveAssetUrl } from './assetUrl';
import { loadImageElement, applyCrispImageSettings } from './loadFabricImage';
import { swapCanvasObject } from './canvasObjectUtils';

const CANVAS_CUSTOM_PROPS = [
  'id',
  'name',
  'strokeOnly',
  'fillOnly',
  'presetId',
  'customNumber',
  'customNumberValue',
  'multiNumber',
  'customNumberValues',
  'customArrow',
  'customArrowDirection',
  'customStationCount',
  'customStationCountValue',
  'trayectoStationGap',
  'trayectoStationWidth',
  'vectorTrayecto',
  'trayectoTrackMode',
  'overlayLayer',
  'erasable',
  'eraserForLayer',
  'globalEraser',
  'trackAttachId',
  'trackAttachLocal',
  'trackAttachMatrix',
];

export { CANVAS_CUSTOM_PROPS };

/** Tamaño base de números en señales (Preanuncio/Velocidad llevan fontBoost en catálogo). */
export const NUMBER_FONT_BOOST = 1.5;

/** Supersampling al rasterizar número + imagen (más nítido al escalar en lienzo). */
const NUMBER_RENDER_MULTIPLIER = 3;
const MIN_RASTER_SIDE = 48;

function renderMultiplier(w, h) {
  const minSide = Math.min(w, h);
  const boost = minSide < MIN_RASTER_SIDE ? Math.ceil(MIN_RASTER_SIDE / minSide) : 1;
  return NUMBER_RENDER_MULTIPLIER * boost;
}

/** En señales con varios huecos, el tamaño se calibra como para este ancho de dígitos. */
const MULTI_SLOT_SIZING_DIGITS = 3;

function sizingReference(text, multiSlot = false) {
  if (multiSlot) return '0'.repeat(MULTI_SLOT_SIZING_DIGITS);
  const trimmed = String(text ?? '').trim();
  return trimmed || '100';
}

function measureFontSize(h, overlay, text, multiSlot = false) {
  if (overlay.fontSizePx > 0) {
    return overlay.fontSizePx;
  }
  const ref = sizingReference(text, multiSlot);
  const digits = ref.length;
  const ratio = overlay.fontSizeRatio ?? 0.07;
  const boost = overlay.fontBoost ?? NUMBER_FONT_BOOST;
  const digitBoost = digits <= 2 ? 1.0 : digits === 3 ? 0.72 : 0.64;
  return Math.max(8, h * ratio * boost * digitBoost);
}

function estimateTextWidth(text, fontSize) {
  return String(text).length * fontSize * 0.61;
}

function fitFontSize(height, width, overlay, text, ctx = null, multiSlot = false) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return 8;
  const fontFamily = overlay.fontFamily || 'Arial Black, Arial, sans-serif';
  const maxW = width * (overlay.maxWidthRatio ?? 0.58);
  const sizeRef = sizingReference(trimmed, multiSlot);
  if (overlay.fontSizePx > 0) {
    return overlay.fontSizePx;
  }
  let fontSize = measureFontSize(height, overlay, sizeRef, multiSlot);
  const softCap = measureFontSize(height, overlay, sizeRef, multiSlot) * 1.08;
  if (fontSize > softCap) fontSize = softCap;
  if (ctx) {
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    while (fontSize > 7 && ctx.measureText(trimmed).width > maxW) {
      fontSize -= 1;
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
    }
    return fontSize;
  }
  while (fontSize > 7 && estimateTextWidth(trimmed, fontSize) > maxW) {
    fontSize -= 1;
  }
  return Math.max(7, fontSize);
}

export function previewSignalFontSize(height, overlay, text, width = null, multiSlot = false) {
  const ov = overlay || {};
  if (ov.fontSizePx > 0 && !width) {
    return Math.max(8, Math.round(ov.fontSizePx));
  }
  const fontSize = width
    ? fitFontSize(height, width, ov, text, null, multiSlot)
    : measureFontSize(height, ov, text, multiSlot);
  return Math.max(8, Math.round(fontSize));
}

export function isMultiNumberPreset(preset) {
  return getNumberSlots(preset).length > 1;
}

/** Devuelve la lista de huecos de número de una señal (1 o varios). */
export function getNumberSlots(preset) {
  if (Array.isArray(preset?.numberOverlays) && preset.numberOverlays.length) {
    return preset.numberOverlays;
  }
  if (preset?.numberOverlay) return [preset.numberOverlay];
  return [];
}

/** Normaliza el valor (string o array) a un array con una entrada por hueco. */
export function normalizeNumberValues(preset, value) {
  const slots = getNumberSlots(preset);
  const count = Math.max(1, slots.length);
  let source;
  if (Array.isArray(value)) source = value;
  else if (typeof value === 'string' && value.includes(',')) source = value.split(',');
  else source = [value];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push(String(source[i] ?? '').trim());
  }
  return out;
}

const imageElementCache = new Map();

function loadImageElementForOverlay(src) {
  const cached = imageElementCache.get(src);
  if (cached) return Promise.resolve(cached);
  return loadImageElement(src, { crossOrigin: 'anonymous' }).then((img) => {
    imageElementCache.set(src, img);
    return img;
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

  const img = await loadImageElementForOverlay(resolveAssetUrl(overlay.imageAsset));
  const aw = Math.max(1, w * (overlay.widthRatio ?? 0.08));
  const ah = Math.max(1, h * (overlay.heightRatio ?? 0.03));
  const ax = w * (overlay.leftRatio ?? 0.5);
  const ay = h * (overlay.topRatio ?? 0.7);
  ctx.drawImage(img, ax, ay, aw, ah);
}

function drawNumberSlot(ctx, overlay, w, h, value, multiSlot = false) {
  const text = String(value ?? '').trim();
  if (!text) return;
  const fontFamily = overlay.fontFamily || 'Arial Black, Arial, sans-serif';
  const fontSize = fitFontSize(h, w, overlay, text, ctx, multiSlot);
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = overlay.fill || '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w * (overlay.leftRatio ?? 0.5), h * (overlay.topRatio ?? 0.5));
}

async function renderSignalNumberCanvas(
  imageUrl,
  preset,
  displayW,
  displayH,
  numberValue,
  arrowDirection = 'right',
) {
  const slots = getNumberSlots(preset);
  const isMulti = slots.length > 1;
  const values = normalizeNumberValues(preset, numberValue);
  const img = await loadImageElementForOverlay(imageUrl);
  const w = Math.max(1, Math.round(displayW));
  const h = Math.max(1, Math.round(displayH));
  const mult = renderMultiplier(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = w * mult;
  canvas.height = h * mult;
  const ctx = canvas.getContext('2d');
  ctx.scale(mult, mult);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;

  slots.forEach((overlay, i) => {
    // Señal de un único número: si está vacío se usa 100 (comportamiento previo).
    const value = isMulti ? values[i] : (values[i] || '100');
    drawNumberSlot(ctx, overlay, w, h, value, isMulti);
  });

  await drawArrowOverlay(ctx, preset, w, h, arrowDirection);

  return canvas;
}

export async function renderSignalNumberDataUrl(
  imageUrl,
  preset,
  displayW,
  displayH,
  numberValue,
  arrowDirection = 'right',
) {
  const canvas = await renderSignalNumberCanvas(
    imageUrl,
    preset,
    displayW,
    displayH,
    numberValue,
    arrowDirection,
  );
  return canvas.toDataURL('image/png');
}

function composeSignalName(baseName, values, isMulti) {
  const clean = (baseName || 'Señal').replace(/\s+[\d/]+$/, '').trim() || 'Señal';
  if (isMulti) {
    const joined = values.filter(Boolean).join('/');
    return joined ? `${clean} ${joined}` : clean;
  }
  const value = values[0] || '';
  return value ? `${clean} ${value}` : clean;
}

function presetNativeSize(preset, element = null) {
  return {
    width: element?.naturalWidth || preset?.width || 1,
    height: element?.naturalHeight || preset?.height || 1,
  };
}

export async function buildSignalWithNumber(_img, preset, displayW, displayH, numberValue, common, arrowDirection) {
  const slots = getNumberSlots(preset);
  const isMulti = slots.length > 1;
  const values = normalizeNumberValues(preset, numberValue);
  const dir = preset.customArrow
    ? resolveArrowDirection(preset, arrowDirection ?? preset.arrowOverlay?.defaultDirection)
    : undefined;
  const { width: nativeW, height: nativeH } = presetNativeSize(preset);
  const dataUrl = await renderSignalNumberDataUrl(
    resolveAssetUrl(preset.imageAsset),
    preset,
    nativeW,
    nativeH,
    isMulti ? values : (values[0] || '100'),
    dir,
  );
  const composed = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' });
  composed.set({
    ...common,
    customNumber: true,
    multiNumber: isMulti,
    customNumberValue: isMulti ? undefined : (values[0] || '100'),
    customNumberValues: isMulti ? values : undefined,
    customArrow: Boolean(preset.customArrow),
    customArrowDirection: dir,
    name: composeSignalName(preset.name, values, isMulti),
  });
  applyCrispImageSettings(composed, { displayW, displayH });
  return composed;
}

export async function replaceSignalNumberObject(canvas, obj, preset, options = {}) {
  if (!canvas || !obj || !preset || !preset.customNumber) return null;

  const slots = getNumberSlots(preset);
  const isMulti = slots.length > 1;
  const displayW = Math.max(1, Math.round(
    obj.getScaledWidth?.() ?? (obj.width || preset.width) * (obj.scaleX || 1),
  ));
  const displayH = Math.max(1, Math.round(
    obj.getScaledHeight?.() ?? (obj.height || preset.height) * (obj.scaleY || 1),
  ));
  const { width: nativeW, height: nativeH } = presetNativeSize(preset);

  const rawValue = options.numberValues
    ?? options.numberText
    ?? (isMulti ? obj.customNumberValues : obj.customNumberValue);
  const values = normalizeNumberValues(preset, rawValue);

  const arrowDirection = options.arrowDirection ?? obj.customArrowDirection ?? preset.arrowOverlay?.defaultDirection ?? 'right';
  const rasterCanvas = await renderSignalNumberCanvas(
    resolveAssetUrl(preset.imageAsset),
    preset,
    nativeW,
    nativeH,
    isMulti ? values : (values[0] || '100'),
    arrowDirection,
  );
  if (options.isGenerationStale?.()) return null;

  const composed = new FabricImage(rasterCanvas);

  composed.set({
    left: obj.left,
    top: obj.top,
    angle: obj.angle ?? 0,
    originX: obj.originX,
    originY: obj.originY,
    flipX: obj.flipX,
    flipY: obj.flipY,
    id: obj.id,
    presetId: preset.id,
    customNumber: true,
    multiNumber: isMulti,
    customNumberValue: isMulti ? undefined : (values[0] || obj.customNumberValue || ''),
    customNumberValues: isMulti ? values : undefined,
    customArrow: Boolean(preset.customArrow),
    customArrowDirection: preset.customArrow ? arrowDirection : undefined,
    name: composeSignalName(obj.name || preset.name, values, isMulti),
    opacity: obj.opacity ?? 1,
    trackAttachId: obj.trackAttachId,
    trackAttachLocal: obj.trackAttachLocal,
  });
  applyCrispImageSettings(composed, { displayW, displayH });

  if (options.isGenerationStale?.()) return null;
  return swapCanvasObject(canvas, obj, composed);
}

export function patchSignalNumberValues(target, preset, { numberText, numberValues } = {}) {
  if (!target || !preset?.customNumber) return;
  const slots = getNumberSlots(preset);
  const isMulti = slots.length > 1;
  const rawValue = numberValues ?? numberText ?? (isMulti ? target.customNumberValues : target.customNumberValue);
  const values = normalizeNumberValues(preset, rawValue);
  target.set({
    customNumber: true,
    multiNumber: isMulti,
    customNumberValue: isMulti ? undefined : (values[0] || target.customNumberValue || ''),
    customNumberValues: isMulti ? values : undefined,
    name: composeSignalName(target.name || preset.name, values, isMulti),
  });
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
