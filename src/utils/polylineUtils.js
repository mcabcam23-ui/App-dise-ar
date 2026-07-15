import { Point, Line } from 'fabric';

/** ¿Son el mismo punto en escena (tolerancia sub-pixel)? */
export function scenePointsNear(a, b, tolerance = 0.5) {
  if (!a || !b) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}

/**
 * Vértices ortogonales entre last y next.
 * Si el destino (p. ej. OSNAP) no está alineado H/V, inserta la esquina intermedia.
 */
export function orthoSegmentVertices(last, next, ortho, tolerance = 0.5) {
  if (!next) return [];
  if (!last || !ortho) return [next];

  const dx = Math.abs(next.x - last.x);
  const dy = Math.abs(next.y - last.y);
  if (dx <= tolerance && dy <= tolerance) return [];
  if (dx <= tolerance || dy <= tolerance) return [next];

  const corner = dx >= dy
    ? { x: next.x, y: last.y }
    : { x: last.x, y: next.y };

  if (scenePointsNear(corner, next, tolerance) || scenePointsNear(corner, last, tolerance)) {
    return [next];
  }
  return [corner, next];
}

/** Añade vértices a la polilínea respetando orto (sin duplicar el último punto). */
export function appendPolylineVertices(points, target, ortho) {
  if (!target) return;
  const last = points[points.length - 1];
  const vertices = last ? orthoSegmentVertices(last, target, ortho) : [target];
  vertices.forEach((v) => {
    const cur = points[points.length - 1];
    if (!cur || !scenePointsNear(cur, v)) {
      points.push({ x: v.x, y: v.y });
    }
  });
}

/** Actualiza la línea punteada de previsualización (goma elástica). */
export function updatePolylineRubberBand(canvas, previewRef, from, to, { stroke, strokeWidth }, zoom) {
  if (!canvas || !from || !to) return;
  if (scenePointsNear(from, to, 0.01)) {
    if (previewRef.current) {
      canvas.remove(previewRef.current);
      previewRef.current = null;
    }
    return;
  }
  const z = Math.max(zoom, 0.02);
  const dash = [8 / z, 5 / z];
  const sw = Math.max(1, strokeWidth);
  if (previewRef.current) {
    previewRef.current.set({
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
      stroke,
      strokeWidth: sw,
      strokeDashArray: dash,
    });
    previewRef.current.setCoords();
  } else {
    previewRef.current = new Line([from.x, from.y, to.x, to.y], {
      stroke,
      strokeWidth: sw,
      strokeDashArray: dash,
      strokeUniform: true,
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    canvas.add(previewRef.current);
  }
  canvas.bringObjectToFront(previewRef.current);
}

/** Actualiza una Polyline con coordenadas absolutas del lienzo (Fabric 7: pathOffset + centro). */
export function setPolylineAbsolutePoints(polyline, absolutePoints) {
  if (!polyline?.set || !Array.isArray(absolutePoints) || absolutePoints.length < 1) return;

  const xs = absolutePoints.map((p) => p.x);
  const ys = absolutePoints.map((p) => p.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

  polyline.set({
    points: absolutePoints.map((p) => ({
      x: p.x - centerX,
      y: p.y - centerY,
    })),
    objectCaching: false,
  });

  polyline.setBoundingBox(false);
  polyline.setPositionByOrigin(new Point(centerX, centerY), 'center', 'center');
  polyline.setCoords?.();
}
