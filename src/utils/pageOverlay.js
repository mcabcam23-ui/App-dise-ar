import { Circle, Group, Line } from 'fabric';

export const OVERLAY_OBJECT_NAME = '__pageOverlay';

export function buildPageOverlay(width, height, type, spacing = 24, color = '#d0d0d0') {
  if (!type || type === 'none') return null;

  const items = [];
  const stroke = { stroke: color, strokeWidth: 1, fill: '' };

  if (type === 'grid') {
    for (let x = spacing; x < width; x += spacing) {
      items.push(new Line([x, 0, x, height], { ...stroke, selectable: false, evented: false }));
    }
    for (let y = spacing; y < height; y += spacing) {
      items.push(new Line([0, y, width, y], { ...stroke, selectable: false, evented: false }));
    }
  } else if (type === 'lines') {
    for (let y = spacing; y < height; y += spacing) {
      items.push(new Line([0, y, width, y], { ...stroke, selectable: false, evented: false }));
    }
  } else if (type === 'dots') {
    const r = 1.2;
    for (let y = spacing; y < height; y += spacing) {
      for (let x = spacing; x < width; x += spacing) {
        items.push(new Circle({
          left: x,
          top: y,
          radius: r,
          fill: color,
          stroke: '',
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
        }));
      }
    }
  }

  if (!items.length) return null;

  return new Group(items, {
    name: OVERLAY_OBJECT_NAME,
    selectable: false,
    evented: false,
    hasControls: false,
    erasable: false,
    overlayLayer: true,
    excludeFromExport: false,
  });
}

export function removePageOverlay(canvas) {
  const existing = canvas.getObjects().find((o) => o.name === OVERLAY_OBJECT_NAME || o.overlayLayer);
  if (existing) canvas.remove(existing);
}

export function syncPageOverlay(canvas, width, height, type, spacing, color) {
  removePageOverlay(canvas);
  const overlay = buildPageOverlay(width, height, type, spacing, color);
  if (overlay) {
    canvas.insertAt(0, overlay);
  }
  canvas.requestRenderAll();
}
