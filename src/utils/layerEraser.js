import { Group, util } from 'fabric';

async function ensureEraserGroup(obj) {
  if (obj._eraserGroup) return obj._eraserGroup;

  if (obj.clipPath) {
    const restored = await obj.clipPath.clone();
    restored.set({
      absolutePositioned: true,
      inverted: false,
      originX: obj.originX,
      originY: obj.originY,
      left: obj.left,
      top: obj.top,
    });
    obj._eraserGroup = restored;
    return restored;
  }

  obj._eraserGroup = new Group([], {
    absolutePositioned: true,
    originX: obj.originX,
    originY: obj.originY,
    left: obj.left,
    top: obj.top,
  });
  return obj._eraserGroup;
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

export async function attachEraserPathToObject(canvas, obj, path) {
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
    originX: obj.originX,
    originY: obj.originY,
    left: obj.left,
    top: obj.top,
  });
  obj.clipPath = mask;
  obj.dirty = true;
  canvas.renderAll();
  return clone;
}

export function isLayerEraserPath(obj) {
  return obj?.globalCompositeOperation === 'destination-out' || obj?.eraserForLayer;
}
