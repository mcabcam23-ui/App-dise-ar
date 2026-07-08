import { ChevronDown, ChevronUp } from 'lucide-react';

/** Barra superior colapsable: menú, herramientas y opciones del lienzo. */
export default function AppChrome({
  collapsed,
  onToggleCollapsed,
  height,
  onResizeStart,
  resizerDragging,
  isCompact,
  compactChromeNeeded = false,
  staticHeader,
  children,
}) {
  return (
    <div
      className={`app-chrome ${collapsed ? 'is-collapsed' : ''} ${isCompact ? 'is-compact' : ''}`}
    >
      {staticHeader && <div className="app-chrome-static">{staticHeader}</div>}

      {collapsed && isCompact && (
        <div className="app-chrome-collapsed-bar">
          <span className="app-chrome-collapsed-hint">
            {compactChromeNeeded
              ? 'Colores y opciones disponibles — toca la flecha'
              : 'Usa la barra inferior para empezar'}
          </span>
          {compactChromeNeeded && (
            <button type="button" className="chrome-mini-btn" onClick={onToggleCollapsed}>
              Mostrar barra
            </button>
          )}
        </div>
      )}

      {!collapsed && (
        <>
          <div
            className="app-chrome-body"
            style={height != null ? { maxHeight: height } : undefined}
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
        hidden={isCompact && !compactChromeNeeded}
      >
        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
    </div>
  );
}
