import {
  Eraser,
  Hand,
  Layers,
  Menu,
  MousePointer2,
  Pencil,
  Redo2,
  SlidersHorizontal,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PANEL_SECTIONS } from '../constants/panelSections';
import { TOOLS } from '../constants/pageSizes';

const PRIMARY_TOOLS = [
  { id: TOOLS.SELECT, icon: MousePointer2, label: 'Seleccionar' },
  { id: TOOLS.PAN, icon: Hand, label: 'Mover vista' },
  { id: TOOLS.PEN, icon: Pencil, label: 'Lápiz' },
  { id: TOOLS.TEXT, icon: Type, label: 'Texto' },
  { id: TOOLS.ERASER, icon: Eraser, label: 'Borrador' },
];

export default function MobileDock({
  tool,
  setTool,
  canUndo,
  canRedo,
  undo,
  redo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  selectionCount,
  onOpenPanel,
  onOpenMenu,
}) {
  const pickTool = (id) => {
    setTool(id);
  };

  return (
    <nav className="mobile-dock" aria-label="Barra móvil">
      <div className="mobile-dock-row mobile-dock-tools">
        {PRIMARY_TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={`mobile-dock-btn ${tool === id ? 'active' : ''}`}
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
            onClick={() => pickTool(id)}
          >
            <Icon size={20} strokeWidth={1.85} />
          </button>
        ))}
      </div>

      <div className="mobile-dock-row mobile-dock-actions">
        <button type="button" className="mobile-dock-btn" title="Deshacer" disabled={!canUndo} onClick={undo}>
          <Undo2 size={20} />
        </button>
        <button type="button" className="mobile-dock-btn" title="Rehacer" disabled={!canRedo} onClick={redo}>
          <Redo2 size={20} />
        </button>

        <span className="mobile-dock-sep" aria-hidden />

        <button type="button" className="mobile-dock-btn" title="Alejar" onClick={onZoomOut}>
          <ZoomOut size={20} />
        </button>
        <button type="button" className="mobile-dock-btn mobile-dock-zoom" title="Zoom 100%" onClick={onZoomReset}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="mobile-dock-btn" title="Acercar" onClick={onZoomIn}>
          <ZoomIn size={20} />
        </button>

        <span className="mobile-dock-sep" aria-hidden />

        <button
          type="button"
          className={`mobile-dock-btn ${selectionCount > 0 ? 'has-selection' : ''}`}
          title="Propiedades"
          onClick={() => onOpenPanel(PANEL_SECTIONS.PROPERTIES)}
        >
          <SlidersHorizontal size={20} />
        </button>
        <button
          type="button"
          className="mobile-dock-btn"
          title="Capas e insertar"
          onClick={() => onOpenPanel(PANEL_SECTIONS.LAYERS)}
        >
          <Layers size={20} />
        </button>
        <button type="button" className="mobile-dock-btn" title="Menú completo" onClick={onOpenMenu}>
          <Menu size={20} />
        </button>
      </div>
    </nav>
  );
}
