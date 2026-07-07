import { Group, util } from 'fabric';

export async function attachEraserPathToObject(canvas, obj, path) {
  if (!canvas || !obj || !path) return null;

  if (path.canvas) {
    canvas.remove(path);
  }

  if (!obj._eraserGroup) {
    obj._eraserGroup = new Group([], {
      absolutePositioned: true,
      originX: obj.originX,
      originY: obj.originY,
      left: obj.left,
      top: obj.top,
    });
  }

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

  obj._eraserGroup.add(clone);

  const mask = await obj._eraserGroup.clone();
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
  canvas.requestRenderAll();
  return clone;
}

export function isLayerEraserPath(obj) {
  return obj?.globalCompositeOperation === 'destination-out' || obj?.eraserForLayer;
}
