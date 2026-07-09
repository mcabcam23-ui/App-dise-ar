import { Point, util } from 'fabric';
import { getPresetShape } from '../constants/presetShapes';
import { findPresetHost, getObjectPresetId } from './presetVariants';
import { getTrayectoTrackSegments } from './trayectoLine';

/** Señal tumbada: separación tras el borde del trazo (tamaño nativo). */
export const SIGNAL_TRACK_SNAP_DISTANCE_PARALLEL = 12;
export const SIGNAL_TRACK_SNAP_REFERENCE_SIZE = 172;
/** Distancia máxima (tamaño nativo) para que encaje el imán al acercar. */
export const SIGNAL_TRACK_SNAP_ENGAGE_DISTANCE = 40;
/** Distancia máxima (tamaño nativo) para seguir pegado (radio de re-imán). */
export const SIGNAL_TRACK_SNAP_DETACH_DISTANCE = 56;
/** Cuánto hay que arrastrar (tamaño nativo) desde el punto de agarre para soltar. */
export const SIGNAL_TRACK_SNAP_DRAG_DETACH_DISTANCE = 80;

const OVERLAY_NAMES = new Set(['__pageOverlay']);
/** Posición al empezar a arrastrar una señal ya pegada. */
const dragAnchor = new WeakMap();

/** Limpia estado de arrastre (p. ej. al soltar la señal). */
export function clearSignalDragState(target) {
  if (target) dragAnchor.delete(target);
}

function ensureDragAnchor(target, wasAttached) {
  if (!dragAnchor.has(target)) {
    dragAnchor.set(target, {
      left: target.left ?? 0,
      top: target.top ?? 0,
      wasAttached,
    });
  }
}

function shouldDetachFromDrag(target, preset) {
  const anchor = dragAnchor.get(target);
  if (!anchor?.wasAttached) return false;
  const ratio = getSignalSizeRatio(target, preset);
  const limit = SIGNAL_TRACK_SNAP_DRAG_DETACH_DISTANCE * ratio;
  const dx = (target.left ?? 0) - anchor.left;
  const dy = (target.top ?? 0) - anchor.top;
  return Math.hypot(dx, dy) > limit;
}

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

export function invalidateTrackSegmentCache() {
  /* Sin caché: las vías se recalculan en cada snap para evitar datos obsoletos. */
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

function getTrackStrokeHalf(trackObj) {
  if (!trackObj) return 0;
  const sw = Math.max(1, trackObj.strokeWidth ?? 2);
  const sx = Math.abs(trackObj.scaleX ?? 1);
  const sy = Math.abs(trackObj.scaleY ?? 1);
  const scale = trackObj.strokeUniform ? 1 : Math.max(sx, sy);
  return (sw * scale) / 2;
}

function originRatio(origin) {
  if (origin === 'left' || origin === 'top') return 0;
  if (origin === 'center') return 0.5;
  if (origin === 'right' || origin === 'bottom') return 1;
  const n = Number(origin);
  return Number.isFinite(n) ? n : 0.5;
}

/** Pie del poste en coordenadas locales de la imagen. */
function getPoleTipLocal(obj, preset) {
  const anchor = preset?.trackSnapAnchor ?? { x: 0.5, y: 1 };
  const ox = originRatio(obj.originX);
  const oy = originRatio(obj.originY);
  const w = obj.width ?? preset?.width ?? 62;
  const h = obj.height ?? preset?.height ?? SIGNAL_TRACK_SNAP_REFERENCE_SIZE;
  return new Point((anchor.x - ox) * w, (anchor.y - oy) * h);
}

function getPoleTipCanvas(obj, preset) {
  return util.transformPoint(getPoleTipLocal(obj, preset), obj.calcTransformMatrix());
}

/** Eje largo de la señal en canvas (imagen vertical → eje Y local). */
function getSignalAxisUnit(obj) {
  const rad = ((obj.angle ?? 0) * Math.PI) / 180;
  return { x: Math.sin(rad), y: Math.cos(rad) };
}

/** Señal vertical (poste ≈ perpendicular a la vía). */
function isVerticalRailSignal(obj) {
  const angle = Math.abs(((obj.angle ?? 0) % 360) + 360) % 360;
  const upright = angle <= 18 || angle >= 342 || (angle >= 162 && angle <= 198);
  return upright;
}

/** Señal tumbada a lo largo de la vía (no confundir con angle de Fabric). */
function isLaidAlongTrack(obj, segment) {
  if (isVerticalRailSignal(obj)) return false;
  const dx = segment.p2.x - segment.p1.x;
  const dy = segment.p2.y - segment.p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return false;
  const axis = getSignalAxisUnit(obj);
  return Math.abs(axis.x * (dx / len) + axis.y * (dy / len)) > 0.78;
}

/** Radio de imán al acercar (solo engancha si el contacto está cerca). */
export function getSignalTrackSnapEngageReach(obj, preset) {
  const ratio = getSignalSizeRatio(obj, preset);
  return SIGNAL_TRACK_SNAP_ENGAGE_DISTANCE * ratio;
}

/** Radio para mantener el pegado (un poco mayor, evita parpadeos). */
export function getSignalTrackSnapDetachReach(obj, preset) {
  const ratio = getSignalSizeRatio(obj, preset);
  return SIGNAL_TRACK_SNAP_DETACH_DISTANCE * ratio;
}

/** @deprecated Usar getSignalTrackSnapEngageReach */
export function getSignalTrackSnapReach(obj, preset) {
  return getSignalTrackSnapEngageReach(obj, preset);
}

export function isTrackObject(obj) {
  if (!obj) return false;
  if (obj.vectorTrayecto) return true;
  return obj.type === 'line' || obj.type === 'polyline';
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

export function collectTrackSegments(canvas, exclude) {
  if (!canvas) return [];
  const segments = [];
  for (const obj of canvas.getObjects()) {
    if (!obj || obj === exclude || isOverlayObject(obj)) continue;
    if (obj.vectorTrayecto) {
      for (const seg of getTrayectoTrackSegments(obj)) segments.push({ ...seg, sourceObj: obj });
      continue;
    }
    if (obj.type === 'line') {
      const seg = getLineSegmentCanvas(obj);
      if (seg) segments.push({ ...seg, sourceObj: obj });
      continue;
    }
    if (obj.type === 'polyline') {
      for (const seg of getPolylineSegments(obj)) segments.push({ ...seg, sourceObj: obj });
    }
  }
  return segments;
}

function closestPointOnSegment(point, segment) {
  const { p1, p2 } = segment;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return { x: p1.x, y: p1.y, t: 0 };

  let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: p1.x + t * dx, y: p1.y + t * dy, t };
}

function distancePointToSegment(point, segment) {
  const closest = closestPointOnSegment(point, segment);
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

/** Normal unitaria de la vía que apunta hacia `point`. */
function normalTowardPoint(segment, point) {
  const closest = closestPointOnSegment(point, segment);
  const dx = segment.p2.x - segment.p1.x;
  const dy = segment.p2.y - segment.p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;

  const n1 = { x: -dy / len, y: dx / len };
  const n2 = { x: dy / len, y: -dx / len };
  const vx = point.x - closest.x;
  const vy = point.y - closest.y;
  const d1 = vx * n1.x + vy * n1.y;
  const d2 = vx * n2.x + vy * n2.y;
  const normal = Math.abs(d1) >= Math.abs(d2) ? (d1 >= 0 ? n1 : { x: -n1.x, y: -n1.y }) : (d2 >= 0 ? n2 : { x: -n2.x, y: -n2.y });
  return { normal, closest };
}

/** Punto de contacto: pie del poste (vertical) o borde del bbox (tumbada). */
function getContactPoint(obj, preset, segment, laidAlong) {
  if (!laidAlong) {
    return getPoleTipCanvas(obj, preset);
  }

  const picked = normalTowardPoint(segment, obj.getCenterPoint());
  if (!picked) return getPoleTipCanvas(obj, preset);

  const { normal, closest } = picked;
  const corners = obj.getCoords?.() ?? [];
  let best = null;
  let bestAlong = Infinity;

  for (const corner of corners) {
    const along = (corner.x - closest.x) * normal.x + (corner.y - closest.y) * normal.y;
    if (along >= -1 && along < bestAlong) {
      bestAlong = along;
      best = corner;
    }
  }

  return best ?? getPoleTipCanvas(obj, preset);
}

/**
 * Mueve la señal para que el punto de contacto quede en el borde exterior del trazo.
 */
function snapContactToTrackEdge(obj, preset, segment, reach) {
  const laidAlong = isLaidAlongTrack(obj, segment);
  const contact = getContactPoint(obj, preset, segment, laidAlong);
  if (!contact) return null;

  if (distancePointToSegment(contact, segment) > reach) return null;

  const picked = normalTowardPoint(segment, contact);
  if (!picked) return null;

  const { normal, closest } = picked;
  const strokeHalf = getTrackStrokeHalf(segment.sourceObj);
  const ratio = getSignalSizeRatio(obj, preset);
  const gap = laidAlong
    ? (preset?.trackSnapDistanceParallel ?? SIGNAL_TRACK_SNAP_DISTANCE_PARALLEL) * ratio
    : 0;
  const targetX = closest.x + normal.x * (strokeHalf + gap);
  const targetY = closest.y + normal.y * (strokeHalf + gap);

  const deltaX = targetX - contact.x;
  const deltaY = targetY - contact.y;
  const error = Math.hypot(deltaX, deltaY);

  return {
    error,
    deltaX,
    deltaY,
    sourceObj: segment.sourceObj,
  };
}

function segmentsForTrack(segments, trackId) {
  if (!trackId) return [];
  return segments.filter((seg) => seg.sourceObj?.id === trackId);
}

function findBestTrackSnap(obj, preset, segments, reach) {
  let best = null;
  for (const segment of segments) {
    const candidate = snapContactToTrackEdge(obj, preset, segment, reach);
    if (!candidate) continue;
    if (!best || candidate.error < best.error) best = candidate;
  }
  return best;
}

export function attachSignalToTrack(canvas, target, trackObj) {
  if (!canvas || !target || !trackObj?.id) return;

  target.trackAttachId = trackObj.id;
  target.trackAttachMatrix = undefined;
  syncSignalTrackAttachLocal(canvas, target);
  canvas.bringObjectToFront?.(target);
}

/** Guarda la posición de la señal en coordenadas locales de la vía (sin escala). */
export function syncSignalTrackAttachLocal(canvas, target) {
  const trackId = getAttachedTrackId(target);
  if (!canvas || !target || !trackId) return;

  const trackObj = canvas.getObjects().find((o) => o.id === trackId);
  if (!trackObj) return;

  const invTrack = util.invertTransform(trackObj.calcTransformMatrix());
  const local = util.transformPoint(target.getCenterPoint(), invTrack);
  target.trackAttachLocal = { x: local.x, y: local.y };
  target.trackAttachMatrix = undefined;
}

export function detachSignalFromTrack(target) {
  if (!target) return;
  if (
    target.trackAttachId === undefined
    && target.trackAttachMatrix === undefined
    && target.trackAttachLocal === undefined
  ) return;
  target.trackAttachId = undefined;
  target.trackAttachMatrix = undefined;
  target.trackAttachLocal = undefined;
}

export function getAttachedTrackId(target) {
  return target?.trackAttachId ?? null;
}

export function updateAttachedSignals(canvas, trackObj) {
  if (!canvas || !trackObj?.id) return false;
  const trackMatrix = trackObj.calcTransformMatrix();
  let moved = false;

  for (const obj of canvas.getObjects()) {
    if (!obj || obj === trackObj) continue;
    if (obj.trackAttachId !== trackObj.id) continue;

    if (!obj.trackAttachLocal) {
      syncSignalTrackAttachLocal(canvas, obj);
    }
    const local = obj.trackAttachLocal;
    if (!local) continue;

    const newCenter = util.transformPoint(new Point(local.x, local.y), trackMatrix);
    obj.setPositionByOrigin(newCenter, obj.originX ?? 'center', obj.originY ?? 'center');
    obj.setCoords?.();
    moved = true;
  }

  return moved;
}

export function applySignalTrackSnap(canvas, target, options = {}) {
  const host = findPresetHost(target) ?? target;
  if (!canvas || !target || !isRailSignal(host)) return false;

  const preset = getPresetShape(getObjectPresetId(host));
  const segments = options.segments ?? collectTrackSegments(canvas, target);
  if (!segments.length) {
    if (options.detachIfMissed) detachSignalFromTrack(target);
    return false;
  }

  const engageReach = options.engageReach ?? getSignalTrackSnapEngageReach(target, preset);
  const detachReach = options.detachReach ?? getSignalTrackSnapDetachReach(target, preset);
  const attachedId = getAttachedTrackId(target);

  if (options.dragging) {
    ensureDragAnchor(target, Boolean(attachedId));
    if (shouldDetachFromDrag(target, preset)) {
      detachSignalFromTrack(target);
      clearSignalDragState(target);
      return false;
    }
  }

  if (attachedId) {
    const attachedSegs = segmentsForTrack(segments, attachedId);
    if (!attachedSegs.length) {
      detachSignalFromTrack(target);
      return false;
    }

    const snap = findBestTrackSnap(target, preset, attachedSegs, detachReach);
    if (!snap) return false;

    const prevAngle = target.angle ?? 0;
    target.set({
      left: (target.left ?? 0) + snap.deltaX,
      top: (target.top ?? 0) + snap.deltaY,
    });
    if (isVerticalRailSignal(target)) target.set({ angle: prevAngle });
    target.setCoords?.();
    syncSignalTrackAttachLocal(canvas, target);
    return true;
  }

  const snap = findBestTrackSnap(target, preset, segments, engageReach);
  if (!snap) {
    if (options.detachIfMissed) detachSignalFromTrack(target);
    return false;
  }

  const prevAngle = target.angle ?? 0;
  target.set({
    left: (target.left ?? 0) + snap.deltaX,
    top: (target.top ?? 0) + snap.deltaY,
  });
  if (isVerticalRailSignal(target)) target.set({ angle: prevAngle });
  target.setCoords?.();

  if (snap.sourceObj) {
    attachSignalToTrack(canvas, target, snap.sourceObj);
    if (options.dragging) {
      dragAnchor.set(target, {
        left: target.left ?? 0,
        top: target.top ?? 0,
        wasAttached: true,
      });
    }
  }
  return true;
}
