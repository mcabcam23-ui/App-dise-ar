import { PencilBrush } from 'fabric';
import { attachEraserPathToObject } from './layerEraser';

function isEmptyPath(pathData) {
  return !pathData?.length || pathData.join('') === 'M 0 0 Q 0 0 0 0 L 0 0';
}

/**
 * Borrador que solo afecta a la capa seleccionada.
 */
export class LayerEraserBrush extends PencilBrush {
  type = 'layer-eraser';

  constructor(canvas, targetRef) {
    super(canvas);
    this.targetRef = targetRef;
    this._patternCanvas = null;
    this._isErasing = false;
    this.erasingWidthAliasing = 4;
  }

  get targetObject() {
    return this.targetRef?.current ?? null;
  }

  _isErasable(obj) {
    return obj?.erasable !== false && !obj?.overlayLayer && obj?.name !== '__pageOverlay';
  }

  preparePattern() {
    const canvas = this.canvas;
    const target = this.targetObject;
    if (!canvas || !target) return;

    if (!this._patternCanvas) {
      this._patternCanvas = document.createElement('canvas');
    }
    const patternCanvas = this._patternCanvas;
    patternCanvas.width = canvas.width;
    patternCanvas.height = canvas.height;
    const ctx = patternCanvas.getContext('2d');
    ctx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);

    if (canvas.backgroundColor) {
      ctx.save();
      ctx.fillStyle = canvas.backgroundColor;
      ctx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
      ctx.restore();
    }

    const hidden = [];
    canvas.getObjects().forEach((obj) => {
      if (obj === target || !obj.visible) return;
      if (!this._isErasable(obj)) return;
      obj.visible = false;
      hidden.push(obj);
    });
    target.visible = false;

    ctx.save();
    ctx.transform(...canvas.viewportTransform);
    canvas._renderObjects(ctx, canvas.getObjects());
    ctx.restore();

    hidden.forEach((obj) => { obj.visible = true; });
    target.visible = true;
  }

  _setBrushStyles(ctx) {
    super._setBrushStyles(ctx);
    ctx.strokeStyle = '#000000';
    if (ctx === this.canvas?.contextTop) {
      ctx.globalCompositeOperation = 'destination-in';
    } else if (ctx === this.canvas?.getContext()) {
      ctx.globalCompositeOperation = 'destination-out';
    }
  }

  _saveAndTransform(ctx) {
    super._saveAndTransform(ctx);
    this._setBrushStyles(ctx);
  }

  needsFullRender() {
    return true;
  }

  onMouseDown(pointer, options) {
    if (!this.canvas._isMainEvent(options.e) || !this.targetObject) return;
    this._prepareForDrawing(pointer);
    this._addPoint(pointer);
    this.preparePattern();
    this._isErasing = true;
    this._render();
  }

  onMouseMove(pointer, options) {
    if (!this.targetObject) return;
    if (this._isErasing) this.preparePattern();
    super.onMouseMove(pointer, options);
  }

  onMouseUp(options) {
    if (!this.canvas._isMainEvent(options.e)) return true;
    this.drawStraightLine = false;
    this.oldEnd = undefined;
    this._isErasing = false;
    this._finalizeAndAddPath();
    return false;
  }

  _render(ctx = this.canvas.contextTop) {
    if (!this._isErasing || !this._patternCanvas) {
      super._render(ctx);
      return;
    }

    const mainCtx = this.canvas.getContext();
    let lineWidth = this.width;
    if (lineWidth - this.erasingWidthAliasing > 0) {
      this.width = lineWidth - this.erasingWidthAliasing;
      super._render(mainCtx);
      this.width = lineWidth;
    }

    const topCtx = this.canvas.contextTop;
    this.canvas.clearContext(topCtx);
    topCtx.save();
    const retina = this.canvas.getRetinaScaling();
    topCtx.scale(1 / retina, 1 / retina);
    topCtx.drawImage(this._patternCanvas, 0, 0);
    topCtx.restore();
    super._render(topCtx);
  }

  _finalizeAndAddPath() {
    const target = this.targetObject;
    if (!target) {
      this.canvas.clearContext(this.canvas.contextTop);
      this._reset();
      return;
    }

    if (this.decimate) {
      this._points = this.decimatePoints(this._points, this.decimate);
    }
    const pathData = this.convertPointsToSVGPath(this._points);
    if (isEmptyPath(pathData)) {
      this.canvas.clearContext(this.canvas.contextTop);
      this._reset();
      return;
    }

    const path = this.createPath(pathData);
    path.eraserForLayer = true;
    this.canvas.clearContext(this.canvas.contextTop);
    this.canvas.fire('before:path:created', { path });

    attachEraserPathToObject(this.canvas, target, path).then(() => {
      this.canvas.fire('path:created', { path, target });
      this._resetShadow();
      this._reset();
    });
  }
}
