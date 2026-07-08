import { Point, util } from 'fabric';
import { getPresetShape } from '../constants/presetShapes';
import { findPresetHost, getObjectPresetId } from './presetVariants';
import { getTrayectoTrackSegments } from './trayectoLine';

/** Separación borde inferior de señal ↔ línea de vía (tamaño nativo). */
export const SIGNAL_TRACK_SNAP_DISTANCE = 52;
export const SIGNAL_TRACK_SNAP_REFERENCE_SIZE = 172;

const OVERLAY_NAMES = new Set(['__pageOverlay']);
const segmentCache = new WeakMap();

function isOverlayObject(obj) {
  return Boolean(obj?.overlayLayer || OVERLAY_NAMES.has(obj?.name));
}

export function isRailSignal(obj) {
  const host = findPresetHost(obj) ?? obj;
  if (!host || host.type === 'activeSelection') return false;
  const presetId = getObjectPresetId(host);
  if (!presetId) return false;
  const preset = getPresetShape(presetId);
  if (!preset) return false;
  if (preset.vectorTrayecto || preset.customStationCount) return false;
  return Boolean(preset.imageAsset || preset.imagePreset);
}

export function invalidateTrackSegmentCache(canvas) {
  if (canvas) segmentCache.delete(canvas);
}

export function getSignalSizeRatio(obj, preset) {
  const nativeW = Math.max(1, preset?.width ?? obj.width ?? 62);
  const nativeH = Math.max(1, preset?.height ?? obj.height ?? SIGNAL_TRACK_SNAP_REFERENCE_SIZE);
  const refScale = preset?.defaultScale ?? 1;
  const refSize = Math.max(nativeW, nativeH) * refScale;
  const currentW = Math.abs(obj.getScaledWidth?.() ?? nativeW * Math.abs(obj.scaleX ?? 1));
  const currentH = Math.abs(obj.getScaledHeight?.() ?? nativeH * Math.abs(obj.scaleY ?? 1));
  return Math.max(currentW, currentH) / refSize;
}

export function getSignalTrackSnapDistance(obj, preset) {
  const base = preset?.trackSnapDistance ?? SIGNAL_TRACK_SNAP_DISTANCE;
  return base * getSignalSizeRatio(obj, preset);
}

export function getSignalTrackSnapTolerance(obj, preset) {
  const distance = getSignalTrackSnapDistance(obj, preset);
  return Math.max(22, distance * 0.75);
}

function getLineSegmentCanvas(obj) {
  const points = obj.calcLinePoints?.();
  if (!points) return null;
  const matrix = obj.calcTransformMatrix();
  return {
    p1: util.transformPoint(new Point(points.x1, points.y1), matrix),
    p2: util.transformPoint(new Point(points.x2, points.y2), matrix),
  };
}

function getPolylineSegments(obj) {
  const points = obj.points;
  if (!points?.length || points.length < 2) return [];
  const matrix = obj.calcTransformMatrix();
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    segments.push({
      p1: util.transformPoint(new Point(a.x, a.y), matrix),
      p2: util.transformPoint(new Point(b.x, b.y), matrix),
    });
  }
  return segments;
}

function collectTrackSegments(canvas, exclude) {
  const segments = [];
  for (const obj of canvas.getObjects()) {
    if (!obj || obj === exclude || isOverlayObject(obj)) continue;
    if (obj.vectorTrayecto) {
      segments.push(...getTrayectoTrackSegments(obj));
      continue;
    }
    if (obj.type === 'line') {
      const seg = getLineSegmentCanvas(obj);
      if (seg) segments.push(seg);
      continue;
    }
    if (obj.type === 'polyline') {
      segments.push(...getPolylineSegments(obj));
    }
  }
  return segments;
}

function getCachedTrackSegments(canvas) {
  let cached = segmentCache.get(canvas);
  if (!cached) {
    cached = collectTrackSegments(canvas, null);
    segmentCache.set(canvas, cached);
  }
  return cached;
}

/** Distancia del centro al borde más cercano a la vía, a lo largo de dir (vía → señal). */
function getNearExtentFromCenter(obj, dirX, dirY) {
  const center = obj.getCenterPoint();
  const coords = obj.getCoords?.() ?? [];
  if (!coords.length) {
    const halfW = (obj.getScaledWidth?.() ?? obj.width ?? 0) / 2;
    const halfH = (obj.getScaledHeight?.() ?? obj.height ?? 0) / 2;
    return -(Math.abs(dirX) * halfW + Math.abs(dirY) * halfH);
  }

  let minAlong = Infinity;
  for (const corner of coords) {
    const along = (corner.x - center.x) * dirX + (corner.y - center.y) * dirY;
    if (along < minAlong) minAlong = along;
  }
  return minAlong;
}

function closestPointOnSegment(point, segment) {
  const { p1, p2 } = segment;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return { x: p1.x, y: p1.y, t: 0 };

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    x: p1.x + t * dx,
    y: p1.y + t * dy,
    t,
  };
}

function segmentNormals(segment) {
  const dx = segment.p2.x - segment.p1.x;
  const dy = segment.p2.y - segment.p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [];
  return [
    { x: -dy / len, y: dx / len },
    { x: dy / len, y: -dx / len },
  ];
}

function trySnapOnSide(obj, closest, normalX, normalY, targetDist, tolerance) {
  const center = obj.getCenterPoint();
  const signedAlong = (center.x - closest.x) * normalX + (center.y - closest.y) * normalY;
  if (Math.abs(signedAlong) < 0.5) return null;

  const dirX = signedAlong >= 0 ? normalX : -normalX;
  const dirY = signedAlong >= 0 ? normalY : -normalY;
  const distAlong = Math.abs(signedAlong);
  const minAlong = getNearExtentFromCenter(obj, dirX, dirY);
  const nearEdgeDist = distAlong + minAlong;
  const error = Math.abs(nearEdgeDist - targetDist);
  if (error > tolerance) return null;

  const delta = targetDist - nearEdgeDist;
  return {
    error,
    deltaX: dirX * delta,
    deltaY: dirY * delta,
  };
}

function measureSegmentSnap(obj, segment, targetDist, tolerance) {
  const center = obj.getCenterPoint();
  const closest = closestPointOnSegment(center, segment);
  const normals = segmentNormals(segment);
  if (!normals.length) return null;

  let best = null;
  for (const normal of normals) {
    const candidate = trySnapOnSide(
      obj,
      closest,
      normal.x,
      normal.y,
      targetDist,
      tolerance,
    );
    if (!candidate) continue;
    if (!best || candidate.error < best.error) best = candidate;
  }
  return best;
}

function findBestTrackSnap(obj, segments, targetDist, tolerance) {
  let best = null;
  for (const segment of segments) {
    const candidate = measureSegmentSnap(obj, segment, targetDist, tolerance);
    if (!candidate) continue;
    if (!best || candidate.error < best.error) best = candidate;
  }
  return best;
}

export function applySignalTrackSnap(canvas, target, options = {}) {
  const host = findPresetHost(target) ?? target;
  if (!canvas || !target || !isRailSignal(host)) return false;

  const preset = getPresetShape(getObjectPresetId(host));
  const segments = options.segments ?? getCachedTrackSegments(canvas);
  if (!segments.length) return false;

  const distance = options.distance ?? getSignalTrackSnapDistance(target, preset);
  const tolerance = options.tolerance ?? getSignalTrackSnapTolerance(target, preset);
  const snap = findBestTrackSnap(target, segments, distance, tolerance);
  if (!snap) return false;

  target.set({
    left: (target.left ?? 0) + snap.deltaX,
    top: (target.top ?? 0) + snap.deltaY,
  });
  target.setCoords?.();
  return true;
}
