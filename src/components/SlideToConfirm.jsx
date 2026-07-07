import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

const THRESHOLD = 0.88;
const RESET_MS = 320;

function readMaxTravel(track, thumb, pad) {
  if (!track || !thumb) return 0;
  return Math.max(0, track.clientWidth - thumb.offsetWidth - pad * 2);
}

export default function SlideToConfirm({
  label,
  disabled,
  disabledHint,
  onConfirm,
  compact = false,
}) {
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const pad = compact ? 3 : 4;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startOffset: 0, max: 0 });
  const offsetRef = useRef(0);

  const setSlideOffset = useCallback((value) => {
    const next = Math.max(0, value);
    offsetRef.current = next;
    setOffset(next);
  }, []);

  const reset = useCallback(() => {
    setDragging(false);
    setSlideOffset(0);
  }, [setSlideOffset]);

  const syncMaxTravel = useCallback(() => {
    const max = readMaxTravel(trackRef.current, thumbRef.current, pad);
    dragRef.current.max = max;
    if (offsetRef.current > max) {
      setSlideOffset(max);
    }
    return max;
  }, [pad, setSlideOffset]);

  useEffect(() => {
    syncMaxTravel();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => syncMaxTravel());
    observer.observe(track);
    return () => observer.disconnect();
  }, [syncMaxTravel, compact]);

  const onPointerDown = (e) => {
    if (disabled) return;
    const max = syncMaxTravel();
    dragRef.current = {
      startX: e.clientX,
      startOffset: offsetRef.current,
      max,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (!dragging || disabled) return;
    const { startX, startOffset, max } = dragRef.current;
    const next = Math.min(max, Math.max(0, startOffset + (e.clientX - startX)));
    setSlideOffset(next);
  };

  const onPointerUp = (e) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);

    const max = syncMaxTravel();
    const current = offsetRef.current;

    if (max > 0 && current / max >= THRESHOLD) {
      setSlideOffset(max);
      onConfirm?.();
      window.setTimeout(reset, RESET_MS);
      return;
    }

    reset();
  };

  return (
    <div className={`slide-confirm ${compact ? 'compact' : ''} ${disabled ? 'disabled' : ''}`}>
      <div ref={trackRef} className="slide-confirm-track">
        <span className="slide-confirm-label">{disabled && disabledHint ? disabledHint : label}</span>
        <button
          ref={thumbRef}
          type="button"
          className={`slide-confirm-thumb ${dragging ? 'dragging' : ''}`}
          style={{
            transform: `translateX(${offset}px)`,
            left: `${pad}px`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          disabled={disabled}
          aria-label={label}
        >
          <ChevronRight size={compact ? 14 : 16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
