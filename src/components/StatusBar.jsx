export default function StatusBar({ canvas, isCompact }) {
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
    bucket: 'Cubo (clic figura = relleno · vacío = fondo · Mayús = trazo)',
  };

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
        {isCompact
          ? '1 dedo = mover · 2 dedos = zoom donde pellizcas · ▲ = ocultar barra'
          : 'Ctrl+rueda zoom · Arrastra borde inferior de la barra para redimensionarla'}
      </span>
    </footer>
  );
}
