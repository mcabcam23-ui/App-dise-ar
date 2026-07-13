import { Plus } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { MAX_SAVED_COLORS } from '../utils/colorPalette';

const LONG_PRESS_MS = 550;

function SavedColorSwatch({ color, index, selected, onApply, onRemove }) {
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback(() => {
    clearLongPress();
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onRemove(index);
    }, LONG_PRESS_MS);
  }, [clearLongPress, index, onRemove]);

  return (
    <button
      type="button"
      className={`saved-color-swatch ${selected ? 'selected' : ''}`}
      style={{ background: color }}
      title={`${color} — clic: aplicar · clic derecho o mantener pulsado: quitar`}
      onClick={() => {
        if (longPressTriggered.current) {
          longPressTriggered.current = false;
          return;
        }
        onApply(color);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onRemove(index);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'touch' || e.pointerType === 'pen') startLongPress();
      }}
      onPointerUp={clearLongPress}
      onPointerLeave={clearLongPress}
      onPointerCancel={clearLongPress}
    />
  );
}

export default function ColorPalette({
  savedColors,
  colorTarget,
  setColorTarget,
  strokeColor,
  fillColor,
  onApplyColor,
  onSaveColor,
  onRemoveColor,
  fillOnly = false,
}) {
  const activeTarget = fillOnly ? 'fill' : colorTarget;
  const currentColor = activeTarget === 'fill' && fillColor !== 'transparent' ? fillColor : strokeColor;

  const requestRemove = useCallback((index) => {
    const color = savedColors[index];
    if (!color) return;
    if (!window.confirm(`¿Quitar el color ${color} de la paleta?`)) return;
    onRemoveColor(index);
  }, [onRemoveColor, savedColors]);

  return (
    <div className="color-palette">
      <div className="color-target-row">
        {!fillOnly && (
          <button
            type="button"
            className={`color-target-btn ${activeTarget === 'stroke' ? 'active' : ''}`}
            title="Aplicar a trazo (I = cuentagotas)"
            onClick={() => setColorTarget('stroke')}
          >
            <span className="color-target-dot" style={{ background: strokeColor }} />
            Trazo
          </button>
        )}
        <button
          type="button"
          className={`color-target-btn ${activeTarget === 'fill' ? 'active' : ''}`}
          title="Aplicar a relleno (Alt+clic con cuentagotas)"
          onClick={() => setColorTarget('fill')}
        >
          <span
            className="color-target-dot"
            style={{
              background: fillColor === 'transparent'
                ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 8px 8px'
                : fillColor,
            }}
          />
          Relleno
        </button>
      </div>

      <div className="saved-colors-row">
        {savedColors.map((color, index) => (
          <SavedColorSwatch
            key={`${color}-${index}`}
            color={color}
            index={index}
            selected={currentColor === color}
            onApply={onApplyColor}
            onRemove={requestRemove}
          />
        ))}
        <button
          type="button"
          className="saved-color-add"
          title={`Guardar color ${activeTarget === 'fill' ? 'de relleno' : 'de trazo'} (${savedColors.length}/${MAX_SAVED_COLORS})`}
          disabled={savedColors.length >= MAX_SAVED_COLORS || (activeTarget === 'fill' && fillColor === 'transparent')}
          onClick={onSaveColor}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
