export default function StatusBar({ canvas }) {
  const { selectionCount, selectedObject, objects, tool, pageSize, zoom, polylinePoints } = canvas;

  let selectionLabel = 'Nada seleccionado';
  if (selectionCount > 1) selectionLabel = `${selectionCount} elementos seleccionados`;
  else if (selectedObject) selectionLabel = selectedObject.name || selectedObject.type || 'Elemento';

  const toolNames = {
    select: 'Selección',
    pan: 'Mover vista (Espacio)',
    text: 'Texto',
    pen: 'Lápiz',
    rect: 'Rectángulo',
    circle: 'Círculo',
    line: 'Línea',
    polyline: polylinePoints > 0 ? `Multilínea (${polylinePoints} pts · clic der. terminar)` : 'Multilínea (clic puntos · clic der. terminar)',
    arrow: 'Flecha',
    image: 'Imagen',
    eyedropper: 'Cuentagotas (clic en hoja · Alt = otro destino)',
  };

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

  return (
    <footer className="status-bar">
      <span>{selectionLabel}</span>
      <span className="status-sep">|</span>
      <span>{objects.length} capas</span>
      <span className="status-sep">|</span>
      <span>{pageSize.label} · {Math.round(zoom * 100)}%</span>
      <span className="status-sep">|</span>
      <span>{toolNames[tool] || tool}</span>
      <span className="status-hint">
        {isTouch
          ? 'Pellizco = zoom · Panel = botón azul abajo derecha'
          : 'Ctrl+rueda zoom papel · Ctrl+C copiar · Shift+clic multiselección'}
      </span>
    </footer>
  );
}
