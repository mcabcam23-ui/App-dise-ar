import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { layerMatchesFilter, layerTypeIcon } from '../../utils/layerUtils';

const TYPE_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'line', label: 'Líneas' },
  { id: 'path', label: 'Trazos' },
  { id: 'textbox', label: 'Texto' },
  { id: 'image', label: 'Imágenes' },
  { id: 'group', label: 'Grupos' },
];

export default function LayersPanel({
  objects,
  selectedObject,
  selectionCount,
  selectObjectByRef,
  toggleObjectVisibility,
  toggleObjectLock,
  renameObject,
  duplicateObject,
  removeObject,
  moveLayer,
  reorderLayerToVisualIndex,
  setAllLayersVisibility,
  unlockAll,
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const layers = useMemo(() => [...objects].reverse(), [objects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return layers.filter((item) => {
      if (!layerMatchesFilter(item, typeFilter)) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q);
    });
  }, [layers, query, typeFilter]);

  const stats = useMemo(() => {
    const hidden = objects.filter((o) => !o.visible).length;
    const locked = objects.filter((o) => o.locked).length;
    return { total: objects.length, hidden, locked };
  }, [objects]);

  const startRename = (item, e) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.name);
  };

  const commitRename = (item) => {
    const name = editName.trim();
    if (name && name !== item.name) renameObject(item.object, name);
    setEditingId(null);
  };

  const onDragStart = (e, visualIndex) => {
    e.dataTransfer.setData('text/plain', String(visualIndex));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = (e, targetVisualIndex) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(from) || from === targetVisualIndex) return;
    const item = layers[from];
    if (item) reorderLayerToVisualIndex(item.object, targetVisualIndex);
  };

  return (
    <div className="panel-section layers-section">
      <div className="panel-section-head">
        <h3>Capas</h3>
        <span className="panel-badge">{stats.total}</span>
      </div>

      <div className="layer-toolbar">
        <label className="layer-search">
          <Search size={14} />
          <input
            type="search"
            placeholder="Buscar capa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="layer-filter-chips">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`layer-chip ${typeFilter === f.id ? 'active' : ''}`}
              onClick={() => setTypeFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="layer-bulk-actions">
          <button type="button" className="layer-bulk-btn" title="Mostrar todas" onClick={() => setAllLayersVisibility(true)}>
            <Eye size={13} /> Visible
          </button>
          <button type="button" className="layer-bulk-btn" title="Desbloquear todas" onClick={unlockAll}>
            <LockOpen size={13} /> Desbloquear
          </button>
        </div>
        <p className="layer-stats">
          {stats.hidden > 0 && `${stats.hidden} oculta${stats.hidden > 1 ? 's' : ''}`}
          {stats.hidden > 0 && stats.locked > 0 && ' · '}
          {stats.locked > 0 && `${stats.locked} bloqueada${stats.locked > 1 ? 's' : ''}`}
          {!stats.hidden && !stats.locked && `${selectionCount || 0} seleccionado${selectionCount === 1 ? '' : 's'}`}
        </p>
      </div>

      <ul className="layer-list advanced">
        {filtered.length === 0 && (
          <li className="layer-empty">No hay capas que coincidan</li>
        )}
        {filtered.map((item) => {
          const Icon = layerTypeIcon(item.type);
          const visualIndex = layers.findIndex((l) => l.id === item.id);
          const isSel = selectedObject === item.object;
          const isEditing = editingId === item.id;

          return (
            <li
              key={item.id}
              className={`layer-row ${isSel ? 'sel' : ''} ${item.locked ? 'locked' : ''} ${!item.visible ? 'hidden-layer' : ''}`}
              draggable={!isEditing}
              onDragStart={(e) => onDragStart(e, visualIndex)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, visualIndex)}
              onClick={() => !isEditing && selectObjectByRef(item.object)}
            >
              <span className="layer-drag-handle" title="Arrastra para reordenar">⋮⋮</span>
              <span className="layer-type-icon" title={item.type}>
                <Icon size={14} />
              </span>

              {isEditing ? (
                <input
                  className="layer-rename-input"
                  value={editName}
                  autoFocus
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitRename(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(item);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="layer-main">
                  <span className="layer-label">{item.name}</span>
                  <span className="layer-meta">{Math.round((item.opacity ?? 1) * 100)}%</span>
                </div>
              )}

              <div className="layer-btns">
                <button type="button" title="Renombrar" onClick={(e) => startRename(item, e)}>
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  title={item.locked ? 'Desbloquear' : 'Bloquear'}
                  onClick={(e) => { e.stopPropagation(); toggleObjectLock(item.object); }}
                >
                  {item.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                </button>
                <button
                  type="button"
                  title={item.visible ? 'Ocultar' : 'Mostrar'}
                  onClick={(e) => { e.stopPropagation(); toggleObjectVisibility(item.object); }}
                >
                  {item.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button type="button" title="Duplicar" onClick={(e) => { e.stopPropagation(); duplicateObject(item.object); }}>
                  <Copy size={12} />
                </button>
                <button type="button" title="Subir" onClick={(e) => { e.stopPropagation(); moveLayer(item.object, 'up'); }}>
                  <ArrowUp size={12} />
                </button>
                <button type="button" title="Bajar" onClick={(e) => { e.stopPropagation(); moveLayer(item.object, 'down'); }}>
                  <ArrowDown size={12} />
                </button>
                <button type="button" title="Al frente" onClick={(e) => { e.stopPropagation(); moveLayer(item.object, 'top'); }}>
                  <ChevronsUp size={12} />
                </button>
                <button type="button" title="Al fondo" onClick={(e) => { e.stopPropagation(); moveLayer(item.object, 'bottom'); }}>
                  <ChevronsDown size={12} />
                </button>
                <button type="button" title="Eliminar" className="danger" onClick={(e) => { e.stopPropagation(); removeObject(item.object); }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
