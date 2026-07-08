import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal } from 'lucide-react';

const STORAGE_KEY = 'eraser-size-panel-pos';
const PANEL_W = 240;

function readStoredPos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function clampPos(x, y) {
  const maxX = Math.max(8, window.innerWidth - PANEL_W - 8);
  const maxY = Math.max(8, window.innerHeight - 120);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

export default function EraserSizeFloatingPanel({ size, onChange, anchorRef }) {
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const posRef = useRef(null);
  const [pos, setPos] = useState(null);
  const [localSize, setLocalSize] = useState(size);

  useEffect(() => {
    setLocalSize(size);
  }, [size]);

  const setPanelPos = useCallback((next) => {
    posRef.current = next;
    setPos(next);
  }, []);

  useLayoutEffect(() => {
    const stored = readStoredPos();
    if (stored) {
      setPanelPos(clampPos(stored.x, stored.y));
      return;
    }
    const anchor = anchorRef?.current;
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      setPanelPos(clampPos(rect.left, rect.bottom + 8));
      return;
    }
    setPanelPos(clampPos(16, 120));
  }, [anchorRef, setPanelPos]);

  const persistPos = useCallback((next) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const onHeaderPointerDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos?.x ?? 0,
      origY: pos?.y ?? 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onHeaderPointerMove = (e) => {
    if (!dragRef.current) return;
    const next = clampPos(
      dragRef.current.origX + e.clientX - dragRef.current.startX,
      dragRef.current.origY + e.clientY - dragRef.current.startY,
    );
    dragRef.current.lastPos = next;
    setPanelPos(next);
  };

  const onHeaderPointerUp = (e) => {
    if (!dragRef.current) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const saved = dragRef.current.lastPos ?? posRef.current;
    dragRef.current = null;
    if (saved) persistPos(saved);
  };

  const onSliderInput = (e) => {
    const next = Number(e.target.value);
    setLocalSize(next);
    onChange(next);
  };

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="eraser-size-float"
      style={{ left: pos.x, top: pos.y, width: PANEL_W }}
      role="dialog"
      aria-label="Tamaño de la goma"
    >
      <div
        className="eraser-size-float-head"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <GripHorizontal size={16} strokeWidth={2} aria-hidden />
        <span>Tamaño de la goma</span>
      </div>
      <div className="eraser-size-float-body">
        <label className="eraser-size-float-control">
          <span className="eraser-size-float-value">{localSize}px</span>
          <input
            type="range"
            min={4}
            max={80}
            value={localSize}
            onChange={onSliderInput}
            onInput={onSliderInput}
          />
        </label>
      </div>
    </div>,
    document.body,
  );
}
