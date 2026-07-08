import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActiveSelection,
  Canvas,
  Circle,
  FabricImage,
  Group,
  Line,
  Path,
  PencilBrush,
  Polyline,
  Rect,
  Textbox,
  Triangle,
  IText,
  loadSVGFromURL,
  util,
} from 'fabric';
import { DEFAULT_PAGE, PAGE_SIZES, TOOLS } from '../constants/pageSizes';
import { ERASER_MODES, getTextModeOption, TEXT_MODES } from '../constants/toolModes';
import { DEFAULT_TEXT_STYLE, isTextObject, readTextStyleFromObject } from '../constants/textStyles';
import { applyTextStylePatch, captureTextFormatSelectionSnapshot, readEffectiveTextStyle } from '../utils/textSelectionStyles';
import { isEraserDrawMode } from '../constants/eraserModes';
import { drawEraserCursorPreview, clearEraserCursorPreview, setEraserCursorScenePoint } from '../utils/eraserBrushUtils';
import { applyEraserStamp, shouldApplyEraserStamp, collectEraserStampPoints } from '../utils/eraserStamp';
import { getBackgroundPreset, OVERLAY_TYPES } from '../constants/pageBackgrounds';
import { restoreAllLayerEraserGroups } from '../utils/layerEraser';
import { syncPageOverlay } from '../utils/pageOverlay';
import { getPresetShape } from '../constants/presetShapes';
import { resolveAssetUrl } from '../utils/assetUrl';
import { loadFabricImageFromAsset, loadFabricImageFromUrl } from '../utils/loadFabricImage';
import { buildSignalWithNumber, CANVAS_CUSTOM_PROPS, isMultiNumberPreset, replaceSignalNumberObject } from '../utils/signalNumberOverlay';
import { getPresetVariants, replacePresetSignal, replacePresetVariant, registerFabricCustomProps, findPresetHost, getObjectPresetId } from '../utils/presetVariants';
import { buildTrayectoShape, replaceTrayectoObject, trayectoNativeWidth } from '../utils/trayectoLine';
import { resolveEventTarget } from '../utils/canvasObjectUtils';
import { applyRotationSnap } from '../utils/rotationSnap';
import { applySignalTrackSnap, invalidateTrackSegmentCache } from '../utils/signalTrackSnap';
import { buildProjectSnapshot, fileToDataUrl } from '../utils/projectPersistence';
import {
  applyBucketFillToObject,
  applyStyleToObject,
  effectiveStrokeWidth,
  objectSupportsFill,
  objectSupportsStroke,
  repairStrokeIfNeeded,
  emptyObjectContent,
} from '../utils/objectStyles';
import {
  loadSavedColors,
  normalizeHex,
  persistSavedColors,
  sampleColorFromCanvas,
  MAX_SAVED_COLORS,
} from '../utils/colorPalette';

registerFabricCustomProps();

const MAX_HISTORY = 60;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function applyVectorQuality(obj) {
  if (!obj) return;
  obj.set({
    objectCaching: false,
    strokeUniform: true,
  });
  if (obj.type === 'group' && obj.getObjects) {
    obj.getObjects().forEach(applyVectorQuality);
  }
}

function isEditing(canvas) {
  const active = canvas?.getActiveObject();
  return active?.isEditing;
}

export function useFabricCanvas(containerRef) {
  const fabricRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const historySuspendedRef = useRef(0);
  const historySaveFrameRef = useRef(null);
  const isDirtyRef = useRef(false);
  const shapeStartRef = useRef(null);
  const activeShapeRef = useRef(null);
  const clipboardRef = useRef(null);
  const pasteOffsetRef = useRef(0);
  const pasteFromKeyRef = useRef(false);
  const spaceDownRef = useRef(false);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const toolRef = useRef(TOOLS.SELECT);
  const textModeRef = useRef(TEXT_MODES.BOX);
  const textStyleRef = useRef(DEFAULT_TEXT_STYLE);
  const textFormatSelectionRef = useRef(null);
  const eraserModeRef = useRef(ERASER_MODES.ALL);
  const eraserSizeRef = useRef(16);
  const strokeWidthRef = useRef(2);
  const strokeColorRef = useRef('#222222');
  const selectedObjectRef = useRef(null);
  const selectionCountRef = useRef(0);
  const polylinePointsRef = useRef([]);
  const polylinePreviewLineRef = useRef(null);
  const polylineDraftRef = useRef(null);
  const zoomRef = useRef(1);
  const propsDebounceRef = useRef(null);
  const propsDebounceTimerRef = useRef(null);
  const pageSizeRef = useRef(PAGE_SIZES[DEFAULT_PAGE]);

  const [tool, setTool] = useState(TOOLS.SELECT);
  const [textMode, setTextMode] = useState(TEXT_MODES.BOX);
  const [eraserMode, setEraserMode] = useState(ERASER_MODES.ALL);
  const [eraserSize, setEraserSizeState] = useState(16);
  const [pageSizeKey, setPageSizeKey] = useState(DEFAULT_PAGE);
  const [strokeColor, setStrokeColor] = useState('#222222');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [colorTarget, setColorTarget] = useState('stroke');
  const [savedColors, setSavedColors] = useState(loadSavedColors);
  const [fontSize, setFontSize] = useState(22);
  const [fontFamily, setFontFamily] = useState('Segoe UI');
  const [textStyle, setTextStyle] = useState(DEFAULT_TEXT_STYLE);
  const [textEditRevision, setTextEditRevision] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [pageOverlayType, setPageOverlayType] = useState(OVERLAY_TYPES.NONE);
  const [pageOverlaySpacing, setPageOverlaySpacing] = useState(24);
  const [pageOverlayColor, setPageOverlayColor] = useState('#cccccc');
  const [selectedObject, setSelectedObject] = useState(null);
  const [selectionCount, setSelectionCount] = useState(0);
  const [objects, setObjects] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [projectName, setProjectName] = useState('Sin título');
  const [savedHint, setSavedHint] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [polylinePoints, setPolylinePoints] = useState(0);

  const pageSize = PAGE_SIZES[pageSizeKey] || PAGE_SIZES[DEFAULT_PAGE];

  const saveColorToPalette = useCallback(() => {
    const source = colorTarget === 'fill' && fillColor !== 'transparent' ? fillColor : strokeColor;
    const hex = normalizeHex(source);
    if (!hex) return;
    setSavedColors((prev) => {
      if (prev.includes(hex)) return prev;
      const next = [hex, ...prev.filter((c) => c !== hex)].slice(0, MAX_SAVED_COLORS);
      persistSavedColors(next);
      return next;
    });
    setSavedHint(`Color ${hex} guardado`);
  }, [colorTarget, fillColor, strokeColor]);

  const removeSavedColor = useCallback((index) => {
    setSavedColors((prev) => {
      const next = prev.filter((_, i) => i !== index);
      persistSavedColors(next);
      return next;
    });
  }, []);

  const updateHistoryFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const refreshObjects = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const typeNames = {
      line: 'Línea',
      polyline: 'Multilínea',
      path: 'Trazo',
      rect: 'Rectángulo',
      circle: 'Círculo',
      textbox: 'Texto',
      'i-text': 'Texto',
      image: 'Imagen',
      group: 'Grupo',
    };
    const list = canvas.getObjects()
      .filter((obj) => !obj.overlayLayer && obj.name !== '__pageOverlay' && !obj.globalEraser)
      .map((obj, i) => ({
      id: obj.id || `obj-${i}`,
      type: obj.type,
      name: obj.name || `${typeNames[obj.type] || obj.type} ${i + 1}`,
      visible: obj.visible !== false,
      locked: obj.selectable === false,
      opacity: obj.opacity ?? 1,
      object: obj,
    }));
    setObjects(list);
  }, []);

  const setEraserSize = useCallback((size) => {
    const next = Math.max(4, Math.min(80, Math.round(Number(size) || 16)));
    eraserSizeRef.current = next;
    setEraserSizeState(next);
  }, []);

  const saveHistoryNow = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || isRestoringRef.current || historySuspendedRef.current > 0) return;

    const json = canvas.toJSON(CANVAS_CUSTOM_PROPS);
    const current = historyRef.current[historyIndexRef.current];
    if (current && JSON.stringify(current) === JSON.stringify(json)) return;

    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    while (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
    updateHistoryFlags();
    if (!isRestoringRef.current) {
      isDirtyRef.current = true;
      setSavedHint((prev) => (prev === 'Guardado' ? '' : prev));
    }
  }, [updateHistoryFlags]);

  const saveHistory = useCallback(() => {
    if (historySaveFrameRef.current != null) return;
    historySaveFrameRef.current = requestAnimationFrame(() => {
      historySaveFrameRef.current = null;
      saveHistoryNow();
    });
  }, [saveHistoryNow]);

  const runWithHistoryBatch = useCallback(
    (fn) => {
      historySuspendedRef.current += 1;
      try {
        fn();
      } finally {
        historySuspendedRef.current -= 1;
        saveHistoryNow();
      }
    },
    [saveHistoryNow],
  );

  const restoreFromHistory = useCallback(
    async (index) => {
      const canvas = fabricRef.current;
      const snapshot = historyRef.current[index];
      if (!canvas || !snapshot) return;

      if (historySaveFrameRef.current != null) {
        cancelAnimationFrame(historySaveFrameRef.current);
        historySaveFrameRef.current = null;
      }

      isRestoringRef.current = true;
      canvas.discardActiveObject();
      await canvas.loadFromJSON(snapshot);
      canvas.getObjects().forEach((obj) => repairStrokeIfNeeded(obj, strokeWidthRef.current || 2));
      await restoreAllLayerEraserGroups(canvas);
      canvas.requestRenderAll();
      historyIndexRef.current = index;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      isRestoringRef.current = false;
      updateHistoryFlags();
      refreshObjects();
      setSelectedObject(null);
      setSelectionCount(0);
    },
    [refreshObjects, updateHistoryFlags],
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) restoreFromHistory(historyIndexRef.current - 1);
  }, [restoreFromHistory]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) restoreFromHistory(historyIndexRef.current + 1);
  }, [restoreFromHistory]);

const SHAPE_TOOLS = [TOOLS.RECT, TOOLS.CIRCLE, TOOLS.LINE, TOOLS.ARROW];

  const cancelPolylineDraft = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (polylinePreviewLineRef.current) {
      canvas.remove(polylinePreviewLineRef.current);
      polylinePreviewLineRef.current = null;
    }
    if (polylineDraftRef.current) {
      canvas.remove(polylineDraftRef.current);
      polylineDraftRef.current = null;
    }
    if (polylinePointsRef.current.length > 0 && historySuspendedRef.current > 0) {
      historySuspendedRef.current -= 1;
    }
    polylinePointsRef.current = [];
    setPolylinePoints(0);
    canvas.requestRenderAll();
  }, []);

  const finishPolyline = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (polylinePreviewLineRef.current) {
      canvas.remove(polylinePreviewLineRef.current);
      polylinePreviewLineRef.current = null;
    }

    const points = polylinePointsRef.current;
    if (points.length >= 2 && polylineDraftRef.current) {
      polylineDraftRef.current.set({
        selectable: true,
        evented: true,
        id: uid(),
        name: 'Multilínea',
        strokeDashArray: undefined,
      });
      polylineDraftRef.current = null;
      if (historySuspendedRef.current > 0) historySuspendedRef.current -= 1;
      saveHistoryNow();
      refreshObjects();
    } else if (polylineDraftRef.current) {
      canvas.remove(polylineDraftRef.current);
      polylineDraftRef.current = null;
      if (historySuspendedRef.current > 0) historySuspendedRef.current -= 1;
    }

    polylinePointsRef.current = [];
    setPolylinePoints(0);
    canvas.requestRenderAll();
  }, [refreshObjects, saveHistoryNow]);

  const applyDrawingMode = useCallback(
    (canvas, activeTool) => {
      const isSelect = activeTool === TOOLS.SELECT;
      const isPen = activeTool === TOOLS.PEN;
      const isPan = activeTool === TOOLS.PAN;
      const isPolyline = activeTool === TOOLS.POLYLINE;
      const isEyedropper = activeTool === TOOLS.EYEDROPPER;
      const isBucket = activeTool === TOOLS.BUCKET;
      const isText = activeTool === TOOLS.TEXT;
      const isEraser = activeTool === TOOLS.ERASER;
      const eraserModeActive = eraserModeRef.current;
      const isEraserDraw = isEraser && isEraserDrawMode(eraserModeActive);
      const isEraserLayer = isEraserDraw && eraserModeActive === ERASER_MODES.LAYER;
      const isShape = SHAPE_TOOLS.includes(activeTool) || isPolyline;

      const isEraserConfirmLayer = isEraser && eraserModeActive === ERASER_MODES.CLEAR_LAYER;

      canvas.skipTargetFind = !isSelect && !isEyedropper && !isBucket && !isText
        && !isEraserConfirmLayer;
      canvas.selection = isSelect || isEraserConfirmLayer;
      canvas.perPixelTargetFind = false;

      if (!isSelect && !(isEraser && (isEraserLayer || isEraserConfirmLayer))) {
        canvas.discardActiveObject();
      }

      if (isPen) {
        canvas.isDrawingMode = true;
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
        canvas.freeDrawingCursor = 'crosshair';
        canvas.moveCursor = 'move';
        const brush = new PencilBrush(canvas);
        brush.color = strokeColor;
        brush.width = strokeWidth;
        brush.strokeLineCap = 'round';
        brush.strokeLineJoin = 'round';
        brush.decimate = 0;
        canvas.freeDrawingBrush = brush;
      } else if (isEraserDraw) {
        canvas.isDrawingMode = false;
        if (isEraserLayer && (!selectedObjectRef.current || selectionCountRef.current > 1)) {
          canvas.defaultCursor = 'not-allowed';
          canvas.hoverCursor = 'not-allowed';
        } else {
          canvas.defaultCursor = 'none';
          canvas.hoverCursor = 'none';
          canvas.freeDrawingCursor = 'none';
          canvas.moveCursor = 'none';
        }
      } else {
        canvas.isDrawingMode = false;
        if (isPan) {
          canvas.defaultCursor = 'grab';
          canvas.hoverCursor = 'grab';
        } else if (isText) {
          canvas.defaultCursor = 'text';
          canvas.hoverCursor = 'text';
        } else if (isEraser) {
          canvas.defaultCursor = 'default';
          canvas.hoverCursor = 'default';
        } else if (isEyedropper || isBucket) {
          canvas.defaultCursor = 'crosshair';
          canvas.hoverCursor = 'crosshair';
        } else if (isShape) {
          canvas.defaultCursor = 'crosshair';
          canvas.hoverCursor = 'crosshair';
        } else {
          canvas.defaultCursor = 'default';
          canvas.hoverCursor = isSelect ? 'move' : 'default';
        }
      }

      canvas.allowTouchScrolling = false;

      canvas.requestRenderAll();
    },
    [strokeColor, strokeWidth],
  );

  const setViewportGestureLock = useCallback(
    (locked) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      if (locked) {
        canvas.skipTargetFind = true;
        canvas.selection = false;
        canvas.allowTouchScrolling = true;
      } else {
        applyDrawingMode(canvas, toolRef.current);
      }
    },
    [applyDrawingMode],
  );

  const getActiveObjects = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return [];
    const active = canvas.getActiveObject();
    if (!active) return [];
    if (active.type === 'activeSelection') return active.getObjects();
    return [active];
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (!active.length) return;
    runWithHistoryBatch(() => {
      active.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      refreshObjects();
      setSelectedObject(null);
      setSelectionCount(0);
    });
  }, [refreshObjects, runWithHistoryBatch]);

  const deleteAll = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    runWithHistoryBatch(() => {
      canvas.getObjects().forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      refreshObjects();
      setSelectedObject(null);
      setSelectionCount(0);
    });
  }, [refreshObjects, runWithHistoryBatch]);

  const isProtectedCanvasObject = (obj) =>
    obj?.overlayLayer || obj?.name === '__pageOverlay';

  const clearAllContent = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const toRemove = canvas.getObjects().filter((obj) => !isProtectedCanvasObject(obj));
    if (!toRemove.length) {
      setSavedHint('No hay contenido que eliminar');
      return;
    }
    runWithHistoryBatch(() => {
      toRemove.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      refreshObjects();
      setSelectedObject(null);
      setSelectionCount(0);
    });
    setSavedHint('Hoja vaciada · fondo y guías conservados');
  }, [refreshObjects, runWithHistoryBatch]);

  const emptySelectedLayer = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active || isProtectedCanvasObject(active)) {
      setSavedHint('Selecciona una capa para vaciar');
      return;
    }
    const name = active.name || active.type || 'capa';
    runWithHistoryBatch(() => {
      if (active.type === 'activeSelection') {
        active.getObjects().forEach(emptyObjectContent);
      } else {
        emptyObjectContent(active);
      }
      canvas.requestRenderAll();
      refreshObjects();
      setSelectedObject(canvas.getActiveObject());
    });
    setSavedHint(`Capa «${name}» vaciada`);
  }, [refreshObjects, runWithHistoryBatch]);

  const bringForward = useCallback(() => {
    const canvas = fabricRef.current;
    getActiveObjects().forEach((obj) => canvas?.bringObjectForward(obj));
    canvas?.requestRenderAll();
    saveHistory();
    refreshObjects();
  }, [getActiveObjects, refreshObjects, saveHistory]);

  const sendBackward = useCallback(() => {
    const canvas = fabricRef.current;
    getActiveObjects().forEach((obj) => canvas?.sendObjectBackwards(obj));
    canvas?.requestRenderAll();
    saveHistory();
    refreshObjects();
  }, [getActiveObjects, refreshObjects, saveHistory]);

  const bringToFront = useCallback(() => {
    const canvas = fabricRef.current;
    getActiveObjects().forEach((obj) => canvas?.bringObjectToFront(obj));
    canvas?.requestRenderAll();
    saveHistory();
    refreshObjects();
  }, [getActiveObjects, refreshObjects, saveHistory]);

  const sendToBack = useCallback(() => {
    const canvas = fabricRef.current;
    getActiveObjects().forEach((obj) => canvas?.sendObjectToBack(obj));
    canvas?.requestRenderAll();
    saveHistory();
    refreshObjects();
  }, [getActiveObjects, refreshObjects, saveHistory]);

  const copySelected = useCallback(async () => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active) return false;
    clipboardRef.current = await active.clone();
    pasteOffsetRef.current = 0;
    setCanPaste(true);
    return true;
  }, []);

  const cutSelected = useCallback(async () => {
    const copied = await copySelected();
    if (copied) deleteSelected();
  }, [copySelected, deleteSelected]);

  const pasteClipboard = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!clipboardRef.current || !canvas) return;
    pasteOffsetRef.current = (pasteOffsetRef.current % 8) + 1;
    const offset = pasteOffsetRef.current * 16;
    const cloned = await clipboardRef.current.clone();

    historySuspendedRef.current += 1;
    try {
      if (cloned.type === 'activeSelection') {
        const items = cloned.getObjects();
        canvas.discardActiveObject();
        const added = [];
        for (const obj of items) {
          const c = await obj.clone();
          c.set({ left: (c.left || 0) + offset, top: (c.top || 0) + offset, id: uid() });
          canvas.add(c);
          added.push(c);
        }
        if (added.length > 1) {
          const sel = new ActiveSelection(added, { canvas });
          canvas.setActiveObject(sel);
          setSelectionCount(added.length);
          setSelectedObject(sel);
        } else if (added.length === 1) {
          canvas.setActiveObject(added[0]);
          setSelectionCount(1);
          setSelectedObject(added[0]);
        }
      } else {
        cloned.set({ left: (cloned.left || 0) + offset, top: (cloned.top || 0) + offset, id: uid() });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        setSelectionCount(1);
        setSelectedObject(cloned);
      }
      canvas.requestRenderAll();
      refreshObjects();
    } finally {
      historySuspendedRef.current -= 1;
      saveHistoryNow();
    }
  }, [refreshObjects, saveHistoryNow]);

  const duplicateSelected = useCallback(async () => {
    await copySelected();
    await pasteClipboard();
  }, [copySelected, pasteClipboard]);

  const selectAll = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects().filter((o) => o.selectable !== false);
    if (!objs.length) return;
    canvas.discardActiveObject();
    if (objs.length === 1) {
      canvas.setActiveObject(objs[0]);
      setSelectedObject(objs[0]);
      setSelectionCount(1);
    } else {
      const sel = new ActiveSelection(objs, { canvas });
      canvas.setActiveObject(sel);
      setSelectedObject(sel);
      setSelectionCount(objs.length);
    }
    canvas.requestRenderAll();
  }, []);

  const deselectAll = useCallback(() => {
    const canvas = fabricRef.current;
    canvas?.discardActiveObject();
    canvas?.requestRenderAll();
    setSelectedObject(null);
    setSelectionCount(0);
    setTool(TOOLS.SELECT);
  }, []);

  const lockSelected = useCallback(() => {
    getActiveObjects().forEach((obj) => {
      obj.set({ selectable: false, evented: false, hasControls: false });
    });
    fabricRef.current?.discardActiveObject();
    fabricRef.current?.requestRenderAll();
    saveHistory();
    refreshObjects();
    setSelectedObject(null);
    setSelectionCount(0);
  }, [getActiveObjects, refreshObjects, saveHistory]);

  const unlockAll = useCallback(() => {
    fabricRef.current?.getObjects().forEach((obj) => {
      obj.set({ selectable: true, evented: true, hasControls: true });
    });
    fabricRef.current?.requestRenderAll();
    saveHistory();
    refreshObjects();
  }, [refreshObjects, saveHistory]);

  const groupSelected = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active || active.type !== 'activeSelection') return;
    const items = active.getObjects();
    canvas.discardActiveObject();
    items.forEach((o) => canvas.remove(o));
    const group = new Group(items, { id: uid(), name: 'Grupo' });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.requestRenderAll();
    saveHistory();
    refreshObjects();
    setSelectedObject(group);
    setSelectionCount(1);
  }, [refreshObjects, saveHistory]);

  const ungroupSelected = useCallback(() => {
    const canvas = fabricRef.current;
    const active = canvas?.getActiveObject();
    if (!active || active.type !== 'group') return;
    const items = active.removeAll();
    canvas.remove(active);
    items.forEach((item) => {
      item.setCoords();
      canvas.add(item);
    });
    if (items.length > 1) {
      const sel = new ActiveSelection(items, { canvas });
      canvas.setActiveObject(sel);
      setSelectedObject(sel);
      setSelectionCount(items.length);
    } else if (items[0]) {
      canvas.setActiveObject(items[0]);
      setSelectedObject(items[0]);
      setSelectionCount(1);
    }
    canvas.requestRenderAll();
    saveHistory();
    refreshObjects();
  }, [refreshObjects, saveHistory]);

  const alignSelected = useCallback(
    (mode) => {
      const canvas = fabricRef.current;
      const objs = getActiveObjects();
      if (!canvas || objs.length < 2) return;
      const bounds = objs.map((o) => o.getBoundingRect());
      const minL = Math.min(...bounds.map((b) => b.left));
      const maxR = Math.max(...bounds.map((b) => b.left + b.width));
      const minT = Math.min(...bounds.map((b) => b.top));
      const maxB = Math.max(...bounds.map((b) => b.top + b.height));
      const midX = (minL + maxR) / 2;
      const midY = (minT + maxB) / 2;

      objs.forEach((obj, i) => {
        const b = bounds[i];
        if (mode === 'left') obj.set({ left: obj.left + (minL - b.left) });
        if (mode === 'right') obj.set({ left: obj.left + (maxR - (b.left + b.width)) });
        if (mode === 'centerH') obj.set({ left: obj.left + (midX - (b.left + b.width / 2)) });
        if (mode === 'top') obj.set({ top: obj.top + (minT - b.top) });
        if (mode === 'bottom') obj.set({ top: obj.top + (maxB - (b.top + b.height)) });
        if (mode === 'centerV') obj.set({ top: obj.top + (midY - (b.top + b.height / 2)) });
        obj.setCoords();
      });
      canvas.requestRenderAll();
      saveHistory();
    },
    [getActiveObjects, saveHistory],
  );

  const nudgeSelected = useCallback(
    (dx, dy) => {
      const canvas = fabricRef.current;
      const objs = getActiveObjects();
      if (!canvas || !objs.length) return;
      objs.forEach((obj) => {
        obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy });
        obj.setCoords();
      });
      canvas.requestRenderAll();
      saveHistory();
    },
    [getActiveObjects, saveHistory],
  );

  const addTextAtPoint = useCallback(
    (pointer) => {
      const canvas = fabricRef.current;
      if (!canvas || !pointer) return;
      const mode = getTextModeOption(textMode);
      const style = textStyleRef.current;
      /** Separación entre el clic y el borde izquierdo del cuadro. */
      const anchorGap = 10;
      const nameByMode = {
        [TEXT_MODES.TITLE]: 'Título',
        [TEXT_MODES.LABEL]: 'Etiqueta',
        [TEXT_MODES.NOTE]: 'Nota',
        [TEXT_MODES.LINE]: 'Texto línea',
      };
      const common = {
        left: pointer.x + anchorGap,
        top: pointer.y,
        originX: 'left',
        originY: 'top',
        fontSize: mode.fontSize ?? style.fontSize,
        fontFamily: style.fontFamily,
        fill: style.fill,
        fontWeight: mode.fontWeight ?? style.fontWeight,
        fontStyle: style.fontStyle,
        underline: style.underline,
        linethrough: style.linethrough,
        textAlign: style.textAlign,
        opacity: style.opacity,
        lineHeight: style.lineHeight,
        charSpacing: style.charSpacing,
        stroke: style.strokeWidth > 0 ? style.stroke || '#000000' : '',
        strokeWidth: style.strokeWidth > 0 ? style.strokeWidth : 0,
        editable: true,
        id: uid(),
        name: nameByMode[mode.id] ?? 'Texto',
      };

      let text;
      if (mode.type === 'i-text') {
        text = new IText(mode.placeholder, common);
      } else {
        text = new Textbox(mode.placeholder, {
          ...common,
          width: mode.width ?? 280,
          backgroundColor: mode.backgroundColor ?? style.backgroundColor ?? '',
          splitByGrapheme: true,
        });
      }

      historySuspendedRef.current += 1;
      canvas.add(text);
      historySuspendedRef.current -= 1;
      canvas.setActiveObject(text);
      canvas.requestRenderAll();
      refreshObjects();
      setSelectedObject(text);
      setSelectionCount(1);
      setTool(TOOLS.SELECT);
      saveHistoryNow();
      if (typeof text.enterEditing === 'function') {
        text.enterEditing();
        if (typeof text.selectAll === 'function') text.selectAll();
      }
    },
    [refreshObjects, saveHistoryNow, textMode],
  );

  const selectTextMode = useCallback((modeId) => {
    setTextMode(modeId);
    const mode = getTextModeOption(modeId);
    setTextStyle((prev) => {
      const next = {
        ...prev,
        fontWeight: mode.fontWeight ?? 'normal',
        fontSize: mode.fontSize ?? prev.fontSize,
        backgroundColor: mode.backgroundColor ?? (mode.type === 'i-text' ? '' : prev.backgroundColor),
      };
      textStyleRef.current = next;
      setFontSize(next.fontSize);
      return next;
    });
  }, []);

  const captureTextFormatSelection = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    textFormatSelectionRef.current = captureTextFormatSelectionSnapshot(obj);
  }, []);

  const applyTextStyleToActive = useCallback(
    (patch) => {
      const canvas = fabricRef.current;
      const pending = textFormatSelectionRef.current;
      const objs = getActiveObjects().filter(isTextObject);
      if (!canvas || !objs.length) return false;

      let changed = false;
      objs.forEach((obj) => {
        if (applyTextStylePatch(obj, patch, pending)) changed = true;
      });

      if (changed) {
        canvas.requestRenderAll();
        saveHistory();
        setSelectedObject(canvas.getActiveObject());
        setTextEditRevision((v) => v + 1);
      }

      textFormatSelectionRef.current = null;
      return changed;
    },
    [getActiveObjects, saveHistory],
  );

  const patchTextStyle = useCallback(
    (patch) => {
      setTextStyle((prev) => {
        const next = { ...prev, ...patch };
        textStyleRef.current = next;
        if (patch.fontSize !== undefined) setFontSize(patch.fontSize);
        if (patch.fontFamily !== undefined) setFontFamily(patch.fontFamily);
        return next;
      });
      if (patch.fill !== undefined) setStrokeColor(patch.fill);

      applyTextStyleToActive(patch);
    },
    [applyTextStyleToActive],
  );

  const addText = useCallback(() => {
    setTool(TOOLS.TEXT);
  }, []);

  const addImageFromFile = useCallback(
    async (file, position) => {
      const canvas = fabricRef.current;
      if (!canvas || !file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        const img = await loadFabricImageFromUrl(dataUrl);
        const maxW = pageSize.width * 0.65;
        const scale = img.width > maxW ? maxW / img.width : 1;
        img.set({
          left: position?.x ?? 60,
          top: position?.y ?? 60,
          scaleX: scale,
          scaleY: scale,
          id: uid(),
          name: file.name?.replace(/\.[^.]+$/, '') || 'Imagen',
          objectCaching: false,
        });
        historySuspendedRef.current += 1;
        canvas.add(img);
        historySuspendedRef.current -= 1;
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        refreshObjects();
        setSelectedObject(img);
        setSelectionCount(1);
      } catch (err) {
        console.error('Error al insertar imagen:', err);
        setSavedHint('No se pudo insertar la imagen');
      }
      setTool(TOOLS.SELECT);
      saveHistoryNow();
    },
    [pageSize.width, refreshObjects, saveHistoryNow],
  );

  const addPresetShape = useCallback(
    async (shapeId, colorOverride, insertSize) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      try {
      const applyInsertScale = (preset, naturalW, naturalH) => {
        const baseScale = preset?.defaultScale || 1;
        const nativeWidth = naturalW || preset?.width || 100;
        const nativeHeight = naturalH || preset?.height || 100;
        if (insertSize?.width > 0 && insertSize?.height > 0) {
          return {
            scaleX: insertSize.width / nativeWidth,
            scaleY: insertSize.height / nativeHeight,
          };
        }
        return { scaleX: baseScale, scaleY: baseScale };
      };

      if (typeof shapeId === 'string' && (shapeId.startsWith('data:') || shapeId.startsWith('/') || shapeId.startsWith('blob:') || shapeId.startsWith('http'))) {
        const img = await loadFabricImageFromUrl(shapeId);
        const scales = insertSize?.width > 0 && insertSize?.height > 0
          ? { scaleX: insertSize.width / (img.width || 1), scaleY: insertSize.height / (img.height || 1) }
          : { scaleX: 0.5, scaleY: 0.5 };
        img.set({ left: 100, top: 100, ...scales, id: uid(), name: 'Figura' });
        historySuspendedRef.current += 1;
        canvas.add(img);
        historySuspendedRef.current -= 1;
        canvas.setActiveObject(img);
      } else {
        const preset = getPresetShape(shapeId);
        const color = colorOverride || strokeColor;
        let shape;

        if (preset) {
          const { scaleX, scaleY } = applyInsertScale(preset);
          const common = {
            left: 80,
            top: 120,
            id: uid(),
            name: preset.name,
            scaleX,
            scaleY,
            presetId: preset.id,
          };

          if (preset.vectorTrayecto && preset.customStationCount) {
            const defaultCount = preset.defaultStationCount ?? 6;
            const stationCount = insertSize?.stationCount ?? defaultCount;
            const nativeW = trayectoNativeWidth(preset, stationCount, {
              trayectoStationGap: insertSize?.stationGap,
              trayectoStationWidth: insertSize?.stationWidth,
            });
            const displayW = insertSize?.width > 0 ? insertSize.width : nativeW * (preset.defaultScale || 1);
            const displayH = insertSize?.height > 0 ? insertSize.height : preset.height * (preset.defaultScale || 1);
            shape = buildTrayectoShape(
              preset,
              stationCount,
              displayW,
              displayH,
              common,
              {
                stroke: color,
                strokeWidth: Math.max(strokeWidth, 2),
                stationGap: insertSize?.stationGap,
                stationWidth: insertSize?.stationWidth,
              },
            );
          } else if (preset.svgAsset) {
            const { objects } = await loadSVGFromURL(resolveAssetUrl(preset.svgAsset));
            if (preset.strokeOnly) {
              objects.forEach((o) =>
                o.set({ fill: '', stroke: color, strokeLineCap: 'round', strokeLineJoin: 'round' }),
              );
              shape = objects.length === 1 ? objects[0] : util.groupSVGElements(objects);
              shape.set({ ...common, strokeOnly: true, stroke: color, fill: '' });
              applyVectorQuality(shape);
            } else {
              objects.forEach((o) => o.set({ fill: color, stroke: '' }));
              shape = objects.length === 1 ? objects[0] : util.groupSVGElements(objects);
              shape.set({ ...common, fillOnly: true });
            }
          } else if (preset.imageAsset) {
            const img = await loadFabricImageFromAsset(preset.imageAsset);
            const { width: nativeW, height: nativeH } = img.getOriginalSize();
            const nativeWidth = nativeW || preset.width || 1;
            const nativeHeight = nativeH || preset.height || 1;
            const displayW = insertSize?.width > 0 ? insertSize.width : nativeWidth * (preset.defaultScale || 1);
            const displayH = insertSize?.height > 0 ? insertSize.height : nativeHeight * (preset.defaultScale || 1);

            if (preset.customNumber) {
              const { scaleX: _sx, scaleY: _sy, ...commonFlat } = common;
              const numberValue = isMultiNumberPreset(preset)
                ? (insertSize?.signalNumbers ?? [])
                : (insertSize?.signalNumber ?? '100');
              shape = await buildSignalWithNumber(
                img,
                preset,
                displayW,
                displayH,
                numberValue,
                { ...commonFlat, scaleX: 1, scaleY: 1 },
                insertSize?.signalArrow ?? preset.arrowOverlay?.defaultDirection ?? 'right',
              );
            } else {
              const scales = applyInsertScale(preset, nativeWidth, nativeHeight);
              img.set({
                ...common,
                ...scales,
                objectCaching: false,
              });
              shape = img;
            }
          } else if (preset.fillOnly) {
            shape = new Path(preset.path, {
              ...common,
              fill: color,
              stroke: '',
              fillOnly: true,
            });
          } else if (preset.strokeOnly) {
            shape = new Path(preset.path, {
              ...common,
              fill: '',
              stroke: color,
              strokeWidth: Math.max(strokeWidth, 3),
              strokeLineCap: 'round',
              strokeLineJoin: 'round',
              strokeDashArray: preset.strokeDashArray,
              strokeOnly: true,
            });
            applyVectorQuality(shape);
          } else {
            shape = new Path(preset.path, {
              ...common,
              fill: fillColor === 'transparent' ? color : fillColor,
              stroke: color,
              strokeWidth,
            });
          }
        } else {
          shape = new Rect({
            left: 120,
            top: 120,
            width: 100,
            height: 100,
            fill: fillColor === 'transparent' ? '' : fillColor,
            stroke: colorOverride || strokeColor,
            strokeWidth,
            id: uid(),
            name: 'Cuadrado',
          });
        }

        historySuspendedRef.current += 1;
        canvas.add(shape);
        historySuspendedRef.current -= 1;
        canvas.setActiveObject(shape);
      }
      canvas.requestRenderAll();
      saveHistoryNow();
      refreshObjects();
      setSelectedObject(canvas.getActiveObject());
      setSelectionCount(1);
      setTool(TOOLS.SELECT);
      } catch (err) {
        console.error('Error al insertar figura:', err);
        setSavedHint('No se pudo insertar la figura');
      }
    },
    [fillColor, refreshObjects, saveHistoryNow, strokeColor, strokeWidth],
  );

  const applyPageOverlay = useCallback(
    (type = pageOverlayType, spacing = pageOverlaySpacing, color = pageOverlayColor) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const size = pageSizeRef.current;
      syncPageOverlay(canvas, size.width, size.height, type, spacing, color);
    },
    [pageOverlayColor, pageOverlaySpacing, pageOverlayType],
  );

  const setBackground = useCallback(
    (color) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      canvas.backgroundColor = color;
      canvas.backgroundImage = undefined;
      canvas.requestRenderAll();
      setBackgroundColor(color);
      saveHistory();
    },
    [saveHistory],
  );

  const applyBackgroundPreset = useCallback(
    (presetId) => {
      const preset = getBackgroundPreset(presetId);
      if (!preset) return;
      setBackground(preset.color);
      setPageOverlayType(preset.overlay ?? OVERLAY_TYPES.NONE);
      if (preset.overlayColor) setPageOverlayColor(preset.overlayColor);
      applyPageOverlay(preset.overlay ?? OVERLAY_TYPES.NONE, pageOverlaySpacing, preset.overlayColor ?? pageOverlayColor);
      setSavedHint(`Fondo: ${preset.label}`);
    },
    [applyPageOverlay, pageOverlayColor, pageOverlaySpacing, setBackground],
  );

  const setPageOverlay = useCallback(
    (type, spacing, color) => {
      if (type !== undefined) setPageOverlayType(type);
      if (spacing !== undefined) setPageOverlaySpacing(spacing);
      if (color !== undefined) setPageOverlayColor(color);
      applyPageOverlay(
        type ?? pageOverlayType,
        spacing ?? pageOverlaySpacing,
        color ?? pageOverlayColor,
      );
      saveHistory();
    },
    [applyPageOverlay, pageOverlayColor, pageOverlaySpacing, pageOverlayType, saveHistory],
  );

  const syncToolbarFromObject = useCallback((obj) => {
    if (!obj || obj.type === 'activeSelection') return;
    if (repairStrokeIfNeeded(obj, strokeWidthRef.current || 2)) {
      fabricRef.current?.requestRenderAll();
    }
    if (isTextObject(obj)) {
      const nextStyle = readEffectiveTextStyle(obj, textStyleRef.current);
      textStyleRef.current = nextStyle;
      setTextStyle(nextStyle);
      setFontSize(nextStyle.fontSize);
      setFontFamily(nextStyle.fontFamily);
    }
    if (objectSupportsStroke(obj) && typeof obj.stroke === 'string' && obj.stroke) {
      setStrokeColor(obj.stroke);
    } else if (isTextObject(obj) && obj.fill) {
      setStrokeColor(obj.fill);
    }
    if (objectSupportsFill(obj)) {
      setFillColor(!obj.fill || obj.fill === 'transparent' ? 'transparent' : obj.fill);
    }
    const w = effectiveStrokeWidth(obj, strokeWidthRef.current || 2);
    if (objectSupportsStroke(obj) && w >= 1) setStrokeWidth(w);
  }, []);

  const applyStyleToSelection = useCallback(
    (style) => {
      const canvas = fabricRef.current;
      const objs = getActiveObjects();
      if (!canvas || !objs.length) return;

      if (objs.every(isTextObject)) {
        applyTextStyleToActive(style);
        return;
      }

      objs.forEach((obj) => applyStyleToObject(obj, style));
      canvas.requestRenderAll();
      saveHistory();
      setSelectedObject(canvas.getActiveObject());
    },
    [applyTextStyleToActive, getActiveObjects, saveHistory],
  );

  const setStrokeColorLive = useCallback(
    (color) => {
      setStrokeColor(color);
      const objs = getActiveObjects();
      if (!objs.length) return;
      if (objs.every(isTextObject)) {
        applyStyleToSelection({ fill: color });
        setTextStyle((prev) => {
          const next = { ...prev, fill: color };
          textStyleRef.current = next;
          return next;
        });
        return;
      }
      applyStyleToSelection({ stroke: color });
    },
    [applyStyleToSelection, getActiveObjects],
  );

  const setFillColorLive = useCallback(
    (color) => {
      setFillColor(color);
      applyStyleToSelection({ fill: color === 'transparent' ? '' : color });
    },
    [applyStyleToSelection],
  );

  const setStrokeWidthLive = useCallback(
    (width) => {
      const w = Math.max(1, Number(width) || 1);
      setStrokeWidth(w);
      applyStyleToSelection({ strokeWidth: w });
    },
    [applyStyleToSelection],
  );

  const fillAtEvent = useCallback(
    (domEvent, fabricTarget) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const target = resolveEventTarget(canvas, domEvent, fabricTarget);
      const useStroke = domEvent.shiftKey;

      if (!target) {
        if (!useStroke && fillColor !== 'transparent') {
          setBackground(fillColor);
          setSavedHint('Fondo rellenado');
        }
        return;
      }

      const ok = applyBucketFillToObject(target, { fillColor, strokeColor, useStroke });
      if (!ok) {
        setSavedHint('Este elemento no admite relleno');
        return;
      }
      canvas.requestRenderAll();
      saveHistoryNow();
      setSavedHint(`Color aplicado a ${target.name || target.type}`);
    },
    [fillColor, saveHistoryNow, setBackground, strokeColor],
  );

  const applyColorToTarget = useCallback(
    (color, target = colorTarget) => {
      const hex = normalizeHex(color);
      if (!hex) return;
      if (target === 'fill') setFillColorLive(hex);
      else setStrokeColorLive(hex);
    },
    [colorTarget, setFillColorLive, setStrokeColorLive],
  );

  const pickColorAtEvent = useCallback(
    (domEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return null;
      const target = domEvent.altKey ? (colorTarget === 'stroke' ? 'fill' : 'stroke') : colorTarget;
      const hex = sampleColorFromCanvas(canvas, domEvent);
      if (!hex) {
        setSavedHint('Sin color en ese punto (zona transparente)');
        return null;
      }
      applyColorToTarget(hex, target);
      setSavedHint(`Color ${hex} → ${target === 'fill' ? 'relleno' : 'trazo'}`);
      return hex;
    },
    [applyColorToTarget, colorTarget],
  );

  const setBackgroundImage = useCallback(
    async (file) => {
      const canvas = fabricRef.current;
      if (!canvas || !file) return;
      try {
        const dataUrl = await fileToDataUrl(file);
        const img = await loadFabricImageFromUrl(dataUrl);
        const { width, height } = pageSizeRef.current;
        canvas.backgroundImage = img;
        canvas.backgroundColor = '';
        setBackgroundColor('');
        img.set({
          scaleX: width / (img.width || 1),
          scaleY: height / (img.height || 1),
          objectCaching: false,
        });
        canvas.requestRenderAll();
        saveHistory();
      } catch (err) {
        console.error('Error al poner imagen de fondo:', err);
        setSavedHint('No se pudo cargar la imagen de fondo');
      }
    },
    [saveHistory],
  );

  const clearBackgroundImage = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundImage = undefined;
    canvas.backgroundColor = backgroundColor;
    canvas.requestRenderAll();
    saveHistory();
  }, [backgroundColor, saveHistory]);

  const syncCanvasZoom = useCallback((canvas, zoomLevel) => {
    const { width, height } = pageSizeRef.current;
    canvas.setDimensions({ width: width * zoomLevel, height: height * zoomLevel });
    canvas.setViewportTransform([zoomLevel, 0, 0, zoomLevel, 0, 0]);
    canvas.calcOffset();
    canvas.requestRenderAll();
  }, []);

  const resizePage = useCallback(
    (key) => {
      const canvas = fabricRef.current;
      const size = PAGE_SIZES[key];
      if (!canvas || !size) return;
      pageSizeRef.current = size;
      canvas.baseWidth = size.width;
      canvas.baseHeight = size.height;
      syncCanvasZoom(canvas, zoomRef.current);
      applyPageOverlay(pageOverlayType, pageOverlaySpacing, pageOverlayColor);
      setPageSizeKey(key);
      saveHistory();
    },
    [applyPageOverlay, pageOverlayColor, pageOverlaySpacing, pageOverlayType, saveHistory, syncCanvasZoom],
  );

  const selectObjectByRef = useCallback((obj) => {
    const canvas = fabricRef.current;
    if (!canvas || !obj) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    setSelectedObject(obj);
    setSelectionCount(1);
  }, []);

  const toggleObjectVisibility = useCallback(
    (obj) => {
      const canvas = fabricRef.current;
      if (!canvas || !obj) return;
      obj.visible = !obj.visible;
      canvas.requestRenderAll();
      refreshObjects();
      saveHistory();
    },
    [refreshObjects, saveHistory],
  );

  const removeObject = useCallback(
    (obj) => {
      const canvas = fabricRef.current;
      if (!canvas || !obj) return;
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      refreshObjects();
      saveHistory();
      setSelectedObject(null);
      setSelectionCount(0);
    },
    [refreshObjects, saveHistory],
  );

  const renameObject = useCallback(
    (obj, name) => {
      if (!obj || !name?.trim()) return;
      obj.set({ name: name.trim() });
      fabricRef.current?.requestRenderAll();
      refreshObjects();
      saveHistory();
    },
    [refreshObjects, saveHistory],
  );

  const toggleObjectLock = useCallback(
    (obj) => {
      const canvas = fabricRef.current;
      if (!canvas || !obj) return;
      const locked = obj.selectable === false;
      obj.set({ selectable: locked, evented: locked, hasControls: locked });
      const active = canvas.getActiveObject();
      if (locked && active === obj) {
        canvas.discardActiveObject();
        setSelectedObject(null);
        setSelectionCount(0);
      } else if (!locked) {
        canvas.setActiveObject(obj);
        setSelectedObject(obj);
        setSelectionCount(1);
      }
      canvas.requestRenderAll();
      refreshObjects();
      saveHistory();
    },
    [refreshObjects, saveHistory],
  );

  const duplicateObject = useCallback(
    async (obj) => {
      const canvas = fabricRef.current;
      if (!canvas || !obj) return;
      const cloned = await obj.clone();
      cloned.set({
        left: (cloned.left || 0) + 16,
        top: (cloned.top || 0) + 16,
        id: uid(),
        name: `${obj.name || 'Capa'} (copia)`,
      });
      historySuspendedRef.current += 1;
      canvas.add(cloned);
      historySuspendedRef.current -= 1;
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      refreshObjects();
      saveHistoryNow();
      setSelectedObject(cloned);
      setSelectionCount(1);
    },
    [refreshObjects, saveHistoryNow],
  );

  const moveLayer = useCallback(
    (obj, direction) => {
      const canvas = fabricRef.current;
      if (!canvas || !obj) return;
      if (direction === 'up') canvas.bringObjectForward(obj);
      else if (direction === 'down') canvas.sendObjectBackwards(obj);
      else if (direction === 'top') canvas.bringObjectToFront(obj);
      else if (direction === 'bottom') canvas.sendObjectToBack(obj);
      canvas.requestRenderAll();
      saveHistory();
      refreshObjects();
    },
    [refreshObjects, saveHistory],
  );

  const reorderLayerToVisualIndex = useCallback(
    (obj, visualIndex) => {
      const canvas = fabricRef.current;
      if (!canvas || !obj) return;
      const total = canvas.getObjects().length;
      const canvasIndex = Math.max(0, Math.min(total - 1, total - 1 - visualIndex));
      canvas.moveObjectTo(obj, canvasIndex);
      canvas.requestRenderAll();
      saveHistory();
      refreshObjects();
    },
    [refreshObjects, saveHistory],
  );

  const setAllLayersVisibility = useCallback(
    (visible) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      canvas.getObjects().forEach((obj) => {
        obj.visible = visible;
      });
      canvas.requestRenderAll();
      refreshObjects();
      saveHistory();
    },
    [refreshObjects, saveHistory],
  );

  const removeHiddenLayers = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const hidden = canvas.getObjects().filter((obj) => obj.visible === false);
    if (!hidden.length) return;
    runWithHistoryBatch(() => {
      hidden.forEach((obj) => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      refreshObjects();
      setSelectedObject(null);
      setSelectionCount(0);
    });
  }, [refreshObjects, runWithHistoryBatch]);

  const applySelectedPropsUpdate = useCallback(
    (props) => {
      const canvas = fabricRef.current;
      const objs = getActiveObjects();
      if (!canvas || !objs.length) return;
      const {
        signalPresetId,
        signalAspectId,
        customNumberValue,
        customNumberValues,
        customArrowDirection,
        customStationCountValue,
        trayectoStationGap,
        trayectoStationWidth,
        ...rest
      } = props;
      const nextPresetId = signalPresetId ?? signalAspectId;

      const applyRest = () => {
        const pending = textFormatSelectionRef.current;
        objs.forEach((obj) => {
          if (isTextObject(obj)) applyTextStylePatch(obj, rest, pending);
          else applyStyleToObject(obj, rest);
        });
        textFormatSelectionRef.current = null;
        canvas.requestRenderAll();
        saveHistory();
        setSelectedObject(canvas.getActiveObject());
        if (objs.some(isTextObject)) setTextEditRevision((v) => v + 1);
      };

      const presetTargets = objs
        .map((obj) => findPresetHost(obj))
        .filter(Boolean);
      const presetUpdates = presetTargets.filter(
        (target) =>
          nextPresetId
          && nextPresetId !== getObjectPresetId(target),
      );
      const customNumberUpdates = objs.filter(
        (obj) => {
          const target = findPresetHost(obj) || obj;
          const presetId = getObjectPresetId(target);
          const preset = presetId ? getPresetShape(presetId) : null;
          return (
            preset?.customNumber
            && target.customNumber
            && presetId
            && !presetUpdates.includes(target)
            && (customNumberValue !== undefined || customNumberValues !== undefined || customArrowDirection !== undefined)
          );
        },
      );
      const trayectoUpdates = objs.filter(
        (obj) => {
          const target = findPresetHost(obj) || obj;
          return (
            target.customStationCount
            && getObjectPresetId(target)
            && (
              customStationCountValue !== undefined
              || trayectoStationGap !== undefined
              || trayectoStationWidth !== undefined
            )
          );
        },
      );

      if (!presetUpdates.length && !customNumberUpdates.length && !trayectoUpdates.length) {
        applyRest();
        return;
      }

      Promise.all([
        ...presetUpdates.map(async (target) => {
          const currentId = getObjectPresetId(target);
          const sameFamily = getPresetVariants(currentId).some((variant) => variant.id === nextPresetId);
          const replaceFn = sameFamily ? replacePresetVariant : replacePresetSignal;
          await replaceFn(canvas, target, nextPresetId, {
            numberText: customNumberValue ?? target.customNumberValue,
            numberValues: customNumberValues ?? target.customNumberValues,
            arrowDirection: customArrowDirection ?? target.customArrowDirection,
            stationCount: customStationCountValue ?? target.customStationCountValue,
            stationGap: trayectoStationGap ?? target.trayectoStationGap,
            stationWidth: trayectoStationWidth ?? target.trayectoStationWidth,
          });
        }),
        ...customNumberUpdates.map(async (obj) => {
          const target = findPresetHost(obj) || obj;
          const preset = getPresetShape(getObjectPresetId(target));
          if (!preset) return;
          await replaceSignalNumberObject(canvas, target, preset, {
            numberText: customNumberValue,
            numberValues: customNumberValues,
            arrowDirection: customArrowDirection ?? target.customArrowDirection,
          });
        }),
        ...trayectoUpdates.map(async (obj) => {
          const preset = getPresetShape(getObjectPresetId(obj));
          if (!preset) return;
          replaceTrayectoObject(canvas, obj, preset, {
            stationCount: customStationCountValue ?? obj.customStationCountValue,
            stationGap: trayectoStationGap ?? obj.trayectoStationGap,
            stationWidth: trayectoStationWidth ?? obj.trayectoStationWidth,
          });
        }),
      ]).then(() => {
        if (Object.keys(rest).length) applyRest();
        else {
          canvas.requestRenderAll();
          saveHistory();
          refreshObjects();
          setSelectedObject(canvas.getActiveObject());
        }
      }).catch((err) => {
        console.error('Error al actualizar la señal:', err);
        setSavedHint('No se pudo actualizar la señal');
      });
    },
    [getActiveObjects, refreshObjects, saveHistory],
  );

  const updateSelectedProps = useCallback((props) => {
    const onlyNumbers = Object.keys(props).length > 0
      && Object.keys(props).every((key) => key === 'customNumberValue' || key === 'customNumberValues');
    if (onlyNumbers) {
      propsDebounceRef.current = { ...propsDebounceRef.current, ...props };
      if (propsDebounceTimerRef.current) clearTimeout(propsDebounceTimerRef.current);
      propsDebounceTimerRef.current = setTimeout(() => {
        propsDebounceTimerRef.current = null;
        const merged = propsDebounceRef.current;
        propsDebounceRef.current = null;
        if (merged) applySelectedPropsUpdate(merged);
      }, 320);
      return;
    }
    if (propsDebounceTimerRef.current) {
      clearTimeout(propsDebounceTimerRef.current);
      propsDebounceTimerRef.current = null;
      const pending = propsDebounceRef.current;
      propsDebounceRef.current = null;
      if (pending) {
        applySelectedPropsUpdate({ ...pending, ...props });
        return;
      }
    }
    applySelectedPropsUpdate(props);
  }, [applySelectedPropsUpdate]);

  const getProjectData = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return buildProjectSnapshot({
      canvas,
      customProps: CANVAS_CUSTOM_PROPS,
      meta: {
        id: canvas.projectId || uid(),
        name: projectName,
        pageSizeKey,
        backgroundColor,
        pageOverlayType,
        pageOverlaySpacing,
        pageOverlayColor,
      },
    });
  }, [backgroundColor, pageOverlayColor, pageOverlaySpacing, pageOverlayType, pageSizeKey, projectName]);

  const markSaved = useCallback(() => {
    isDirtyRef.current = false;
    setSavedHint('Guardado');
  }, []);

  const isProjectDirty = useCallback(() => isDirtyRef.current, []);

  const loadProjectData = useCallback(
    async (project) => {
      const canvas = fabricRef.current;
      if (!canvas || !project) return;
      isRestoringRef.current = true;
      canvas.projectId = project.id;
      setProjectName(project.name || 'Sin título');
      if (project.pageSizeKey && PAGE_SIZES[project.pageSizeKey]) {
        const size = PAGE_SIZES[project.pageSizeKey];
        pageSizeRef.current = size;
        canvas.baseWidth = size.width;
        canvas.baseHeight = size.height;
        setPageSizeKey(project.pageSizeKey);
      }

      const overlayType = project.pageOverlayType ?? OVERLAY_TYPES.NONE;
      const overlaySpacing = project.pageOverlaySpacing ?? 24;
      const overlayColor = project.pageOverlayColor ?? '#cccccc';
      setPageOverlayType(overlayType);
      setPageOverlaySpacing(overlaySpacing);
      setPageOverlayColor(overlayColor);

      await canvas.loadFromJSON(project.canvas);
      canvas.getObjects().forEach((obj) => {
        repairStrokeIfNeeded(obj, 2);
        if (obj.type === 'line' && !obj.name) obj.name = 'Línea';
        if (obj.type === 'polyline' && !obj.name) obj.name = 'Multilínea';
        if (obj.type === 'path' && !obj.name) obj.name = 'Trazo';
        if (obj.overlayLayer || obj.name === '__pageOverlay') {
          obj.set({ selectable: false, evented: false, erasable: false, excludeFromExport: true });
        }
      });
      await restoreAllLayerEraserGroups(canvas);

      const loadedBg = canvas.backgroundColor;
      const bgString = typeof loadedBg === 'string'
        ? loadedBg
        : loadedBg?.toHex?.() ?? project.backgroundColor ?? '#ffffff';
      setBackgroundColor(canvas.backgroundImage ? '' : (project.backgroundColor ?? bgString));
      if (!canvas.backgroundImage && bgString) {
        canvas.backgroundColor = bgString;
      }

      if (!canvas.getObjects().some((o) => o.overlayLayer || o.name === '__pageOverlay')) {
        syncPageOverlay(canvas, pageSizeRef.current.width, pageSizeRef.current.height, overlayType, overlaySpacing, overlayColor);
      }
      canvas.requestRenderAll();
      syncCanvasZoom(canvas, zoomRef.current);
      historyRef.current = [canvas.toJSON(CANVAS_CUSTOM_PROPS)];
      historyIndexRef.current = 0;
      isRestoringRef.current = false;
      isDirtyRef.current = false;
      updateHistoryFlags();
      refreshObjects();
      setSelectedObject(null);
      setSelectionCount(0);
      markSaved();
    },
    [markSaved, refreshObjects, syncCanvasZoom, updateHistoryFlags],
  );

  const newProject = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.projectId = uid();
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.backgroundImage = undefined;
    const size = PAGE_SIZES[DEFAULT_PAGE];
    pageSizeRef.current = size;
    canvas.baseWidth = size.width;
    canvas.baseHeight = size.height;
    syncCanvasZoom(canvas, zoomRef.current);
    setProjectName('Sin título');
    setPageSizeKey(DEFAULT_PAGE);
    setBackgroundColor('#ffffff');
    setPageOverlayType(OVERLAY_TYPES.NONE);
    applyPageOverlay(OVERLAY_TYPES.NONE, 24, '#cccccc');
    historyRef.current = [canvas.toJSON(CANVAS_CUSTOM_PROPS)];
    historyIndexRef.current = 0;
    updateHistoryFlags();
    refreshObjects();
    setSelectedObject(null);
    setSelectionCount(0);
    setSavedHint('');
    isDirtyRef.current = false;
  }, [applyPageOverlay, refreshObjects, syncCanvasZoom, updateHistoryFlags]);

  const exportCanvas = useCallback(() => fabricRef.current, []);

  const setCanvasZoom = useCallback(
    (value, options = {}) => {
      const clamped = Math.min(4, Math.max(0.2, value));
      zoomRef.current = clamped;
      const fabricCanvas = fabricRef.current;
      if (fabricCanvas) syncCanvasZoom(fabricCanvas, clamped);
      if (!options.live) setZoom(clamped);
    },
    [syncCanvasZoom],
  );

  const getCanvasZoom = useCallback(() => zoomRef.current, []);

  const flushCanvasZoom = useCallback(() => {
    setZoom(zoomRef.current);
  }, []);

  const zoomStepMultiply = useCallback(
    (factor) => {
      setCanvasZoom(zoomRef.current * factor);
    },
    [setCanvasZoom],
  );

  const zoomStep = useCallback(
    (delta) => {
      setCanvasZoom(zoomRef.current + delta);
    },
    [setCanvasZoom],
  );

  const recalcCanvasOffset = useCallback(() => {
    fabricRef.current?.calcOffset();
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const openContextMenuAt = useCallback(
    (x, y) => {
      if (tool === TOOLS.POLYLINE && polylinePointsRef.current.length > 0) {
        finishPolyline();
        return;
      }
      setContextMenu({ x, y });
    },
    [tool, finishPolyline],
  );

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      openContextMenuAt(e.clientX, e.clientY);
    },
    [openContextMenuAt],
  );

  const handlePasteEvent = useCallback(
    async (e) => {
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      if (pasteFromKeyRef.current) {
        pasteFromKeyRef.current = false;
        return;
      }

      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) await addImageFromFile(file);
            return;
          }
        }
      }

      if (clipboardRef.current && canPaste) {
        e.preventDefault();
        await pasteClipboard();
      }
    },
    [addImageFromFile, canPaste, pasteClipboard],
  );

  // Init canvas
  useEffect(() => {
    registerFabricCustomProps();
    const wrapper = containerRef.current;
    if (!wrapper || fabricRef.current) return;

    wrapper.replaceChildren();
    const el = document.createElement('canvas');
    wrapper.appendChild(el);

    const size = PAGE_SIZES[DEFAULT_PAGE];
    pageSizeRef.current = size;

    let canvas;
    try {
      canvas = new Canvas(el, {
        width: size.width,
        height: size.height,
        backgroundColor: '#ffffff',
        preserveObjectStacking: true,
        selection: true,
        altSelectionKey: 'shiftKey',
        selectionColor: 'rgba(0, 120, 212, 0.18)',
        selectionBorderColor: 'rgba(0, 120, 212, 0.95)',
        selectionLineWidth: 1.5,
        enableRetinaScaling: true,
      });
      canvas.baseWidth = size.width;
      canvas.baseHeight = size.height;
      if (canvas.contextContainer) {
        canvas.contextContainer.imageSmoothingEnabled = true;
        if (canvas.contextContainer.imageSmoothingQuality) {
          canvas.contextContainer.imageSmoothingQuality = 'high';
        }
      }
    } catch (err) {
      console.error('Error al iniciar el lienzo:', err);
      wrapper.replaceChildren();
      return;
    }

    canvas.projectId = uid();
    fabricRef.current = canvas;
    syncCanvasZoom(canvas, zoomRef.current);
    historyRef.current = [canvas.toJSON(CANVAS_CUSTOM_PROPS)];
    historyIndexRef.current = 0;
    syncPageOverlay(canvas, size.width, size.height, OVERLAY_TYPES.NONE, 24, '#cccccc');

    const syncSelection = (e) => {
      const sel = e?.selected || (canvas.getActiveObject() ? [canvas.getActiveObject()] : []);
      const count = sel.length;
      setSelectionCount(count);
      const single = count === 1 ? sel[0] : count > 1 ? canvas.getActiveObject() : null;
      setSelectedObject(single);
      if (count === 1) {
        syncToolbarFromObject(single);
      } else if (count > 1 && single?.type === 'activeSelection') {
        const firstText = single.getObjects().find(isTextObject);
        if (firstText) syncToolbarFromObject(firstText);
      }
    };

    canvas.on('object:rotating', (e) => {
      if (isRestoringRef.current) return;
      applyRotationSnap(e?.target);
    });

    canvas.on('object:moving', (e) => {
      if (isRestoringRef.current) return;
      applySignalTrackSnap(canvas, e?.target);
    });

    canvas.on('object:modified', (e) => {
      if (isRestoringRef.current) return;
      invalidateTrackSegmentCache(canvas);
      const target = e?.target;
      let changed = applyRotationSnap(target);
      if (applySignalTrackSnap(canvas, target)) changed = true;
      if (changed) {
        canvas.requestRenderAll();
        const active = canvas.getActiveObject();
        if (active) syncToolbarFromObject(active);
      }
      saveHistory();
      refreshObjects();
    });
    canvas.on('object:added', (ev) => {
      if (ev.target && !ev.target.id) ev.target.id = uid();
      invalidateTrackSegmentCache(canvas);
      if (!isRestoringRef.current) {
        saveHistory();
        refreshObjects();
      }
    });
    canvas.on('object:removed', () => {
      invalidateTrackSegmentCache(canvas);
      if (!isRestoringRef.current) {
        saveHistory();
        refreshObjects();
      }
    });
    canvas.on('selection:created', syncSelection);
    canvas.on('selection:updated', syncSelection);
    canvas.on('selection:cleared', () => {
      setSelectedObject(null);
      setSelectionCount(0);
    });
    const bumpTextEdit = () => setTextEditRevision((v) => v + 1);
    canvas.on('text:selection:changed', bumpTextEdit);
    canvas.on('text:editing:entered', bumpTextEdit);
    canvas.on('text:editing:exited', bumpTextEdit);

    canvas.on('mouse:down:before', (opt) => {
      if (isRestoringRef.current || opt.e.button !== 0) return;
      if (toolRef.current !== TOOLS.SELECT) return;
      const target = opt.target;
      if (!isTextObject(target) || target.editable === false || target.isEditing) return;
      if (opt.e.shiftKey) return;
      const active = canvas.getActiveObject();
      if (active !== target) return;
      target.enterEditing(opt.e);
    });

    canvas.on('mouse:dblclick', (opt) => {
      const target = opt.target;
      if (!isTextObject(target) || target.editable === false || target.isEditing) return;
      canvas.setActiveObject(target, opt.e);
      target.enterEditing(opt.e);
    });

    canvas.on('mouse:down', (opt) => {
      const target = opt.target;
      if (isTextObject(target) && target.isEditing) {
        canvas._currentTransform = null;
      }
    });

    canvas.on('mouse:move', () => {
      const active = canvas.getActiveObject();
      if (isTextObject(active) && active.isEditing && canvas._currentTransform) {
        canvas._currentTransform = null;
      }
    });

    canvas.on('path:created', (e) => {
      if (e.path?.eraserForLayer) {
        if (!e.stamp || !canvas._eraserDragActive) {
          if (e.stamp) saveHistory();
          else saveHistoryNow();
        }
        refreshObjects();
        return;
      }
      if (e.path?.globalEraser) {
        if (!e.path.id) e.path.id = uid();
        applyVectorQuality(e.path);
        if (!e.stamp || !canvas._eraserDragActive) {
          if (e.stamp) saveHistory();
          else saveHistoryNow();
        }
        refreshObjects();
        return;
      }
      if (e.path) {
        if (!e.path.id) e.path.id = uid();
        if (!e.path.name) e.path.name = 'Trazo';
        applyVectorQuality(e.path);
        e.path.set({
          stroke: e.path.stroke || strokeColorRef.current || '#000000',
          strokeWidth: Math.max(1, e.path.strokeWidth || strokeWidthRef.current || 2),
          fill: '',
          erasable: true,
        });
      }
      canvas.discardActiveObject();
      saveHistoryNow();
      refreshObjects();
    });

    canvas.selection = true;
    canvas.skipTargetFind = false;
    canvas.allowTouchScrolling = false;
    canvas.isDrawingMode = false;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      wrapper.replaceChildren();
    };
  }, [containerRef, refreshObjects, saveHistory, syncCanvasZoom, syncToolbarFromObject]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || spacePanActive) return;
    applyDrawingMode(canvas, tool);
    if (tool !== TOOLS.SELECT && !(tool === TOOLS.ERASER && (eraserMode === ERASER_MODES.LAYER || eraserMode === ERASER_MODES.CLEAR_LAYER))) {
      setSelectedObject(null);
      setSelectionCount(0);
    }
    if (tool !== TOOLS.POLYLINE) {
      cancelPolylineDraft();
    }
  }, [tool, eraserMode, applyDrawingMode, cancelPolylineDraft, spacePanActive]);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (spacePanActive) {
      canvas.discardActiveObject();
      canvas.skipTargetFind = true;
      canvas.selection = false;
      canvas.isDrawingMode = false;
      canvas.defaultCursor = 'grab';
      canvas.hoverCursor = 'grab';
      canvas.requestRenderAll();
      return;
    }
    applyDrawingMode(canvas, tool);
  }, [spacePanActive, tool, applyDrawingMode]);
  useEffect(() => {
    textModeRef.current = textMode;
  }, [textMode]);
  useEffect(() => {
    textStyleRef.current = textStyle;
  }, [textStyle]);
  useEffect(() => {
    eraserModeRef.current = eraserMode;
  }, [eraserMode]);
  useEffect(() => {
    selectedObjectRef.current = selectedObject;
    selectionCountRef.current = selectionCount;
    const canvas = fabricRef.current;
    if (canvas && tool === TOOLS.ERASER && isEraserDrawMode(eraserMode)) {
      applyDrawingMode(canvas, tool);
    }
  }, [selectedObject, selectionCount, tool, eraserMode, applyDrawingMode]);

  useEffect(() => {
    eraserSizeRef.current = eraserSize;
  }, [eraserSize]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.ERASER || !isEraserDrawMode(eraserMode)) {
      return undefined;
    }

    const canShowEraserCursor = () => {
      if (eraserModeRef.current === ERASER_MODES.LAYER
        && (!selectedObjectRef.current || selectionCountRef.current > 1)) return false;
      return true;
    };

    const getStampOptions = () => ({
      mode: eraserModeRef.current,
      target: eraserModeRef.current === ERASER_MODES.LAYER ? selectedObjectRef.current : null,
    });

    const tryEraserStamp = (scenePoint, { force = false, dragging = false } = {}) => {
      const size = eraserSizeRef.current;
      if (!force && !shouldApplyEraserStamp(canvas._lastEraserStampPoint, scenePoint, size, { dragging })) {
        return Promise.resolve(false);
      }
      return applyEraserStamp(canvas, scenePoint, size, getStampOptions()).then((applied) => {
        if (applied) {
          canvas._lastEraserStampPoint = { x: scenePoint.x, y: scenePoint.y };
          canvas._eraserDragModified = true;
        }
        return applied;
      });
    };

    const stampAlongDrag = (fromPoint, toPoint) => {
      const size = eraserSizeRef.current;
      const points = collectEraserStampPoints(fromPoint, toPoint, size);
      points.reduce(
        (chain, point) => chain.then(() => tryEraserStamp(point, { force: true, dragging: true })),
        Promise.resolve(false),
      );
    };

    const isEraserButtonDown = (opt) => canvas._eraserDragActive || (opt.e.buttons & 1) === 1;

    const paintEraserCursor = () => {
      if (!canShowEraserCursor()) return;
      const point = canvas._eraserCursorScenePoint;
      if (!point) return;
      drawEraserCursorPreview(canvas, point, eraserSizeRef.current);
    };

    const onDown = (opt) => {
      if (!canShowEraserCursor() || opt.e.button !== 0) return;
      opt.e.preventDefault?.();
      const point = canvas.getScenePoint(opt.e);
      setEraserCursorScenePoint(canvas, point);
      canvas._eraserDragActive = true;
      canvas._eraserDragModified = false;
      canvas._lastEraserStampPoint = null;
      tryEraserStamp(point, { force: true });
      paintEraserCursor();
    };

    const onUp = (opt) => {
      if (canvas._eraserDragActive && canvas._eraserDragModified) {
        saveHistoryNow();
      }
      canvas._eraserDragActive = false;
      canvas._eraserDragModified = false;
      canvas._lastEraserStampPoint = null;
      if (!canShowEraserCursor()) return;
      setEraserCursorScenePoint(canvas, canvas.getScenePoint(opt.e));
      requestAnimationFrame(paintEraserCursor);
    };

    const onPathCreated = () => {
      requestAnimationFrame(paintEraserCursor);
    };

    const onMove = (opt) => {
      if (!canShowEraserCursor()) return;
      const point = canvas.getScenePoint(opt.e);
      setEraserCursorScenePoint(canvas, point);
      if (isEraserButtonDown(opt)) {
        const from = canvas._lastEraserStampPoint;
        if (from) {
          stampAlongDrag(from, point);
        } else {
          tryEraserStamp(point, { force: true, dragging: true });
        }
      }
      paintEraserCursor();
    };

    const onOut = () => {
      if (canvas._eraserDragActive && canvas._eraserDragModified) {
        saveHistoryNow();
      }
      canvas._eraserDragActive = false;
      canvas._eraserDragModified = false;
      setEraserCursorScenePoint(canvas, null);
      canvas._lastEraserStampPoint = null;
      clearEraserCursorPreview(canvas);
    };

    const onAfterRender = ({ ctx }) => {
      if (ctx !== canvas.contextTop) return;
      paintEraserCursor();
    };

    canvas.on('mouse:down', onDown);
    canvas.on('mouse:move', onMove);
    canvas.on('mouse:up', onUp);
    canvas.on('mouse:out', onOut);
    canvas.on('after:render', onAfterRender);
    canvas.on('path:created', onPathCreated);

    return () => {
      canvas.off('mouse:down', onDown);
      canvas.off('mouse:move', onMove);
      canvas.off('mouse:up', onUp);
      canvas.off('mouse:out', onOut);
      canvas.off('after:render', onAfterRender);
      canvas.off('path:created', onPathCreated);
      clearEraserCursorPreview(canvas);
    };
  }, [tool, eraserMode, eraserSize, saveHistoryNow]);

  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);
  useEffect(() => {
    strokeColorRef.current = strokeColor;
  }, [strokeColor]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.PEN && !(tool === TOOLS.ERASER && isEraserDrawMode(eraserMode))) return;
    applyDrawingMode(canvas, tool);
  }, [strokeColor, strokeWidth, tool, eraserMode, applyDrawingMode]);

  // Texto: clic en la hoja coloca según el modo activo
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.TEXT) return;

    const onMouseDown = (opt) => {
      if (opt.e.button !== 0) return;
      const target = opt.target;
      if (isTextObject(target)) {
        canvas.setActiveObject(target, opt.e);
        target.enterEditing?.(opt.e);
        setSelectedObject(target);
        setSelectionCount(1);
        setTool(TOOLS.SELECT);
        return;
      }
      opt.e.preventDefault?.();
      addTextAtPoint(canvas.getScenePoint(opt.e));
    };

    canvas.on('mouse:down', onMouseDown);
    return () => canvas.off('mouse:down', onMouseDown);
  }, [tool, addTextAtPoint]);

  // Multilínea: clic añade punto, clic derecho termina
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.POLYLINE) return;

    const onMouseDown = (opt) => {
      if (opt.e.button !== 0) return;
      opt.e.preventDefault?.();
      canvas.discardActiveObject();
      const pointer = canvas.getScenePoint(opt.e);
      if (polylinePointsRef.current.length === 0) {
        historySuspendedRef.current += 1;
      }
      polylinePointsRef.current.push({ x: pointer.x, y: pointer.y });
      setPolylinePoints(polylinePointsRef.current.length);

      if (polylineDraftRef.current) canvas.remove(polylineDraftRef.current);
      if (polylinePointsRef.current.length >= 2) {
        polylineDraftRef.current = new Polyline([...polylinePointsRef.current], {
          stroke: strokeColor,
          strokeWidth,
          fill: '',
          selectable: false,
          evented: false,
        });
        canvas.add(polylineDraftRef.current);
      }
      canvas.requestRenderAll();
    };

    const onMouseMove = (opt) => {
      const points = polylinePointsRef.current;
      if (!points.length) return;
      const pointer = canvas.getScenePoint(opt.e);
      const last = points[points.length - 1];
      if (polylinePreviewLineRef.current) canvas.remove(polylinePreviewLineRef.current);
      polylinePreviewLineRef.current = new Line([last.x, last.y, pointer.x, pointer.y], {
        stroke: strokeColor,
        strokeWidth: Math.max(1, strokeWidth - 1),
        strokeDashArray: [6, 5],
        opacity: 0.65,
        selectable: false,
        evented: false,
      });
      canvas.add(polylinePreviewLineRef.current);
      canvas.requestRenderAll();
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
    };
  }, [tool, strokeColor, strokeWidth]);

  // Shape drawing
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const shapeTools = [TOOLS.RECT, TOOLS.CIRCLE, TOOLS.LINE, TOOLS.ARROW];

    const onMouseDown = (opt) => {
      if (!shapeTools.includes(tool)) return;
      opt.e.preventDefault?.();
      canvas.discardActiveObject();
      const pointer = canvas.getScenePoint(opt.e);
      shapeStartRef.current = pointer;
      const common = {
        stroke: strokeColor,
        strokeWidth: Math.max(1, strokeWidth),
        fill: tool === TOOLS.LINE || tool === TOOLS.ARROW ? '' : fillColor === 'transparent' ? '' : fillColor,
        selectable: false,
        evented: false,
        id: uid(),
      };
      let shape;
      if (tool === TOOLS.RECT) shape = new Rect({ ...common, left: pointer.x, top: pointer.y, width: 0, height: 0, name: 'Rectángulo' });
      else if (tool === TOOLS.CIRCLE) shape = new Circle({ ...common, left: pointer.x, top: pointer.y, radius: 1, name: 'Círculo' });
      else if (tool === TOOLS.LINE || tool === TOOLS.ARROW)
        shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], { ...common, name: tool === TOOLS.ARROW ? 'Flecha' : 'Línea' });
      if (shape) {
        activeShapeRef.current = shape;
        historySuspendedRef.current += 1;
        canvas.add(shape);
      }
    };

    const onMouseMove = (opt) => {
      if (!shapeStartRef.current || !activeShapeRef.current) return;
      const pointer = canvas.getScenePoint(opt.e);
      const start = shapeStartRef.current;
      const shape = activeShapeRef.current;
      if (tool === TOOLS.RECT) {
        shape.set({ left: Math.min(start.x, pointer.x), top: Math.min(start.y, pointer.y), width: Math.abs(pointer.x - start.x), height: Math.abs(pointer.y - start.y) });
      } else if (tool === TOOLS.CIRCLE) {
        shape.set({ left: Math.min(start.x, pointer.x), top: Math.min(start.y, pointer.y), radius: Math.max(Math.abs(pointer.x - start.x), Math.abs(pointer.y - start.y)) / 2 });
      } else {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }
      canvas.requestRenderAll();
    };

    const onMouseUp = () => {
      if (!activeShapeRef.current) return;
      const shape = activeShapeRef.current;
      if (tool === TOOLS.ARROW) {
        const { x1, y1, x2, y2 } = shape;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = new Triangle({
          left: x2,
          top: y2,
          width: 14,
          height: 18,
          fill: strokeColor,
          angle: (angle * 180) / Math.PI + 90,
          originX: 'center',
          originY: 'center',
          id: uid(),
          name: 'Punta flecha',
        });
        const line = new Line([x1, y1, x2, y2], { stroke: strokeColor, strokeWidth, name: 'Flecha' });
        const arrowGroup = new Group([line, head], {
          id: uid(),
          name: 'Flecha',
        });
        canvas.remove(shape);
        canvas.add(arrowGroup);
      } else {
        const sw = Math.max(1, shape.strokeWidth || strokeWidth || 2);
        shape.set({
          selectable: true,
          evented: true,
          strokeWidth: sw,
          stroke: shape.stroke || strokeColor,
          name: shape.name || 'Línea',
        });
      }
      activeShapeRef.current = null;
      shapeStartRef.current = null;
      canvas.requestRenderAll();
      if (historySuspendedRef.current > 0) historySuspendedRef.current -= 1;
      saveHistoryNow();
      refreshObjects();
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [tool, strokeColor, strokeWidth, fillColor, saveHistoryNow, refreshObjects]);

  // Cuentagotas: clic en la hoja toma el color visible
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.EYEDROPPER) return;

    const onMouseDown = (opt) => {
      if (opt.e.button !== 0) return;
      opt.e.preventDefault?.();
      pickColorAtEvent(opt.e);
    };

    canvas.on('mouse:down', onMouseDown);
    return () => canvas.off('mouse:down', onMouseDown);
  }, [tool, pickColorAtEvent]);

  // Cubo de relleno: clic en figura o fondo
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.BUCKET) return;

    const onMouseDown = (opt) => {
      if (opt.e.button !== 0) return;
      opt.e.preventDefault?.();
      fillAtEvent(opt.e, opt.target);
    };

    canvas.on('mouse:down', onMouseDown);
    return () => canvas.off('mouse:down', onMouseDown);
  }, [tool, fillAtEvent]);

  // Marquesina de selección múltiple (overlay DOM — estable frente a scroll/zoom de Fabric)
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.SELECT || spacePanActive) return;

    let overlayEl = null;
    let dragStart = null;

    const removeOverlay = () => {
      overlayEl?.remove();
      overlayEl = null;
      dragStart = null;
    };

    const clientToScene = (clientX, clientY) => canvas.getScenePoint({ clientX, clientY });

    const updateOverlay = (clientX, clientY) => {
      if (!overlayEl || !dragStart) return;
      const x = Math.min(dragStart.x, clientX);
      const y = Math.min(dragStart.y, clientY);
      overlayEl.style.left = `${x}px`;
      overlayEl.style.top = `${y}px`;
      overlayEl.style.width = `${Math.abs(clientX - dragStart.x)}px`;
      overlayEl.style.height = `${Math.abs(clientY - dragStart.y)}px`;
    };

    const finishDrag = (e) => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', finishDrag);
      document.removeEventListener('pointercancel', finishDrag);
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', finishDrag);

      const start = dragStart;
      removeOverlay();

      if (!start || !canvas.selection) return;

      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved <= 4) return;

      const x1 = Math.min(start.x, e.clientX);
      const y1 = Math.min(start.y, e.clientY);
      const x2 = Math.max(start.x, e.clientX);
      const y2 = Math.max(start.y, e.clientY);

      const tl = clientToScene(x1, y1);
      const br = clientToScene(x2, y2);
      const left = Math.min(tl.x, br.x);
      const top = Math.min(tl.y, br.y);
      const width = Math.abs(br.x - tl.x);
      const height = Math.abs(br.y - tl.y);

      const collected = canvas.collectObjects(
        { left, top, width, height },
        { includeIntersecting: true },
      );
      const objects = collected.filter(
        (obj) => obj?.selectable !== false
          && !obj?.overlayLayer
          && obj?.name !== '__pageOverlay',
      );

      if (objects.length === 1) {
        canvas.setActiveObject(objects[0], e);
      } else if (objects.length > 1) {
        canvas.setActiveObject(new ActiveSelection(objects, { canvas }), e);
      } else {
        canvas.discardActiveObject();
      }
      canvas._groupSelector = null;
      canvas.requestRenderAll();
    };

    const onPointerMove = (e) => {
      if (!dragStart) return;
      e.preventDefault();
      updateOverlay(e.clientX, e.clientY);
    };

    const onMouseDown = (opt) => {
      if (opt.e.button !== 0) return;
      if (canvas.isDrawingMode || canvas._currentTransform) return;
      if (opt.target?.isEditing) return;
      if (opt.e.shiftKey) {
        // Shift+arrastrar: marquesina aunque haya objeto debajo
      } else if (opt.target?.selectable) {
        return;
      }

      opt.e.preventDefault?.();
      opt.e.stopPropagation?.();

      canvas.selection = true;
      canvas.skipTargetFind = false;
      canvas.allowTouchScrolling = false;
      canvas._groupSelector = null;
      canvas.renderTop();

      dragStart = { x: opt.e.clientX, y: opt.e.clientY };
      overlayEl = document.createElement('div');
      overlayEl.className = 'canvas-marquee';
      document.body.appendChild(overlayEl);
      updateOverlay(dragStart.x, dragStart.y);

      document.addEventListener('pointermove', onPointerMove, { passive: false });
      document.addEventListener('pointerup', finishDrag);
      document.addEventListener('pointercancel', finishDrag);
      document.addEventListener('mousemove', onPointerMove, { passive: false });
      document.addEventListener('mouseup', finishDrag);
    };

    canvas.on('mouse:down', onMouseDown);
    return () => {
      canvas.off('mouse:down', onMouseDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', finishDrag);
      document.removeEventListener('pointercancel', finishDrag);
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', finishDrag);
      removeOverlay();
      canvas._groupSelector = null;
      canvas.renderTop();
    };
  }, [tool, spacePanActive]);

  // Restaurar selección si un gesto de viewport la desactivó
  useEffect(() => {
    const restoreSelectionMode = () => {
      const canvas = fabricRef.current;
      if (!canvas || toolRef.current !== TOOLS.SELECT || spaceDownRef.current) return;
      if (!canvas.selection || canvas.skipTargetFind) {
        applyDrawingMode(canvas, TOOLS.SELECT);
      }
    };
    window.addEventListener('pointerup', restoreSelectionMode);
    window.addEventListener('pointercancel', restoreSelectionMode);
    return () => {
      window.removeEventListener('pointerup', restoreSelectionMode);
      window.removeEventListener('pointercancel', restoreSelectionMode);
    };
  }, [applyDrawingMode]);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      const canvas = fabricRef.current;
      const mod = e.ctrlKey || e.metaKey;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!spaceDownRef.current) spaceDownRef.current = true;
        setSpacePanActive(true);
      }

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (mod && e.key === 'c') {
        e.preventDefault();
        copySelected();
      }
      if (mod && e.key === 'x') {
        e.preventDefault();
        cutSelected();
      }
      if (mod && e.key === 'v') {
        e.preventDefault();
        if (clipboardRef.current) {
          pasteFromKeyRef.current = true;
          pasteClipboard();
        }
      }
      if (mod && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }
      if (mod && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
      }
      if (mod && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        groupSelected();
      }
      if (mod && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        ungroupSelected();
      }
      if (mod && canvas) {
        const textObjs = getActiveObjects().filter(isTextObject);
        if (textObjs.length) {
          const target = textObjs[0];
          const style = readEffectiveTextStyle(target, textStyleRef.current);
          if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            patchTextStyle({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' });
          } else if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            patchTextStyle({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' });
          } else if (e.key === 'u' || e.key === 'U') {
            e.preventDefault();
            patchTextStyle({ underline: !style.underline });
          }
        }
      }

      if (e.key === 'Escape') {
        if (tool === TOOLS.POLYLINE && polylinePointsRef.current.length > 0) {
          cancelPolylineDraft();
          return;
        }
        deselectAll();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditing(canvas)) {
        e.preventDefault();
        deleteSelected();
      }

      if (!mod && !isEditing(canvas)) {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          nudgeSelected(-step, 0);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          nudgeSelected(step, 0);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          nudgeSelected(0, -step);
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          nudgeSelected(0, step);
        }
        if (e.key === 'v' || e.key === 'V') setTool(TOOLS.SELECT);
        if (e.key === 't' || e.key === 'T') setTool(TOOLS.TEXT);
        if (e.key === 'p' || e.key === 'P') setTool(TOOLS.PEN);
        if (e.key === 'e' || e.key === 'E') setTool(TOOLS.ERASER);
        if (e.key === 'm' || e.key === 'M') setTool(TOOLS.POLYLINE);
        if (e.key === 'h' || e.key === 'H') setTool(TOOLS.PAN);
        if (e.key === 'i' || e.key === 'I') setTool(TOOLS.EYEDROPPER);
        if (e.key === 'b' || e.key === 'B') setTool(TOOLS.BUCKET);
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        setSpacePanActive(false);
      }
    };

    const onBlur = () => {
      if (spaceDownRef.current) {
        spaceDownRef.current = false;
        setSpacePanActive(false);
      }
      const canvas = fabricRef.current;
      if (canvas) applyDrawingMode(canvas, toolRef.current);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [
    addText,
    applyDrawingMode,
    cancelPolylineDraft,
    copySelected,
    cutSelected,
    deleteSelected,
    deselectAll,
    duplicateSelected,
    getActiveObjects,
    groupSelected,
    handlePasteEvent,
    nudgeSelected,
    patchTextStyle,
    pasteClipboard,
    redo,
    selectAll,
    tool,
    undo,
    ungroupSelected,
  ]);

  return {
    tool,
    setTool,
    textMode,
    setTextMode: selectTextMode,
    textStyle,
    textEditRevision,
    patchTextStyle,
    captureTextFormatSelection,
    eraserMode,
    setEraserMode,
    eraserSize,
    setEraserSize,
    pageSizeKey,
    pageSize,
    strokeColor,
    setStrokeColor: setStrokeColorLive,
    fillColor,
    setFillColor: setFillColorLive,
    strokeWidth,
    setStrokeWidth: setStrokeWidthLive,
    colorTarget,
    setColorTarget,
    savedColors,
    applyColorToTarget,
    saveColorToPalette,
    removeSavedColor,
    pickColorAtEvent,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    backgroundColor,
    pageOverlayType,
    pageOverlaySpacing,
    pageOverlayColor,
    selectedObject,
    selectionCount,
    objects,
    canUndo,
    canRedo,
    canPaste,
    zoom,
    spacePanActive,
    projectName,
    setProjectName,
    savedHint,
    markSaved,
    isProjectDirty,
    contextMenu,
    closeContextMenu,
    handleContextMenu,
    openContextMenuAt,
    polylinePoints,
    cancelPolylineDraft,
    finishPolyline,
    undo,
    redo,
    copySelected,
    cutSelected,
    pasteClipboard,
    selectAll,
    deselectAll,
    deleteSelected,
    deleteAll,
    clearAllContent,
    emptySelectedLayer,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    duplicateSelected,
    lockSelected,
    unlockAll,
    groupSelected,
    ungroupSelected,
    alignSelected,
    addText,
    addImageFromFile,
    addPresetShape,
    setBackground,
    applyBackgroundPreset,
    setPageOverlay,
    setBackgroundImage,
    clearBackgroundImage,
    resizePage,
    selectObjectByRef,
    toggleObjectVisibility,
    removeObject,
    renameObject,
    toggleObjectLock,
    duplicateObject,
    moveLayer,
    reorderLayerToVisualIndex,
    setAllLayersVisibility,
    removeHiddenLayers,
    updateSelectedProps,
    getProjectData,
    loadProjectData,
    newProject,
    exportCanvas,
    setCanvasZoom,
    getCanvasZoom,
    flushCanvasZoom,
    zoomStepMultiply,
    zoomStep,
    setViewportGestureLock,
    recalcCanvasOffset,
  };
}
