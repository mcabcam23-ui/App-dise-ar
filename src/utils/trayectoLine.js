import { Path } from 'fabric';

export const TRAYECTO_CANVAS_PROPS = [
  'customStationCount',
  'customStationCountValue',
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

function clampStationCount(count, preset) {
  const min = preset?.minStationCount ?? 1;
  const max = preset?.maxStationCount ?? 24;
  const n = Math.round(Number(count) || DEFAULT_STATIONS);
  return Math.min(max, Math.max(min, n));
}

function resolveTrackMode(preset) {
  return preset?.trayectoTrackMode === TRAYECTO_TRACK_MODES.DOUBLE
    ? TRAYECTO_TRACK_MODES.DOUBLE
    : TRAYECTO_TRACK_MODES.SINGLE;
}

export function trayectoNativeWidth(_preset, stationCount) {
  const n = clampStationCount(stationCount, _preset);
  return NATIVE.marginL + n * NATIVE.stationW + Math.max(0, n - 1) * NATIVE.gapW + NATIVE.marginR;
}

export function trayectoNativeHeight(preset) {
  return preset?.height ?? NATIVE.height;
}

function layout(stationCount) {
  const n = Math.max(1, Math.round(stationCount));
  const W = trayectoNativeWidth(null, n);
  const stations = [];

  for (let i = 0; i < n; i += 1) {
    const x0 = NATIVE.marginL + i * (NATIVE.stationW + NATIVE.gapW);
    stations.push({
      x0,
      x1: x0 + NATIVE.stationW,
      cx: x0 + NATIVE.stationW / 2,
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
function buildSingleTrackPath(stationCount, height) {
  const H = Math.max(8, height);
  const { n, W, stations } = layout(stationCount);
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
function buildDoubleTrackPath(stationCount, height) {
  const H = Math.max(8, height);
  const { n, W, stations } = layout(stationCount);
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

export function buildTrayectoPathData(stationCount, height, trackMode = TRAYECTO_TRACK_MODES.SINGLE) {
  return trackMode === TRAYECTO_TRACK_MODES.DOUBLE
    ? buildDoubleTrackPath(stationCount, height)
    : buildSingleTrackPath(stationCount, height);
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
  { stroke = '#000000', strokeWidth = 2 } = {},
) {
  const count = clampStationCount(stationCount, preset);
  const trackMode = resolveTrackMode(preset);
  const nativeW = trayectoNativeWidth(preset, count);
  const nativeH = trayectoNativeHeight(preset);
  const pathData = buildTrayectoPathData(count, nativeH, trackMode);
  const w = Math.max(1, displayW ?? nativeW);
  const h = Math.max(1, displayH ?? nativeH);
  const style = { stroke, strokeWidth: Math.max(1, strokeWidth) };
  const label = trackMode === TRAYECTO_TRACK_MODES.DOUBLE ? 'Vía doble' : preset?.name ?? 'Trayecto';

  const path = createTrayectoPath(pathData, style);
  path.set({
    ...common,
    customStationCount: true,
    customStationCountValue: count,
    vectorTrayecto: true,
    trayectoTrackMode: trackMode,
    scaleX: w / nativeW,
    scaleY: h / nativeH,
    name: `${label} · ${count} est.`,
  });

  return path;
}

export function replaceTrayectoObject(canvas, obj, preset, options = {}) {
  if (!canvas || !obj || !preset) return null;

  const oldCount = clampStationCount(obj.customStationCountValue ?? preset.defaultStationCount, preset);
  const count = clampStationCount(
    options.stationCount ?? obj.customStationCountValue ?? preset.defaultStationCount,
    preset,
  );
  const displayH = obj.getScaledHeight?.() ?? trayectoNativeHeight(preset);
  const currentW = obj.getScaledWidth?.() ?? trayectoNativeWidth(preset, oldCount);
  const oldNativeW = trayectoNativeWidth(preset, oldCount);
  const newNativeW = trayectoNativeWidth(preset, count);
  const displayW = options.keepWidth === false
    ? currentW
    : currentW * (newNativeW / oldNativeW);

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
  });

  const index = canvas.getObjects().indexOf(obj);
  const wasActive = canvas.getActiveObject() === obj;
  canvas.remove(obj);
  if (index >= 0) canvas.insertAt(index, path);
  else canvas.add(path);
  if (wasActive) canvas.setActiveObject(path);
  canvas.requestRenderAll();
  return path;
}

export function previewTrayectoSvg(stationCount, height, trackMode = TRAYECTO_TRACK_MODES.SINGLE) {
  const w = trayectoNativeWidth(null, stationCount);
  const d = buildTrayectoPathData(stationCount, height, trackMode);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${height}" width="100%" height="100%"><path d="${d}" fill="none" stroke="#000" stroke-width="2" stroke-linejoin="miter" stroke-linecap="butt"/></svg>`;
}
