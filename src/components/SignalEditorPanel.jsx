import SignalAspectPicker from './SignalAspectPicker';
import SignalTypePicker from './SignalTypePicker';
import { getPresetShape } from '../constants/presetShapes';
import { getNumberSlots } from '../utils/signalNumberOverlay';
import {
  getBaseVariantId,
  getPresetVariants,
  getSwappableSignalTypes,
  mapAspectToVariant,
} from '../utils/presetVariants';

export default function SignalEditorPanel({
  presetId,
  onPresetChange,
  showTypePicker = true,
  numberValues,
  onNumberValuesChange,
}) {
  if (!presetId) return null;

  const preset = getPresetShape(presetId);
  const typeBaseId = getBaseVariantId(presetId);
  const showType = showTypePicker && getSwappableSignalTypes(presetId).length > 1;
  const showAspect = getPresetVariants(typeBaseId).length > 1;
  const slots = getNumberSlots(preset);
  const isMulti = slots.length > 1;
  const showNumber = Boolean(preset?.customNumber && onNumberValuesChange && slots.length);

  if (!showType && !showAspect && !showNumber) return null;

  const values = Array.isArray(numberValues) ? numberValues : [];

  const changeType = (newTypeBaseId) => {
    if (!newTypeBaseId || newTypeBaseId === typeBaseId) return;
    onPresetChange(mapAspectToVariant(newTypeBaseId, presetId));
  };

  const changeAspect = (newAspectId) => {
    if (!newAspectId || newAspectId === presetId) return;
    onPresetChange(newAspectId);
  };

  const changeSlot = (index, raw) => {
    const value = raw.replace(/[^\d]/g, '');
    const next = slots.map((_, i) => (i === index ? value : (values[i] ?? '')));
    onNumberValuesChange(next, isMulti);
  };

  return (
    <div className="signal-editor-panel">
      {showType && (
        <SignalTypePicker presetId={presetId} onChange={changeType} />
      )}
      {showAspect && (
        <SignalAspectPicker
          presetId={typeBaseId}
          value={presetId}
          onChange={changeAspect}
        />
      )}
      {showNumber && (
        <div className={`signal-number-field ${isMulti ? 'is-multi' : ''}`}>
          <span className="signal-aspect-label">{isMulti ? 'Velocidades' : 'Número'}</span>
          <div className="signal-number-inputs">
            {slots.map((_, i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder={isMulti ? `V${i + 1}` : 'Ej. 120'}
                value={values[i] ?? ''}
                onChange={(e) => changeSlot(i, e.target.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function signalEditorHasContent(presetId, host) {
  if (!presetId) return false;
  const preset = getPresetShape(presetId);
  const typeBaseId = getBaseVariantId(presetId);
  return (
    getSwappableSignalTypes(presetId).length > 1
    || getPresetVariants(typeBaseId).length > 1
    || Boolean(preset?.customNumber || host?.customNumber)
  );
}
