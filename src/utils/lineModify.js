import { Line, Polyline } from 'fabric';
import { setPolylineAbsolutePoints } from './polylineUtils';
import {
  applyTrimToChain,
  cloneLineVisualProps,
  closeWorldChain,
  collectWorldSegments,
  dedupeConsecutivePoints,
  ENDPOINT_TOLERANCE,
  explodeWorldChain,
  findNearestIntersectionAlongChain,
  findTrimIntersection,
  getWorldPointChain,
  hitTestLineLike,
  isModifiableLineObject,
  joinWorldChains,
  nearestEndpointIndex,
  projectPointOnSegment,
  splitWorldChainAt,
} from './lineGeometry';
import { invalidateTrackSegmentCache, isTrackObject, updateAttachedSignals } from './signalTrackSnap';

function createWorldPolyline(points, props, name = 'Multilínea') {
  const poly = new Polyline([{ x: 0, y: 0 }], {
    ...props,
    fill: '',
    selectable: true,
    evented: true,
    objectCaching: false,
    strokeUniform: true,
    strokeLineCap: 'round',
    strokeLineJoin: 'miter',
    name,
  });
  setPolylineAbsolutePoints(poly, points);
  poly.setCoords();
  return poly;
}

function createWorldLine(p1, p2, props, name = 'Línea') {
  const line = new Line([p1.x, p1.y, p2.x, p2.y], {
    ...props,
    fill: '',
    selectable: true,
    evented: true,
    objectCaching: false,
    strokeUniform: true,
    name,
  });
  line.setCoords();
  return line;
}

function pieceFromChain(chain, source, idGen) {
  const props = {
    ...cloneLineVisualProps(source),
    id: idGen(),
  };
  if (chain.length === 2) return createWorldLine(chain[0], chain[1], props, source.name || 'Línea');
  return createWorldPolyline(chain, props, source.name || 'Multilínea');
}

function replaceObjectWithPieces(canvas, source, pieces) {
  const index = canvas.getObjects().indexOf(source);
  canvas.remove(source);
  pieces.forEach((piece, i) => {
    if (index >= 0) canvas.insertAt(index + i, piece);
    else canvas.add(piece);
  });
  return pieces;
}

function notifyGeometryChange(canvas, ...objects) {
  invalidateTrackSegmentCache();
  const tracks = new Set();
  objects.forEach((obj) => {
    if (isTrackObject(obj)) tracks.add(obj);
  });
  tracks.forEach((track) => updateAttachedSignals(canvas, track));
}

export function joinLineObjects(canvas, objA, objB, { tolerance = ENDPOINT_TOLERANCE, idGen } = {}) {
  if (!canvas || !objA || !objB || objA === objB) return null;
  if (!isModifiableLineObject(objA) || !isModifiableLineObject(objB)) return null;

  const chainA = getWorldPointChain(objA);
  const chainB = getWorldPointChain(objB);
  const merged = joinWorldChains(chainA, chainB, tolerance);
  if (!merged || merged.length < 2) return null;

  const props = { ...cloneLineVisualProps(objA), id: idGen() };
  const result = merged.length === 2
    ? createWorldLine(merged[0], merged[1], props, objA.name || 'Línea')
    : createWorldPolyline(merged, props, objA.name || 'Multilínea');

  const index = Math.min(canvas.getObjects().indexOf(objA), canvas.getObjects().indexOf(objB));
  canvas.remove(objA);
  canvas.remove(objB);
  if (index >= 0) canvas.insertAt(index, result);
  else canvas.add(result);

  notifyGeometryChange(canvas, objA, objB, result);
  return result;
}

export function splitLineObjectAtPoint(canvas, obj, point, { tolerance = ENDPOINT_TOLERANCE, idGen } = {}) {
  if (!canvas || !obj || !point || !isModifiableLineObject(obj)) return null;

  const chain = getWorldPointChain(obj);
  if (chain.length < 2) return null;

  if (chain.length === 2) {
    const pieces = splitWorldChainAt(chain, 0, point, tolerance);
    if (!pieces) return null;
    const created = pieces.map((piece) => pieceFromChain(piece, obj, idGen));
    replaceObjectWithPieces(canvas, obj, created);
    notifyGeometryChange(canvas, obj, ...created);
    return created;
  }

  let segmentIndex = 0;
  let bestDist = Infinity;
  let snapPoint = { x: point.x, y: point.y };
  for (let i = 0; i < chain.length - 1; i += 1) {
    const proj = projectPointOnSegment(point, chain[i], chain[i + 1]);
    const d = Math.hypot(point.x - proj.x, point.y - proj.y);
    if (d < bestDist) {
      bestDist = d;
      segmentIndex = i;
      snapPoint = proj;
    }
  }
  point = snapPoint;

  const pieces = splitWorldChainAt(chain, segmentIndex, point, tolerance);
  if (!pieces) return null;

  const created = pieces.map((piece) => pieceFromChain(piece, obj, idGen));
  replaceObjectWithPieces(canvas, obj, created);
  notifyGeometryChange(canvas, obj, ...created);
  return created;
}

export function extendLineObjectAtPointer(canvas, obj, pointer, { idGen } = {}) {
  if (!canvas || !obj || !pointer || !isModifiableLineObject(obj)) return null;

  const chain = getWorldPointChain(obj);
  if (chain.length < 2) return null;

  const endpointIndex = nearestEndpointIndex(chain, pointer);
  const segments = collectWorldSegments(canvas, [obj]);
  const hit = findNearestIntersectionAlongChain(chain, endpointIndex, segments, obj);
  if (!hit) return null;

  const updated = [...chain];
  updated[endpointIndex] = { ...hit.point };
  const clean = dedupeConsecutivePoints(updated);
  if (clean.length < 2) return null;

  const props = { ...cloneLineVisualProps(obj), id: obj.id || idGen() };
  const index = canvas.getObjects().indexOf(obj);
  canvas.remove(obj);
  const result = clean.length === 2
    ? createWorldLine(clean[0], clean[1], props, obj.name || 'Línea')
    : createWorldPolyline(clean, props, obj.name || 'Multilínea');
  if (index >= 0) canvas.insertAt(index, result);
  else canvas.add(result);

  notifyGeometryChange(canvas, obj, result);
  return result;
}

export function trimLineObjectAtPointer(canvas, obj, pointer, { idGen } = {}) {
  if (!canvas || !obj || !pointer || !isModifiableLineObject(obj)) return null;

  const chain = getWorldPointChain(obj);
  if (chain.length < 2) return null;

  const hit = hitTestLineLike(canvas, pointer, { exclude: [] });
  if (!hit || hit.obj !== obj) return null;

  const segments = collectWorldSegments(canvas, [obj]);
  const trimInfo = findTrimIntersection(chain, hit.segmentIndex, pointer, segments, obj);
  if (!trimInfo) return null;

  const trimmed = applyTrimToChain(chain, trimInfo);
  if (!trimmed || trimmed.length < 2) {
    canvas.remove(obj);
    notifyGeometryChange(canvas, obj);
    return null;
  }

  const props = { ...cloneLineVisualProps(obj), id: obj.id || idGen() };
  canvas.remove(obj);
  const result = trimmed.length === 2
    ? createWorldLine(trimmed[0], trimmed[1], props, obj.name || 'Línea')
    : createWorldPolyline(trimmed, props, obj.name || 'Multilínea');
  canvas.add(result);
  notifyGeometryChange(canvas, obj, result);
  return result;
}

export function explodeLineObject(canvas, obj, { idGen } = {}) {
  if (!canvas || !obj || !isModifiableLineObject(obj)) return null;

  const chain = getWorldPointChain(obj);
  const pieces = explodeWorldChain(chain);
  if (pieces.length <= 1) return null;

  const created = pieces.map((piece) => pieceFromChain(piece, obj, idGen));
  replaceObjectWithPieces(canvas, obj, created);
  notifyGeometryChange(canvas, obj, ...created);
  return created;
}

export function closeLineObject(canvas, obj, { idGen } = {}) {
  if (!canvas || !obj || obj.type !== 'polyline') return null;

  const chain = getWorldPointChain(obj);
  const closed = closeWorldChain(chain);
  if (!closed) return null;

  const props = { ...cloneLineVisualProps(obj), id: obj.id || idGen() };
  canvas.remove(obj);
  const result = createWorldPolyline(closed, props, obj.name || 'Multilínea');
  canvas.add(result);
  notifyGeometryChange(canvas, obj, result);
  return result;
}

export function mergeConnectedLines(canvas, objects, { tolerance = ENDPOINT_TOLERANCE, idGen } = {}) {
  const lines = objects.filter(isModifiableLineObject);
  if (lines.length < 2) return null;

  let mergedAny = false;
  let remaining = [...lines];

  while (remaining.length >= 2) {
    let joined = false;
    outer: for (let i = 0; i < remaining.length; i += 1) {
      for (let j = i + 1; j < remaining.length; j += 1) {
        const a = remaining[i];
        const b = remaining[j];
        const chainA = getWorldPointChain(a);
        const chainB = getWorldPointChain(b);
        if (!joinWorldChains(chainA, chainB, tolerance)) continue;

        const result = joinLineObjects(canvas, a, b, { tolerance, idGen });
        if (result) {
          remaining = remaining.filter((obj) => obj !== a && obj !== b);
          remaining.push(result);
          mergedAny = true;
          joined = true;
          break outer;
        }
      }
    }
    if (!joined) break;
  }

  return mergedAny ? remaining : null;
}

export function modifyLineAtPointer(canvas, mode, pointer, { zoom = 1, pickRef = null, idGen } = {}) {
  if (!canvas || !pointer) return null;

  if (mode === 'join') {
    const hit = hitTestLineLike(canvas, pointer, { zoom });
    if (!hit) return null;
    if (!pickRef?.obj) {
      return { pick: { obj: hit.obj }, result: null };
    }
    if (pickRef.obj === hit.obj) return null;
    const result = joinLineObjects(canvas, pickRef.obj, hit.obj, { idGen });
    return { pick: null, result };
  }

  const hit = hitTestLineLike(canvas, pointer, { zoom, exclude: pickRef?.obj ? [] : [] });
  if (!hit) return null;

  switch (mode) {
    case 'split':
      return { pick: null, result: splitLineObjectAtPoint(canvas, hit.obj, hit.point, { idGen }) };
    case 'extend':
      return { pick: null, result: extendLineObjectAtPointer(canvas, hit.obj, pointer, { idGen }) };
    case 'trim':
      return { pick: null, result: trimLineObjectAtPointer(canvas, hit.obj, pointer, { idGen }) };
    case 'explode':
      return { pick: null, result: explodeLineObject(canvas, hit.obj, { idGen }) };
    case 'close':
      return { pick: null, result: closeLineObject(canvas, hit.obj, { idGen }) };
    default:
      return null;
  }
}

export { hitTestLineLike, isModifiableLineObject, getWorldPointChain };
