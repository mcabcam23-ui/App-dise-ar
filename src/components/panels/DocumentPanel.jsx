export default function DocumentPanel({
  objects,
  selectionCount,
  unlockAll,
  clearAllContent,
  duplicateSelected,
  groupSelected,
  ungroupSelected,
  deselectAll,
  removeHiddenLayers,
}) {
  const hidden = objects.filter((o) => !o.visible).length;
  const locked = objects.filter((o) => o.locked).length;
  const visible = objects.length - hidden;

  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <h3>Documento</h3>
      </div>

      <div className="doc-stats">
        <div className="doc-stat">
          <span className="doc-stat-value">{objects.length}</span>
          <span className="doc-stat-label">Capas totales</span>
        </div>
        <div className="doc-stat">
          <span className="doc-stat-value">{visible}</span>
          <span className="doc-stat-label">Visibles</span>
        </div>
        <div className="doc-stat">
          <span className="doc-stat-value">{selectionCount}</span>
          <span className="doc-stat-label">Selección</span>
        </div>
      </div>

      <h4 className="panel-subheading">Acciones rápidas</h4>
      <div className="doc-actions">
        <button type="button" className="btn-block" onClick={duplicateSelected} disabled={selectionCount === 0}>
          Duplicar selección
        </button>
        <button type="button" className="btn-block" onClick={groupSelected} disabled={selectionCount < 2}>
          Agrupar selección
        </button>
        <button type="button" className="btn-block" onClick={ungroupSelected} disabled={selectionCount !== 1}>
          Desagrupar
        </button>
        <button type="button" className="btn-block" onClick={deselectAll}>
          Quitar selección
        </button>
        <button type="button" className="btn-block" onClick={unlockAll} disabled={locked === 0}>
          Desbloquear todas ({locked})
        </button>
        <button type="button" className="btn-block" onClick={removeHiddenLayers} disabled={hidden === 0}>
          Eliminar capas ocultas ({hidden})
        </button>
        <button
          type="button"
          className="btn-block danger-block"
          onClick={() => {
            if (window.confirm('¿Vaciar todo el contenido de la hoja? Se conservan el fondo y las guías.')) {
              clearAllContent();
            }
          }}
          disabled={objects.length === 0}
        >
          Vaciar lienzo
        </button>
      </div>

      <h4 className="panel-subheading">Atajos útiles</h4>
      <ul className="doc-shortcuts">
        <li><kbd>V</kbd> Seleccionar</li>
        <li><kbd>T</kbd> Texto</li>
        <li><kbd>E</kbd> Borrador</li>
        <li><kbd>Ctrl+Z</kbd> Deshacer</li>
        <li><kbd>Ctrl+D</kbd> Duplicar</li>
        <li><kbd>Supr</kbd> Eliminar</li>
      </ul>
    </div>
  );
}
