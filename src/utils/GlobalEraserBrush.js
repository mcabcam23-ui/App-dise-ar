import { PencilBrush } from 'fabric';
import { applyGlobalEraserPath } from './layerEraser';
import {
  isEmptyEraserPath,
  prepareGlobalEraserPattern,
  paintEraserCursorOverlay,
  renderEraserPreview,
  setEraserCursorScenePoint,
} from './eraserBrushUtils';

function isProtectedObject(obj) {
  return obj?.erasable === false || obj?.overlayLayer || obj?.name === '__pageOverlay';
}

/**
 * Borrador global: borra todo el contenido dibujado, protege fondo y guías.
 */
export class GlobalEraserBrush extends PencilBrush {
  type = 'global-eraser';

  constructor(canvas) {
    super(canvas);
    this._patternCanvas = null;
    this._isErasing = false;
    this.erasingWidthAliasing = 0;
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
    if (!this.canvas._isMainEvent(options.e)) return;
    this.canvas.calcOffset();
    this._prepareForDrawing(pointer);
    this._addPoint(pointer);
    prepareGlobalEraserPattern(this.canvas, this._getPatternCanvas(), isProtectedObject);
    setEraserCursorScenePoint(this.canvas, pointer);
    this._isErasing = true;
    this._render();
  }

  onMouseMove(pointer, options) {
    if (!this.canvas._isMainEvent(options.e)) return;
    setEraserCursorScenePoint(this.canvas, pointer);
    if (this._isErasing) {
      prepareGlobalEraserPattern(this.canvas, this._getPatternCanvas(), isProtectedObject);
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
    path.set({
      globalCompositeOperation: 'destination-out',
      stroke: 'rgba(0,0,0,1)',
      fill: '',
      strokeUniform: true,
      objectCaching: false,
      erasable: false,
      globalEraser: true,
      name: 'Borrado',
      selectable: false,
      evented: false,
    });

    this.canvas.clearContext(this.canvas.contextTop);
    this.canvas.fire('before:path:created', { path });

    applyGlobalEraserPath(this.canvas, path).then(() => {
      this.canvas.fire('path:created', { path });
      path.setCoords();
      this._resetShadow();
      this._reset();
    });
  }
}

export function isGlobalEraserPath(obj) {
  return obj?.globalEraser === true || (obj?.globalCompositeOperation === 'destination-out' && !obj?.eraserForLayer);
}
