import { TOOLS } from '../constants/pageSizes';

const MIN_H = 48;
const MIN_W = 36;

/** Área de arrastre con altura/ancho mínimos; el ancho extra crece hacia la derecha. */
function normalizeBox(x1, y1, x2, y2) {
  let left = Math.min(x1, x2);
  let right = Math.max(x1, x2);
  let top = Math.min(y1, y2);
  let bottom = Math.max(y1, y2);

  if (bottom - top < MIN_H) {
    const cy = (top + bottom) / 2;
    top = cy - MIN_H / 2;
    bottom = cy + MIN_H / 2;
  }
  if (right - left < MIN_W) {
    right = left + MIN_W;
  }

  const w = right - left;
  const h = bottom - top;
  const vInset = Math.max(4, h * 0.06);
  const hInset = Math.max(8, w * 0.12);
  const arm = Math.max(10, Math.min(w * 0.38, 32));

  return {
    left,
    right,
    top: top + vInset,
    bottom: bottom - vInset,
    w,
    h,
    hInset,
    arm,
    bulge: Math.max(arm * 0.85, Math.min(w * 0.55, 44)),
  };
}

/** Corchete rectangular [ — espina con margen interior, brazos a la derecha (o izquierda si openLeft=false). */
export function rectangularBracketPoints(x1, y1, x2, y2, openLeft = true) {
  const { left, right, top, bottom, hInset, arm } = normalizeBox(x1, y1, x2, y2);
  const spine = openLeft ? left + hInset : right - hInset;

  if (openLeft) {
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
export function curlyBracketPoints(x1, y1, x2, y2, openLeft = true) {
  const { left, right, top, bottom, hInset, arm, bulge } = normalizeBox(x1, y1, x2, y2);
  const spine = openLeft ? left + hInset : right - hInset;
  const midY = top + (bottom - top) / 2;
  const topNotch = top + (bottom - top) * 0.24;
  const botNotch = top + (bottom - top) * 0.76;

  if (openLeft) {
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

export function bracketPointsForTool(tool, x1, y1, x2, y2, openLeft = true) {
  if (tool === TOOLS.RECT_BRACKET) {
    return rectangularBracketPoints(x1, y1, x2, y2, openLeft);
  }
  return curlyBracketPoints(x1, y1, x2, y2, openLeft);
}
