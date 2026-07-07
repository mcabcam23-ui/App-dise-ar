export const DEFAULT_TEXT_STYLE = {
  fontSize: 22,
  fontFamily: 'Segoe UI',
  fontWeight: 'normal',
  fontStyle: 'normal',
  underline: false,
  linethrough: false,
  textAlign: 'left',
  fill: '#222222',
  backgroundColor: '',
  opacity: 1,
  lineHeight: 1.2,
  charSpacing: 0,
  stroke: '',
  strokeWidth: 0,
};

export const FONT_FAMILIES = [
  { label: 'Segoe UI', value: 'Segoe UI', group: 'Sistema' },
  { label: 'Arial', value: 'Arial', group: 'Sans-serif' },
  { label: 'Verdana', value: 'Verdana', group: 'Sans-serif' },
  { label: 'Tahoma', value: 'Tahoma', group: 'Sans-serif' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS', group: 'Sans-serif' },
  { label: 'Calibri', value: 'Calibri', group: 'Sans-serif' },
  { label: 'Helvetica', value: 'Helvetica', group: 'Sans-serif' },
  { label: 'Georgia', value: 'Georgia', group: 'Serif' },
  { label: 'Times New Roman', value: 'Times New Roman', group: 'Serif' },
  { label: 'Palatino Linotype', value: 'Palatino Linotype', group: 'Serif' },
  { label: 'Courier New', value: 'Courier New', group: 'Monospace' },
  { label: 'Lucida Console', value: 'Lucida Console', group: 'Monospace' },
  { label: 'Impact', value: 'Impact', group: 'Display' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS', group: 'Display' },
];

export const FONT_SIZE_PRESETS = [10, 12, 14, 16, 18, 22, 28, 36, 48, 64, 96];

export function readTextStyleFromObject(obj, fallback = DEFAULT_TEXT_STYLE) {
  if (!obj) return { ...fallback };
  return {
    fontSize: obj.fontSize ?? fallback.fontSize,
    fontFamily: obj.fontFamily ?? fallback.fontFamily,
    fontWeight: obj.fontWeight ?? fallback.fontWeight,
    fontStyle: obj.fontStyle ?? fallback.fontStyle,
    underline: !!obj.underline,
    linethrough: !!obj.linethrough,
    textAlign: obj.textAlign ?? fallback.textAlign,
    fill: typeof obj.fill === 'string' && obj.fill ? obj.fill : fallback.fill,
    backgroundColor: obj.backgroundColor ?? fallback.backgroundColor,
    opacity: obj.opacity ?? fallback.opacity,
    lineHeight: obj.lineHeight ?? fallback.lineHeight,
    charSpacing: obj.charSpacing ?? fallback.charSpacing,
    stroke: obj.stroke ?? fallback.stroke,
    strokeWidth: obj.strokeWidth ?? fallback.strokeWidth,
  };
}

export function isTextObject(obj) {
  return obj?.type === 'textbox' || obj?.type === 'i-text' || obj?.type === 'text';
}

export function isTextSelection(selectedObject, selectionCount = 0) {
  if (isTextObject(selectedObject)) return true;
  if (selectionCount > 1 && selectedObject?.type === 'activeSelection' && selectedObject.getObjects) {
    const items = selectedObject.getObjects();
    return items.length > 0 && items.every(isTextObject);
  }
  return false;
}

export function selectionHasTextbox(selectedObject) {
  if (selectedObject?.type === 'textbox') return true;
  if (selectedObject?.type === 'activeSelection' && selectedObject.getObjects) {
    return selectedObject.getObjects().some((o) => o.type === 'textbox');
  }
  return false;
}
