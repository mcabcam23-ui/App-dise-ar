import { ChevronDown, ChevronUp } from 'lucide-react';

export default function AppChrome({
  collapsed,
  onToggleCollapsed,
  height,
  onResizeStart,
  resizerDragging,
  isCompact,
  staticHeader,
  children,
}) {
  return (
    <div
      className={`app-chrome ${collapsed ? 'is-collapsed' : ''} ${isCompact ? 'is-compact' : ''}`}
    >
      {staticHeader && <div className="app-chrome-static">{staticHeader}</div>}

      {!collapsed && (
        <>
          <div
            className="app-chrome-body"
            style={height != null ? { height } : undefined}
          >
            {children}
          </div>
          {!isCompact && (
            <div
              className={`chrome-resizer-h ${resizerDragging ? 'dragging' : ''}`}
              onMouseDown={onResizeStart}
              title="Arrastra para cambiar la altura de las herramientas"
              role="separator"
              aria-orientation="horizontal"
            />
          )}
        </>
      )}

      <button
        type="button"
        className="chrome-collapse-btn"
        title={collapsed ? 'Mostrar herramientas' : 'Ocultar herramientas'}
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
    </div>
  );
}
