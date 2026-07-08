import { resolveAssetUrl } from '../utils/assetUrl';
import { formatSignalAspectLabel, getPresetVariants } from '../utils/presetVariants';

export default function SignalAspectPicker({ presetId, value, onChange }) {
  const variants = getPresetVariants(presetId);
  if (variants.length <= 1) return null;

  const currentId = value || presetId;

  return (
    <div className="signal-aspect-picker">
      <span className="signal-aspect-label">Aspecto</span>
      <div className="signal-aspect-row" role="listbox" aria-label="Aspecto de la señal">
        {variants.map((variant) => {
          const selected = variant.id === currentId;
          const label = formatSignalAspectLabel(variant);
          return (
            <button
              key={variant.id}
              type="button"
              role="option"
              aria-selected={selected}
              className={`signal-aspect-chip ${selected ? 'sel' : ''}`}
              title={label}
              onClick={() => onChange(variant.id)}
            >
              <span className="signal-aspect-thumb">
                <img src={resolveAssetUrl(variant.imageAsset)} alt="" loading="lazy" />
              </span>
              <span className="signal-aspect-chip-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
