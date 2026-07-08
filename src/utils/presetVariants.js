import { FabricObject } from 'fabric';
import { PRESET_CATEGORIES } from '../constants/presetCatalog';
import { getPresetShape } from '../constants/presetShapes';
import { resolveAssetUrl } from './assetUrl';
import { loadFabricImageFromAsset } from './loadFabricImage';
import { swapCanvasObject } from './canvasObjectUtils';
import { CANVAS_CUSTOM_PROPS, replaceSignalNumberObject } from './signalNumberOverlay';
import { replaceTrayectoObject } from './trayectoLine';

const ASPECT_PATTERN = /(verdedestellos|verdeamarillo|amarillodestellos|rojoblanco|amarillo|destellos|rojo|verde)/gi;
const ASPECT_KEYWORD = /(verdedestellos|verdeamarillo|amarillodestellos|rojoblanco|amarillo|destellos|rojo|verde)/i;

let fabricCustomPropsRegistered = false;

export function registerFabricCustomProps() {
  if (fabricCustomPropsRegistered) return;
  fabricCustomPropsRegistered = true;
  const existing = new Set(FabricObject.customProperties || []);
  CANVAS_CUSTOM_PROPS.forEach((prop) => existing.add(prop));
  FabricObject.customProperties = [...existing];
}

export function getObjectPresetId(obj) {
  if (!obj) return undefined;
  return obj.presetId ?? obj.get?.('presetId');
}

export function findPresetHost(obj) {
  if (!obj) return null;
  if (getObjectPresetId(obj)) return obj;
  if (obj.type === 'group' && typeof obj.getObjects === 'function') {
    return obj.getObjects().find((child) => getObjectPresetId(child)) ?? null;
  }
  if (obj.type === 'activeSelection' && typeof obj.getObjects === 'function') {
    return obj.getObjects().find((child) => getObjectPresetId(child)) ?? null;
  }
  return null;
}

function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\s-]+/g, '');
}

function cartelonFamilyKey(compact) {
  if (!compact.startsWith('cartelon')) return null;
  if (compact === 'cartelonc') return 'cartelon-c';
  return 'cartelon-ea-ec';
}

function isAvSignalLabel(compact) {
  return /^av/.test(compact);
}

function isAvOffVariant(compact) {
  return compact === 'av' || compact === 'avblanco';
}

const AV_ASPECT_LABELS = {
  av: 'Apagada',
  avblanco: 'Apagada',
  avamarillo: 'Amarillo',
  avamarillodestellos: 'Amarillo destellos',
  avrojo: 'Rojo',
  avrojoazul: 'Rojo azul',
  avrojoazuldestellos: 'Rojo azul destellos',
  avrojoblanco: 'Rojo blanco',
  avrojoblancodestellos: 'Rojo blanco destellos',
  avverde: 'Verde',
  avverdeamarillo: 'Verde amarillo',
};

const AV_ASPECT_ORDER = Object.keys(AV_ASPECT_LABELS);

function avAspectOrderRank(compact) {
  const index = AV_ASPECT_ORDER.indexOf(compact);
  return index === -1 ? 999 : index;
}

function formatAvAspectLabel(compact) {
  return AV_ASPECT_LABELS[compact] ?? null;
}

function sortAspectVariants(variants) {
  return variants.slice().sort((a, b) => {
    const aCompact = normalizeLabel(a?.label || a?.name);
    const bCompact = normalizeLabel(b?.label || b?.name);
    if (isAvSignalLabel(aCompact) && isAvSignalLabel(bCompact)) {
      return avAspectOrderRank(aCompact) - avAspectOrderRank(bCompact);
    }
    return aspectRank(a) - aspectRank(b);
  });
}

export function variantFamilyKey(shape) {
  const compact = normalizeLabel(shape?.label || shape?.name);
  if (!compact) return shape?.id || '';
  if (isAvSignalLabel(compact)) return 'av';
  const cartelonKey = cartelonFamilyKey(compact);
  if (cartelonKey) return cartelonKey;
  if (compact.startsWith('retroceso')) return 'retroceso';
  const stripped = compact.replace(ASPECT_PATTERN, '').trim();
  return stripped || 'senal';
}

function hasAspectKeyword(shape) {
  const compact = normalizeLabel(shape?.label || shape?.name);
  if (isAvOffVariant(compact)) return false;
  if (isAvSignalLabel(compact)) return true;
  return ASPECT_KEYWORD.test(compact);
}

function aspectRank(shape) {
  const compact = normalizeLabel(shape?.label || shape?.name);
  if (isAvOffVariant(compact)) return 0;
  if (/apagado/.test(compact)) return 0;
  if (/^senal$/.test(compact)) return 0;
  if (/^senalcon/.test(compact)) return 1;
  if (compact === 'retroceso') return 0;
  if (hasAspectKeyword(shape)) return 100;
  if (cartelonFamilyKey(compact)) return 50;
  return 50;
}

function pickBaseVariant(shapes) {
  const withoutColor = shapes.filter((shape) => !hasAspectKeyword(shape));
  const pool = withoutColor.length ? withoutColor : shapes;
  return pool.slice().sort((a, b) => aspectRank(a) - aspectRank(b))[0];
}

export function getBaseVariantId(presetId) {
  const variants = getPresetVariants(presetId);
  if (variants.length <= 1) return presetId;
  return pickBaseVariant(variants).id;
}

export function getSignalTypeBaseId(presetId) {
  return getBaseVariantId(presetId);
}

function isSwappableImagePreset(shape) {
  return Boolean(shape?.imageAsset && !shape.svgAsset && !shape.path);
}

function isTrayectoPreset(shape) {
  return Boolean(shape?.customStationCount && shape?.vectorTrayecto);
}

export function formatSignalTypeLabel(item) {
  if (!item) return '';
  if (item.groupLabel) return `${item.categoryLabel} · ${item.groupLabel}`;
  return `${item.categoryLabel} · ${item.preset?.label ?? ''}`;
}

export function getSwappableSignalTypes(currentPresetId) {
  const current = currentPresetId ? getPresetShape(currentPresetId) : null;
  const trayectoMode = isTrayectoPreset(current);
  const items = [];

  for (const cat of PRESET_CATEGORIES) {
    for (const group of cat.groups) {
      const bases = filterPickerGridShapes(group.shapes).filter((shape) => {
        if (!isSwappableImagePreset(shape)) return false;
        if (isTrayectoPreset(shape)) return trayectoMode;
        return !trayectoMode;
      });

      for (const preset of bases) {
        const familyKey = variantFamilyKey(preset);
        let shortLabel = group.label || preset.label;
        if (familyKey === 'cartelon-ea-ec') {
          shortLabel = 'Cartelón EA/EC';
        } else if (cat.label === 'AC cerradas' && preset.label?.startsWith('Cartelón')) {
          shortLabel = preset.label.replace(/^Cartelón\s*/i, '');
        }
        items.push({
          preset,
          categoryLabel: cat.label,
          groupLabel: group.label,
          shortLabel,
        });
      }
    }
  }

  return items;
}

export function mapAspectToVariant(targetBasePresetId, sourcePresetId) {
  const baseId = getBaseVariantId(targetBasePresetId);
  if (!sourcePresetId || sourcePresetId === baseId) return baseId;

  const sourcePreset = getPresetShape(sourcePresetId);
  const aspectLabel = formatSignalAspectLabel(sourcePreset);
  const variants = getPresetVariants(baseId);
  if (!variants.length) return baseId;

  const match = variants.find((variant) => formatSignalAspectLabel(variant) === aspectLabel);
  return match?.id ?? baseId;
}

/** En la rejilla de inserción solo se muestra la señal vacía/apagada de cada familia. */
export function filterPickerGridShapes(shapes) {
  if (!shapes?.length) return [];

  const familyBuckets = new Map();
  for (const shape of shapes) {
    if (!shape.imageAsset || shape.vectorTrayecto || shape.customStationCount) continue;
    const key = variantFamilyKey(shape);
    if (!familyBuckets.has(key)) familyBuckets.set(key, []);
    familyBuckets.get(key).push(shape);
  }

  const hiddenIds = new Set();
  for (const family of familyBuckets.values()) {
    if (family.length <= 1) continue;
    const base = pickBaseVariant(family);
    for (const shape of family) {
      if (shape.id !== base.id) hiddenIds.add(shape.id);
    }
  }

  if (!hiddenIds.size) return shapes;
  return shapes.filter((shape) => !hiddenIds.has(shape.id));
}

function findGroupShapes(presetId) {
  if (!presetId) return null;
  for (const cat of PRESET_CATEGORIES) {
    for (const group of cat.groups) {
      if (group.shapes.some((shape) => shape.id === presetId)) {
        return group.shapes;
      }
    }
  }
  return null;
}

export function getPresetVariants(presetId) {
  const groupShapes = findGroupShapes(presetId);
  if (!groupShapes || groupShapes.length < 2) return [];

  if (groupShapes.some((shape) => shape.vectorTrayecto || shape.customStationCount)) {
    return [];
  }

  const imageShapes = groupShapes.filter((shape) => shape.imageAsset);
  if (imageShapes.length < 2) return [];

  const preset = getPresetShape(presetId);
  if (!preset) return [];

  const presetCompact = normalizeLabel(preset?.label || preset?.name);
  if (isAvSignalLabel(presetCompact)) {
    const avVariants = imageShapes.filter((shape) => (
      isAvSignalLabel(normalizeLabel(shape?.label || shape?.name))
    ));
    return avVariants.length >= 2 ? sortAspectVariants(avVariants) : [];
  }

  const familyKey = variantFamilyKey(preset);
  const sameFamily = imageShapes.filter((shape) => variantFamilyKey(shape) === familyKey);
  return sameFamily.length >= 2 ? sortAspectVariants(sameFamily) : [];
}

export function formatSignalAspectLabel(shape) {
  const raw = shape?.label || shape?.name || '';
  const compact = normalizeLabel(raw);

  const avLabel = formatAvAspectLabel(compact);
  if (avLabel) return avLabel;

  if (/cartelon/.test(compact)) {
    if (/apagado/.test(compact)) return 'Apagada';
    if (/eaencendido/.test(compact) || (compact.includes('ea') && compact.includes('encendido'))) return 'EA';
    if (/ecencendido/.test(compact) || (compact.includes('ec') && compact.includes('encendido'))) return 'EC';
    if (compact === 'cartelonc') return 'C';
  }

  if (/verdedestellos/.test(compact)) return 'Verde destellos';
  if (/verdeamarillo/.test(compact)) return 'Verde amarillo';
  if (/amarillodestellos/.test(compact)) return 'Amarillo destellos';
  if (/rojoblanco/.test(compact)) return 'Rojo blanco';
  if (/\brojo/.test(compact) || compact.includes('rojo')) return 'Rojo';
  if (/\bverde/.test(compact) || compact.includes('verde')) return 'Verde';
  if (/\bamarillo/.test(compact) || compact.includes('amarillo')) return 'Amarillo';
  if (/^senal$/.test(compact)) return 'Apagada';
  if (/^senalcon/.test(compact) || compact.startsWith('senalcon')) return 'Apagada';
  if (/^retroceso$/.test(compact)) return 'Retroceso';
  if (/retrocesodesviada/.test(compact)) return 'Desviada';
  if (/retrocesodirecta/.test(compact)) return 'Directa';
  if (/retrocesorojoblanco/.test(compact)) return 'Rojo blanco';
  if (/retrocesorojo/.test(compact)) return 'Rojo';

  const cleaned = raw
    .replace(/^Señal/i, '')
    .replace(/^senal/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  return cleaned || raw || 'Variante';
}

export async function replacePresetSignal(canvas, obj, newPresetId, options = {}) {
  if (!canvas || !obj || !newPresetId) return null;

  const target = findPresetHost(obj) || obj;
  const newPreset = getPresetShape(newPresetId);
  if (!newPreset) return null;

  if (isTrayectoPreset(newPreset)) {
    return replaceTrayectoObject(canvas, target, newPreset, {
      stationCount: options.stationCount ?? target.customStationCountValue ?? newPreset.defaultStationCount,
      stationGap: options.stationGap ?? target.trayectoStationGap,
      stationWidth: options.stationWidth ?? target.trayectoStationWidth,
    });
  }

  if (!newPreset.imageAsset) return null;

  if (newPreset.customNumber) {
    return replaceSignalNumberObject(canvas, target, newPreset, {
      numberValues: options.numberValues ?? target.customNumberValues,
      numberText: options.numberText ?? target.customNumberValue,
      arrowDirection: options.arrowDirection ?? target.customArrowDirection,
    });
  }

  const displayW = target.getScaledWidth?.() ?? (target.width || newPreset.width) * (target.scaleX || 1);
  const displayH = target.getScaledHeight?.() ?? (target.height || newPreset.height) * (target.scaleY || 1);

  const img = await loadFabricImageFromAsset(newPreset.imageAsset);
  const { width: nativeW, height: nativeH } = img.getOriginalSize();
  const nativeWidth = nativeW || newPreset.width || 1;
  const nativeHeight = nativeH || newPreset.height || 1;

  img.set({
    left: target.left,
    top: target.top,
    angle: target.angle ?? 0,
    originX: target.originX,
    originY: target.originY,
    flipX: target.flipX,
    flipY: target.flipY,
    scaleX: displayW / nativeWidth,
    scaleY: displayH / nativeHeight,
    id: target.id,
    presetId: newPreset.id,
    name: newPreset.name,
    customNumber: false,
    customNumberValue: '',
    customArrow: false,
    customArrowDirection: undefined,
    objectCaching: false,
    opacity: target.opacity ?? 1,
  });

  return swapCanvasObject(canvas, target, img);
}

export async function replacePresetVariant(canvas, obj, newPresetId, options = {}) {
  if (!canvas || !obj || !newPresetId) return null;

  const target = findPresetHost(obj) || obj;
  const currentPresetId = getObjectPresetId(target);
  if (!currentPresetId) return null;

  const allowed = getPresetVariants(currentPresetId);
  if (!allowed.some((shape) => shape.id === newPresetId)) return null;

  return replacePresetSignal(canvas, obj, newPresetId, options);
}
