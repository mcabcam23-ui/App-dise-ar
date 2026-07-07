export const OVERLAY_TYPES = {
  NONE: 'none',
  GRID: 'grid',
  LINES: 'lines',
  DOTS: 'dots',
};

export const OVERLAY_OPTIONS = [
  { id: OVERLAY_TYPES.NONE, label: 'Sin guía' },
  { id: OVERLAY_TYPES.GRID, label: 'Cuadrícula' },
  { id: OVERLAY_TYPES.LINES, label: 'Rayas horizontales' },
  { id: OVERLAY_TYPES.DOTS, label: 'Puntos' },
];

export const BACKGROUND_PRESETS = [
  { id: 'white', label: 'Blanco', color: '#ffffff', overlay: OVERLAY_TYPES.NONE },
  { id: 'cream', label: 'Crema', color: '#faf8f0', overlay: OVERLAY_TYPES.NONE },
  { id: 'gray', label: 'Gris claro', color: '#f0f0f0', overlay: OVERLAY_TYPES.NONE },
  { id: 'graph', label: 'Cuadriculado', color: '#ffffff', overlay: OVERLAY_TYPES.GRID, overlayColor: '#cccccc' },
  { id: 'lined', label: 'Rayado', color: '#ffffff', overlay: OVERLAY_TYPES.LINES, overlayColor: '#93c5fd' },
  { id: 'dots', label: 'Punteado', color: '#ffffff', overlay: OVERLAY_TYPES.DOTS, overlayColor: '#d1d5db' },
  { id: 'blueprint', label: 'Plano azul', color: '#1a365d', overlay: OVERLAY_TYPES.GRID, overlayColor: '#2c5282' },
  { id: 'green-board', label: 'Verde pizarra', color: '#1e3a2f', overlay: OVERLAY_TYPES.NONE },
  { id: 'yellow-note', label: 'Nota amarilla', color: '#fff9c4', overlay: OVERLAY_TYPES.LINES, overlayColor: '#fbbf24' },
  { id: 'pink', label: 'Rosa suave', color: '#fce7f3', overlay: OVERLAY_TYPES.NONE },
];

export function getBackgroundPreset(id) {
  return BACKGROUND_PRESETS.find((p) => p.id === id) ?? BACKGROUND_PRESETS[0];
}
