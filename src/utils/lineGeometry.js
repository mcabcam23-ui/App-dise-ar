import { util } from 'fabric';
import { scenePointsNear } from './polylineUtils';

export const ENDPOINT_TOLERANCE = 0.75;
export const HIT_TOLERANCE_PX = 10;

export const LINE_LIKE_TYPES = new Set(['line', 'polyline']);

export function isModifiableLineObject(obj) {
  if (!obj || !LINE_LIKE_TYPES.has(obj.type)) return false;
  if (obj.erasable === false || obj.overlayLayer || obj.name === '__pageOverlay') return false;
  if (obj.vectorTrayecto || obj.customStationCount) return false;
  return true;
}

function transformLocalPoint(matrix, x, y) {
  const p = util.transformPoint({ x, y }, matrix);
  return { x: p.x, y: p.y };
}

export function getWorldMatrix(obj) {
  obj.setCoords?.();
  return obj.calcTransformMatrix();
}

export function getWorldPointChain(obj) {
  if (!obj) return [];
  const matrix = getWorldMatrix(obj);

  if (obj.type === 'line') {
    return [
      transformLocalPoint(matrix, obj.x1 ?? 0, obj.y1 ?? 0),
      transformLocalPoint(matrix, obj.x2 ?? 0, obj.y2 ?? 0),
    ];
  }

  if (obj.type === 'polyline') {
    const raw = obj.points || [];
    if (raw.length < 1) return [];
    const ox = obj.pathOffset?.x ?? 0;
    const oy = obj.pathOffset?.y ?? 0;
    return raw.map((p) => transformLocalPoint(matrix, p.x - ox, p.y - oy));
  }

  return [];
}

export function pointsEqual(a, b, tolerance = ENDPOINT_TOLERANCE) {
  return scenePointsNear(a, b, tolerance);
}

export function dedupeConsecutivePoints(points, tolerance = ENDPOINT_TOLERANCE) {
  if (!points.length) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    if (!pointsEqual(points[i], out[out.length - 1], tolerance)) {
      out.push(points[i]);
    }
  }
  return out;
}

export function projectPointOnSegment(pointer, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return { x: a.x, y: a.y, t: 0 };
  const t = Math.max(0, Math.min(1, ((pointer.x - a.x) * dx + (pointer.y - a.y) * dy) / lenSq));
  return { x: a.x + t * dx, y: a.y + t * dy, t };
}

export function segmentIntersection(a1, a2, b1, b2, tolerance = ENDPOINT_TOLERANCE) {
  const x1 = a1.x;
  const y1 = a1.y;
  const x2 = a2.x;
  const y2 = a2.y;
  const x3 = b1.x;
  const y3 = b1.y;
  const x4 = b2.x;
  const y4 = b2.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-9) return null;

  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;

  const onA = (
    px >= Math.min(x1, x2) - tolerance
    && px <= Math.max(x1, x2) + tolerance
    && py >= Math.min(y1, y2) - tolerance
    && py <= Math.max(y1, y2) + tolerance
  );
  const onB = (
    px >= Math.min(x3, x4) - tolerance
    && px <= Math.max(x3, x4) + tolerance
    && py >= Math.min(y3, y4) - tolerance
    && py <= Math.max(y3, y4) + tolerance
  );
  if (!onA || !onB) return null;
  return { x: px, y: py };
}

export function collectWorldSegments(canvas, exclude = []) {
  const excludeSet = new Set(exclude.filter(Boolean));
  const segments = [];
  if (!canvas) return segments;

  canvas.getObjects().forEach((obj) => {
    if (excludeSet.has(obj) || !isModifiableLineObject(obj)) return;
    const chain = getWorldPointChain(obj);
    for (let i = 0; i < chain.length - 1; i += 1) {
      segments.push({
        a: chain[i],
        b: chain[i + 1],
        obj,
        segmentIndex: i,
      });
    }
  });
  return segments;
}

export function hitTestLineLike(canvas, pointer, { tolerancePx = HIT_TOLERANCE_PX, zoom = 1, exclude = [] } = {}) {
  if (!canvas || !pointer) return null;
  const maxDist = tolerancePx / Math.max(zoom, 0.05);
  let best = null;

  canvas.getObjects().forEach((obj) => {
    if (exclude.includes(obj) || !isModifiableLineObject(obj)) return;
    const chain = getWorldPointChain(obj);
    for (let i = 0; i < chain.length - 1; i += 1) {
      const proj = projectPointOnSegment(pointer, chain[i], chain[i + 1]);
      const dist = Math.hypot(pointer.x - proj.x, pointer.y - proj.y);
      if (dist <= maxDist && (!best || dist < best.dist)) {
        best = {
          obj,
          segmentIndex: i,
          point: { x: proj.x, y: proj.y },
          dist,
          chain,
        };
      }
    }
  });

  return best;
}

export function nearestEndpointIndex(chain, pointer) {
  if (!chain.length) return -1;
  let best = 0;
  let bestDist = Math.hypot(chain[0].x - pointer.x, chain[0].y - pointer.y);
  for (let i = 1; i < chain.length; i += 1) {
    const d = Math.hypot(chain[i].x - pointer.x, chain[i].y - pointer.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function joinWorldChains(chainA, chainB, tolerance = ENDPOINT_TOLERANCE) {
  if (chainA.length < 2 || chainB.length < 2) return null;

  const endsA = [
    { end: 'start', p: chainA[0] },
    { end: 'end', p: chainA[chainA.length - 1] },
  ];
  const endsB = [
    { end: 'start', p: chainB[0] },
    { end: 'end', p: chainB[chainB.length - 1] },
  ];

  let best = null;
  endsA.forEach((ea) => {
    endsB.forEach((eb) => {
      const dist = Math.hypot(ea.p.x - eb.p.x, ea.p.y - eb.p.y);
      if (dist <= tolerance && (!best || dist < best.dist)) {
        best = { dist, aEnd: ea.end, bEnd: eb.end };
      }
    });
  });
  if (!best) return null;

  let a = [...chainA];
  let b = [...chainB];
  if (best.aEnd === 'start') a.reverse();
  if (best.bEnd === 'end') b.reverse();

  const merged = [...a];
  if (!pointsEqual(merged[merged.length - 1], b[0], tolerance)) {
    merged.push({ ...b[0] });
  }
  merged.push(...b.slice(1));
  return dedupeConsecutivePoints(merged, tolerance);
}

export function splitWorldChainAt(chain, segmentIndex, point, tolerance = ENDPOINT_TOLERANCE) {
  if (chain.length < 2 || segmentIndex < 0 || segmentIndex >= chain.length - 1) return null;

  const atStart = pointsEqual(point, chain[segmentIndex], tolerance);
  const atEnd = pointsEqual(point, chain[segmentIndex + 1], tolerance);

  if (atStart && segmentIndex === 0) return null;
  if (atEnd && segmentIndex === chain.length - 2) return null;

  let left;
  let right;

  if (atStart) {
    left = chain.slice(0, segmentIndex + 1);
    right = chain.slice(segmentIndex);
  } else if (atEnd) {
    left = chain.slice(0, segmentIndex + 2);
    right = chain.slice(segmentIndex + 1);
  } else {
    left = [...chain.slice(0, segmentIndex + 1), { ...point }];
    right = [{ ...point }, ...chain.slice(segmentIndex + 1)];
  }

  left = dedupeConsecutivePoints(left, tolerance);
  right = dedupeConsecutivePoints(right, tolerance);
  if (left.length < 2 || right.length < 2) return null;
  return [left, right];
}

export function findNearestRayIntersection(origin, through, segments, { excludeObj = null, excludeSegmentIndex = -1 } = {}) {
  const dx = through.x - origin.x;
  const dy = through.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const dir = { x: dx / len, y: dy / len };

  let best = null;
  segments.forEach((seg) => {
    if (excludeObj && seg.obj === excludeObj && seg.segmentIndex === excludeSegmentIndex) return;

    const rayEnd = { x: origin.x + dir.x * 1e6, y: origin.y + dir.y * 1e6 };
    const hit = segmentIntersection(origin, rayEnd, seg.a, seg.b);
    if (!hit) return;

    const t = (hit.x - origin.x) * dir.x + (hit.y - origin.y) * dir.y;
    if (t <= ENDPOINT_TOLERANCE) return;
    if (!best || t < best.t) {
      best = { point: hit, t, segment: seg };
    }
  });

  return best;
}

export function extendRayFromEndpoint(chain, endpointIndex) {
  if (chain.length < 2) return null;
  if (endpointIndex === 0) {
    return {
      origin: chain[0],
      through: {
        x: chain[0].x - (chain[1].x - chain[0].x),
        y: chain[0].y - (chain[1].y - chain[0].y),
      },
    };
  }
  const last = chain.length - 1;
  return {
    origin: chain[last],
    through: {
      x: chain[last].x + (chain[last].x - chain[last - 1].x),
      y: chain[last].y + (chain[last].y - chain[last - 1].y),
    },
  };
}

export function findNearestIntersectionAlongChain(chain, endpointIndex, segments, sourceObj) {
  const ray = extendRayFromEndpoint(chain, endpointIndex);
  if (!ray) return null;
  return findNearestRayIntersection(ray.origin, ray.through, segments, { excludeObj: sourceObj });
}

export function findTrimIntersection(chain, segmentIndex, pickPoint, segments, sourceObj) {
  const segStart = chain[segmentIndex];
  const segEnd = chain[segmentIndex + 1];
  const proj = projectPointOnSegment(pickPoint, segStart, segEnd);
  const toStart = Math.hypot(proj.x - segStart.x, proj.y - segStart.y);
  const toEnd = Math.hypot(proj.x - segEnd.x, proj.y - segEnd.y);
  const trimFromEnd = toEnd < toStart;

  const origin = trimFromEnd ? segEnd : segStart;
  const through = trimFromEnd ? segStart : segEnd;
  const hit = findNearestRayIntersection(origin, through, segments, {
    excludeObj: sourceObj,
    excludeSegmentIndex: segmentIndex,
  });
  if (!hit) return null;
  return { point: hit.point, trimFromEnd, segmentIndex, pickT: proj.t };
}

export function applyTrimToChain(chain, trimInfo, tolerance = ENDPOINT_TOLERANCE) {
  const { point, trimFromEnd, segmentIndex } = trimInfo;
  if (chain.length < 2) return null;

  if (trimFromEnd) {
    const head = chain.slice(0, segmentIndex + 1);
    head.push({ ...point });
    return dedupeConsecutivePoints(head, tolerance);
  }

  const tail = [{ ...point }, ...chain.slice(segmentIndex + 1)];
  return dedupeConsecutivePoints(tail, tolerance);
}

export function explodeWorldChain(chain, tolerance = ENDPOINT_TOLERANCE) {
  const clean = dedupeConsecutivePoints(chain, tolerance);
  if (clean.length < 2) return [];
  const pieces = [];
  for (let i = 0; i < clean.length - 1; i += 1) {
    pieces.push([clean[i], clean[i + 1]]);
  }
  return pieces;
}

export function closeWorldChain(chain, tolerance = ENDPOINT_TOLERANCE) {
  if (chain.length < 3) return null;
  if (pointsEqual(chain[0], chain[chain.length - 1], tolerance)) return [...chain];
  return [...chain, { ...chain[0] }];
}

export function cloneLineVisualProps(obj) {
  return {
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    strokeLineCap: obj.strokeLineCap,
    strokeLineJoin: obj.strokeLineJoin,
    strokeUniform: obj.strokeUniform,
    strokeDashArray: obj.strokeDashArray,
    opacity: obj.opacity ?? 1,
    erasable: obj.erasable !== false,
    strokeOnly: obj.strokeOnly,
  };
}
