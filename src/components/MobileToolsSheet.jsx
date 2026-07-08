import {
  Copy,
  ClipboardPaste,
  Layers,
  LayoutTemplate,
  PackagePlus,
  Redo2,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
  ClipboardList,
} from 'lucide-react';
import { PANEL_SECTIONS } from '../constants/panelSections';
import { SHAPE_TOOLS, UTILITY_TOOLS } from '../constants/toolGroups';
import { TOOLS } from '../constants/pageSizes';

const PANEL_SHORTCUTS = [
  { id: PANEL_SECTIONS.LAYERS, icon: Layers, label: 'Capas' },
  { id: PANEL_SECTIONS.INSERT, icon: PackagePlus, label: 'Insertar' },
  { id: PANEL_SECTIONS.PROPERTIES, icon: SlidersHorizontal, label: 'Propiedades' },
  { id: PANEL_SECTIONS.PAGE, icon: LayoutTemplate, label: 'Página' },
  { id: PANEL_SECTIONS.DOCUMENT, icon: ClipboardList, label: 'Documento' },
];

function ToolGrid({ tools, tool, onPick }) {
  return (
    <div className="mobile-tools-grid">
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          className={`mobile-tool-chip ${tool === id ? 'active' : ''}`}
          onClick={() => onPick(id)}
        >
          <Icon size={22} strokeWidth={1.75} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function MobileToolsSheet({
  open,
  onClose,
  tool,
  setTool,
  onImagePick,
  selectionCount,
  canPaste,
  canUndo,
  canRedo,
  undo,
  redo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  copySelected,
  cutSelected,
  pasteClipboard,
  deleteSelected,
  onOpenPanel,
}) {
  if (!open) return null;

  const pick = (id) => {
    if (id === TOOLS.IMAGE) {
      onImagePick?.();
    } else {
      setTool(id);
    }
    onClose();
  };

  const openPanelSection = (section) => {
    onOpenPanel?.(section);
    onClose();
  };

  return (
    <>
      <button type="button" className="mobile-sheet-backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="mobile-tools-sheet" role="dialog" aria-modal="true" aria-label="Más opciones">
        <div className="mobile-sheet-head">
          <div>
            <strong>Más opciones</strong>
            <p className="mobile-sheet-sub">Formas, edición y paneles</p>
          </div>
          <button type="button" className="mobile-sheet-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="mobile-tools-scroll">
          <section className="mobile-tools-section">
            <h3>Formas</h3>
            <ToolGrid tools={SHAPE_TOOLS} tool={tool} onPick={pick} />
          </section>

          <section className="mobile-tools-section">
            <h3>Extras</h3>
            <ToolGrid tools={UTILITY_TOOLS} tool={tool} onPick={pick} />
          </section>

          <section className="mobile-tools-section">
            <h3>Editar</h3>
            <div className="mobile-tools-actions mobile-tools-actions-4">
              <button type="button" disabled={!canUndo} onClick={() => { undo(); onClose(); }}>
                <Undo2 size={18} />
                Deshacer
              </button>
              <button type="button" disabled={!canRedo} onClick={() => { redo(); onClose(); }}>
                <Redo2 size={18} />
                Rehacer
              </button>
              <button type="button" disabled={!selectionCount} onClick={() => { copySelected(); onClose(); }}>
                <Copy size={18} />
                Copiar
              </button>
              <button type="button" disabled={!canPaste} onClick={() => { pasteClipboard(); onClose(); }}>
                <ClipboardPaste size={18} />
                Pegar
              </button>
              <button type="button" disabled={!selectionCount} onClick={() => { cutSelected(); onClose(); }}>
                <Scissors size={18} />
                Cortar
              </button>
              <button type="button" disabled={!selectionCount} onClick={() => { deleteSelected(); onClose(); }}>
                <Trash2 size={18} />
                Eliminar
              </button>
            </div>
          </section>

          <section className="mobile-tools-section">
            <h3>Zoom</h3>
            <div className="mobile-tools-zoom">
              <button type="button" onClick={onZoomOut} aria-label="Alejar">
                <ZoomOut size={20} />
              </button>
              <button type="button" className="mobile-tools-zoom-value" onClick={onZoomReset}>
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={onZoomIn} aria-label="Acercar">
                <ZoomIn size={20} />
              </button>
            </div>
          </section>

          <section className="mobile-tools-section">
            <h3>Paneles</h3>
            <div className="mobile-panel-chips">
              {PANEL_SHORTCUTS.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`mobile-panel-chip ${id === PANEL_SECTIONS.PROPERTIES && selectionCount > 0 ? 'highlight' : ''}`}
                  onClick={() => openPanelSection(id)}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
