import { PencilBrush } from 'fabric';
import { attachEraserPathToObject } from './layerEraser';
import {
  isEmptyEraserPath,
  prepareLayerEraserPattern,
  paintEraserCursorOverlay,
  renderEraserPreview,
  setEraserCursorScenePoint,
} from './eraserBrushUtils';

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
    this.erasingWidthAliasing = 0;
  }

  get targetObject() {
    return this.targetRef?.current ?? null;
  }

  _isErasable(obj) {
    return obj?.erasable !== false && !obj?.overlayLayer && obj?.name !== '__pageOverlay';
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
    this.canvas.calcOffset();
    this._prepareForDrawing(pointer);
    this._addPoint(pointer);
    prepareLayerEraserPattern(
      this.canvas,
      this._getPatternCanvas(),
      this.targetObject,
      (obj) => this._isErasable(obj),
    );
    setEraserCursorScenePoint(this.canvas, pointer);
    this._isErasing = true;
    this._render();
  }

  onMouseMove(pointer, options) {
    if (!this.canvas._isMainEvent(options.e) || !this.targetObject) return;
    setEraserCursorScenePoint(this.canvas, pointer);
    if (this._isErasing) {
      prepareLayerEraserPattern(
        this.canvas,
        this._getPatternCanvas(),
        this.targetObject,
        (obj) => this._isErasable(obj),
      );
    }
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

  _getPatternCanvas() {
    if (!this._patternCanvas) {
      this._patternCanvas = document.createElement('canvas');
    }
    return this._patternCanvas;
  }

  _render(ctx = this.canvas.contextTop) {
    if (!this._isErasing || !this._patternCanvas) {
      super._render(ctx);
      paintEraserCursorOverlay(this.canvas, this.width);
      return;
    }
    renderEraserPreview(this);
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
    if (isEmptyEraserPath(pathData)) {
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
