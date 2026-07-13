/** Actualiza una Polyline con coordenadas absolutas del lienzo (evita recorte del trazo). */
export function setPolylineAbsolutePoints(polyline, absolutePoints) {
  if (!polyline?.set || !Array.isArray(absolutePoints) || absolutePoints.length < 1) return;

  const xs = absolutePoints.map((p) => p.x);
  const ys = absolutePoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const sw = Math.max(1, polyline.strokeWidth || 2);
  const pad = sw / 2 + 1;
  const left = minX - pad;
  const top = minY - pad;

  polyline.set({
    left,
    top,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
    points: absolutePoints.map((p) => ({ x: p.x - minX + pad, y: p.y - minY + pad })),
    objectCaching: false,
    dirty: true,
  });
  polyline._setPositionDimensions?.({});
  polyline.setCoords?.();
}
