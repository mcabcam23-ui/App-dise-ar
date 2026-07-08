import { Path, Point, util } from 'fabric';
import { getPresetShape } from '../constants/presetCatalog';
import { swapCanvasObject } from './canvasObjectUtils';

export const TRAYECTO_CANVAS_PROPS = [
  'customStationCount',
  'customStationCountValue',
  'trayectoStationGap',
  'trayectoStationWidth',
  'vectorTrayecto',
  'trayectoTrackMode',
];

export const TRAYECTO_TRACK_MODES = {
  SINGLE: 'single',
  DOUBLE: 'double',
};

const DEFAULT_STATIONS = 6;

/** Tamaño fijo de estación y márgenes (PNG 984×83, 6 estaciones). */
const NATIVE = {
  marginL: 54,
  marginR: 60,
  stationW: 62,
  gapW: 100,
  height: 83,
  yTop: 25,
  yBase: 58,
  topWidth: 40,
};

const STATION_WIDTH_MIN = 20;
const STATION_WIDTH_MAX = 200;
const STATION_GAP_MIN = 20;
const STATION_GAP_MAX = 400;

function clampStationCount(count, preset) {
  const min = preset?.minStationCount ?? 1;
  const max = preset?.maxStationCount ?? 24;
  const n = Math.round(Number(count) || DEFAULT_STATIONS);
  return Math.min(max, Math.max(min, n));
}

function clampStationWidth(value, preset) {
  const min = preset?.minStationWidth ?? STATION_WIDTH_MIN;
  const max = preset?.maxStationWidth ?? STATION_WIDTH_MAX;
  const n = Math.round(Number(value) || NATIVE.stationW);
  return Math.min(max, Math.max(min, n));
}

function clampStationGap(value, preset) {
  const min = preset?.minStationGap ?? STATION_GAP_MIN;
  const max = preset?.maxStationGap ?? STATION_GAP_MAX;
  const n = Math.round(Number(value) || NATIVE.gapW);
  return Math.min(max, Math.max(min, n));
}

export function resolveTrayectoGeometry(source = {}, preset) {
  return {
    stationW: clampStationWidth(
      source.trayectoStationWidth ?? preset?.defaultStationWidth ?? NATIVE.stationW,
      preset,
    ),
    gapW: clampStationGap(
      source.trayectoStationGap ?? preset?.defaultStationGap ?? NATIVE.gapW,
      preset,
    ),
  };
}

export function trayectoDefaultStationWidth(preset) {
  return clampStationWidth(preset?.defaultStationWidth ?? NATIVE.stationW, preset);
}

export function trayectoDefaultStationGap(preset) {
  return clampStationGap(preset?.defaultStationGap ?? NATIVE.gapW, preset);
}

function resolveTrackMode(preset) {
  return preset?.trayectoTrackMode === TRAYECTO_TRACK_MODES.DOUBLE
    ? TRAYECTO_TRACK_MODES.DOUBLE
    : TRAYECTO_TRACK_MODES.SINGLE;
}

export function trayectoNativeWidth(_preset, stationCount, geometry) {
  const n = clampStationCount(stationCount, _preset);
  const { stationW, gapW } = resolveTrayectoGeometry(geometry, _preset);
  return NATIVE.marginL + n * stationW + Math.max(0, n - 1) * gapW + NATIVE.marginR;
}

export function trayectoNativeHeight(preset) {
  return preset?.height ?? NATIVE.height;
}

function layout(stationCount, geometry, preset) {
  const n = Math.max(1, Math.round(stationCount));
  const { stationW, gapW } = resolveTrayectoGeometry(geometry, preset);
  const W = trayectoNativeWidth(preset, n, { trayectoStationWidth: stationW, trayectoStationGap: gapW });
  const stations = [];

  for (let i = 0; i < n; i += 1) {
    const x0 = NATIVE.marginL + i * (stationW + gapW);
    stations.push({
      x0,
      x1: x0 + stationW,
      cx: x0 + stationW / 2,
    });
  }

  return { n, W, stations };
}

function fmt(n) {
  return n.toFixed(2);
}

function scaledY(H, y) {
  return (H / NATIVE.height) * y;
}

function stationTopSpan(scaleY) {
  return (NATIVE.topWidth / 2) * scaleY;
}

/** Vía única: línea recta inferior completa + trapezios encima. */
function buildSingleTrackPath(stationCount, height, geometry, preset) {
  const H = Math.max(8, height);
  const { n, W, stations } = layout(stationCount, geometry, preset);
  const yTop = scaledY(H, NATIVE.yTop);
  const yBase = scaledY(H, NATIVE.yBase);
  const topHalf = stationTopSpan(H / NATIVE.height);
  const parts = [`M 0 ${fmt(yBase)} L ${fmt(W)} ${fmt(yBase)}`];

  for (let i = 0; i < n; i += 1) {
    const { x0, x1, cx } = stations[i];
    const xTL = cx - topHalf;
    const xTR = cx + topHalf;

    parts.push(
      `M ${fmt(x0)} ${fmt(yBase)}`,
      `L ${fmt(xTL)} ${fmt(yTop)}`,
      `L ${fmt(xTR)} ${fmt(yTop)}`,
      `L ${fmt(x1)} ${fmt(yBase)}`,
    );
  }

  return parts.join(' ');
}

/** Vía doble: dos líneas rectas completas + trapezios entre ellas (sin relleno). */
function buildDoubleTrackPath(stationCount, height, geometry, preset) {
  const H = Math.max(8, height);
  const { n, W, stations } = layout(stationCount, geometry, preset);
  const yTop = scaledY(H, NATIVE.yTop);
  const yBase = scaledY(H, NATIVE.yBase);
  const topHalf = stationTopSpan(H / NATIVE.height);
  const parts = [
    `M 0 ${fmt(yTop)} L ${fmt(W)} ${fmt(yTop)}`,
    `M 0 ${fmt(yBase)} L ${fmt(W)} ${fmt(yBase)}`,
  ];

  for (let i = 0; i < n; i += 1) {
    const { x0, x1, cx } = stations[i];
    const xTL = cx - topHalf;
    const xTR = cx + topHalf;

    parts.push(
      `M ${fmt(x0)} ${fmt(yBase)} L ${fmt(xTL)} ${fmt(yTop)}`,
      `M ${fmt(xTR)} ${fmt(yTop)} L ${fmt(x1)} ${fmt(yBase)}`,
    );
  }

  return parts.join(' ');
}

export function buildTrayectoPathData(
  stationCount,
  height,
  trackMode = TRAYECTO_TRACK_MODES.SINGLE,
  geometry = {},
  preset = null,
) {
  return trackMode === TRAYECTO_TRACK_MODES.DOUBLE
    ? buildDoubleTrackPath(stationCount, height, geometry, preset)
    : buildSingleTrackPath(stationCount, height, geometry, preset);
}

function createTrayectoPath(pathData, style) {
  return new Path(pathData, {
    fill: '',
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeLineJoin: 'miter',
    strokeLineCap: 'butt',
    strokeUniform: true,
    objectCaching: false,
  });
}

export function buildTrayectoShape(
  preset,
  stationCount,
  displayW,
  displayH,
  common,
  { stroke = '#000000', strokeWidth = 2, stationGap, stationWidth } = {},
) {
  const count = clampStationCount(stationCount, preset);
  const trackMode = resolveTrackMode(preset);
  const geometry = resolveTrayectoGeometry({
    trayectoStationGap: stationGap,
    trayectoStationWidth: stationWidth,
  }, preset);
  const nativeW = trayectoNativeWidth(preset, count, {
    trayectoStationGap: geometry.gapW,
    trayectoStationWidth: geometry.stationW,
  });
  const nativeH = trayectoNativeHeight(preset);
  const pathData = buildTrayectoPathData(count, nativeH, trackMode, {
    trayectoStationGap: geometry.gapW,
    trayectoStationWidth: geometry.stationW,
  }, preset);
  const w = Math.max(1, displayW ?? nativeW);
  const h = Math.max(1, displayH ?? nativeH);
  const style = { stroke, strokeWidth: Math.max(1, strokeWidth) };
  const label = trackMode === TRAYECTO_TRACK_MODES.DOUBLE ? 'Vía doble' : preset?.name ?? 'Trayecto';

  const path = createTrayectoPath(pathData, style);
  path.set({
    ...common,
    customStationCount: true,
    customStationCountValue: count,
    trayectoStationGap: geometry.gapW,
    trayectoStationWidth: geometry.stationW,
    vectorTrayecto: true,
    trayectoTrackMode: trackMode,
    strokeOnly: true,
    scaleX: w / nativeW,
    scaleY: h / nativeH,
    name: `${label} · ${count} est.`,
  });

  return path;
}

export function replaceTrayectoObject(canvas, obj, preset, options = {}) {
  if (!canvas || !obj || !preset) return null;

  const oldPreset = getPresetShape(obj.presetId) ?? preset;

  const oldCount = clampStationCount(obj.customStationCountValue ?? oldPreset.defaultStationCount, oldPreset);
  const count = clampStationCount(
    options.stationCount ?? obj.customStationCountValue ?? preset.defaultStationCount,
    preset,
  );
  const oldGeometry = resolveTrayectoGeometry(obj, oldPreset);
  const geometry = resolveTrayectoGeometry({
    trayectoStationGap: options.stationGap ?? obj.trayectoStationGap,
    trayectoStationWidth: options.stationWidth ?? obj.trayectoStationWidth,
  }, preset);

  const oldNativeW = trayectoNativeWidth(oldPreset, oldCount, {
    trayectoStationGap: oldGeometry.gapW,
    trayectoStationWidth: oldGeometry.stationW,
  });
  const newNativeW = trayectoNativeWidth(preset, count, {
    trayectoStationGap: geometry.gapW,
    trayectoStationWidth: geometry.stationW,
  });
  const oldNativeH = trayectoNativeHeight(oldPreset);
  const newNativeH = trayectoNativeHeight(preset);

  // Usar escala × ancho nativo (no getScaledWidth del bbox) para no estrechar al cambiar vía.
  const displayW = options.keepWidth === false
    ? (obj.getScaledWidth?.() ?? newNativeW)
    : (obj.scaleX ?? 1) * oldNativeW * (newNativeW / oldNativeW);
  const displayH = options.keepHeight === false
    ? (obj.getScaledHeight?.() ?? newNativeH)
    : (obj.scaleY ?? 1) * oldNativeH * (newNativeH / oldNativeH);

  const path = buildTrayectoShape(preset, count, displayW, displayH, {
    left: obj.left,
    top: obj.top,
    angle: obj.angle ?? 0,
    id: obj.id,
    presetId: preset.id,
    opacity: obj.opacity ?? 1,
  }, {
    stroke: typeof obj.stroke === 'string' && obj.stroke ? obj.stroke : '#000000',
    strokeWidth: obj.strokeWidth ?? 2,
    stationGap: geometry.gapW,
    stationWidth: geometry.stationW,
  });

  return swapCanvasObject(canvas, obj, path);
}

export function previewTrayectoSvg(
  stationCount,
  height,
  trackMode = TRAYECTO_TRACK_MODES.SINGLE,
  geometry = {},
  preset = null,
) {
  const resolved = resolveTrayectoGeometry(geometry, preset);
  const w = trayectoNativeWidth(preset, stationCount, {
    trayectoStationGap: resolved.gapW,
    trayectoStationWidth: resolved.stationW,
  });
  const d = buildTrayectoPathData(stationCount, height, trackMode, {
    trayectoStationGap: resolved.gapW,
    trayectoStationWidth: resolved.stationW,
  }, preset);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" width="100%" height="100%"><path d="${d}" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="miter" stroke-linecap="butt"/></svg>`;
}

/** Líneas de vía en coordenadas del lienzo (para snap de señales). */
export function getTrayectoTrackSegments(obj) {
  if (!obj?.vectorTrayecto) return [];

  const preset = getPresetShape(obj.presetId) ?? null;
  const trackMode = obj.trayectoTrackMode ?? resolveTrackMode(preset);
  const stationCount = clampStationCount(
    obj.customStationCountValue ?? preset?.defaultStationCount,
    preset,
  );
  const geometry = resolveTrayectoGeometry(obj, preset);
  const nativeH = trayectoNativeHeight(preset);
  const nativeW = trayectoNativeWidth(preset, stationCount, {
    trayectoStationGap: geometry.gapW,
    trayectoStationWidth: geometry.stationW,
  });
  const yTop = scaledY(nativeH, NATIVE.yTop);
  const yBase = scaledY(nativeH, NATIVE.yBase);
  const matrix = obj.calcTransformMatrix();
  const toCanvas = (x, y) => util.transformPoint(new Point(x, y), matrix);

  const segments = [{ x1: 0, y1: yBase, x2: nativeW, y2: yBase }];
  if (trackMode === TRAYECTO_TRACK_MODES.DOUBLE) {
    segments.unshift({ x1: 0, y1: yTop, x2: nativeW, y2: yTop });
  }

  return segments.map((seg) => ({
    p1: toCanvas(seg.x1, seg.y1),
    p2: toCanvas(seg.x2, seg.y2),
  }));
}
