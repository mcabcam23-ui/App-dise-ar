import { ERASER_MODE_OPTIONS, TEXT_MODE_OPTIONS } from '../constants/toolModes';
import { TOOLS } from '../constants/pageSizes';
import SnapQuickToggles from './SnapQuickToggles';

export default function StatusBar({ canvas, displayZoom, isCompact }) {
  const {
    selectionCount,
    selectedObject,
    objects,
    tool,
    textMode,
    eraserMode,
    pageSize,
    zoom,
    polylinePoints,
    sheets,
    activeSheetId,
    settings,
    updateSetting,
  } = canvas;

  const activeSheet = sheets?.find((sheet) => sheet.id === activeSheetId);

  const zoomLevel = displayZoom ?? zoom;

  let selectionLabel = 'Nada seleccionado';
  if (selectionCount > 1) selectionLabel = `${selectionCount} elementos seleccionados`;
  else if (selectedObject) selectionLabel = selectedObject.name || selectedObject.type || 'Elemento';

  let toolLabel = tool;
  if (tool === TOOLS.TEXT) {
    toolLabel = TEXT_MODE_OPTIONS.find((m) => m.id === textMode)?.label ?? 'Texto';
  } else if (tool === TOOLS.ERASER) {
    toolLabel = ERASER_MODE_OPTIONS.find((m) => m.id === eraserMode)?.label ?? 'Borrador';
  } else {
    const toolNames = {
      select: 'Selección',
      pan: 'Mover vista (Espacio)',
      pen: 'Lápiz',
      rect: 'Rectángulo',
      circle: 'Círculo',
      line: 'Línea',
      polyline: polylinePoints > 0
        ? (isCompact
          ? `Multilínea (${polylinePoints} pts · Terminar abajo)`
          : `Multilínea (${polylinePoints} pts · clic der. terminar)`)
        : (isCompact
          ? 'Multilínea (toca puntos · Terminar abajo)'
          : 'Multilínea (clic puntos · clic der. terminar)'),
      arrow: 'Flecha',
      image: 'Imagen',
      eyedropper: 'Cuentagotas (clic en hoja · Alt = otro destino)',
      bucket: 'Cubo (clic figura = relleno · vacío = fondo)',
    };
    const toolNamesCompact = {
      select: 'Selección',
      pan: 'Mover',
      pen: 'Lápiz',
      rect: 'Rectángulo',
      circle: 'Círculo',
      line: 'Línea',
      polyline: polylinePoints > 0 ? `Multilínea (${polylinePoints} · Terminar)` : 'Multilínea',
      arrow: 'Flecha',
      image: 'Imagen',
      eyedropper: 'Cuentagotas',
      bucket: 'Cubo',
    };
    toolLabel = (isCompact ? toolNamesCompact : toolNames)[tool] || tool;
  }

  let modeHint = '';
  if (tool === TOOLS.TEXT) {
    modeHint = TEXT_MODE_OPTIONS.find((m) => m.id === textMode)?.hint ?? '';
  } else if (tool === TOOLS.ERASER) {
    modeHint = ERASER_MODE_OPTIONS.find((m) => m.id === eraserMode)?.hint ?? '';
  }

  return (
    <footer className={`status-bar ${isCompact ? 'is-compact' : ''}`}>
      <div className="status-bar-main">
        <span>{selectionLabel}</span>
        <span className="status-sep">|</span>
        <span>{objects.length} capas</span>
        <span className="status-sep">|</span>
        <span>{pageSize.label} · {Math.round(zoomLevel * 100)}%</span>
        {activeSheet && (
          <>
            <span className="status-sep">|</span>
            <span>{activeSheet.name}</span>
          </>
        )}
        <span className="status-sep">|</span>
        <span>{toolLabel}</span>
      </div>
      <div className="status-bar-right">
        <span className="status-hint">
          {modeHint || (isCompact
            ? (tool === 'select' && selectionCount === 0
              ? 'Toca una herramienta abajo para empezar · desliza para mover la hoja'
              : 'Desliza = mover · pellizca = zoom · mantén pulsado = menú')
            : 'Ctrl+rueda = zoom · Rueda = subir/bajar · Alt+rueda = laterales · Espacio = mover vista')}
        </span>
        <SnapQuickToggles
          settings={settings}
          updateSetting={updateSetting}
          compact={isCompact}
        />
      </div>
    </footer>
  );
}
