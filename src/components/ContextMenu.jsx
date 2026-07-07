import { PAGE_SIZES, TOOLS } from '../constants/pageSizes';

export default function ContextMenu({ menu, canvas, onClose, isCompact = false }) {
  if (!menu) return null;

  const run = (fn) => {
    fn();
    onClose();
  };

  const hasSelection = canvas.selectionCount > 0;
  const isGroup = canvas.selectedObject?.type === 'group';
  const isMulti = canvas.selectionCount > 1;

  const items = [
    { label: 'Cortar', shortcut: 'Ctrl+X', disabled: !hasSelection, action: () => run(canvas.cutSelected) },
    { label: 'Copiar', shortcut: 'Ctrl+C', disabled: !hasSelection, action: () => run(canvas.copySelected) },
    { label: 'Pegar', shortcut: 'Ctrl+V', disabled: !canvas.canPaste, action: () => run(canvas.pasteClipboard) },
    { label: 'Duplicar', shortcut: 'Ctrl+D', disabled: !hasSelection, action: () => run(canvas.duplicateSelected) },
    { sep: true },
    { label: 'Seleccionar todo', shortcut: 'Ctrl+A', action: () => run(canvas.selectAll) },
    { label: 'Deseleccionar', shortcut: 'Esc', disabled: !hasSelection, action: () => run(canvas.deselectAll) },
    { sep: true },
    { label: 'Traer al frente', disabled: !hasSelection, action: () => run(canvas.bringToFront) },
    { label: 'Enviar al fondo', disabled: !hasSelection, action: () => run(canvas.sendToBack) },
    { label: 'Subir capa', disabled: !hasSelection, action: () => run(canvas.bringForward) },
    { label: 'Bajar capa', disabled: !hasSelection, action: () => run(canvas.sendBackward) },
    { sep: true },
    { label: 'Agrupar', shortcut: 'Ctrl+G', disabled: !isMulti, action: () => run(canvas.groupSelected) },
    { label: 'Desagrupar', shortcut: 'Ctrl+Shift+G', disabled: !isGroup, action: () => run(canvas.ungroupSelected) },
    { label: 'Bloquear', disabled: !hasSelection, action: () => run(canvas.lockSelected) },
    { label: 'Desbloquear todo', action: () => run(canvas.unlockAll) },
    { sep: true },
    { label: 'Eliminar', shortcut: 'Supr', disabled: !hasSelection, danger: true, action: () => run(canvas.deleteSelected) },
    { label: 'Vaciar lienzo', danger: true, action: () => run(() => { if (window.confirm('¿Vaciar todo el lienzo?')) canvas.deleteAll(); }) },
  ];

  return (
    <>
      <div className="ctx-backdrop" onClick={onClose} onContextMenu={(e) => e.preventDefault()} />
      <ul className={`ctx-menu ${isCompact ? 'ctx-menu-compact' : ''}`} style={isCompact ? undefined : { left: menu.x, top: menu.y }}>
        {items.map((item, i) =>
          item.sep ? (
            <li key={`sep-${i}`} className="ctx-sep" />
          ) : (
            <li key={item.label}>
              <button type="button" disabled={item.disabled} className={item.danger ? 'danger' : ''} onClick={item.action}>
                <span>{item.label}</span>
                {!isCompact && item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            </li>
          ),
        )}
      </ul>
    </>
  );
}

export { TOOLS, PAGE_SIZES };
