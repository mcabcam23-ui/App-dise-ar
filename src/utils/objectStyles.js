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

export function effectiveStrokeWidth(obj, fallback = 2) {
  const w = obj?.strokeWidth;
  if (typeof w !== 'number' || w < 1) return fallback;
  return w;
}

export function objectRequiresVisibleStroke(obj) {
  if (!obj) return false;
  if (['line', 'polyline'].includes(obj.type)) return true;
  if (obj.type === 'path' && obj.globalCompositeOperation !== 'destination-out') return true;
  return false;
}

export function repairStrokeIfNeeded(obj, fallback = 2) {
  if (!obj || !objectRequiresVisibleStroke(obj)) return false;
  let changed = false;
  const patch = {};
  if (effectiveStrokeWidth(obj, fallback) !== obj.strokeWidth) {
    patch.strokeWidth = Math.max(1, fallback);
    changed = true;
  }
  if (!obj.stroke || obj.stroke === 'transparent') {
    patch.stroke = '#000000';
    changed = true;
  }
  if (changed) obj.set(patch);
  return changed;
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

  const {
    fill,
    stroke,
    strokeWidth,
    opacity,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    underline,
    linethrough,
    textAlign,
    backgroundColor,
    lineHeight,
    charSpacing,
    angle,
  } = style;

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
    const textFill = fill !== undefined ? fill : undefined;
    if (textFill !== undefined) obj.set({ fill: textFill });
    if (fontSize !== undefined) obj.set({ fontSize });
    if (fontFamily !== undefined) obj.set({ fontFamily });
    if (fontWeight !== undefined) obj.set({ fontWeight });
    if (fontStyle !== undefined) obj.set({ fontStyle });
    if (underline !== undefined) obj.set({ underline });
    if (linethrough !== undefined) obj.set({ linethrough });
    if (textAlign !== undefined) obj.set({ textAlign });
    if (backgroundColor !== undefined) obj.set({ backgroundColor });
    if (lineHeight !== undefined) obj.set({ lineHeight });
    if (charSpacing !== undefined) obj.set({ charSpacing });
    if (stroke !== undefined) obj.set({ stroke: stroke || undefined });
    if (strokeWidth !== undefined) obj.set({ strokeWidth: strokeWidth > 0 ? strokeWidth : 0 });
    if (opacity !== undefined) obj.set({ opacity });
    if (angle !== undefined) {
      obj.set({ angle });
      obj.setCoords?.();
    }
    return;
  }

  if (fill !== undefined && objectSupportsFill(obj)) {
    obj.set({ fill });
  }
  if (stroke !== undefined && objectSupportsStroke(obj)) {
    obj.set({ stroke });
  }
  if (strokeWidth !== undefined && objectSupportsStroke(obj)) {
    const width = objectRequiresVisibleStroke(obj) ? Math.max(1, strokeWidth) : strokeWidth;
    obj.set({ strokeWidth: width });
  }
  if (opacity !== undefined) obj.set({ opacity });
  if (angle !== undefined) {
    obj.set({ angle });
    obj.setCoords?.();
  }
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
    return { fill: true, stroke: true, strokeWidth: true, text: true };
  }
  if (obj.fillOnly) return { fill: true, stroke: false, strokeWidth: false, text: false };
  if (obj.strokeOnly) return { fill: false, stroke: true, strokeWidth: true, text: false };
  if (['line', 'polyline'].includes(obj.type)) {
    return { fill: false, stroke: true, strokeWidth: true, text: false };
  }
  if (obj.type === 'image') return { fill: false, stroke: false, strokeWidth: false, text: false };
  return { fill: true, stroke: true, strokeWidth: true, text: false };
}

/** Vacía el contenido visible de un objeto sin quitarlo del lienzo. */
export function emptyObjectContent(obj) {
  if (!obj) return;

  obj.set({ clipPath: undefined, dirty: true });
  obj._eraserGroup = undefined;

  if (obj.type === 'group' && obj.getObjects) {
    obj.getObjects().forEach(emptyObjectContent);
    return;
  }

  if (obj.type === 'activeSelection' && obj.getObjects) {
    obj.getObjects().forEach(emptyObjectContent);
    return;
  }

  if (['textbox', 'i-text', 'text'].includes(obj.type)) {
    obj.set({
      text: '',
      fill: '#000000',
      backgroundColor: '',
      underline: false,
      fontWeight: 'normal',
      fontStyle: 'normal',
    });
    return;
  }

  if (obj.type === 'image') {
    obj.set({ opacity: 0 });
    return;
  }

  obj.set({
    fill: '',
    stroke: '',
    strokeWidth: 0,
    opacity: 1,
  });
}
