export const TEXT_MODES = {
  BOX: 'box',
  LINE: 'line',
  TITLE: 'title',
  LABEL: 'label',
  NOTE: 'note',
};

export const ERASER_MODES = {
  ALL: 'all',
  LAYER: 'layer',
  CLEAR_ALL: 'clear_all',
  CLEAR_LAYER: 'clear_layer',
};

export const TEXT_MODE_OPTIONS = [
  {
    id: TEXT_MODES.BOX,
    label: 'Caja',
    hint: 'Clic en la hoja · caja multilínea redimensionable',
    type: 'textbox',
    placeholder: 'Escribe aquí',
    width: 280,
  },
  {
    id: TEXT_MODES.LINE,
    label: 'Línea',
    hint: 'Clic en la hoja · texto en una sola línea',
    type: 'i-text',
    placeholder: 'Texto',
  },
  {
    id: TEXT_MODES.TITLE,
    label: 'Título',
    hint: 'Clic en la hoja · texto grande en negrita',
    type: 'textbox',
    placeholder: 'Título',
    width: 420,
    fontSize: 36,
    fontWeight: 'bold',
  },
  {
    id: TEXT_MODES.LABEL,
    label: 'Etiqueta',
    hint: 'Clic en la hoja · texto pequeño',
    type: 'i-text',
    placeholder: 'Etiqueta',
    fontSize: 13,
  },
  {
    id: TEXT_MODES.NOTE,
    label: 'Nota',
    hint: 'Clic en la hoja · caja con fondo amarillo',
    type: 'textbox',
    placeholder: 'Nota…',
    width: 240,
    fontSize: 15,
    backgroundColor: '#fff9c4',
  },
];

export const ERASER_MODE_OPTIONS = [
  {
    id: ERASER_MODES.ALL,
    label: 'Todo',
    hint: 'Pinta sobre la hoja para borrar cualquier trazo',
    group: 'draw',
  },
  {
    id: ERASER_MODES.LAYER,
    label: 'Una capa',
    hint: 'Selecciona una capa y pinta solo sobre ella',
    group: 'draw',
  },
  {
    id: ERASER_MODES.CLEAR_ALL,
    label: 'Vaciar hoja',
    hint: 'Borra todo el contenido (requiere deslizar para confirmar)',
    group: 'confirm',
  },
  {
    id: ERASER_MODES.CLEAR_LAYER,
    label: 'Vaciar capa',
    hint: 'Vacía la capa seleccionada (requiere deslizar para confirmar)',
    group: 'confirm',
  },
];

export function getTextModeOption(id) {
  return TEXT_MODE_OPTIONS.find((m) => m.id === id) ?? TEXT_MODE_OPTIONS[0];
}

export function getEraserModeOption(id) {
  return ERASER_MODE_OPTIONS.find((m) => m.id === id) ?? ERASER_MODE_OPTIONS[0];
}

export const MODIFY_MODES = {
  JOIN: 'join',
  SPLIT: 'split',
  EXTEND: 'extend',
  TRIM: 'trim',
  EXPLODE: 'explode',
  CLOSE: 'close',
};

export const MODIFY_MODE_OPTIONS = [
  {
    id: MODIFY_MODES.JOIN,
    label: 'Unir',
    hint: 'Clic en un trazo y luego en otro (extremos cercanos)',
    key: 'J',
  },
  {
    id: MODIFY_MODES.SPLIT,
    label: 'Separar',
    hint: 'Clic sobre el trazo donde quieres cortarlo',
    key: 'S',
  },
  {
    id: MODIFY_MODES.EXTEND,
    label: 'Extender',
    hint: 'Clic cerca de un extremo para alargar hasta el cruce más cercano',
  },
  {
    id: MODIFY_MODES.TRIM,
    label: 'Recortar',
    hint: 'Clic en la parte del trazo que quieres eliminar',
  },
  {
    id: MODIFY_MODES.EXPLODE,
    label: 'Explotar',
    hint: 'Clic en multilínea para separar en tramos individuales',
  },
  {
    id: MODIFY_MODES.CLOSE,
    label: 'Cerrar',
    hint: 'Clic en multilínea abierta para cerrar el contorno',
  },
];

export function getModifyModeOption(id) {
  return MODIFY_MODE_OPTIONS.find((m) => m.id === id) ?? MODIFY_MODE_OPTIONS[0];
}
