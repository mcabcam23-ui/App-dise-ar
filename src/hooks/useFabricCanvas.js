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
  loadSVGFromURL,
  util,
} from 'fabric';
import { DEFAULT_PAGE, PAGE_SIZES, TOOLS } from '../constants/pageSizes';
import { getPresetShape } from '../constants/presetShapes';
import { resolveAssetUrl } from '../utils/assetUrl';

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
  const shapeStartRef = useRef(null);
  const activeShapeRef = useRef(null);
  const clipboardRef = useRef(null);
  const pasteOffsetRef = useRef(0);
  const pasteFromKeyRef = useRef(false);
  const spaceDownRef = useRef(false);
  const toolBeforeSpaceRef = useRef(TOOLS.SELECT);
  const polylinePointsRef = useRef([]);
  const polylinePreviewLineRef = useRef(null);
  const polylineDraftRef = useRef(null);
  const zoomRef = useRef(1);
  const pageSizeRef = useRef(PAGE_SIZES[DEFAULT_PAGE]);

  const [tool, setTool] = useState(TOOLS.SELECT);
  const [pageSizeKey, setPageSizeKey] = useState(DEFAULT_PAGE);
  const [strokeColor, setStrokeColor] = useState('#222222');
  const [fillColor, setFillColor] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(22);
  const [fontFamily, setFontFamily] = useState('Segoe UI');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
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

  const updateHistoryFlags = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const refreshObjects = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const list = canvas.getObjects().map((obj, i) => ({
      id: obj.id || `obj-${i}`,
      type: obj.type,
      name: obj.name || `${obj.type} ${i + 1}`,
      visible: obj.visible !== false,
      locked: obj.selectable === false,
      object: obj,
    }));
    setObjects(list);
  }, []);

  const saveHistoryNow = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || isRestoringRef.current || historySuspendedRef.current > 0) return;

    const json = canvas.toJSON(['id', 'name', 'strokeOnly', 'fillOnly', 'presetId']);
    const current = historyRef.current[historyIndexRef.current];
    if (current && JSON.stringify(current) === JSON.stringify(json)) return;

    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(json);
    while (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
    updateHistoryFlags();
    setSavedHint('');
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
      const isShape = SHAPE_TOOLS.includes(activeTool) || isPolyline;

      // Solo la flecha (selección) puede clicar objetos existentes
      canvas.skipTargetFind = !isSelect;
      canvas.selection = isSelect;

      if (!isSelect) {
        canvas.discardActiveObject();
      }

      if (isPen) {
        canvas.isDrawingMode = true;
        canvas.defaultCursor = 'crosshair';
        canvas.hoverCursor = 'crosshair';
        const brush = new PencilBrush(canvas);
        brush.color = strokeColor;
        brush.width = strokeWidth;
        brush.strokeLineCap = 'round';
        brush.strokeLineJoin = 'round';
        brush.decimate = 0;
        canvas.freeDrawingBrush = brush;
      } else {
        canvas.isDrawingMode = false;
        if (isPan) {
          canvas.defaultCursor = 'grab';
          canvas.hoverCursor = 'grab';
        } else if (isShape) {
          canvas.defaultCursor = 'crosshair';
          canvas.hoverCursor = 'crosshair';
        } else {
          canvas.defaultCursor = 'default';
          canvas.hoverCursor = isSelect ? 'move' : 'default';
        }
      }

      canvas.requestRenderAll();
    },
    [strokeColor, strokeWidth],
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

  const addText = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new Textbox('Escribe aquí', {
      left: 80,
      top: 80,
      width: 280,
      fontSize,
      fontFamily,
      fill: strokeColor,
      id: uid(),
      name: 'Texto',
    });
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
  }, [fontFamily, fontSize, refreshObjects, saveHistoryNow, strokeColor]);

  const addImageFromFile = useCallback(
    async (file, position) => {
      const canvas = fabricRef.current;
      if (!canvas || !file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        const maxW = pageSize.width * 0.65;
        const scale = img.width > maxW ? maxW / img.width : 1;
        img.set({
          left: position?.x ?? 60,
          top: position?.y ?? 60,
          scaleX: scale,
          scaleY: scale,
          id: uid(),
          name: file.name?.replace(/\.[^.]+$/, '') || 'Imagen',
        });
        historySuspendedRef.current += 1;
        canvas.add(img);
        historySuspendedRef.current -= 1;
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        refreshObjects();
        setSelectedObject(img);
        setSelectionCount(1);
      } finally {
        URL.revokeObjectURL(url);
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
        const img = await FabricImage.fromURL(shapeId, { crossOrigin: 'anonymous' });
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

          if (preset.svgAsset) {
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
            const img = await FabricImage.fromURL(resolveAssetUrl(preset.imageAsset), { crossOrigin: 'anonymous' });
            const scales = applyInsertScale(preset, img.width, img.height);
            img.set({
              ...common,
              ...scales,
              objectCaching: false,
            });
            shape = img;
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
    },
    [fillColor, refreshObjects, saveHistoryNow, strokeColor, strokeWidth],
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

  const setBackgroundImage = useCallback(
    async (file) => {
      const canvas = fabricRef.current;
      if (!canvas || !file) return;
      const url = URL.createObjectURL(file);
      try {
        const img = await FabricImage.fromURL(url);
        canvas.backgroundImage = img;
        canvas.backgroundColor = '';
        img.set({
          scaleX: canvas.width / (img.width || 1),
          scaleY: canvas.height / (img.height || 1),
        });
        canvas.requestRenderAll();
        saveHistory();
      } finally {
        URL.revokeObjectURL(url);
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
      setPageSizeKey(key);
      saveHistory();
    },
    [saveHistory, syncCanvasZoom],
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

  const updateSelectedProps = useCallback(
    (props) => {
      const canvas = fabricRef.current;
      const objs = getActiveObjects();
      if (!canvas || !objs.length) return;
      objs.forEach((obj) => {
        if (obj.type === 'group' && (props.stroke !== undefined || props.fill !== undefined)) {
          obj.getObjects().forEach((child) => child.set(props));
        }
        obj.set(props);
      });
      canvas.requestRenderAll();
      saveHistory();
      setSelectedObject(canvas.getActiveObject());
    },
    [getActiveObjects, saveHistory],
  );

  const getProjectData = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return {
      id: canvas.projectId || uid(),
      name: projectName,
      pageSizeKey,
      backgroundColor,
      canvas: canvas.toJSON(['id', 'name', 'strokeOnly', 'fillOnly', 'presetId']),
      updatedAt: new Date().toISOString(),
    };
  }, [backgroundColor, pageSizeKey, projectName]);

  const markSaved = useCallback(() => setSavedHint('Guardado'), []);

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
      if (project.backgroundColor) setBackgroundColor(project.backgroundColor);
      await canvas.loadFromJSON(project.canvas);
      syncCanvasZoom(canvas, zoomRef.current);
      historyRef.current = [canvas.toJSON(['id', 'name', 'strokeOnly', 'fillOnly', 'presetId'])];
      historyIndexRef.current = 0;
      isRestoringRef.current = false;
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
    historyRef.current = [canvas.toJSON(['id', 'name', 'strokeOnly', 'fillOnly', 'presetId'])];
    historyIndexRef.current = 0;
    updateHistoryFlags();
    refreshObjects();
    setSelectedObject(null);
    setSelectionCount(0);
    setSavedHint('');
  }, [refreshObjects, syncCanvasZoom, updateHistoryFlags]);

  const exportCanvas = useCallback(() => fabricRef.current, []);

  const setCanvasZoom = useCallback(
    (value) => {
      const clamped = Math.min(3, Math.max(0.25, value));
      zoomRef.current = clamped;
      setZoom(clamped);
      const canvas = fabricRef.current;
      if (canvas) syncCanvasZoom(canvas, clamped);
    },
    [syncCanvasZoom],
  );

  const zoomStep = useCallback(
    (delta) => {
      setCanvasZoom(zoomRef.current + delta);
    },
    [setCanvasZoom],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      if (tool === TOOLS.POLYLINE && polylinePointsRef.current.length > 0) {
        finishPolyline();
        return;
      }
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [tool, finishPolyline],
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
    historyRef.current = [canvas.toJSON(['id', 'name', 'strokeOnly', 'fillOnly', 'presetId'])];
    historyIndexRef.current = 0;

    const syncSelection = (e) => {
      const sel = e?.selected || (canvas.getActiveObject() ? [canvas.getActiveObject()] : []);
      const count = sel.length;
      setSelectionCount(count);
      setSelectedObject(count === 1 ? sel[0] : count > 1 ? canvas.getActiveObject() : null);
    };

    canvas.on('object:modified', () => {
      if (!isRestoringRef.current) {
        saveHistory();
        refreshObjects();
      }
    });
    canvas.on('object:added', (ev) => {
      if (ev.target && !ev.target.id) ev.target.id = uid();
      if (!isRestoringRef.current) {
        saveHistory();
        refreshObjects();
      }
    });
    canvas.on('object:removed', () => {
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
    canvas.on('path:created', (e) => {
      if (e.path) {
        if (!e.path.id) e.path.id = uid();
        if (!e.path.name) e.path.name = 'Trazo';
        applyVectorQuality(e.path);
      }
      canvas.discardActiveObject();
      saveHistoryNow();
      refreshObjects();
    });

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      wrapper.replaceChildren();
    };
  }, [containerRef, refreshObjects, saveHistory, syncCanvasZoom]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    applyDrawingMode(canvas, tool);
    if (tool !== TOOLS.SELECT) {
      setSelectedObject(null);
      setSelectionCount(0);
    }
    if (tool !== TOOLS.POLYLINE) {
      cancelPolylineDraft();
    }
  }, [tool, applyDrawingMode, cancelPolylineDraft]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || tool !== TOOLS.PEN) return;
    applyDrawingMode(canvas, TOOLS.PEN);
  }, [strokeColor, strokeWidth, tool, applyDrawingMode]);

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
        strokeWidth,
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
        const line = new Line([x1, y1, x2, y2], { stroke: strokeColor, strokeWidth, id: uid(), name: 'Flecha' });
        canvas.remove(shape);
        canvas.add(line, head);
      } else {
        shape.set({ selectable: true, evented: true });
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

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      const canvas = fabricRef.current;
      const mod = e.ctrlKey || e.metaKey;

      if (e.code === 'Space') {
        if (!spaceDownRef.current) toolBeforeSpaceRef.current = tool;
        spaceDownRef.current = true;
        if (tool !== TOOLS.PEN) setTool(TOOLS.PAN);
        e.preventDefault();
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
        if (e.key === 't' || e.key === 'T') addText();
        if (e.key === 'p' || e.key === 'P') setTool(TOOLS.PEN);
        if (e.key === 'm' || e.key === 'M') setTool(TOOLS.POLYLINE);
        if (e.key === 'h' || e.key === 'H') setTool(TOOLS.PAN);
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        setTool(toolBeforeSpaceRef.current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('paste', handlePasteEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('paste', handlePasteEvent);
    };
  }, [
    addText,
    cancelPolylineDraft,
    copySelected,
    cutSelected,
    deleteSelected,
    deselectAll,
    duplicateSelected,
    groupSelected,
    handlePasteEvent,
    nudgeSelected,
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
    pageSizeKey,
    pageSize,
    strokeColor,
    setStrokeColor,
    fillColor,
    setFillColor,
    strokeWidth,
    setStrokeWidth,
    fontSize,
    setFontSize,
    fontFamily,
    setFontFamily,
    backgroundColor,
    selectedObject,
    selectionCount,
    objects,
    canUndo,
    canRedo,
    canPaste,
    zoom,
    projectName,
    setProjectName,
    savedHint,
    markSaved,
    contextMenu,
    closeContextMenu,
    handleContextMenu,
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
    setBackgroundImage,
    clearBackgroundImage,
    resizePage,
    selectObjectByRef,
    toggleObjectVisibility,
    removeObject,
    updateSelectedProps,
    getProjectData,
    loadProjectData,
    newProject,
    exportCanvas,
    setCanvasZoom,
    zoomStep,
  };
}
