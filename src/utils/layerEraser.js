import { Group, util } from 'fabric';
import { trySplitErasedObject } from './eraserObjectSplit';

const pendingSplitIds = new Set();

function isGlobalEraserPath(obj) {  return obj?.globalEraser === true
    || (obj?.globalCompositeOperation === 'destination-out' && !obj?.eraserForLayer);
}

function isProtectedFromAttach(obj) {
  return obj?.erasable === false
    || obj?.overlayLayer
    || obj?.name === '__pageOverlay'
    || isGlobalEraserPath(obj);
}

function eraserTransformProps(obj) {
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
  };
}

async function ensureEraserGroup(obj) {
  if (obj._eraserGroup) return obj._eraserGroup;

  if (obj.clipPath) {
    const restored = await obj.clipPath.clone();
    restored.set({
      absolutePositioned: true,
      inverted: false,
      ...eraserTransformProps(obj),
    });
    obj._eraserGroup = restored;
    return restored;
  }

  obj._eraserGroup = new Group([], {
    absolutePositioned: true,
    ...eraserTransformProps(obj),
  });
  return obj._eraserGroup;
}

export function clearLayerEraser(obj) {
  if (!obj) return;
  obj.set({ clipPath: undefined, dirty: true });
  obj._eraserGroup = undefined;
}

export function syncLayerEraserMask(target) {
  if (!target) return false;

  const syncOne = (obj) => {
    if (!obj?.clipPath && !obj?._eraserGroup) return false;
    const transform = eraserTransformProps(obj);
    if (obj.clipPath) obj.clipPath.set(transform);
    if (obj._eraserGroup) obj._eraserGroup.set(transform);
    obj.dirty = true;
    return true;
  };

  if (target.type === 'activeSelection' && target.getObjects) {
    return target.getObjects().some(syncOne);
  }

  return syncOne(target);
}

export async function restoreEraserGroupFromClip(obj) {
  if (!obj?.clipPath || obj._eraserGroup) return;
  await ensureEraserGroup(obj);
}

export async function restoreAllLayerEraserGroups(canvas) {
  if (!canvas) return;
  const objects = canvas.getObjects();
  await Promise.all(objects.map((obj) => restoreEraserGroupFromClip(obj)));
}

export async function attachEraserPathToObject(canvas, obj, path, { deferSplit = false } = {}) {
  if (!canvas || !obj || !path) return null;

  if (path.canvas) {
    canvas.remove(path);
  }

  const eraserGroup = await ensureEraserGroup(obj);

  const clone = await path.clone();
  const matrix = util.multiplyTransformMatrices(
    util.invertTransform(obj.calcTransformMatrix()),
    clone.calcTransformMatrix(),
  );
  util.applyTransformToObject(clone, matrix);
  clone.set({
    stroke: '#000000',
    fill: '',
    globalCompositeOperation: 'source-over',
    selectable: false,
    evented: false,
  });

  eraserGroup.add(clone);

  const mask = await eraserGroup.clone();
  mask.set({
    absolutePositioned: true,
    inverted: true,
    ...eraserTransformProps(obj),
  });
  obj.clipPath = mask;
  obj.dirty = true;
  canvas.renderAll();

  if (deferSplit) {
    if (obj.id) pendingSplitIds.add(obj.id);
    return obj;
  }

  if (obj.id) pendingSplitIds.delete(obj.id);
  return trySplitErasedObject(canvas, obj);
}

export async function flushPendingEraserSplits(canvas) {
  if (!canvas || !pendingSplitIds.size) return [];
  const pending = canvas.getObjects().filter((obj) => obj.id && pendingSplitIds.has(obj.id));
  pendingSplitIds.clear();
  const results = [];
  for (const obj of pending) {
    const split = await trySplitErasedObject(canvas, obj);
    if (Array.isArray(split)) results.push(...split);
    else if (split) results.push(split);
  }
  return results;
}
function findEraserTargets(canvas, path) {
  path.setCoords();
  return canvas.getObjects().filter((obj) => {
    if (isProtectedFromAttach(obj)) return false;
    try {
      obj.setCoords();
      return typeof obj.intersectsWithObject === 'function' && obj.intersectsWithObject(path);
    } catch {
      return false;
    }
  });
}

export async function applyGlobalEraserPath(canvas, path, { deferSplit = false } = {}) {
  if (!canvas || !path) return [];

  const targets = findEraserTargets(canvas, path);
  const affected = [];

  for (const obj of targets) {
    const clone = await path.clone();
    const result = await attachEraserPathToObject(canvas, obj, clone, { deferSplit });
    if (Array.isArray(result)) affected.push(...result);
    else if (result) affected.push(result);
    else affected.push(obj);
  }

  if (path.canvas) canvas.remove(path);
  canvas.renderAll();
  return affected;
}
export async function bakeGlobalErasersIntoObject(canvas, obj) {
  if (!canvas || !obj || obj.type === 'activeSelection') return;

  const globals = canvas.getObjects().filter(isGlobalEraserPath);
  if (!globals.length) return;

  for (const path of globals) {
    try {
      obj.setCoords();
      path.setCoords();
      if (typeof obj.intersectsWithObject !== 'function' || !obj.intersectsWithObject(path)) continue;
      await attachEraserPathToObject(canvas, obj, await path.clone());
      canvas.remove(path);
    } catch {
      // ignore hit-test failures on unusual objects
    }
  }
}

export async function migrateCanvasGlobalErasers(canvas) {
  if (!canvas) return;
  const erasables = canvas.getObjects().filter((obj) => !isProtectedFromAttach(obj));
  for (const obj of erasables) {
    await bakeGlobalErasersIntoObject(canvas, obj);
  }
}

export function isLayerEraserPath(obj) {
  return obj?.globalCompositeOperation === 'destination-out' || obj?.eraserForLayer;
}
