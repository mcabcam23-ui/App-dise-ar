import { Plus, X } from 'lucide-react';
import { MAX_SAVED_COLORS } from '../utils/colorPalette';

export default function ColorPalette({
  savedColors,
  colorTarget,
  setColorTarget,
  strokeColor,
  fillColor,
  onApplyColor,
  onSaveColor,
  onRemoveColor,
}) {
  const currentColor = colorTarget === 'fill' && fillColor !== 'transparent' ? fillColor : strokeColor;

  return (
    <div className="color-palette">
      <div className="color-target-row">
        <button
          type="button"
          className={`color-target-btn ${colorTarget === 'stroke' ? 'active' : ''}`}
          title="Aplicar a trazo (I = cuentagotas)"
          onClick={() => setColorTarget('stroke')}
        >
          <span className="color-target-dot" style={{ background: strokeColor }} />
          Trazo
        </button>
        <button
          type="button"
          className={`color-target-btn ${colorTarget === 'fill' ? 'active' : ''}`}
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
          <button
            key={`${color}-${index}`}
            type="button"
            className={`saved-color-swatch ${currentColor === color ? 'selected' : ''}`}
            style={{ background: color }}
            title={`${color} — clic: aplicar · clic der.: quitar`}
            onClick={() => onApplyColor(color)}
            onContextMenu={(e) => {
              e.preventDefault();
              onRemoveColor(index);
            }}
          >
            <span
              className="saved-color-remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveColor(index);
              }}
              title="Quitar"
            >
              <X size={10} />
            </span>
          </button>
        ))}
        <button
          type="button"
          className="saved-color-add"
          title={`Guardar color ${colorTarget === 'fill' ? 'de relleno' : 'de trazo'} (${savedColors.length}/${MAX_SAVED_COLORS})`}
          disabled={savedColors.length >= MAX_SAVED_COLORS || (colorTarget === 'fill' && fillColor === 'transparent')}
          onClick={onSaveColor}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
