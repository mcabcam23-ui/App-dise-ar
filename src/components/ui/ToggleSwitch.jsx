export default function ToggleSwitch({
  checked = false,
  onChange,
  label,
  hint,
  icon: Icon,
  disabled = false,
}) {
  return (
    <label className={`setting-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="setting-row-main">
        {Icon && (
          <span className="setting-row-icon" aria-hidden="true">
            <Icon size={18} strokeWidth={1.75} />
          </span>
        )}
        <span className="setting-row-text">
          <span className="setting-row-label">{label}</span>
          {hint && <span className="setting-row-hint">{hint}</span>}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className={`toggle-switch ${checked ? 'on' : ''}`}
        onClick={() => onChange?.(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </label>
  );
}
