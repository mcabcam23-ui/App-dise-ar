import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MENU_GROUPS, MENU_GROUP_LABELS } from '../constants/menuActions';

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

export default function MenuBar({ canvas, handlers, isCompact = false }) {
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

  if (isCompact) return null;

  return (
    <nav className="menu-bar" ref={barRef}>
      {Object.entries(MENU_GROUPS).map(([key, items]) => (
        <div key={key} className={`menu-root ${open === key ? 'open' : ''}`}>
          <button
            type="button"
            className="menu-trigger"
            ref={(el) => {
              triggerRefs.current[key] = el;
            }}
            onClick={() => setOpen(open === key ? null : key)}
          >
            {MENU_GROUP_LABELS[key] ?? key}
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
