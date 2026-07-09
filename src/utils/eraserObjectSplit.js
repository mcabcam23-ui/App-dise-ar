import { Line, Path, Point, Polyline, ActiveSelection } from 'fabric';
import { clearLayerEraser } from './layerEraser';

const SPLITTABLE_TYPES = new Set(['path', 'polyline', 'line']);
const SAMPLE_STEP = 4;
const ENDPOINT_EPS = 0.75;

function cloneProps(obj) {
  return {
    left: obj.left,
    top: obj.top,
    angle: obj.angle ?? 0,
    scaleX: obj.scaleX ?? 1,
    scaleY: obj.scaleY ?? 1,
    skewX: obj.skewX ?? 0,
    skewY: obj.skewY ?? 0,
    flipX: obj.flipX ?? false,
    flipY: obj.flipY ?? false,
    originX: obj.originX,
    originY: obj.originY,
    stroke: obj.stroke,
    strokeWidth: obj.strokeWidth,
    strokeLineCap: obj.strokeLineCap,
    strokeLineJoin: obj.strokeLineJoin,
    strokeUniform: obj.strokeUniform,
    strokeDashArray: obj.strokeDashArray,
    opacity: obj.opacity ?? 1,
    objectCaching: false,
    erasable: obj.erasable !== false,
    id: obj.id,
    name: obj.name,
    presetId: obj.presetId,
    vectorTrayecto: obj.vectorTrayecto,
    trayectoTrackMode: obj.trayectoTrackMode,
    customStationCount: obj.customStationCount,
    customStationCountValue: obj.customStationCountValue,
    trayectoStationGap: obj.trayectoStationGap,
    trayectoStationWidth: obj.trayectoStationWidth,
    strokeOnly: obj.strokeOnly,
  };
}

function getEraserObjects(obj) {
  const group = obj._eraserGroup;
  if (!group?.getObjects) return [];
  return group.getObjects();
}

function isPointErased(point, erasers) {
  for (const eraser of erasers) {
    if (!eraser) continue;
    const pad = Math.max(1, (eraser.strokeWidth || 0) / 2);
    const bounds = eraser.getBoundingRect(true, true);
    if (
      point.x < bounds.left - pad
      || point.x > bounds.left + bounds.width + pad
      || point.y < bounds.top - pad
      || point.y > bounds.top + bounds.height + pad
    ) {
      continue;
    }
    if (typeof eraser.containsPoint === 'function') {
      if (eraser.containsPoint(new Point(point.x, point.y))) return true;
    } else {
      return true;
    }
  }
  return false;
}

function isSegmentErased(a, b, erasers) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(2, Math.ceil(dist / SAMPLE_STEP));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
    if (isPointErased(point, erasers)) return true;
  }
  return false;
}

function pointsEqual(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= ENDPOINT_EPS;
}

function splitSegmentsByEraser(segments, erasers) {
  return segments.filter((seg) => !isSegmentErased(
    { x: seg.x1, y: seg.y1 },
    { x: seg.x2, y: seg.y2 },
    erasers,
  ));
}

function segmentsToChains(segments) {
  if (!segments.length) return [];

  const remaining = segments.map((seg) => ({ ...seg }));
  const chains = [];

  while (remaining.length) {
    const seed = remaining.shift();
    const points = [
      { x: seed.x1, y: seed.y1 },
      { x: seed.x2, y: seed.y2 },
    ];

    let extended = true;
    while (extended) {
      extended = false;
      for (let i = remaining.length - 1; i >= 0; i -= 1) {
        const seg = remaining[i];
        const start = { x: seg.x1, y: seg.y1 };
        const end = { x: seg.x2, y: seg.y2 };
        const head = points[0];
        const tail = points[points.length - 1];

        if (pointsEqual(end, head)) {
          points.unshift(start);
          remaining.splice(i, 1);
          extended = true;
        } else if (pointsEqual(start, head)) {
          points.unshift(end);
          remaining.splice(i, 1);
          extended = true;
        } else if (pointsEqual(start, tail)) {
          points.push(end);
          remaining.splice(i, 1);
          extended = true;
        } else if (pointsEqual(end, tail)) {
          points.push(start);
          remaining.splice(i, 1);
          extended = true;
        }
      }
    }

    chains.push(points);
  }

  return chains.filter((chain) => chain.length >= 2);
}

function sampleQuadratic(p0, p1, p2, steps = 8) {
  const points = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    });
  }
  return points;
}

function sampleCubic(p0, p1, p2, p3, steps = 10) {
  const points = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    points.push({
      x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
    });
  }
  return points;
}

function pathCommandsToSegments(pathCommands) {
  const segments = [];
  if (!Array.isArray(pathCommands)) return segments;

  let current = null;
  let subpathStart = null;

  const addLine = (next) => {
    if (!current) return;
    segments.push({
      x1: current.x,
      y1: current.y,
      x2: next.x,
      y2: next.y,
    });
    current = next;
  };

  for (const cmd of pathCommands) {
    const type = cmd[0];
    if (type === 'M') {
      current = { x: cmd[1], y: cmd[2] };
      subpathStart = { ...current };
    } else if (type === 'L' && current) {
      addLine({ x: cmd[1], y: cmd[2] });
    } else if (type === 'Q' && current) {
      const control = { x: cmd[1], y: cmd[2] };
      const end = { x: cmd[3], y: cmd[4] };
      let prev = current;
      sampleQuadratic(current, control, end).forEach((point) => {
        segments.push({ x1: prev.x, y1: prev.y, x2: point.x, y2: point.y });
        prev = point;
      });
      current = end;
    } else if (type === 'C' && current) {
      const c1 = { x: cmd[1], y: cmd[2] };
      const c2 = { x: cmd[3], y: cmd[4] };
      const end = { x: cmd[5], y: cmd[6] };
      let prev = current;
      sampleCubic(current, c1, c2, end).forEach((point) => {
        segments.push({ x1: prev.x, y1: prev.y, x2: point.x, y2: point.y });
        prev = point;
      });
      current = end;
    } else if (type === 'Z' && current && subpathStart) {
      addLine({ ...subpathStart });
      current = { ...subpathStart };
    }
  }

  return segments;
}

function chainToPathData(points) {
  if (points.length < 2) return null;
  const parts = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let i = 1; i < points.length; i += 1) {
    parts.push(`L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`);
  }
  return parts.join(' ');
}

function buildPieceChains(segments, erasers) {
  return segmentsToChains(splitSegmentsByEraser(segments, erasers));
}

function buildLineChains(obj, erasers) {
  return buildPieceChains([{
    x1: obj.x1,
    y1: obj.y1,
    x2: obj.x2,
    y2: obj.y2,
  }], erasers);
}

function buildPolylineChains(obj, erasers) {
  const points = obj.points ?? [];
  if (points.length < 2) return [];
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({
      x1: points[i].x,
      y1: points[i].y,
      x2: points[i + 1].x,
      y2: points[i + 1].y,
    });
  }
  return buildPieceChains(segments, erasers);
}

function buildPathChains(obj, erasers) {
  return buildPieceChains(pathCommandsToSegments(obj.path), erasers);
}

function applyTransformFromSource(target, source) {
  target.set({
    left: source.left,
    top: source.top,
    angle: source.angle ?? 0,
    scaleX: source.scaleX ?? 1,
    scaleY: source.scaleY ?? 1,
    skewX: source.skewX ?? 0,
    skewY: source.skewY ?? 0,
    flipX: source.flipX ?? false,
    flipY: source.flipY ?? false,
    originX: source.originX,
    originY: source.originY,
    pathOffset: source.pathOffset,
  });
}

function createLinePiece(source, chain, common) {
  const piece = new Line([chain[0].x, chain[0].y, chain[1].x, chain[1].y], {
    ...common,
    fill: '',
    strokeUniform: true,
  });
  applyTransformFromSource(piece, source);
  piece.setCoords();
  return piece;
}

function createPolylinePiece(source, chain, common) {
  const piece = new Polyline(
    chain.map((point) => ({ x: point.x, y: point.y })),
    {
      ...common,
      fill: '',
      strokeUniform: true,
    },
  );
  applyTransformFromSource(piece, source);
  piece.setCoords();
  return piece;
}

function createPathPiece(source, chain, common) {
  const piece = new Path('', {
    ...common,
    fill: '',
    strokeUniform: true,
  });
  applyTransformFromSource(piece, source);
  piece._setPath(chainToPathData(chain), false);
  piece.setCoords();
  return piece;
}

function applySingleChain(obj, chain) {
  if (obj.type === 'line') {
    obj.set({
      x1: chain[0].x,
      y1: chain[0].y,
      x2: chain[1].x,
      y2: chain[1].y,
      dirty: true,
    });
    return true;
  }

  if (obj.type === 'polyline') {
    obj.set({
      points: chain.map((point) => ({ x: point.x, y: point.y })),
      dirty: true,
    });
    return true;
  }

  obj._setPath(chainToPathData(chain), false);
  obj.dirty = true;
  return true;
}

function replaceWithPieces(canvas, obj, chains) {
  const index = canvas.getObjects().indexOf(obj);
  const wasActive = canvas.getActiveObject() === obj;
  const common = cloneProps(obj);
  const created = chains.map((chain) => {
    if (obj.type === 'line') return createLinePiece(obj, chain, common);
    if (obj.type === 'polyline') return createPolylinePiece(obj, chain, common);
    return createPathPiece(obj, chain, common);
  });

  canvas.remove(obj);
  created.forEach((next, offset) => {
    canvas.insertAt(index + offset, next);
  });

  if (wasActive) {
    if (created.length === 1) canvas.setActiveObject(created[0]);
    else if (created.length > 1) canvas.setActiveObject(new ActiveSelection(created, { canvas }));
  }

  canvas.requestRenderAll();
  return created;
}

export async function trySplitErasedObject(canvas, obj) {
  if (!canvas || !obj || !SPLITTABLE_TYPES.has(obj.type)) return null;

  const erasers = getEraserObjects(obj);
  if (!erasers.length) return null;

  let chains = [];
  if (obj.type === 'line') chains = buildLineChains(obj, erasers);
  else if (obj.type === 'polyline') chains = buildPolylineChains(obj, erasers);
  else if (obj.type === 'path') chains = buildPathChains(obj, erasers);

  if (!chains.length) {
    canvas.remove(obj);
    canvas.requestRenderAll();
    return [];
  }

  if (chains.length === 1) {
    applySingleChain(obj, chains[0]);
    clearLayerEraser(obj);
    obj.setCoords();
    canvas.requestRenderAll();
    return [obj];
  }

  return replaceWithPieces(canvas, obj, chains);
}
