import { Point, util } from 'fabric';
import { getPresetShape } from '../constants/presetShapes';
import { findPresetHost, getObjectPresetId } from './presetVariants';
import { getTrayectoTrackSegments } from './trayectoLine';

/** Señal tumbada: separación tras el borde del trazo (tamaño nativo). */
export const SIGNAL_TRACK_SNAP_DISTANCE_PARALLEL = 6;
export const SIGNAL_TRACK_SNAP_REFERENCE_SIZE = 172;
/** Distancia máxima (tamaño nativo) para que encaje el imán al acercar. */
export const SIGNAL_TRACK_SNAP_ENGAGE_DISTANCE = 40;
/** Imán al acercar con señal tumbada (~un poco menos que en vertical). */
export const SIGNAL_TRACK_SNAP_ENGAGE_DISTANCE_LAID = 34;
/** Distancia máxima (tamaño nativo) para seguir pegado (radio de re-imán). */
export const SIGNAL_TRACK_SNAP_DETACH_DISTANCE = 56;
/** Radio de re-imán con señal tumbada. */
export const SIGNAL_TRACK_SNAP_DETACH_DISTANCE_LAID = 47;
/** Cuánto hay que arrastrar (tamaño nativo) desde el punto de agarre para soltar. */
export const SIGNAL_TRACK_SNAP_DRAG_DETACH_DISTANCE = 80;
export const SIGNAL_TRACK_SNAP_DRAG_DETACH_DISTANCE_LAID = 68;
/** Zona muerta al arrastrar pegada (evita micro-correcciones). */
const LAID_SNAP_DEAD_ZONE = 2.2;

const OVERLAY_NAMES = new Set(['__pageOverlay']);
/** Posición al empezar a arrastrar una señal ya pegada. */
const dragAnchor = new WeakMap();
/** Bloqueo lateral al deslizar una señal tumbada pegada (evita recalcular el imán cada frame). */
const laidSlideLock = new WeakMap();
/** Desfase a lo largo de la vía entre el agarre y el centro (solo al iniciar arrastre). */
const dragGrabHint = new WeakMap();

let trackSegmentCache = {
  canvas: null,
  generation: 0,
  segments: [],
};
let trackSegmentCacheGeneration = 0;

/** Limpia estado de arrastre (p. ej. al soltar la señal). */
export function clearSignalDragState(target) {
  if (!target) return;
  dragAnchor.delete(target);
  laidSlideLock.delete(target);
  dragGrabHint.delete(target);
}

export function isLaidRailSignal(obj) {
  const host = findPresetHost(obj) ?? obj;
  return isRailSignal(host) && !isVerticalRailSignal(host);
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
  const laid = !isVerticalRailSignal(target);
  const base = laid
    ? SIGNAL_TRACK_SNAP_DRAG_DETACH_DISTANCE_LAID
    : SIGNAL_TRACK_SNAP_DRAG_DETACH_DISTANCE;
  const limit = base * ratio;
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
  trackSegmentCacheGeneration += 1;
}

export function getCachedTrackSegments(canvas, exclude) {
  if (!canvas) return [];
  if (
    trackSegmentCache.canvas === canvas
    && trackSegmentCache.generation === trackSegmentCacheGeneration
  ) {
    return trackSegmentCache.segments;
  }
  const segments = collectTrackSegments(canvas, exclude);
  trackSegmentCache = {
    canvas,
    generation: trackSegmentCacheGeneration,
    segments,
  };
  return segments;
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

export function getLaidTrackSnapEngageReach(obj, preset) {
  const ratio = getSignalSizeRatio(obj, preset);
  return SIGNAL_TRACK_SNAP_ENGAGE_DISTANCE_LAID * ratio;
}

export function getLaidTrackSnapDetachReach(obj, preset) {
  const ratio = getSignalSizeRatio(obj, preset);
  return SIGNAL_TRACK_SNAP_DETACH_DISTANCE_LAID * ratio;
}

function snapReachForTarget(target, preset, { attached = false } = {}) {
  if (isVerticalRailSignal(target)) {
    return attached
      ? getSignalTrackSnapDetachReach(target, preset)
      : getSignalTrackSnapEngageReach(target, preset);
  }
  return attached
    ? getLaidTrackSnapDetachReach(target, preset)
    : getLaidTrackSnapEngageReach(target, preset);
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

function getHalfExtentTowardTrack(obj, sideNormal) {
  const center = obj.getCenterPoint();
  const inward = { x: -sideNormal.x, y: -sideNormal.y };
  const corners = obj.getCoords?.() ?? [];
  let maxInward = 0;
  for (const corner of corners) {
    const d = (corner.x - center.x) * inward.x + (corner.y - center.y) * inward.y;
    if (d > maxInward) maxInward = d;
  }
  return maxInward;
}

/** Lado de la vía donde debe quedar la señal tumbada (nunca sobre el eje del trazo). */
function getLaidSideNormal(segment, obj) {
  const center = obj.getCenterPoint();
  const picked = normalTowardPoint(segment, center);
  if (!picked) return null;

  const { normal, closest } = picked;
  const dot = (center.x - closest.x) * normal.x + (center.y - closest.y) * normal.y;
  if (Math.abs(dot) >= 0.5) {
    return dot >= 0 ? normal : { x: -normal.x, y: -normal.y };
  }

  const corners = obj.getCoords?.() ?? [];
  let weightPos = 0;
  let weightNeg = 0;
  for (const corner of corners) {
    const side = (corner.x - closest.x) * normal.x + (corner.y - closest.y) * normal.y;
    if (side >= 0) weightPos += side;
    else weightNeg -= side;
  }
  return weightPos >= weightNeg ? normal : { x: -normal.x, y: -normal.y };
}

/** Snap de señal tumbada: solo a un lado de la vía, sin centrar sobre la línea. */
function snapLaidAlongTrack(obj, preset, segment, reach) {
  const center = obj.getCenterPoint();
  const closest = closestPointOnSegment(center, segment);
  const sideNormal = getLaidSideNormal(segment, obj);
  if (!sideNormal) return null;

  const halfInward = getHalfExtentTowardTrack(obj, sideNormal);
  const distToAxis = distancePointToSegment(center, segment);
  const innerEdgeDist = Math.max(0, distToAxis - halfInward);
  if (innerEdgeDist > reach) return null;

  const strokeHalf = getTrackStrokeHalf(segment.sourceObj);
  const ratio = getSignalSizeRatio(obj, preset);
  const gap = (preset?.trackSnapDistanceParallel ?? SIGNAL_TRACK_SNAP_DISTANCE_PARALLEL) * ratio;
  const offset = strokeHalf + gap + halfInward;
  const targetX = closest.x + sideNormal.x * offset;
  const targetY = closest.y + sideNormal.y * offset;

  const deltaX = targetX - center.x;
  const deltaY = targetY - center.y;

  return {
    error: Math.hypot(deltaX, deltaY),
    deltaX,
    deltaY,
    sourceObj: segment.sourceObj,
  };
}

function nearestSegmentToPoint(point, segments) {
  let nearest = null;
  let minDist = Infinity;
  for (const segment of segments) {
    const dist = distancePointToSegment(point, segment);
    if (dist < minDist) {
      minDist = dist;
      nearest = segment;
    }
  }
  return nearest;
}

/**
 * Mueve la señal para que el punto de contacto quede en el borde exterior del trazo.
 */
function snapContactToTrackEdge(obj, preset, segment, reach) {
  const laidAlong = isLaidAlongTrack(obj, segment);
  if (laidAlong) {
    return snapLaidAlongTrack(obj, preset, segment, reach);
  }

  const contact = getPoleTipCanvas(obj, preset);
  if (!contact) return null;

  if (distancePointToSegment(contact, segment) > reach) return null;

  const picked = normalTowardPoint(segment, contact);
  if (!picked) return null;

  const { normal, closest } = picked;
  const strokeHalf = getTrackStrokeHalf(segment.sourceObj);
  const targetX = closest.x + normal.x * strokeHalf;
  const targetY = closest.y + normal.y * strokeHalf;

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

function segmentsForLaidSnap(obj, segments) {
  const parallel = segments.filter((seg) => isLaidAlongTrack(obj, seg));
  return parallel.length ? parallel : segments;
}

function findBestTrackSnapCandidate(obj, preset, segments, reach) {
  if (!segments.length) return null;

  const laidAlong = !isVerticalRailSignal(obj);
  const pool = laidAlong ? segmentsForLaidSnap(obj, segments) : segments;
  const segment = pool.length === 1
    ? pool[0]
    : nearestSegmentToPoint(
      laidAlong ? obj.getCenterPoint() : getPoleTipCanvas(obj, preset),
      pool,
    );
  if (!segment) return null;

  const snap = snapContactToTrackEdge(obj, preset, segment, reach);
  if (!snap) return null;
  return { ...snap, segment };
}

function findBestTrackSnap(obj, preset, segments, reach) {
  const candidate = findBestTrackSnapCandidate(obj, preset, segments, reach);
  if (!candidate) return null;
  const { segment: _segment, ...snap } = candidate;
  return snap;
}

function getIdealLaidPerpOffset(target, preset, segment, sideNormal) {
  const halfInward = getHalfExtentTowardTrack(target, sideNormal);
  const strokeHalf = getTrackStrokeHalf(segment.sourceObj);
  const ratio = getSignalSizeRatio(target, preset);
  const gap = (preset?.trackSnapDistanceParallel ?? SIGNAL_TRACK_SNAP_DISTANCE_PARALLEL) * ratio;
  return strokeHalf + gap + halfInward;
}

function getAlongBias(target, segment, pointer) {
  const hint = dragGrabHint.get(target);
  if (hint?.alongBias != null) return hint.alongBias;
  const center = target.getCenterPoint();
  const closestCenter = closestPointOnSegment(center, segment);
  const closestPtr = closestPointOnSegment(pointer, segment);
  return closestCenter.t - closestPtr.t;
}

function buildLaidSlideLock(target, preset, segment, pointer) {
  const sideNormal = getLaidSideNormal(segment, target);
  if (!sideNormal) return null;

  return {
    nx: sideNormal.x,
    ny: sideNormal.y,
    perpOffset: getIdealLaidPerpOffset(target, preset, segment, sideNormal),
    alongBias: getAlongBias(target, segment, pointer),
    p1: { x: segment.p1.x, y: segment.p1.y },
    p2: { x: segment.p2.x, y: segment.p2.y },
  };
}

function segmentsForTrack(segments, trackId) {
  if (!trackId) return [];
  return segments.filter((seg) => seg.sourceObj?.id === trackId);
}

/** Coloca la señal tumbada en la vía respetando el punto de agarre (parámetro t + offset lateral). */
function positionLaidFromDragLock(target, pointer, lock) {
  if (!lock || !pointer) return false;

  const dx = lock.p2.x - lock.p1.x;
  const dy = lock.p2.y - lock.p1.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return false;

  let tPtr = ((pointer.x - lock.p1.x) * dx + (pointer.y - lock.p1.y) * dy) / lenSq;
  let t = tPtr + lock.alongBias;
  t = Math.max(0, Math.min(1, t));

  target.setPositionByOrigin(
    new Point(
      lock.p1.x + t * dx + lock.nx * lock.perpOffset,
      lock.p1.y + t * dy + lock.ny * lock.perpOffset,
    ),
    target.originX ?? 'center',
    target.originY ?? 'center',
  );
  target.setCoords?.();
  return true;
}

/** Arrastre tumbado: desliza por la vía sin saltar al proyectar el centro. */
function applyLaidDragTrackSnap(canvas, target, preset, segments, pointer, engageReach) {
  if (!pointer) return false;

  const attachedId = getAttachedTrackId(target);

  if (!attachedId) {
    const candidate = findBestTrackSnapCandidate(target, preset, segments, engageReach);
    if (!candidate) return false;

    const lock = buildLaidSlideLock(target, preset, candidate.segment, pointer);
    if (!lock) return false;
    laidSlideLock.set(target, lock);
    positionLaidFromDragLock(target, pointer, lock);

    if (candidate.sourceObj) {
      attachSignalToTrack(canvas, target, candidate.sourceObj, { bringToFront: false });
      dragAnchor.set(target, {
        left: target.left ?? 0,
        top: target.top ?? 0,
        wasAttached: true,
      });
    }
    return true;
  }

  let lock = laidSlideLock.get(target);
  if (!lock) {
    const attachedSegs = segmentsForTrack(segments, attachedId);
    const parallel = segmentsForLaidSnap(target, attachedSegs);
    const pool = parallel.length ? parallel : attachedSegs;
    const segment = nearestSegmentToPoint(target.getCenterPoint(), pool);
    if (!segment) return false;
    lock = buildLaidSlideLock(target, preset, segment, pointer);
    if (!lock) return false;
    laidSlideLock.set(target, lock);
  }

  return positionLaidFromDragLock(target, pointer, lock);
}

/** Guarda el desfase de agarre; el offset lateral se calcula al enganchar (no al pulsar). */
export function prepareLaidSlideDrag(canvas, target, pointer) {
  if (!canvas || !target || !pointer) return;
  const host = findPresetHost(target) ?? target;
  if (!isRailSignal(host) || isVerticalRailSignal(host)) return;

  laidSlideLock.delete(target);
  const segments = getCachedTrackSegments(canvas, target);
  const attachedId = getAttachedTrackId(target);
  const attachedSegs = attachedId ? segmentsForTrack(segments, attachedId) : segments;
  const parallel = segmentsForLaidSnap(target, attachedSegs);
  const pool = parallel.length ? parallel : attachedSegs;
  const segment = nearestSegmentToPoint(target.getCenterPoint(), pool);
  if (!segment) return;

  const center = target.getCenterPoint();
  const closestCenter = closestPointOnSegment(center, segment);
  const closestPtr = closestPointOnSegment(pointer, segment);
  dragGrabHint.set(target, { alongBias: closestCenter.t - closestPtr.t });

  if (attachedId) {
    const preset = getPresetShape(getObjectPresetId(host));
    const lock = buildLaidSlideLock(target, preset, segment, pointer);
    if (lock) laidSlideLock.set(target, lock);
  }
}

/** Al arrastrar tumbada: solo corrige la distancia al lado, no el deslizamiento a lo largo de la vía. */
function applySnapDelta(target, preset, segment, snap, { dragging = false } = {}) {
  if (!snap) return false;

  let { deltaX, deltaY } = snap;
  if (dragging && !isVerticalRailSignal(target) && segment) {
    const sideNormal = getLaidSideNormal(segment, target);
    if (sideNormal) {
      const perp = deltaX * sideNormal.x + deltaY * sideNormal.y;
      const ratio = getSignalSizeRatio(target, preset);
      if (Math.abs(perp) < LAID_SNAP_DEAD_ZONE * ratio) return false;
      deltaX = sideNormal.x * perp;
      deltaY = sideNormal.y * perp;
    }
  }

  const prevAngle = target.angle ?? 0;
  target.set({
    left: (target.left ?? 0) + deltaX,
    top: (target.top ?? 0) + deltaY,
  });
  if (isVerticalRailSignal(target)) target.set({ angle: prevAngle });
  target.setCoords?.();
  return true;
}

export function attachSignalToTrack(canvas, target, trackObj, { bringToFront = true } = {}) {
  if (!canvas || !target || !trackObj?.id) return;

  target.trackAttachId = trackObj.id;
  target.trackAttachMatrix = undefined;
  syncSignalTrackAttachLocal(canvas, target);
  if (bringToFront) canvas.bringObjectToFront?.(target);
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
  laidSlideLock.delete(target);
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

  const engageReach = options.engageReach ?? snapReachForTarget(target, preset, { attached: false });
  const detachReach = options.detachReach ?? snapReachForTarget(target, preset, { attached: true });
  const attachedId = getAttachedTrackId(target);

  if (options.dragging) {
    ensureDragAnchor(target, Boolean(attachedId));
    if (shouldDetachFromDrag(target, preset)) {
      detachSignalFromTrack(target);
      clearSignalDragState(target);
      return false;
    }

    if (!isVerticalRailSignal(target) && options.pointer) {
      return applyLaidDragTrackSnap(canvas, target, preset, segments, options.pointer, engageReach);
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

    const segment = attachedSegs.length === 1
      ? attachedSegs[0]
      : nearestSegmentToPoint(target.getCenterPoint(), attachedSegs);
    const perpOnly = !isVerticalRailSignal(target) && !options.dragging;
    if (!applySnapDelta(target, preset, segment, snap, { dragging: perpOnly })) return false;
    if (!options.dragging) syncSignalTrackAttachLocal(canvas, target);
    return true;
  }

  const snap = findBestTrackSnap(target, preset, segments, engageReach);
  if (!snap) {
    if (options.detachIfMissed) detachSignalFromTrack(target);
    return false;
  }

  const pool = !isVerticalRailSignal(target) ? segmentsForLaidSnap(target, segments) : segments;
  const segment = pool.length === 1
    ? pool[0]
    : nearestSegmentToPoint(
      isVerticalRailSignal(target) ? getPoleTipCanvas(target, preset) : target.getCenterPoint(),
      pool,
    );
  if (!applySnapDelta(target, preset, segment, snap, { dragging: options.dragging })) {
    if (options.detachIfMissed) detachSignalFromTrack(target);
    return false;
  }

  if (snap.sourceObj) {
    attachSignalToTrack(canvas, target, snap.sourceObj, { bringToFront: !options.dragging });
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
