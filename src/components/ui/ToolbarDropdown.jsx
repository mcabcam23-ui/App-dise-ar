import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';

const DropCloseContext = createContext(null);

function useDropdownMenuPosition(open, rootRef, minWidth) {
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return undefined;
    }

    const canvasArea = document.querySelector('.canvas-area');
    const scrollSnapshot = canvasArea
      ? { top: canvasArea.scrollTop, left: canvasArea.scrollLeft }
      : null;

    const update = () => {
      const trigger = rootRef.current?.querySelector('.tb-drop-trigger');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(minWidth, rect.width);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      setPos({
        top: rect.bottom + 2,
        left,
        minWidth: width,
      });
    };

    update();
    window.addEventListener('resize', update);

    const guardScroll = () => {
      if (!canvasArea || !scrollSnapshot) return;
      if (canvasArea.scrollTop !== scrollSnapshot.top) canvasArea.scrollTop = scrollSnapshot.top;
      if (canvasArea.scrollLeft !== scrollSnapshot.left) canvasArea.scrollLeft = scrollSnapshot.left;
    };
    canvasArea?.addEventListener('scroll', guardScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', update);
      canvasArea?.removeEventListener('scroll', guardScroll);
    };
  }, [open, rootRef, minWidth]);

  return pos;
}

export function ToolbarDropdown({
  label,
  suffix,
  title,
  icon,
  iconOnly = false,
  className = '',
  menuClassName = '',
  minWidth = 168,
  children,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();
  const menuPos = useDropdownMenuPosition(open, rootRef, minWidth);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.tb-drop-menu-portal')) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu = open && menuPos ? (
    <DropCloseContext.Provider value={() => setOpen(false)}>
      <div
        id={menuId}
        className={`tb-drop-menu tb-drop-menu-portal ${menuClassName}`.trim()}
        style={{
          top: menuPos.top,
          left: menuPos.left,
          minWidth: menuPos.minWidth,
        }}
        role="menu"
      >
        {children}
      </div>
    </DropCloseContext.Provider>
  ) : null;

  return (
    <div className={`tb-drop ${open ? 'is-open' : ''} ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`tb-drop-trigger ${iconOnly ? 'icon-only' : ''}`}
        title={title || label}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {!iconOnly && <span className="tb-drop-label">{label}</span>}
        {!iconOnly && suffix && <span className="tb-drop-suffix">{suffix}</span>}
        <ChevronDown size={12} className="tb-drop-chevron" aria-hidden />
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}

export function DropMenuItem({ active, disabled, onClick, children, style }) {
  const close = useContext(DropCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      className={`tb-drop-item ${active ? 'active' : ''}`}
      disabled={disabled}
      style={style}
      onClick={(e) => {
        onClick?.(e);
        close?.();
      }}
    >
      {children}
    </button>
  );
}

export function DropMenuDivider() {
  return <div className="tb-drop-divider" role="separator" />;
}

export function DropMenuSection({ label, children }) {
  return (
    <div className="tb-drop-section">
      {label && <div className="tb-drop-section-label">{label}</div>}
      {children}
    </div>
  );
}

export function DropSubmenu({ label, children, minWidth = 200 }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`tb-drop-sub ${open ? 'is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button type="button" className="tb-drop-item tb-drop-item-sub" aria-haspopup="menu">
        <span>{label}</span>
        <ChevronRight size={12} aria-hidden />
      </button>
      {open && (
        <div className="tb-drop-submenu" style={{ minWidth }} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

export function DropMenuField({ label, children }) {
  return (
    <label className="tb-drop-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DropMenuFooter({ children }) {
  return <div className="tb-drop-footer">{children}</div>;
}
