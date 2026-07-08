import { LayoutGrid, Menu, Plus } from 'lucide-react';
import { DOCK_TOOLS } from '../constants/toolGroups';

export default function MobileDock({
  tool,
  setTool,
  selectionCount,
  onOpenPanel,
  onOpenMenu,
  onOpenTools,
}) {
  return (
    <nav className="mobile-dock" aria-label="Herramientas principales">
      <div className="mobile-dock-row">
        {DOCK_TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={`mobile-dock-item ${tool === id ? 'active' : ''}`}
            aria-label={label}
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
          >
            <span className="mobile-dock-icon">
              <Icon size={22} strokeWidth={1.85} />
            </span>
            <span className="mobile-dock-label">{label}</span>
          </button>
        ))}

        <button
          type="button"
          className="mobile-dock-item mobile-dock-more"
          aria-label="Más herramientas y opciones"
          onClick={onOpenTools}
        >
          <span className="mobile-dock-icon">
            <Plus size={24} strokeWidth={2} />
          </span>
          <span className="mobile-dock-label">Más</span>
        </button>

        <button
          type="button"
          className={`mobile-dock-item ${selectionCount > 0 ? 'has-selection' : ''}`}
          aria-label={selectionCount > 0 ? 'Propiedades del elemento' : 'Panel de capas'}
          onClick={onOpenPanel}
        >
          <span className="mobile-dock-icon">
            <LayoutGrid size={22} strokeWidth={1.85} />
          </span>
          <span className="mobile-dock-label">Panel</span>
        </button>

        <button
          type="button"
          className="mobile-dock-item"
          aria-label="Menú completo"
          onClick={onOpenMenu}
        >
          <span className="mobile-dock-icon">
            <Menu size={22} strokeWidth={1.85} />
          </span>
          <span className="mobile-dock-label">Menú</span>
        </button>
      </div>
    </nav>
  );
}
