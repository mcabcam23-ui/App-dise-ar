import { TOOLS } from '../constants/pageSizes';
import { isTextObject, isTextSelection } from '../constants/textStyles';
import { getObjectStyleCaps } from './objectStyles';
import { findPresetHost, getObjectPresetId } from './presetVariants';
import { getPresetShape } from '../constants/presetCatalog';

const STROKE_DRAW_TOOLS = new Set([
  TOOLS.PEN,
  TOOLS.RECT,
  TOOLS.CIRCLE,
  TOOLS.LINE,
  TOOLS.POLYLINE,
  TOOLS.ARROW,
  TOOLS.BRACKETS,
  TOOLS.RECT_BRACKET,
]);

const FILL_DRAW_TOOLS = new Set([TOOLS.RECT, TOOLS.CIRCLE]);

function capsFromSelection(selectedObject, selectionCount) {
  if (!selectionCount) return null;

  if (selectionCount > 1) {
    const objects =
      selectedObject?.type === 'activeSelection' && selectedObject.getObjects
        ? selectedObject.getObjects()
        : [selectedObject].filter(Boolean);

    if (objects.length === 0) {
      return { fill: true, stroke: true, strokeWidth: true };
    }

    if (objects.every(isTextObject)) return null;

    return {
      fill: objects.some((o) => getObjectStyleCaps(o).fill),
      stroke: objects.some((o) => getObjectStyleCaps(o).stroke),
      strokeWidth: objects.some((o) => getObjectStyleCaps(o).strokeWidth),
    };
  }

  if (!selectedObject || isTextObject(selectedObject)) return null;

  if (selectedObject.customNumber) {
    const caps = getObjectStyleCaps(selectedObject);
    if (!caps.fill && !caps.stroke) return null;
  }

  return getObjectStyleCaps(selectedObject);
}

export function getStyleControlsVisibility({ tool, selectedObject, selectionCount }) {
  if (
    tool === TOOLS.TEXT ||
    tool === TOOLS.ERASER ||
    tool === TOOLS.PAN ||
    tool === TOOLS.IMAGE ||
    tool === TOOLS.EYEDROPPER
  ) {
    return { showStroke: false, showFill: false, showStrokeWidth: false, showAny: false };
  }

  if (tool === TOOLS.BUCKET) {
    return { showStroke: false, showFill: true, showStrokeWidth: false, showAny: true };
  }

  if (STROKE_DRAW_TOOLS.has(tool)) {
    return {
      showStroke: true,
      showFill: FILL_DRAW_TOOLS.has(tool),
      showStrokeWidth: true,
      showAny: true,
    };
  }

  const caps = capsFromSelection(selectedObject, selectionCount);
  if (!caps) {
    return { showStroke: false, showFill: false, showStrokeWidth: false, showAny: false };
  }

  return {
    showStroke: caps.stroke,
    showFill: caps.fill,
    showStrokeWidth: caps.strokeWidth,
    showAny: Boolean(caps.stroke || caps.fill || caps.strokeWidth),
  };
}

export function needsToolModeBar({ tool, selectedObject, selectionCount }) {
  if (tool === TOOLS.TEXT || tool === TOOLS.ERASER) return true;
  return isTextSelection(selectedObject, selectionCount) && tool !== TOOLS.ERASER;
}

export function needsCompactChromeBody({ tool, selectedObject, selectionCount }) {
  if (getStyleControlsVisibility({ tool, selectedObject, selectionCount }).showAny) return true;
  if (needsToolModeBar({ tool, selectedObject, selectionCount })) return true;
  if (selectionCount === 1 && selectedObject) {
    const host = findPresetHost(selectedObject);
    const presetId = getObjectPresetId(host);
    const preset = presetId ? getPresetShape(presetId) : null;
    if (preset?.customNumber || host?.customNumber) return true;
    if (preset?.customStationCount || host?.customStationCount) return true;
  }
  return false;
}
