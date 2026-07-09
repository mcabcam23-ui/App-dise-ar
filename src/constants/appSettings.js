import { TOOLS } from './pageSizes';

export const APP_SETTINGS_KEY = 'estudio-app-settings';

export const DEFAULT_SETTINGS = {
  // Lápiz y dibujo
  palmRejection: false, // Solo el lápiz óptico dibuja; ignora dedos/palma
  penSmoothing: true, // Suaviza el trazo del lápiz
  // Imán y ajuste
  snapRotation: true, // Ajusta la rotación a ángulos fijos
  trackSnap: true, // Imán a la vía al mover señales
};

/** Herramientas en las que el rechazo de palma debe actuar (dibujo/pintado). */
const DRAWING_TOOLS = new Set([
  TOOLS.PEN,
  TOOLS.ERASER,
  TOOLS.RECT,
  TOOLS.CIRCLE,
  TOOLS.LINE,
  TOOLS.POLYLINE,
  TOOLS.ARROW,
  TOOLS.BUCKET,
]);

export function isDrawingTool(tool) {
  return DRAWING_TOOLS.has(tool);
}

export function loadAppSettings() {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAppSettings(settings) {
  try {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

/** Claves de localStorage que definen la disposición de la interfaz. */
export const LAYOUT_PREFERENCE_KEYS = [
  'estudio-panel-width',
  'estudio-chrome-height',
  'estudio-chrome-collapsed',
  'estudio-panel-section',
  'eraser-size-panel-pos',
];

export function resetLayoutPreferences() {
  LAYOUT_PREFERENCE_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  });
}
