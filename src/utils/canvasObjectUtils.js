export function isObjectActive(canvas, obj) {
  const active = canvas.getActiveObject();
  if (!active || !obj) return false;
  if (active === obj) return true;
  if (active.type === 'activeSelection' && active.contains?.(obj)) return true;
  if (active.type === 'group' && active.contains?.(obj)) return true;
  return false;
}

/** Fabric 7 devuelve metadatos desde findTarget; opt.target sigue siendo el objeto. */
export function resolveEventTarget(canvas, domEvent, fabricTarget) {
  if (fabricTarget?.set) return fabricTarget;
  const hit = canvas?.findTarget?.(domEvent);
  if (!hit) return null;
  if (hit.set) return hit;
  return hit.target ?? hit.currentTarget ?? null;
}

export function swapCanvasObject(canvas, oldObj, newObj) {
  const parent = oldObj.group;
  const wasActive = isObjectActive(canvas, oldObj);

  if (parent) {
    const index = parent._objects.indexOf(oldObj);
    parent.remove(oldObj);
    if (index >= 0) parent.insertAt(index, newObj);
    else parent.add(newObj);
    newObj.setCoords();
    parent.setCoords();
  } else {
    const index = canvas.getObjects().indexOf(oldObj);
    canvas.remove(oldObj);
    if (index >= 0) canvas.insertAt(index, newObj);
    else canvas.add(newObj);
    newObj.setCoords();
  }

  if (wasActive) canvas.setActiveObject(newObj);
  canvas.requestRenderAll();
  return newObj;
}
