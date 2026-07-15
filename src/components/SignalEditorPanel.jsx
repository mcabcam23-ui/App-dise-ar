import { useEffect, useRef, useState } from 'react';
import SignalAspectPicker from './SignalAspectPicker';
import SignalArrowPicker from './SignalArrowPicker';
import SignalTypePicker from './SignalTypePicker';
import { getPresetShape } from '../constants/presetShapes';
import { getNumberSlots } from '../utils/signalNumberOverlay';
import {
  findDiagonalArrowPresetId,
  findStraightArrowPresetId,
  getBaseVariantId,
  getPresetVariants,
  getSwappableSignalTypes,
  isStraightArrowPreset,
  mapAspectToVariant,
} from '../utils/presetVariants';

export default function SignalEditorPanel({
  presetId,
  onPresetChange,
  showTypePicker = true,
  numberValues,
  onNumberValuesChange,
  onNumberCommit,
  arrowDirection,
  onArrowDirectionChange,
  onArrowModeChange,
}) {
  const preset = presetId ? getPresetShape(presetId) : null;
  const typeBaseId = presetId ? getBaseVariantId(presetId) : '';
  const showType = Boolean(presetId && showTypePicker && getSwappableSignalTypes(presetId).length > 1);
  const showAspect = Boolean(presetId && getPresetVariants(typeBaseId).length > 1);
  const slots = preset ? getNumberSlots(preset) : [];
  const isMulti = slots.length > 1;
  const straight = Boolean(preset && isStraightArrowPreset(preset));
  const straightId = presetId ? findStraightArrowPresetId(presetId) : null;
  const diagonalId = presetId ? findDiagonalArrowPresetId(presetId) : null;
  const showFront = Boolean(straightId && diagonalId);
  const showNumber = Boolean(preset?.customNumber && onNumberValuesChange && slots.length && !straight);
  const showArrow = Boolean(preset?.customArrow || straight || showFront);

  const externalValues = Array.isArray(numberValues) ? numberValues : [];
  const externalKey = externalValues.join('|');
  const [draftValues, setDraftValues] = useState(() => externalValues);
  const focusedSlotRef = useRef(-1);

  useEffect(() => {
    focusedSlotRef.current = -1;
    setDraftValues(externalValues);
  }, [presetId]);

  useEffect(() => {
    if (focusedSlotRef.current >= 0) return;
    setDraftValues(externalValues);
  }, [externalKey]);

  if (!presetId || !preset) return null;
  if (!showType && !showAspect && !showNumber && !showArrow) return null;

  const values = draftValues;
  const effectiveArrow = straight
    ? 'front'
    : (arrowDirection === 'left' || arrowDirection === 'right' ? arrowDirection : (preset?.arrowOverlay?.defaultDirection ?? 'right'));

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
    setDraftValues(next);
    onNumberValuesChange?.(next, isMulti);
  };

  const commitNumberSlot = () => {
    focusedSlotRef.current = -1;
    onNumberCommit?.();
  };

  const changeArrow = (dir) => {
    if (dir === 'front') {
      if (onArrowModeChange) {
        onArrowModeChange({ direction: 'front', presetId: straightId });
        return;
      }
      if (straightId && straightId !== presetId) onPresetChange?.(straightId);
      return;
    }

    const nextPresetId = straight ? diagonalId : presetId;
    if (onArrowModeChange) {
      onArrowModeChange({
        direction: dir,
        presetId: nextPresetId && nextPresetId !== presetId ? nextPresetId : undefined,
      });
      return;
    }
    if (nextPresetId && nextPresetId !== presetId) onPresetChange?.(nextPresetId);
    onArrowDirectionChange?.(dir);
  };

  return (
    <div className="signal-editor-panel">
      {showType && (
        <SignalTypePicker presetId={presetId} onChange={changeType} />
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
                onFocus={() => { focusedSlotRef.current = i; }}
                onBlur={commitNumberSlot}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                onChange={(e) => changeSlot(i, e.target.value)}
              />
            ))}
          </div>
        </div>
      )}
      {showArrow && (
        <SignalArrowPicker
          compact
          showFront={showFront}
          value={effectiveArrow}
          onChange={changeArrow}
        />
      )}
      {showAspect && (
        <SignalAspectPicker
          presetId={typeBaseId}
          value={presetId}
          onChange={changeAspect}
        />
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
    || Boolean(preset?.customArrow || host?.customArrow)
    || Boolean(preset && isStraightArrowPreset(preset))
    || Boolean(findStraightArrowPresetId(presetId))
  );
}
