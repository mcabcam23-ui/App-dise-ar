import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveAssetUrl } from '../utils/assetUrl';
import {
  formatSignalTypeLabel,
  getSignalTypeBaseId,
  getSwappableSignalTypes,
} from '../utils/presetVariants';

function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.categoryLabel)) groups.set(item.categoryLabel, []);
    groups.get(item.categoryLabel).push(item);
  }
  return [...groups.entries()].map(([label, entries]) => ({ label, entries }));
}

export default function SignalTypePicker({ presetId, onChange }) {
  const types = getSwappableSignalTypes(presetId);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const rootRef = useRef(null);
  const menuId = useId();

  const currentTypeId = getSignalTypeBaseId(presetId);
  const current =
    types.find((item) => item.preset.id === currentTypeId) ?? types[0];
  const categories = groupByCategory(types);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return undefined;
    }

    const canvasArea = document.querySelector('.canvas-area');
    const scrollSnapshot = canvasArea
      ? { top: canvasArea.scrollTop, left: canvasArea.scrollLeft }
      : null;

    const update = () => {
      const trigger = rootRef.current?.querySelector('.signal-type-trigger');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(420, Math.max(280, rect.width));
      let left = rect.left;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      setMenuPos({
        top: rect.bottom + 4,
        left,
        width,
      });
    };

    update();
    window.addEventListener('resize', update);

    const guardScroll = () => {
      if (!canvasArea || !scrollSnapshot) return;
      if (canvasArea.scrollTop !== scrollSnapshot.top) {
        canvasArea.scrollTop = scrollSnapshot.top;
      }
      if (canvasArea.scrollLeft !== scrollSnapshot.left) {
        canvasArea.scrollLeft = scrollSnapshot.left;
      }
    };
    canvasArea?.addEventListener('scroll', guardScroll, { passive: true });

    return () => {
      window.removeEventListener('resize', update);
      canvasArea?.removeEventListener('scroll', guardScroll);
      if (scrollSnapshot && canvasArea) {
        canvasArea.scrollTop = scrollSnapshot.top;
        canvasArea.scrollLeft = scrollSnapshot.left;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.signal-type-drop-portal')) return;
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

  if (types.length <= 1) return null;

  const pickType = (item) => {
    if (item.preset.id !== currentTypeId) onChange(item.preset.id);
    setOpen(false);
  };

  const menu = open && menuPos
    ? createPortal(
        <div
          id={menuId}
          className="signal-type-drop-portal"
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            zIndex: 1000,
          }}
          role="listbox"
          aria-label="Tipo de señal"
        >
          {categories.map((cat) => (
            <div key={cat.label} className="signal-type-cat">
              <div className="signal-type-cat-title">{cat.label}</div>
              <div className="signal-type-grid">
                {cat.entries.map((item) => {
                  const selected = item.preset.id === currentTypeId;
                  return (
                    <button
                      key={item.preset.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`signal-type-option ${selected ? 'sel' : ''}`}
                      title={formatSignalTypeLabel(item)}
                      onClick={() => pickType(item)}
                    >
                      <span className="signal-aspect-thumb">
                        <img
                          src={resolveAssetUrl(item.preset.imageAsset)}
                          alt=""
                          loading="lazy"
                        />
                      </span>
                      <span className="signal-type-option-label">{item.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="signal-type-picker" ref={rootRef}>
      <span className="signal-aspect-label">Tipo de señal</span>
      <button
        type="button"
        className="signal-type-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="signal-aspect-thumb">
          <img src={resolveAssetUrl(current.preset.imageAsset)} alt="" />
        </span>
        <span className="signal-type-trigger-text">
          <span className="signal-type-trigger-name">{current.shortLabel}</span>
          <span className="signal-type-trigger-meta">{current.categoryLabel}</span>
        </span>
        <span className="signal-type-caret" aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {menu}
    </div>
  );
}
