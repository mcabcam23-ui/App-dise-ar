export function objectSupportsFill(obj) {
  if (!obj || obj.strokeOnly) return false;
  if (obj.fillOnly) return true;
  if (['line', 'polyline', 'image'].includes(obj.type)) return false;
  if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') return true;
  return true;
}

export function objectSupportsStroke(obj) {
  if (!obj || obj.fillOnly) return false;
  return true;
}

export function displayColor(value, fallback = '#000000') {
  if (!value || value === 'transparent') return fallback;
  if (typeof value === 'string' && value.startsWith('#')) return value;
  return fallback;
}

export function isArrowGroup(obj) {
  return obj?.type === 'group' && obj.name === 'Flecha';
}

export function applyStyleToObject(obj, style) {
  if (!obj) return;

  const { fill, stroke, strokeWidth, opacity, fontSize, fontFamily } = style;

  if (isArrowGroup(obj)) {
    obj.getObjects().forEach((child) => {
      if (child.type === 'line') {
        if (stroke !== undefined) child.set({ stroke });
        if (strokeWidth !== undefined) child.set({ strokeWidth });
      }
      if (child.type === 'triangle' && stroke !== undefined) child.set({ fill: stroke });
    });
    if (opacity !== undefined) obj.set({ opacity });
    obj.setCoords?.();
    return;
  }

  if (obj.type === 'group') {
    obj.getObjects().forEach((child) => applyStyleToObject(child, style));
    if (opacity !== undefined) obj.set({ opacity });
    if (strokeWidth !== undefined && !objectSupportsStroke(obj)) {
      /* group container */
    }
    return;
  }

  if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
    if (fill !== undefined) obj.set({ fill });
    if (fontSize !== undefined) obj.set({ fontSize });
    if (fontFamily !== undefined) obj.set({ fontFamily });
    if (opacity !== undefined) obj.set({ opacity });
    return;
  }

  if (fill !== undefined && objectSupportsFill(obj)) {
    obj.set({ fill });
  }
  if (stroke !== undefined && objectSupportsStroke(obj)) {
    obj.set({ stroke });
  }
  if (strokeWidth !== undefined && objectSupportsStroke(obj)) {
    obj.set({ strokeWidth });
  }
  if (opacity !== undefined) obj.set({ opacity });
}

export function applyBucketFillToObject(obj, { fillColor, strokeColor, useStroke = false }) {
  if (!obj) return false;

  const fill = fillColor === 'transparent' ? '' : fillColor;
  const stroke = strokeColor || '#000000';

  if (useStroke) {
    applyStyleToObject(obj, { stroke });
    return true;
  }

  if (objectSupportsFill(obj)) {
    applyStyleToObject(obj, { fill });
    return true;
  }

  if (objectSupportsStroke(obj)) {
    applyStyleToObject(obj, { stroke: fill || stroke });
    return true;
  }

  return false;
}

export function getObjectStyleCaps(obj) {
  if (!obj) return { fill: false, stroke: false, strokeWidth: false, text: false };
  if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
    return { fill: true, stroke: false, strokeWidth: false, text: true };
  }
  if (obj.fillOnly) return { fill: true, stroke: false, strokeWidth: false, text: false };
  if (obj.strokeOnly) return { fill: false, stroke: true, strokeWidth: true, text: false };
  if (['line', 'polyline'].includes(obj.type)) {
    return { fill: false, stroke: true, strokeWidth: true, text: false };
  }
  if (obj.type === 'image') return { fill: false, stroke: false, strokeWidth: false, text: false };
  return { fill: true, stroke: true, strokeWidth: true, text: false };
}
