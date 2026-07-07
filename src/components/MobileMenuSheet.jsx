import { X } from 'lucide-react';
import { MENU_GROUP_LABELS, MENU_GROUPS } from '../constants/menuActions';

export default function MobileMenuSheet({ open, onClose, canvas, handlers }) {
  if (!open) return null;

  const run = (action) => {
    handlers[action]?.();
    onClose();
  };

  return (
    <>
      <button type="button" className="mobile-sheet-backdrop" aria-label="Cerrar menú" onClick={onClose} />
      <div className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-label="Menú">
        <div className="mobile-sheet-head">
          <strong>Menú</strong>
          <button type="button" className="mobile-sheet-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="mobile-menu-scroll">
          {Object.entries(MENU_GROUPS).map(([key, items]) => (
            <section key={key} className="mobile-menu-section">
              <h3>{MENU_GROUP_LABELS[key] ?? key}</h3>
              <ul>
                {items.map((item, i) =>
                  item.sep ? (
                    <li key={`sep-${key}-${i}`} className="mobile-menu-sep" aria-hidden />
                  ) : (
                    <li key={item.label}>
                      <button
                        type="button"
                        disabled={item.disabled?.(canvas)}
                        onClick={() => run(item.action)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
