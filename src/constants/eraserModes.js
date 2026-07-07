import { ERASER_MODES } from './toolModes';

export function isEraserDrawMode(mode) {
  return mode === ERASER_MODES.ALL || mode === ERASER_MODES.LAYER;
}

export function isEraserConfirmMode(mode) {
  return mode === ERASER_MODES.CLEAR_ALL || mode === ERASER_MODES.CLEAR_LAYER;
}
