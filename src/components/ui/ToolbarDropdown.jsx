import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const DropCloseContext = createContext(null);

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

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
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
      {open && (
        <DropCloseContext.Provider value={() => setOpen(false)}>
          <div
            id={menuId}
            className={`tb-drop-menu ${menuClassName}`.trim()}
            style={{ minWidth }}
            role="menu"
          >
            {children}
          </div>
        </DropCloseContext.Provider>
      )}
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
