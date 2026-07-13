import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function SheetTabsBar({
  sheets,
  activeSheetId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  isCompact = false,
  className = '',
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const startRename = (sheet) => {
    setEditingId(sheet.id);
    setEditValue(sheet.name);
  };

  const commitRename = () => {
    if (editingId) onRename?.(editingId, editValue);
    setEditingId(null);
    setEditValue('');
  };

  if (!sheets?.length) return null;

  return (
    <div className={`sheet-tabs-bar ${isCompact ? 'is-compact' : ''} ${className}`.trim()} role="tablist" aria-label="Hojas del documento">
      <div className="sheet-tabs-scroll">
        {sheets.map((sheet) => {
          const active = sheet.id === activeSheetId;
          const editing = editingId === sheet.id;
          return (
            <div
              key={sheet.id}
              className={`sheet-tab ${active ? 'active' : ''}`}
              role="presentation"
            >
              {editing ? (
                <input
                  className="sheet-tab-input"
                  value={editValue}
                  autoFocus
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditValue('');
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="sheet-tab-btn"
                  title={sheet.name}
                  onClick={() => onSelect?.(sheet.id)}
                  onDoubleClick={() => startRename(sheet)}
                >
                  {sheet.name}
                </button>
              )}
              {sheets.length > 1 && !editing && (
                <button
                  type="button"
                  className="sheet-tab-close"
                  aria-label={`Quitar ${sheet.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove?.(sheet.id);
                  }}
                >
                  <X size={12} strokeWidth={2.25} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="sheet-tab-add"
          aria-label="Añadir hoja"
          title="Añadir hoja"
          onClick={() => onAdd?.()}
        >
          <Plus size={15} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
