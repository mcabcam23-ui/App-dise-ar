import { applyStyleToObject } from './objectStyles';
import { DEFAULT_TEXT_STYLE, isTextObject, readTextStyleFromObject } from '../constants/textStyles';

const OBJECT_LEVEL_PROPS = new Set([
  'textAlign',
  'lineHeight',
  'charSpacing',
  'opacity',
  'backgroundColor',
]);

export function captureTextFormatSelectionSnapshot(obj) {
  if (!isTextObject(obj) || !obj.isEditing) return null;

  let start = obj.selectionStart ?? 0;
  let end = obj.selectionEnd ?? start;
  const ta = obj.hiddenTextarea;

  if (ta && typeof ta.selectionStart === 'number' && ta.selectionEnd > ta.selectionStart) {
    start = ta.selectionStart;
    end = ta.selectionEnd;
  }

  return {
    objectId: obj.id,
    start,
    end,
  };
}

export function readTextSelectionRange(obj, pending) {
  if (!isTextObject(obj)) return null;

  let start = obj.selectionStart ?? 0;
  let end = obj.selectionEnd ?? start;

  if (obj.isEditing && obj.hiddenTextarea) {
    const ta = obj.hiddenTextarea;
    const taStart = ta.selectionStart ?? 0;
    const taEnd = ta.selectionEnd ?? taStart;
    if (taEnd > taStart) {
      start = taStart;
      end = taEnd;
    }
  }

  if (end <= start && pending?.objectId === obj.id && pending.end > pending.start) {
    return { start: pending.start, end: pending.end };
  }

  return end > start ? { start, end } : null;
}

function isFullTextSelected(obj, start, end) {
  const len = obj.text?.length ?? 0;
  return start === 0 && end >= len;
}

export function resolveTextStyleScope(obj, pending) {
  if (!isTextObject(obj)) return 'skip';
  if (!obj.isEditing) return 'object';

  const range = readTextSelectionRange(obj, pending);
  if (!range) return 'object';
  if (isFullTextSelected(obj, range.start, range.end)) return 'object';
  return 'partial';
}

export function hasPartialTextSelection(obj, pending) {
  return resolveTextStyleScope(obj, pending) === 'partial';
}

export function splitTextStylePatch(patch) {
  const objectLevel = {};
  const selectionLevel = {};
  Object.entries(patch).forEach(([key, value]) => {
    if (OBJECT_LEVEL_PROPS.has(key)) objectLevel[key] = value;
    else selectionLevel[key] = value;
  });
  return { objectLevel, selectionLevel };
}

function normalizeSelectionPatch(patch) {
  const style = { ...patch };
  if (style.strokeWidth !== undefined && style.strokeWidth <= 0) {
    style.stroke = '';
    style.strokeWidth = 0;
  } else if (style.strokeWidth > 0 && !style.stroke) {
    style.stroke = '#000000';
  }
  if (style.backgroundColor !== undefined) {
    style.textBackgroundColor = style.backgroundColor;
    delete style.backgroundColor;
  }
  return style;
}

export function applyTextStylePatch(obj, patch, pending) {
  if (!isTextObject(obj) || !patch) return false;

  const { objectLevel, selectionLevel } = splitTextStylePatch(patch);
  let changed = false;

  if (Object.keys(objectLevel).length) {
    applyStyleToObject(obj, objectLevel);
    changed = true;
  }

  if (Object.keys(selectionLevel).length) {
    const scope = resolveTextStyleScope(obj, pending);
    const range = readTextSelectionRange(obj, pending);

    if (scope === 'partial' && range && typeof obj.setSelectionStyles === 'function') {
      obj.setSelectionStyles(
        normalizeSelectionPatch(selectionLevel),
        range.start,
        range.end,
      );
      changed = true;
    } else {
      applyStyleToObject(obj, selectionLevel);
      changed = true;
    }
  }

  if (changed) {
    obj.dirty = true;
    obj.initDimensions?.();
    obj.setCoords?.();
  }

  return changed;
}

export function readEffectiveTextStyle(obj, fallback, pending) {
  if (!isTextObject(obj)) return { ...fallback };

  const range = readTextSelectionRange(obj, pending);
  if (obj.isEditing && range && typeof obj.getSelectionStyles === 'function') {
    const styles = obj.getSelectionStyles(range.start, range.end, true);
    const first = styles[0] || {};
    const base = readTextStyleFromObject(obj, fallback);
    return {
      ...base,
      fill: first.fill ?? base.fill,
      fontSize: first.fontSize ?? base.fontSize,
      fontFamily: first.fontFamily ?? base.fontFamily,
      fontWeight: first.fontWeight ?? base.fontWeight,
      fontStyle: first.fontStyle ?? base.fontStyle,
      underline: first.underline ?? base.underline,
      linethrough: first.linethrough ?? base.linethrough,
      stroke: first.stroke ?? base.stroke,
      strokeWidth: first.strokeWidth ?? base.strokeWidth,
      backgroundColor: first.textBackgroundColor ?? base.backgroundColor,
    };
  }

  return readTextStyleFromObject(obj, fallback);
}

export function getTextFormatHint(obj, pending) {
  if (!isTextObject(obj)) return '';
  if (!obj.isEditing) {
    return 'Doble clic en el texto · selecciona una parte · aplica el formato';
  }
  if (hasPartialTextSelection(obj, pending)) {
    return 'Formato solo en la selección';
  }
  return 'Selecciona un fragmento del texto para darle un estilo distinto';
}

export function readTextStyleFromSelection(selectedObject, fallback, pending) {
  if (isTextObject(selectedObject)) {
    return readEffectiveTextStyle(selectedObject, fallback, pending);
  }
  if (selectedObject?.type === 'activeSelection' && selectedObject.getObjects) {
    const first = selectedObject.getObjects().find(isTextObject);
    if (first) return readEffectiveTextStyle(first, fallback, pending);
  }
  return { ...(fallback ?? DEFAULT_TEXT_STYLE) };
}
