import { ChevronDown, ChevronUp, Save } from 'lucide-react';

export default function AppChrome({
  collapsed,
  onToggleCollapsed,
  height,
  onResizeStart,
  resizerDragging,
  isCompact,
  projectName,
  onSave,
  children,
}) {
  return (
    <div
      className={`app-chrome ${collapsed ? 'is-collapsed' : ''} ${isCompact ? 'is-compact' : ''}`}
      style={!collapsed && height != null ? { height } : undefined}
    >
      {collapsed ? (
        <div className="app-chrome-collapsed-bar">
          <span className="app-chrome-collapsed-title">Estudio</span>
          <span className="app-chrome-collapsed-doc">{projectName || 'Sin título'}</span>
          <button type="button" className="chrome-mini-btn" title="Guardar" onClick={onSave}>
            <Save size={16} />
          </button>
        </div>
      ) : (
        <div className="app-chrome-body">{children}</div>
      )}

      <button
        type="button"
        className="chrome-collapse-btn"
        title={collapsed ? 'Mostrar barra superior' : 'Ocultar barra superior'}
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      {!collapsed && !isCompact && (
        <div
          className={`chrome-resizer-h ${resizerDragging ? 'dragging' : ''}`}
          onMouseDown={onResizeStart}
          title="Arrastra para cambiar la altura de la barra"
          role="separator"
          aria-orientation="horizontal"
        />
      )}
    </div>
  );
}
