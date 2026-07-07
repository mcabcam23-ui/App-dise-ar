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
    label: 'Goma · todo',
    hint: 'Pinta para borrar todo el contenido · el fondo no se borra',
    group: 'draw',
  },
  {
    id: ERASER_MODES.LAYER,
    label: 'Goma · capa',
    hint: 'Selecciona una capa · pinta para borrar solo esa capa',
    group: 'draw',
  },
  {
    id: ERASER_MODES.CLEAR_ALL,
    label: 'Vaciar hoja',
    hint: 'Elimina todo el contenido de la hoja (requiere confirmación)',
    group: 'confirm',
  },
  {
    id: ERASER_MODES.CLEAR_LAYER,
    label: 'Vaciar capa',
    hint: 'Vacía por completo la capa seleccionada · la capa sigue en la lista (requiere confirmación)',
    group: 'confirm',
  },
];

export function getTextModeOption(id) {
  return TEXT_MODE_OPTIONS.find((m) => m.id === id) ?? TEXT_MODE_OPTIONS[0];
}

export function getEraserModeOption(id) {
  return ERASER_MODE_OPTIONS.find((m) => m.id === id) ?? ERASER_MODE_OPTIONS[0];
}
