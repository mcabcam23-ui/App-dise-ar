import { TOOLS } from '../constants/pageSizes';

const MIN_H = 48;
const MIN_ARM = 10;

function resolveVerticalSpan(start, pointer) {
  let top = Math.min(start.y, pointer.y);
  let bottom = Math.max(start.y, pointer.y);
  if (bottom - top < MIN_H) {
    const cy = (start.y + pointer.y) / 2;
    top = cy - MIN_H / 2;
    bottom = cy + MIN_H / 2;
  }

  const h = bottom - top;
  const vInset = Math.max(4, h * 0.06);
  const innerTop = top + vInset;
  const innerBottom = bottom - vInset;
  const innerH = innerBottom - innerTop;

  return {
    top: innerTop,
    bottom: innerBottom,
    midY: innerTop + innerH / 2,
    topNotch: innerTop + innerH * 0.24,
    botNotch: innerTop + innerH * 0.76,
  };
}

function resolveArmLength(start, pointer) {
  return Math.max(MIN_ARM, Math.abs(pointer.x - start.x));
}

/** Corchete rectangular [ — la espina queda en el primer clic; los brazos crecen hacia el arrastre. */
export function rectangularBracketPoints(start, pointer) {
  const openRight = pointer.x >= start.x;
  const arm = resolveArmLength(start, pointer);
  const { top, bottom } = resolveVerticalSpan(start, pointer);
  const spine = start.x;

  if (openRight) {
    return [
      { x: spine + arm, y: top },
      { x: spine, y: top },
      { x: spine, y: bottom },
      { x: spine + arm, y: bottom },
    ];
  }

  return [
    { x: spine - arm, y: top },
    { x: spine, y: top },
    { x: spine, y: bottom },
    { x: spine - arm, y: bottom },
  ];
}

/** Corchete normal { — mismos trazos rectos que el icono del menú. */
export function curlyBracketPoints(start, pointer) {
  const openRight = pointer.x >= start.x;
  const arm = resolveArmLength(start, pointer);
  const { top, bottom, midY, topNotch, botNotch } = resolveVerticalSpan(start, pointer);
  const spine = start.x;
  const bulge = Math.max(arm * 0.85, Math.min(arm * 1.4, 44));

  if (openRight) {
    return [
      { x: spine + arm, y: top },
      { x: spine, y: top },
      { x: spine, y: topNotch },
      { x: spine + bulge, y: midY },
      { x: spine, y: botNotch },
      { x: spine, y: bottom },
      { x: spine + arm, y: bottom },
    ];
  }

  return [
    { x: spine - arm, y: top },
    { x: spine, y: top },
    { x: spine, y: topNotch },
    { x: spine - bulge, y: midY },
    { x: spine, y: botNotch },
    { x: spine, y: bottom },
    { x: spine - arm, y: bottom },
  ];
}

export function bracketPointsForTool(tool, start, pointer) {
  if (tool === TOOLS.RECT_BRACKET) {
    return rectangularBracketPoints(start, pointer);
  }
  return curlyBracketPoints(start, pointer);
}
