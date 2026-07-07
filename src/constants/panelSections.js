export const PANEL_SECTIONS = {
  LAYERS: 'layers',
  INSERT: 'insert',
  PROPERTIES: 'properties',
  PAGE: 'page',
  DOCUMENT: 'document',
};

export const PANEL_SECTION_OPTIONS = [
  { id: PANEL_SECTIONS.LAYERS, label: 'Capas', hint: 'Orden, visibilidad y bloqueo' },
  { id: PANEL_SECTIONS.INSERT, label: 'Insertar', hint: 'Figuras prefabricadas e imágenes' },
  { id: PANEL_SECTIONS.PROPERTIES, label: 'Propiedades', hint: 'Estilo del elemento seleccionado' },
  { id: PANEL_SECTIONS.PAGE, label: 'Página', hint: 'Tamaño y fondo' },
  { id: PANEL_SECTIONS.DOCUMENT, label: 'Documento', hint: 'Acciones y estadísticas' },
];

export const PANEL_SECTION_KEY = 'estudio-panel-section';

export function loadPanelSection() {
  try {
    const saved = localStorage.getItem(PANEL_SECTION_KEY);
    if (saved && PANEL_SECTION_OPTIONS.some((s) => s.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return PANEL_SECTIONS.LAYERS;
}

export function savePanelSection(id) {
  try {
    localStorage.setItem(PANEL_SECTION_KEY, id);
  } catch {
    /* ignore */
  }
}
