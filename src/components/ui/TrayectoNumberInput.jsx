import { useEffect, useState } from 'react';

/** Campo numérico de trayecto: permite escribir con libertad y aplica al salir o Enter. */
export default function TrayectoNumberInput({
  label,
  value,
  min,
  max,
  onCommit,
}) {
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(String(value ?? min));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value ?? min));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
