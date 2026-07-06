import {
  ArrowRight,
  Circle,
  Copy,
  Hand,
  ImagePlus,
  Minus,
  MousePointer2,
  Pencil,
  Pipette,
  Redo2,
  Scissors,
  Square,
  Trash2,
  Type,
  Undo2,
  ClipboardPaste,
  Waypoints,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { TOOLS } from '../constants/pageSizes';
import ColorPalette from './ColorPalette';

const TOOLS_ROW = [
  { id: TOOLS.SELECT, icon: MousePointer2, label: 'Seleccionar', key: 'V' },
  { id: TOOLS.PAN, icon: Hand, label: 'Mover vista', key: 'H' },
  { id: TOOLS.EYEDROPPER, icon: Pipette, label: 'Cuentagotas', key: 'I' },
  { id: TOOLS.TEXT, icon: Type, label: 'Texto', key: 'T' },
  { id: TOOLS.PEN, icon: Pencil, label: 'Lápiz', key: 'P' },
  { id: TOOLS.RECT, icon: Square, label: 'Rectángulo' },
  { id: TOOLS.CIRCLE, icon: Circle, label: 'Círculo' },
  { id: TOOLS.LINE, icon: Minus, label: 'Línea' },
  { id: TOOLS.POLYLINE, icon: Waypoints, label: 'Multilínea', key: 'M' },
  { id: TOOLS.ARROW, icon: ArrowRight, label: 'Flecha' },
  { id: TOOLS.IMAGE, icon: ImagePlus, label: 'Imagen' },
];

export default function TopToolbar({
  tool,
  setTool,
  strokeColor,
  setStrokeColor,
  fillColor,
  setFillColor,
  strokeWidth,
  setStrokeWidth,
  colorTarget,
  setColorTarget,
  savedColors,
  applyColorToTarget,
  saveColorToPalette,
  removeSavedColor,
  canUndo,
  canRedo,
  canPaste,
  selectionCount,
  undo,
  redo,
  copySelected,
  cutSelected,
  pasteClipboard,
  deleteSelected,
  addText,
  onImagePick,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) {
  const pick = (id) => {
    if (id === TOOLS.TEXT) {
      addText();
      setTool(TOOLS.SELECT);
      return;
    }
    if (id === TOOLS.IMAGE) {
      onImagePick();
      return;
    }
    setTool(id);
  };

  return (
    <div className="top-toolbar">
      <div className="top-toolbar-main">
      <div className="tb-group">
        <button type="button" className="tb-btn" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={17} />
        </button>
        <button type="button" className="tb-btn" title="Rehacer (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={17} />
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group">
        <button type="button" className="tb-btn" title="Cortar (Ctrl+X)" disabled={!selectionCount} onClick={cutSelected}>
          <Scissors size={17} />
        </button>
        <button type="button" className="tb-btn" title="Copiar (Ctrl+C)" disabled={!selectionCount} onClick={copySelected}>
          <Copy size={17} />
        </button>
        <button type="button" className="tb-btn" title="Pegar (Ctrl+V)" disabled={!canPaste} onClick={pasteClipboard}>
          <ClipboardPaste size={17} />
        </button>
        <button type="button" className="tb-btn" title="Eliminar (Supr)" disabled={!selectionCount} onClick={deleteSelected}>
          <Trash2 size={17} />
        </button>
      </div>

      <div className="tb-divider" />

      <div className="tb-group tools-row">
        {TOOLS_ROW.map(({ id, icon: Icon, label, key }) => (
          <button
            key={id}
            type="button"
            className={`tb-btn tool ${tool === id ? 'active' : ''}`}
            title={key ? `${label} (${key})` : label}
            onClick={() => pick(id)}
          >
            <Icon size={17} />
          </button>
        ))}
      </div>

      <div className="tb-divider" />

      <div className="tb-group colors">
        <label className="color-swatch" title="Color de trazo">
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => {
              setColorTarget('stroke');
              setStrokeColor(e.target.value);
            }}
          />
          <span>Trazo</span>
        </label>
        <label className="color-swatch" title="Color de relleno">
          <input
            type="color"
            value={fillColor === 'transparent' ? '#ffffff' : fillColor}
            onChange={(e) => {
              setColorTarget('fill');
              setFillColor(e.target.value);
            }}
          />
          <span>Relleno</span>
        </label>
        <button
          type="button"
          className={`tb-text-btn ${fillColor === 'transparent' ? 'on' : ''}`}
          onClick={() => setFillColor(fillColor === 'transparent' ? '#f0f0f0' : 'transparent')}
        >
          Sin relleno
        </button>
        <label className="stroke-size">
          <span>{strokeWidth}px</span>
          <input type="range" min={1} max={40} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
        </label>
      </div>

      <div className="tb-divider" />

      <div className="tb-group zoom-group">
        <button type="button" className="tb-btn" title="Alejar (Ctrl+rueda)" onClick={onZoomOut}>
          <ZoomOut size={17} />
        </button>
        <button type="button" className="tb-btn zoom-label" title="Zoom 100%" onClick={onZoomReset}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="tb-btn" title="Acercar (Ctrl+rueda)" onClick={onZoomIn}>
          <ZoomIn size={17} />
        </button>
      </div>
      </div>

      <div className="top-toolbar-palette">
        <ColorPalette
          savedColors={savedColors}
          colorTarget={colorTarget}
          setColorTarget={setColorTarget}
          strokeColor={strokeColor}
          fillColor={fillColor}
          onApplyColor={applyColorToTarget}
          onSaveColor={saveColorToPalette}
          onRemoveColor={removeSavedColor}
        />
      </div>
    </div>
  );
}
