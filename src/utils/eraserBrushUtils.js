import { Point, PencilBrush, util } from 'fabric';

/**
 * Utilidades compartidas para los pinceles de goma (global y por capa).
 */

function resetPatternContext(patternCanvas, canvas) {
  const upper = canvas.upperCanvasEl;
  const retina = canvas.getRetinaScaling();
  patternCanvas.width = upper.width;
  patternCanvas.height = upper.height;
  const ctx = patternCanvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);
  if (retina > 1) {
    ctx.scale(retina, retina);
  }
  return ctx;
}

function renderPatternBackground(canvas, ctx) {
  if (typeof canvas._renderBackground === 'function') {
    canvas._renderBackground(ctx);
    return;
  }
  if (canvas.backgroundColor) {
    ctx.save();
    ctx.fillStyle = canvas.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function renderPatternObjects(canvas, ctx, shouldHide) {
  const hidden = [];
  canvas.getObjects().forEach((obj) => {
    if (shouldHide(obj)) {
      obj.visible = false;
      hidden.push(obj);
    }
  });

  try {
    ctx.save();
    ctx.transform(...canvas.viewportTransform);
    canvas._renderObjects(ctx, canvas.getObjects());
    ctx.restore();
  } finally {
    hidden.forEach((obj) => {
      obj.visible = true;
    });
  }
}

export function prepareGlobalEraserPattern(canvas, patternCanvas, isProtectedObject) {
  if (!canvas || !patternCanvas) return;
  const ctx = resetPatternContext(patternCanvas, canvas);
  renderPatternBackground(canvas, ctx);
  renderPatternObjects(canvas, ctx, (obj) => obj.visible && !isProtectedObject(obj));
}

export function prepareLayerEraserPattern(canvas, patternCanvas, target, isErasable) {
  if (!canvas || !patternCanvas || !target) return;
  const ctx = resetPatternContext(patternCanvas, canvas);
  renderPatternBackground(canvas, ctx);
  renderPatternObjects(canvas, ctx, (obj) => {
    if (obj === target) return true;
    return obj.visible && isErasable(obj);
  });
}

export function setEraserCursorScenePoint(canvas, scenePoint) {
  if (!canvas) return;
  canvas._eraserCursorScenePoint = scenePoint
    ? { x: scenePoint.x, y: scenePoint.y }
    : null;
}

/** Cuadrado azul del tamaño de la goma — coordenadas de pantalla del lienzo. */
export function drawEraserCursorPreview(ctx, canvas, scenePoint, size) {
  if (!ctx || !canvas || !scenePoint || !size) return;
  const vpt = canvas.viewportTransform;
  if (!vpt) return;

  const zoom = canvas.getZoom() || 1;
  const hairline = 1.5 / zoom;
  const dash = 4 / zoom;
  const half = size / 2;
  const center = util.transformPoint(new Point(scenePoint.x, scenePoint.y), vpt);

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0, 120, 212, 0.14)';
  ctx.strokeStyle = 'rgba(0, 120, 212, 0.95)';
  ctx.lineWidth = hairline;
  ctx.setLineDash([dash, dash]);

  ctx.beginPath();
  ctx.rect(center.x - half, center.y - half, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function paintEraserCursorOverlay(canvas, size) {
  const point = canvas?._eraserCursorScenePoint;
  if (!point || !size) return;
  drawEraserCursorPreview(canvas.getContext(), canvas, point, size);
}

export function renderEraserPreview(brush) {
  const canvas = brush.canvas;
  if (!canvas || !brush._patternCanvas) {
    PencilBrush.prototype._render.call(brush);
    paintEraserCursorOverlay(canvas, brush.width);
    return;
  }

  const retina = canvas.getRetinaScaling();
  const invRetina = 1 / retina;

  const topCtx = canvas.contextTop;
  canvas.clearContext(topCtx);
  topCtx.save();
  topCtx.setTransform(invRetina, 0, 0, invRetina, 0, 0);
  topCtx.drawImage(brush._patternCanvas, 0, 0);
  topCtx.restore();
  PencilBrush.prototype._render.call(brush, topCtx);
  paintEraserCursorOverlay(canvas, brush.width);
}

export function isEmptyEraserPath(pathData) {
  return !pathData?.length || pathData.join('') === 'M 0 0 Q 0 0 0 0 L 0 0';
}

export function clearEraserCursorPreview(canvas) {
  if (!canvas) return;
  setEraserCursorScenePoint(canvas, null);
}

export function getEraserStrokeCaps() {
  return { strokeLineCap: 'square', strokeLineJoin: 'miter' };
}
