import { PencilBrush } from 'fabric';

function isEmptyPath(pathData) {
  return !pathData?.length || pathData.join('') === 'M 0 0 Q 0 0 0 0 L 0 0';
}

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
    this.erasingWidthAliasing = 4;
  }

  preparePattern() {
    const canvas = this.canvas;
    if (!canvas) return;

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
      if (!obj.visible || isProtectedObject(obj)) return;
      obj.visible = false;
      hidden.push(obj);
    });

    ctx.save();
    ctx.transform(...canvas.viewportTransform);
    canvas._renderObjects(ctx, canvas.getObjects());
    ctx.restore();

    hidden.forEach((obj) => { obj.visible = true; });
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
    this._prepareForDrawing(pointer);
    this._addPoint(pointer);
    this.preparePattern();
    this._isErasing = true;
    this._render();
  }

  onMouseMove(pointer, options) {
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
    this.canvas.add(path);
    this.canvas.fire('path:created', { path });
    path.setCoords();
    this._resetShadow();
    this._reset();
  }
}

export function isGlobalEraserPath(obj) {
  return obj?.globalEraser === true || (obj?.globalCompositeOperation === 'destination-out' && !obj?.eraserForLayer);
}
