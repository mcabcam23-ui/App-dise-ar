import { forwardRef, useRef } from 'react';
import { ERASER_MODE_OPTIONS, ERASER_MODES, MODIFY_MODE_OPTIONS } from '../constants/toolModes';
import { isEraserDrawMode } from '../constants/eraserModes';
import { isTextSelection } from '../constants/textStyles';
import { TOOLS } from '../constants/pageSizes';
import { findPresetHost, getObjectPresetId } from '../utils/presetVariants';
import SignalEditorPanel, { signalEditorHasContent } from './SignalEditorPanel';
import TextStyleBar from './TextStyleBar';
import EraserSizeFloatingPanel from './EraserSizeFloatingPanel';
import SlideConfirmFloatingPanel from './SlideConfirmFloatingPanel';

function hasSignalEditorContent(presetId, host) {
  return signalEditorHasContent(presetId, host);
}
const ERASER_DRAW_MODES = ERASER_MODE_OPTIONS.filter((m) => m.group === 'draw');
const ERASER_CONFIRM_MODES = ERASER_MODE_OPTIONS.filter((m) => m.group === 'confirm');

function ModeAnchorButton({
  mode,
  active,
  onSelect,
  buttonClassName = '',
}) {
  return (
    <button
      type="button"
      className={`tool-mode-btn ${buttonClassName} ${active ? 'active' : ''}`.trim()}
      title={mode.hint}
      onClick={() => onSelect(mode.id)}
    >
      {mode.label}
    </button>
  );
}

const EraserModeAnchor = forwardRef(function EraserModeAnchor({
  mode,
  active,
  onSelect,
  buttonClassName = '',
}, ref) {
  return (
    <div ref={ref} className={`tool-mode-mode-anchor ${active ? 'is-active' : ''}`}>
      <ModeAnchorButton
        mode={mode}
        active={active}
        onSelect={onSelect}
        buttonClassName={buttonClassName}
      />
    </div>
  );
});

export default function ToolModeBar({
  tool,
  textMode,
  setTextMode,
  textStyle,
  onTextStyleChange,
  eraserMode,
  setEraserMode,
  modifyMode,
  setModifyMode,
  modifyPickLabel,
  eraserSize,
  setEraserSize,
  selectedObject,
  selectionCount,
  onClearAllContent,
  onEmptySelectedLayer,
  onSignalPresetChange,
  onSignalNumberChange,
  onSignalNumberCommit,
  onSignalArrowChange,
  onSignalArrowModeChange,
  textEditRevision = 0,
  onCaptureTextFormatSelection,
  isCompact = false,
}) {
  const textSelected = isTextSelection(selectedObject, selectionCount);
  const eraserDrawBlockRef = useRef(null);
  const clearAllAnchorRef = useRef(null);
  const clearLayerAnchorRef = useRef(null);
  const confirmModeActive = eraserMode === ERASER_MODES.CLEAR_ALL || eraserMode === ERASER_MODES.CLEAR_LAYER;

  if (tool === TOOLS.TEXT || (textSelected && tool !== TOOLS.ERASER)) {
    return (
      <TextStyleBar
        textMode={textMode}
        setTextMode={setTextMode}
        textStyle={textStyle}
        onTextStyleChange={onTextStyleChange}
        selectedObject={selectedObject}
        selectionCount={selectionCount}
        textEditRevision={textEditRevision}
        editing={textSelected && tool !== TOOLS.TEXT}
        onCaptureTextFormatSelection={onCaptureTextFormatSelection}
      />
    );
  }

  if (tool === TOOLS.ERASER) {
    const activeMeta = ERASER_MODE_OPTIONS.find((m) => m.id === eraserMode);
    let hint = activeMeta?.hint ?? '';

    if (eraserMode === ERASER_MODES.LAYER && selectionCount > 1) {
      hint = 'Selecciona una sola capa para borrar sobre ella';
    } else if (eraserMode === ERASER_MODES.LAYER && !selectedObject) {
      hint = 'Selecciona una capa en la hoja o en el panel de capas';
    } else if (eraserMode === ERASER_MODES.LAYER && selectedObject) {
      hint = `Goma capa: ${selectedObject.name || selectedObject.type}`;
    } else if (eraserMode === ERASER_MODES.CLEAR_LAYER && !selectedObject) {
      hint = 'Selecciona la capa que quieres vaciar';
    } else if (eraserMode === ERASER_MODES.CLEAR_LAYER && selectedObject) {
      hint = `Se vaciará: ${selectedObject.name || selectedObject.type} · la capa permanece en la lista`;
    }

    return (
      <div className={`tool-mode-bar tool-mode-bar-eraser ${isCompact ? 'is-compact' : ''}`}>
        <div className="tool-mode-row">
          <div className="tool-mode-block" ref={eraserDrawBlockRef}>
            <span className="tool-mode-label">Borrar trazos</span>
            <div className="tool-mode-options tool-mode-options-draw">
              {ERASER_DRAW_MODES.map((mode) => (
                <ModeAnchorButton
                  key={mode.id}
                  mode={mode}
                  active={eraserMode === mode.id}
                  onSelect={setEraserMode}
                />
              ))}
            </div>
          </div>

          <div className="tool-mode-block tool-mode-block-danger">
            <span className="tool-mode-label">Vaciar contenido</span>
            <div className="tool-mode-options tool-mode-options-confirm">
              {ERASER_CONFIRM_MODES.map((mode) => (
                <EraserModeAnchor
                  key={mode.id}
                  ref={mode.id === ERASER_MODES.CLEAR_ALL ? clearAllAnchorRef : clearLayerAnchorRef}
                  mode={mode}
                  active={eraserMode === mode.id}
                  onSelect={setEraserMode}
                  buttonClassName="confirm-mode"
                />
              ))}
            </div>
          </div>

          <span className="tool-mode-hint">{hint}</span>
        </div>
        {isEraserDrawMode(eraserMode) && (
          <EraserSizeFloatingPanel
            size={eraserSize}
            onChange={setEraserSize}
            anchorRef={eraserDrawBlockRef}
          />
        )}
        {confirmModeActive && (
          <SlideConfirmFloatingPanel
            anchorRef={eraserMode === ERASER_MODES.CLEAR_ALL ? clearAllAnchorRef : clearLayerAnchorRef}
            open
            onConfirm={eraserMode === ERASER_MODES.CLEAR_ALL ? onClearAllContent : onEmptySelectedLayer}
            disabled={eraserMode === ERASER_MODES.CLEAR_LAYER && !selectedObject}
            disabledHint="Selecciona capa"
          />
        )}
      </div>
    );
  }

  if (tool === TOOLS.MODIFY) {
    const activeMeta = MODIFY_MODE_OPTIONS.find((m) => m.id === modifyMode);
    let hint = activeMeta?.hint ?? '';
    if (modifyMode === 'join' && modifyPickLabel) {
      hint = `Primer trazo: ${modifyPickLabel} · clic en el segundo`;
    }

    return (
      <div className={`tool-mode-bar tool-mode-bar-modify ${isCompact ? 'is-compact' : ''}`}>
        <div className="tool-mode-row">
          <div className="tool-mode-block">
            <span className="tool-mode-label">Modificar trazos</span>
            <div className="tool-mode-options tool-mode-options-draw">
              {MODIFY_MODE_OPTIONS.map((mode) => (
                <ModeAnchorButton
                  key={mode.id}
                  mode={mode}
                  active={modifyMode === mode.id}
                  onSelect={setModifyMode}
                />
              ))}
            </div>
          </div>
          <span className="tool-mode-hint">{hint}</span>
        </div>
      </div>
    );
  }

  if (tool === TOOLS.SELECT && selectionCount === 1 && selectedObject && onSignalPresetChange) {
    const presetHost = findPresetHost(selectedObject);
    const presetId = getObjectPresetId(presetHost);
    if (presetId && hasSignalEditorContent(presetId, presetHost)) {
      return (
        <div className={`tool-mode-bar tool-mode-bar-aspect ${isCompact ? 'is-compact' : ''}`}>
          <SignalEditorPanel
            presetId={presetId}
            onPresetChange={onSignalPresetChange}
            numberValues={presetHost?.multiNumber
              ? (presetHost?.customNumberValues ?? [])
              : [presetHost?.customNumberValue ?? '']}
            onNumberValuesChange={onSignalNumberChange}
            onNumberCommit={onSignalNumberCommit}
            arrowDirection={presetHost?.customArrowDirection}
            onArrowDirectionChange={onSignalArrowChange}
            onArrowModeChange={onSignalArrowModeChange}
          />
        </div>
      );
    }
  }

  return null;
}
