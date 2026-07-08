import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import SlideToConfirm from './SlideToConfirm';

const WIDTH_SCALE = 2.35;
const MIN_WIDTH = 200;

function clampLeft(left, width) {
  const maxLeft = Math.max(8, window.innerWidth - width - 8);
  return Math.min(maxLeft, Math.max(8, left));
}

function panelWidth(anchorWidth) {
  return Math.max(MIN_WIDTH, Math.round(anchorWidth * WIDTH_SCALE));
}

export default function SlideConfirmFloatingPanel({
  anchorRef,
  open,
  label = 'Desliza →',
  disabled,
  disabledHint,
  onConfirm,
}) {
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return undefined;
    }

    const place = () => {
      const anchor = anchorRef?.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = panelWidth(rect.width);
      const left = rect.left + rect.width / 2 - width / 2;
      setStyle({
        left: clampLeft(left, width),
        top: rect.bottom + 6,
        width,
      });
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, open]);

  if (!open || !style) return null;

  return createPortal(
    <div
      className="slide-confirm-float"
      style={style}
      role="dialog"
      aria-label={disabled && disabledHint ? disabledHint : label}
    >
      <SlideToConfirm
        compact
        label={label}
        disabled={disabled}
        disabledHint={disabledHint}
        onConfirm={onConfirm}
      />
    </div>,
    document.body,
  );
}
