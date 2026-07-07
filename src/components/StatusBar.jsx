import { ERASER_MODE_OPTIONS, TEXT_MODE_OPTIONS } from '../constants/toolModes';
import { TOOLS } from '../constants/pageSizes';

export default function StatusBar({ canvas, isCompact }) {
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
  } = canvas;

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
        ? `Multilínea (${polylinePoints} pts · clic der. terminar)`
        : 'Multilínea (clic puntos · clic der. terminar)',
      arrow: 'Flecha',
      image: 'Imagen',
      eyedropper: 'Cuentagotas (clic en hoja · Alt = otro destino)',
      bucket: 'Cubo (clic figura = relleno · vacío = fondo · Mayús = trazo)',
    };
    toolLabel = toolNames[tool] || tool;
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
        <span>{pageSize.label} · {Math.round(zoom * 100)}%</span>
        <span className="status-sep">|</span>
        <span>{toolLabel}</span>
      </div>
      <span className="status-hint">
        {modeHint || (isCompact
          ? '1 dedo = mover vista · 2 dedos = zoom · Mantén pulsado = menú contextual · Barra inferior = herramientas'
          : 'Ctrl+rueda zoom · Arrastra borde inferior de la barra para redimensionarla')}
      </span>
    </footer>
  );
}
