import { Point, util } from 'fabric';
import { snapPointerToGrid } from './adaptiveGrid';

/** Radio de captura en píxeles de pantalla (se convierte según zoom). */
export const SNAP_SCREEN_RADIUS = 14;

const OVERLAY_NAMES = new Set(['__pageOverlay']);

const SNAP_COLORS = {
  endpoint: '#228b22',
  midpoint: '#228b22',
  line: '#c45c00',
  grid: '#0078d4',
  aperture: 'rgba(255, 210, 0, 0.95)',
};

const SNAP_APERTURE_COLORS = {
  endpoint: 'rgba(34, 139, 34, 0.92)',
  midpoint: 'rgba(34, 139, 34, 0.92)',
  line: 'rgba(196, 92, 0, 0.92)',
  grid: 'rgba(0, 120, 212, 0.92)',
};

function isSnapTarget(obj) {
  return Boolean(
    obj
    && obj.visible !== false
    && !obj.overlayLayer
    && !obj.globalEraser
    && !OVERLAY_NAMES.has(obj.name),
  );
}

function transformLocalPoint(matrix, x, y) {
  const pt = util.transformPoint(new Point(x, y), matrix);
  return { x: pt.x, y: pt.y };
}

function pushUniqueEndpoint(endpoints, point, seen, precision = 2) {
  const key = `${point.x.toFixed(precision)},${point.y.toFixed(precision)}`;
  if (seen.has(key)) return;
  seen.add(key);
  endpoints.push(point);
}

function pushSegment(segments, a, b) {
  if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5) return;
  segments.push({ a, b });
}

function collectFromLine(obj, matrix, endpoints, segments, seen) {
  const p1 = transformLocalPoint(matrix, obj.x1 ?? 0, obj.y1 ?? 0);
  const p2 = transformLocalPoint(matrix, obj.x2 ?? 0, obj.y2 ?? 0);
  pushUniqueEndpoint(endpoints, p1, seen);
  pushUniqueEndpoint(endpoints, p2, seen);
  pushSegment(segments, p1, p2);
}

function collectFromPolyline(obj, matrix, endpoints, segments, seen) {
  const raw = obj.points || [];
  if (raw.length < 1) return;
  const world = raw.map((p) => transformLocalPoint(matrix, p.x, p.y));
  world.forEach((p) => pushUniqueEndpoint(endpoints, p, seen));
  for (let i = 0; i < world.length - 1; i += 1) {
    pushSegment(segments, world[i], world[i + 1]);
  }
}

function collectFromRect(obj, matrix, endpoints, segments, seen) {
  const w = obj.width ?? 0;
  const h = obj.height ?? 0;
  const corners = [
    transformLocalPoint(matrix, 0, 0),
    transformLocalPoint(matrix, w, 0),
    transformLocalPoint(matrix, w, h),
    transformLocalPoint(matrix, 0, h),
  ];
  corners.forEach((p) => pushUniqueEndpoint(endpoints, p, seen));
  for (let i = 0; i < corners.length; i += 1) {
    pushSegment(segments, corners[i], corners[(i + 1) % corners.length]);
  }
}

function collectFromCircle(obj, matrix, endpoints, segments, seen) {
  const r = obj.radius ?? 0;
  const cx = obj.originX === 'center' ? 0 : r;
  const cy = obj.originY === 'center' ? 0 : r;
  const center = transformLocalPoint(matrix, cx, cy);
  pushUniqueEndpoint(endpoints, center, seen);
  const cardinals = [
    transformLocalPoint(matrix, cx, cy - r),
    transformLocalPoint(matrix, cx + r, cy),
    transformLocalPoint(matrix, cx, cy + r),
    transformLocalPoint(matrix, cx - r, cy),
  ];
  cardinals.forEach((p) => pushUniqueEndpoint(endpoints, p, seen));
  for (let i = 0; i < cardinals.length; i += 1) {
    pushSegment(segments, cardinals[i], cardinals[(i + 1) % cardinals.length]);
  }
}

function collectFromPath(obj, matrix, endpoints, segments, seen) {
  const commands = obj.path;
  if (!Array.isArray(commands) || !commands.length) return;

  const offsetX = obj.pathOffset?.x ?? 0;
  const offsetY = obj.pathOffset?.y ?? 0;
  const toWorld = (x, y) => transformLocalPoint(matrix, x - offsetX, y - offsetY);

  let current = null;
  let subpathStart = null;

  commands.forEach((cmd) => {
    const type = cmd[0];
    if (type === 'M' || type === 'm') {
      const rel = type === 'm';
      const x = rel ? (current?.x ?? 0) + cmd[1] : cmd[1];
      const y = rel ? (current?.y ?? 0) + cmd[2] : cmd[2];
      current = { x, y };
      subpathStart = current;
      pushUniqueEndpoint(endpoints, toWorld(x, y), seen);
      return;
    }
    if (type === 'L' || type === 'l') {
      const rel = type === 'l';
      const x = rel ? (current?.x ?? 0) + cmd[1] : cmd[1];
      const y = rel ? (current?.y ?? 0) + cmd[2] : cmd[2];
      const next = { x, y };
      if (current) pushSegment(segments, toWorld(current.x, current.y), toWorld(x, y));
      current = next;
      pushUniqueEndpoint(endpoints, toWorld(x, y), seen);
      return;
    }
    if (type === 'H' || type === 'h') {
      const rel = type === 'h';
      const x = rel ? (current?.x ?? 0) + cmd[1] : cmd[1];
      const next = { x, y: current?.y ?? 0 };
      if (current) pushSegment(segments, toWorld(current.x, current.y), toWorld(next.x, next.y));
      current = next;
      pushUniqueEndpoint(endpoints, toWorld(next.x, next.y), seen);
      return;
    }
    if (type === 'V' || type === 'v') {
      const rel = type === 'v';
      const y = rel ? (current?.y ?? 0) + cmd[1] : cmd[1];
      const next = { x: current?.x ?? 0, y };
      if (current) pushSegment(segments, toWorld(current.x, current.y), toWorld(next.x, next.y));
      current = next;
      pushUniqueEndpoint(endpoints, toWorld(next.x, next.y), seen);
      return;
    }
    if (type === 'C' || type === 'c') {
      const rel = type === 'c';
      const x = rel ? (current?.x ?? 0) + cmd[5] : cmd[5];
      const y = rel ? (current?.y ?? 0) + cmd[6] : cmd[6];
      const next = { x, y };
      if (current) pushSegment(segments, toWorld(current.x, current.y), toWorld(x, y));
      current = next;
      pushUniqueEndpoint(endpoints, toWorld(x, y), seen);
      return;
    }
    if (type === 'Q' || type === 'q') {
      const rel = type === 'q';
      const x = rel ? (current?.x ?? 0) + cmd[3] : cmd[3];
      const y = rel ? (current?.y ?? 0) + cmd[4] : cmd[4];
      const next = { x, y };
      if (current) pushSegment(segments, toWorld(current.x, current.y), toWorld(x, y));
      current = next;
      pushUniqueEndpoint(endpoints, toWorld(x, y), seen);
      return;
    }
    if (type === 'Z' || type === 'z') {
      if (current && subpathStart) {
        pushSegment(segments, toWorld(current.x, current.y), toWorld(subpathStart.x, subpathStart.y));
      }
      current = subpathStart;
    }
  });
}

function collectFromObject(obj, endpoints, segments, seen, parentMatrix = null) {
  if (!isSnapTarget(obj)) return;

  if (obj.type === 'group' && obj.getObjects) {
    const groupMatrix = parentMatrix
      ? util.multiplyTransformMatrices(parentMatrix, obj.calcOwnMatrix())
      : obj.calcTransformMatrix();
    obj.getObjects().forEach((child) => {
      collectFromObject(child, endpoints, segments, seen, groupMatrix);
    });
    return;
  }

  const matrix = parentMatrix
    ? util.multiplyTransformMatrices(parentMatrix, obj.calcOwnMatrix())
    : obj.calcTransformMatrix();

  switch (obj.type) {
    case 'line':
      collectFromLine(obj, matrix, endpoints, segments, seen);
      break;
    case 'polyline':
      collectFromPolyline(obj, matrix, endpoints, segments, seen);
      break;
    case 'rect':
      collectFromRect(obj, matrix, endpoints, segments, seen);
      break;
    case 'circle':
      collectFromCircle(obj, matrix, endpoints, segments, seen);
      break;
    case 'path':
      collectFromPath(obj, matrix, endpoints, segments, seen);
      break;
    default:
      break;
  }
}

export function collectSnapGeometry(canvas, exclude = []) {
  const endpoints = [];
  const segments = [];
  const seen = new Set();
  const excludeSet = new Set(exclude.filter(Boolean));

  if (!canvas) return { endpoints, segments };

  canvas.getObjects().forEach((obj) => {
    if (excludeSet.has(obj)) return;
    collectFromObject(obj, endpoints, segments, seen);
  });

  return { endpoints, segments };
}

function projectPointOnSegment(pointer, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return { x: a.x, y: a.y, t: 0 };
  const t = Math.max(0, Math.min(1, ((pointer.x - a.x) * dx + (pointer.y - a.y) * dy) / lenSq));
  return { x: a.x + t * dx, y: a.y + t * dy, t };
}

/** Pie perpendicular desde un punto de referencia sobre el segmento (estilo AutoCAD PER). */
function perpendicularFootOnSegment(reference, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return null;
  const t = ((reference.x - a.x) * dx + (reference.y - a.y) * dy) / lenSq;
  const tClamped = Math.max(0, Math.min(1, t));
  return {
    x: a.x + tClamped * dx,
    y: a.y + tClamped * dy,
    angle: Math.atan2(dy, dx),
  };
}

function nearestEndpoint(pointer, endpoints, maxDist) {
  let best = null;
  let bestDist = maxDist;
  endpoints.forEach((pt) => {
    const d = Math.hypot(pointer.x - pt.x, pointer.y - pt.y);
    if (d <= bestDist) {
      bestDist = d;
      best = { x: pt.x, y: pt.y, kind: 'endpoint', dist: d };
    }
  });
  return best;
}

function nearestMidpoint(pointer, segments, maxDist) {
  let best = null;
  let bestDist = maxDist;
  segments.forEach(({ a, b }) => {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const d = Math.hypot(pointer.x - mx, pointer.y - my);
    if (d <= bestDist) {
      bestDist = d;
      best = { x: mx, y: my, kind: 'midpoint', dist: d };
    }
  });
  return best;
}

function nearestOnLineFromReference(pointer, reference, segments, maxDist, { excludeEndpoints = false, endpointZone = 0 } = {}) {
  let best = null;
  let bestDist = maxDist;

  const skipNearEndpoints = (point, a, b) => (
    excludeEndpoints
    && endpointZone > 0
    && (
      Math.hypot(point.x - a.x, point.y - a.y) < endpointZone
      || Math.hypot(point.x - b.x, point.y - b.y) < endpointZone
    )
  );

  segments.forEach(({ a, b }) => {
    if (reference) {
      const foot = perpendicularFootOnSegment(reference, a, b);
      if (foot && !skipNearEndpoints(foot, a, b)) {
        const d = Math.hypot(pointer.x - foot.x, pointer.y - foot.y);
        if (d <= bestDist) {
          bestDist = d;
          best = { x: foot.x, y: foot.y, kind: 'line', angle: foot.angle, dist: d, mode: 'perpendicular' };
        }
      }
    }

    const proj = projectPointOnSegment(pointer, a, b);
    if (skipNearEndpoints(proj, a, b)) return;

    const d = Math.hypot(pointer.x - proj.x, pointer.y - proj.y);
    if (d <= bestDist) {
      bestDist = d;
      best = {
        x: proj.x,
        y: proj.y,
        kind: 'line',
        angle: Math.atan2(b.y - a.y, b.x - a.x),
        dist: d,
        mode: reference ? 'nearest' : 'nearest',
      };
    }
  });

  return best;
}

export function snapScenePointer(pointer, canvas, settings, { exclude = [], zoom = 1, referencePoint = null } = {}) {
  if (!pointer || !canvas) return { point: pointer, snap: null };
  if (!settings?.snapEndpoint && !settings?.snapOnLine && !settings?.snapGrid) {
    return { point: pointer, snap: null };
  }

  const maxDist = SNAP_SCREEN_RADIUS / Math.max(zoom, 0.05);
  const endpointZone = settings.snapEndpoint ? 10 / Math.max(zoom, 0.05) : 0;
  const candidates = [];

  if (settings.snapEndpoint || settings.snapOnLine) {
    const { endpoints, segments } = collectSnapGeometry(canvas, exclude);

    if (settings.snapEndpoint) {
      const endpointSnap = nearestEndpoint(pointer, endpoints, maxDist);
      if (endpointSnap) candidates.push(endpointSnap);
      const midpointSnap = nearestMidpoint(pointer, segments, maxDist);
      if (midpointSnap) candidates.push(midpointSnap);
    }

    if (settings.snapOnLine) {
      const lineSnap = nearestOnLineFromReference(pointer, referencePoint, segments, maxDist, {
        excludeEndpoints: settings.snapEndpoint,
        endpointZone,
      });
      if (lineSnap) candidates.push(lineSnap);
    }
  }

  if (settings.snapGrid) {
    const gridSnap = snapPointerToGrid(pointer, zoom, maxDist);
    if (gridSnap) candidates.push(gridSnap);
  }

  if (!candidates.length) return { point: pointer, snap: null };

  const tiePriority = { endpoint: 0, midpoint: 1, line: 2, grid: 3 };
  candidates.sort((a, b) => {
    if (Math.abs(a.dist - b.dist) > 0.75) return a.dist - b.dist;
    return (tiePriority[a.kind] ?? 9) - (tiePriority[b.kind] ?? 9);
  });

  const snap = candidates[0];
  return { point: { x: snap.x, y: snap.y }, snap };
}

export function hasObjectSnapEnabled(settings) {
  return Boolean(settings?.snapEndpoint || settings?.snapOnLine || settings?.snapGrid);
}

export function getMoveSnapExclude(target) {
  if (!target) return [];
  if (target.type === 'activeSelection' && typeof target.getObjects === 'function') {
    return target.getObjects();
  }
  return [target];
}

/** Ajuste dx/dy para encajar el puntero al mover figuras o imágenes. */
export function applyPointerMoveSnap(pointer, canvas, settings, { exclude = [], zoom = 1, referencePoint = null } = {}) {
  if (!pointer || !canvas || !hasObjectSnapEnabled(settings)) {
    return { dx: 0, dy: 0, snap: null, point: pointer };
  }
  const result = snapScenePointer(pointer, canvas, settings, { exclude, zoom, referencePoint });
  if (!result.snap) {
    return { dx: 0, dy: 0, snap: null, point: pointer };
  }
  return {
    dx: result.point.x - pointer.x,
    dy: result.point.y - pointer.y,
    snap: result.snap,
    point: result.point,
  };
}

function sceneToScreen(canvas, scenePoint) {
  return util.transformPoint(new Point(scenePoint.x, scenePoint.y), canvas.viewportTransform);
}

/** Apertura en el cursor: color según el tipo de referencia activa. */
function drawSnapAperture(ctx, canvas, pointer, zoom, snapKind) {
  if (!pointer) return;
  const screen = sceneToScreen(canvas, pointer);
  const half = Math.max(7, 9 * Math.min(zoom, 1.5));
  ctx.save();
  ctx.strokeStyle = SNAP_APERTURE_COLORS[snapKind] ?? SNAP_COLORS.aperture;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.strokeRect(screen.x - half, screen.y - half, half * 2, half * 2);
  ctx.restore();
}

function drawEndpointGlyph(ctx, screen, zoom) {
  const s = Math.max(5, 6.5 * Math.min(zoom, 1.8));
  ctx.strokeStyle = SNAP_COLORS.endpoint;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.rect(screen.x - s, screen.y - s, s * 2, s * 2);
  ctx.fill();
  ctx.stroke();
}

function drawMidpointGlyph(ctx, screen, zoom) {
  const s = Math.max(5, 6 * Math.min(zoom, 1.8));
  ctx.fillStyle = SNAP_COLORS.midpoint;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.25;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(screen.x, screen.y - s);
  ctx.lineTo(screen.x + s, screen.y + s * 0.85);
  ctx.lineTo(screen.x - s, screen.y + s * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawLineGlyph(ctx, screen, angle, zoom, mode = 'nearest') {
  const len = Math.max(8, 10 * Math.min(zoom, 1.8));
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(angle);
  ctx.strokeStyle = SNAP_COLORS.line;
  ctx.lineWidth = 2.25;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.lineTo(len, 0);
  ctx.stroke();

  if (mode === 'perpendicular') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.stroke();
  } else {
    ctx.fillStyle = SNAP_COLORS.line;
    ctx.beginPath();
    ctx.arc(0, 0, len * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGridGlyph(ctx, screen, zoom) {
  const s = Math.max(4, 5.5 * Math.min(zoom, 1.8));
  ctx.strokeStyle = SNAP_COLORS.grid;
  ctx.fillStyle = SNAP_COLORS.grid;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(screen.x - s, screen.y);
  ctx.lineTo(screen.x + s, screen.y);
  ctx.moveTo(screen.x, screen.y - s);
  ctx.lineTo(screen.x, screen.y + s);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(screen.x, screen.y, s * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSnapMarker(ctx, canvas, snapPoint, zoom = 1, pointer = null) {
  if (!ctx || !canvas || !snapPoint) return;
  if (!canvas.viewportTransform) return;

  if (pointer) drawSnapAperture(ctx, canvas, pointer, zoom, snapPoint.kind);

  const screen = sceneToScreen(canvas, snapPoint);

  if (snapPoint.kind === 'endpoint') {
    drawEndpointGlyph(ctx, screen, zoom);
    return;
  }
  if (snapPoint.kind === 'midpoint') {
    drawMidpointGlyph(ctx, screen, zoom);
    return;
  }
  if (snapPoint.kind === 'line') {
    drawLineGlyph(ctx, screen, snapPoint.angle ?? 0, zoom, snapPoint.mode ?? 'nearest');
    return;
  }
  if (snapPoint.kind === 'grid') {
    drawGridGlyph(ctx, screen, zoom);
  }
}
