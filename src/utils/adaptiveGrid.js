/** Espaciado “bonito” (1, 2, 5 × potencia de 10), como la cuadrícula de AutoCAD. */
export function niceGridStep(sceneUnits) {
  if (!Number.isFinite(sceneUnits) || sceneUnits <= 0) return 1;
  const exp = Math.floor(Math.log10(sceneUnits));
  const base = 10 ** exp;
  const norm = sceneUnits / base;
  if (norm <= 1) return base;
  if (norm <= 2) return 2 * base;
  if (norm <= 5) return 5 * base;
  return 10 * base;
}

/** Cuadrícula menor ~18–24 px en pantalla; mayor = 5× menor (estilo AutoCAD). */
export function getAdaptiveGridSpacings(zoom, { targetMinorPx = 20, majorFactor = 5 } = {}) {
  const z = Math.max(zoom, 0.02);
  const minor = niceGridStep(targetMinorPx / z);
  const major = minor * majorFactor;
  return { minor, major };
}

/** Encaja el puntero en la intersección de cuadrícula más cercana. */
export function snapPointerToGrid(pointer, zoom, maxDist) {
  if (!pointer) return null;
  const { minor } = getAdaptiveGridSpacings(zoom);
  if (!minor || minor <= 0) return null;

  const gx = Math.round(pointer.x / minor) * minor;
  const gy = Math.round(pointer.y / minor) * minor;
  const dist = Math.hypot(pointer.x - gx, pointer.y - gy);
  if (dist > maxDist) return null;

  return { x: gx, y: gy, kind: 'grid', dist, step: minor };
}

function getObjectBottomCenterInScene(target) {
  target.setCoords?.();
  const ac = target.aCoords;
  if (ac?.bl && ac?.br) {
    return {
      x: (ac.bl.x + ac.br.x) / 2,
      y: (ac.bl.y + ac.br.y) / 2,
    };
  }
  const bounds = target.getBoundingRect();
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height,
  };
}

/** Encaja el centro inferior del objeto en la intersección de cuadrícula más cercana. */
export function snapObjectOriginToGrid(target, zoom) {
  if (!target) return null;
  const { minor } = getAdaptiveGridSpacings(zoom);
  if (!minor || minor <= 0) return null;

  const { x: anchorX, y: anchorY } = getObjectBottomCenterInScene(target);

  const snappedX = Math.round(anchorX / minor) * minor;
  const snappedY = Math.round(anchorY / minor) * minor;
  const dx = snappedX - anchorX;
  const dy = snappedY - anchorY;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;

  target.set({
    left: (target.left ?? 0) + dx,
    top: (target.top ?? 0) + dy,
  });
  target.setCoords?.();
  return { x: snappedX, y: snappedY, kind: 'grid', step: minor };
}

export function drawAdaptiveGrid(ctx, pageWidth, pageHeight, zoom, viewportTransform, options = {}) {
  if (!ctx || !viewportTransform || !pageWidth || !pageHeight) return;

  const { minor, major } = getAdaptiveGridSpacings(zoom, options);
  const z = Math.max(zoom, 0.02);
  const hairline = 1 / z;

  const minorColor = options.minorColor ?? 'rgba(0, 0, 0, 0.07)';
  const majorColor = options.majorColor ?? 'rgba(0, 0, 0, 0.16)';
  const axisColor = options.axisColor ?? 'rgba(0, 0, 0, 0.22)';

  ctx.save();
  ctx.setTransform(
    viewportTransform[0],
    viewportTransform[1],
    viewportTransform[2],
    viewportTransform[3],
    viewportTransform[4],
    viewportTransform[5],
  );

  const drawLines = (step, color, width) => {
    if (step <= 0) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();

    const x0 = Math.floor(0 / step) * step;
    const x1 = Math.ceil(pageWidth / step) * step;
    for (let x = x0; x <= x1; x += step) {
      if (Math.abs(x) < 0.001) continue;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, pageHeight);
    }

    const y0 = Math.floor(0 / step) * step;
    const y1 = Math.ceil(pageHeight / step) * step;
    for (let y = y0; y <= y1; y += step) {
      if (Math.abs(y) < 0.001) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(pageWidth, y);
    }
    ctx.stroke();
  };

  drawLines(minor, minorColor, hairline);
  drawLines(major, majorColor, hairline * 1.35);

  ctx.strokeStyle = axisColor;
  ctx.lineWidth = hairline * 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(pageWidth, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(0, pageHeight);
  ctx.stroke();

  ctx.restore();
}
