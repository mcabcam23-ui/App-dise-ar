import { Path } from 'fabric';
import { ERASER_MODES } from '../constants/toolModes';
import { attachEraserPathToObject } from './layerEraser';

export function isProtectedFromGlobalEraser(obj) {
  return obj?.erasable === false
    || obj?.overlayLayer
    || obj?.name === '__pageOverlay'
    || obj?.globalEraser;
}

export function getEraserSceneRect(scenePoint, size, padding = 0) {
  const half = size / 2 + padding;
  return {
    tl: { x: scenePoint.x - half, y: scenePoint.y - half },
    br: { x: scenePoint.x + half, y: scenePoint.y + half },
  };
}

function objectTouchesEraser(obj, scenePoint, rect) {
  if (!obj?.visible) return false;
  try {
    if (typeof obj.containsPoint === 'function' && obj.containsPoint(scenePoint)) return true;
    if (typeof obj.intersectsWithRect === 'function') {
      return obj.intersectsWithRect(rect.tl, rect.br);
    }
  } catch {
    return false;
  }
  return false;
}

export function hasErasableContentAt(canvas, scenePoint, size, { mode, target }) {
  if (!canvas || !scenePoint || !size) return false;

  const zoom = canvas.getZoom() || 1;
  const rect = getEraserSceneRect(scenePoint, size, 1 / zoom);

  if (mode === ERASER_MODES.LAYER) {
    if (!target || target.erasable === false) return false;
    return objectTouchesEraser(target, scenePoint, rect);
  }

  return canvas.getObjects().some((obj) => {
    if (isProtectedFromGlobalEraser(obj)) return false;
    return objectTouchesEraser(obj, scenePoint, rect);
  });
}

export function createSquareErasePath(scenePoint, size) {
  const half = size / 2;
  const left = scenePoint.x - half;
  const top = scenePoint.y - half;
  const right = scenePoint.x + half;
  const bottom = scenePoint.y + half;
  const pathStr = `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;

  return new Path(pathStr, {
    fill: 'rgba(0,0,0,1)',
    stroke: '',
    strokeWidth: 0,
    globalCompositeOperation: 'destination-out',
    strokeUniform: true,
    objectCaching: false,
    erasable: false,
    globalEraser: true,
    name: 'Borrado',
    selectable: false,
    evented: false,
  });
}

export function shouldApplyEraserStamp(lastPoint, scenePoint, size, { dragging = false } = {}) {
  if (!lastPoint) return true;
  const minDist = Math.max(2, size * (dragging ? 0.22 : 0.35));
  return Math.hypot(scenePoint.x - lastPoint.x, scenePoint.y - lastPoint.y) >= minDist;
}

/** Puntos intermedios para borrar en continuo mientras se arrastra. */
export function collectEraserStampPoints(from, to, size) {
  if (!from) return [to];
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const step = Math.max(2, size * 0.22);
  if (dist <= step) return [to];
  const count = Math.ceil(dist / step);
  const points = [];
  for (let i = 1; i <= count; i += 1) {
    const t = i / count;
    points.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
  }
  return points;
}

export async function applyEraserStamp(canvas, scenePoint, size, { mode, target }) {
  if (!canvas || !scenePoint || !size) return false;
  if (!hasErasableContentAt(canvas, scenePoint, size, { mode, target })) return false;

  const path = createSquareErasePath(scenePoint, size);

  if (mode === ERASER_MODES.LAYER && target) {
    path.eraserForLayer = true;
    canvas.fire('before:path:created', { path });
    await attachEraserPathToObject(canvas, target, path);
    canvas.fire('path:created', { path, target, stamp: true });
    return true;
  }

  canvas.fire('before:path:created', { path });
  canvas.add(path);
  path.setCoords();
  canvas.renderAll();
  canvas.fire('path:created', { path, stamp: true });
  return true;
}
