export default function SignalArrowPicker({
  value = 'right',
  onChange,
  compact = false,
  showFront = false,
}) {
  const dir = value === 'left' || value === 'front' ? value : 'right';

  return (
    <div className={`signal-arrow-field ${compact ? 'is-compact' : ''}`}>
      <span className="signal-aspect-label">Flecha</span>
      <div className="signal-arrow-options" role="group" aria-label="Dirección de la flecha">
        <button
          type="button"
          className={`signal-arrow-btn ${dir === 'left' ? 'sel' : ''}`}
          title="Señala a la izquierda"
          aria-pressed={dir === 'left'}
          disabled={!onChange}
          onClick={() => onChange?.('left')}
        >
          ↖
        </button>
        {showFront && (
          <button
            type="button"
            className={`signal-arrow-btn ${dir === 'front' ? 'sel' : ''}`}
            title="Flecha de frente (vía directa)"
            aria-pressed={dir === 'front'}
            disabled={!onChange}
            onClick={() => onChange?.('front')}
          >
            ↑
          </button>
        )}
        <button
          type="button"
          className={`signal-arrow-btn ${dir === 'right' ? 'sel' : ''}`}
          title="Señala a la derecha"
          aria-pressed={dir === 'right'}
          disabled={!onChange}
          onClick={() => onChange?.('right')}
        >
          ↗
        </button>
      </div>
    </div>
  );
}
