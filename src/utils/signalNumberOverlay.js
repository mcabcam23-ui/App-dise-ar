import { Group, Textbox } from 'fabric';

const CANVAS_CUSTOM_PROPS = [
  'id',
  'name',
  'strokeOnly',
  'fillOnly',
  'presetId',
  'customNumber',
  'customNumberValue',
];

export { CANVAS_CUSTOM_PROPS };

export function buildSignalWithNumber(img, preset, displayW, displayH, numberText, common) {
  const overlay = preset.numberOverlay || {};
  const fontSizeRatio = overlay.fontSizeRatio ?? 0.2;
  const leftRatio = overlay.leftRatio ?? 0.5;
  const topRatio = overlay.topRatio ?? 0.56;
  const value = String(numberText ?? '').trim() || '100';

  const scaleX = displayW / (img.width || preset.width || 1);
  const scaleY = displayH / (img.height || preset.height || 1);

  img.set({
    left: 0,
    top: 0,
    scaleX,
    scaleY,
    objectCaching: false,
  });

  const fontSize = Math.max(8, Math.round(displayH * fontSizeRatio));
  const text = new Textbox(value, {
    left: displayW * leftRatio,
    top: displayH * topRatio,
    originX: 'center',
    originY: 'center',
    width: Math.max(24, displayW * 0.55),
    fontSize,
    fontFamily: overlay.fontFamily || 'Arial Black, Arial, sans-serif',
    fontWeight: overlay.fontWeight || 'bold',
    fill: overlay.fill || '#111111',
    textAlign: 'center',
    editable: true,
    splitByGrapheme: false,
    objectCaching: false,
  });

  const group = new Group([img, text], {
    ...common,
    subTargetCheck: true,
    customNumber: true,
    customNumberValue: value,
    name: `${preset.name} ${value}`,
  });

  return group;
}

export function updateSignalNumber(group, newValue) {
  if (!group?.customNumber || group.type !== 'group') return;
  const value = String(newValue ?? '').trim();
  if (!value) return;
  const textObj = group.getObjects?.().find((o) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
  if (textObj) {
    textObj.set({ text: value });
    const baseName = (group.name || 'Señal').replace(/\s+\d+$/, '').trim() || 'Señal';
    group.set({ customNumberValue: value, name: `${baseName} ${value}` });
    group.setCoords?.();
  }
}
