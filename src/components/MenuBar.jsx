import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENUS = {
  archivo: [
    { label: 'Nuevo', action: 'new' },
    { label: 'Guardar', shortcut: 'Ctrl+S', action: 'save' },
    { sep: true },
    { label: 'Abrir proyecto…', action: 'openProjects' },
    { label: 'Importar .json…', action: 'importJson' },
    { sep: true },
    { label: 'Exportar PNG…', action: 'exportPng' },
    { label: 'Exportar JPEG…', action: 'exportJpeg' },
    { label: 'Exportar WebP…', action: 'exportWebp' },
    { label: 'Exportar SVG…', action: 'exportSvg' },
    { label: 'Exportar PDF…', action: 'exportPdf' },
    { sep: true },
    { label: 'Exportar proyecto (.json)…', action: 'exportJson' },
  ],
  editar: [
    { label: 'Deshacer', shortcut: 'Ctrl+Z', action: 'undo', disabled: (c) => !c.canUndo },
    { label: 'Rehacer', shortcut: 'Ctrl+Y', action: 'redo', disabled: (c) => !c.canRedo },
    { sep: true },
    { label: 'Cortar', shortcut: 'Ctrl+X', action: 'cut', disabled: (c) => !c.selectionCount },
    { label: 'Copiar', shortcut: 'Ctrl+C', action: 'copy', disabled: (c) => !c.selectionCount },
    { label: 'Pegar', shortcut: 'Ctrl+V', action: 'paste', disabled: (c) => !c.canPaste },
    { label: 'Duplicar', shortcut: 'Ctrl+D', action: 'duplicate', disabled: (c) => !c.selectionCount },
    { sep: true },
    { label: 'Seleccionar todo', shortcut: 'Ctrl+A', action: 'selectAll' },
    { label: 'Eliminar', shortcut: 'Supr', action: 'delete', disabled: (c) => !c.selectionCount },
    { label: 'Vaciar lienzo', action: 'clearAll' },
    { sep: true },
    { label: 'Agrupar', shortcut: 'Ctrl+G', action: 'group', disabled: (c) => c.selectionCount < 2 },
    { label: 'Desagrupar', shortcut: 'Ctrl+Shift+G', action: 'ungroup', disabled: (c) => c.selectedObject?.type !== 'group' },
    { label: 'Bloquear selección', action: 'lock', disabled: (c) => !c.selectionCount },
    { label: 'Desbloquear todo', action: 'unlock' },
  ],
  ver: [
    { label: 'Acercar', action: 'zoomIn' },
    { label: 'Alejar', action: 'zoomOut' },
    { label: 'Zoom 100%', action: 'zoomReset' },
    { label: 'Ajustar a ventana', action: 'zoomFit' },
  ],
  insertar: [
    { label: 'Texto', shortcut: 'T', action: 'addText' },
    { label: 'Imagen…', action: 'addImage' },
    { label: 'Rectángulo', action: 'toolRect' },
    { label: 'Círculo', action: 'toolCircle' },
    { label: 'Línea', action: 'toolLine' },
    { label: 'Multilínea', shortcut: 'M', action: 'toolPolyline' },
    { label: 'Flecha', action: 'toolArrow' },
  ],
  formato: [
    { label: 'Alinear izquierda', action: 'alignLeft', disabled: (c) => c.selectionCount < 2 },
    { label: 'Centrar horizontal', action: 'alignCenterH', disabled: (c) => c.selectionCount < 2 },
    { label: 'Alinear derecha', action: 'alignRight', disabled: (c) => c.selectionCount < 2 },
    { sep: true },
    { label: 'Alinear arriba', action: 'alignTop', disabled: (c) => c.selectionCount < 2 },
    { label: 'Centrar vertical', action: 'alignCenterV', disabled: (c) => c.selectionCount < 2 },
    { label: 'Alinear abajo', action: 'alignBottom', disabled: (c) => c.selectionCount < 2 },
    { sep: true },
    { label: 'Traer al frente', action: 'front', disabled: (c) => !c.selectionCount },
    { label: 'Enviar al fondo', action: 'back', disabled: (c) => !c.selectionCount },
  ],
};

function MenuDropdown({ menuKey, triggerRefs, open, children }) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }

    const update = () => {
      const trigger = triggerRefs.current[menuKey];
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPos({ top: rect.bottom, left: rect.left });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, menuKey, triggerRefs]);

  if (!open || !pos) return null;

  return createPortal(
    <ul
      className="menu-drop menu-drop-portal"
      style={{ top: pos.top, left: pos.left }}
    >
      {children}
    </ul>,
    document.body,
  );
}

export default function MenuBar({ canvas, handlers }) {
  const [open, setOpen] = useState(null);
  const barRef = useRef(null);
  const triggerRefs = useRef({});

  useEffect(() => {
    const close = (e) => {
      if (barRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.menu-drop-portal')) return;
      setOpen(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const run = (action) => {
    handlers[action]?.();
    setOpen(null);
  };

  return (
    <nav className="menu-bar" ref={barRef}>
      {Object.entries(MENUS).map(([key, items]) => (
        <div key={key} className={`menu-root ${open === key ? 'open' : ''}`}>
          <button
            type="button"
            className="menu-trigger"
            ref={(el) => {
              triggerRefs.current[key] = el;
            }}
            onClick={() => setOpen(open === key ? null : key)}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
          <MenuDropdown menuKey={key} triggerRefs={triggerRefs} open={open === key}>
            {items.map((item, i) =>
              item.sep ? (
                <li key={`s-${i}`} className="menu-sep" />
              ) : (
                <li key={item.label}>
                  <button
                    type="button"
                    disabled={item.disabled?.(canvas)}
                    onClick={() => run(item.action)}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <kbd>{item.shortcut}</kbd>}
                  </button>
                </li>
              ),
            )}
          </MenuDropdown>
        </div>
      ))}
    </nav>
  );
}
