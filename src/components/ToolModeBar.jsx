import { ERASER_MODE_OPTIONS, ERASER_MODES } from '../constants/toolModes';
import { isEraserConfirmMode, isEraserDrawMode } from '../constants/eraserModes';
import { isTextSelection } from '../constants/textStyles';
import { TOOLS } from '../constants/pageSizes';
import SlideToConfirm from './SlideToConfirm';
import TextStyleBar from './TextStyleBar';

const ERASER_DRAW_MODES = ERASER_MODE_OPTIONS.filter((m) => m.group === 'draw');
const ERASER_CONFIRM_MODES = ERASER_MODE_OPTIONS.filter((m) => m.group === 'confirm');

function ModeAnchorButton({
  mode,
  active,
  onSelect,
  buttonClassName = '',
  drop,
}) {
  return (
    <div className="tool-mode-mode-anchor">
      <button
        type="button"
        className={`tool-mode-btn ${buttonClassName} ${active ? 'active' : ''}`.trim()}
        title={mode.hint}
        onClick={() => onSelect(mode.id)}
      >
        {mode.label}
      </button>
      {active && drop}
    </div>
  );
}

function EraserSizeDrop({ size, onChange }) {
  return (
    <div className="tool-mode-anchor-drop tool-mode-size-drop">
      <label className="tool-mode-size">
        <span>{size}px</span>
        <input
          type="range"
          min={4}
          max={80}
          value={size}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

export default function ToolModeBar({
  tool,
  textMode,
  setTextMode,
  textStyle,
  onTextStyleChange,
  eraserMode,
  setEraserMode,
  eraserSize,
  setEraserSize,
  selectedObject,
  selectionCount,
  onClearAllContent,
  onEmptySelectedLayer,
  textEditRevision = 0,
  onCaptureTextFormatSelection,
}) {
  const textSelected = isTextSelection(selectedObject, selectionCount);

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

    if (eraserMode === ERASER_MODES.LAYER && !selectedObject) {
      hint = 'Selecciona una capa en la hoja o en el panel de capas';
    } else if (eraserMode === ERASER_MODES.LAYER && selectedObject) {
      hint = `Goma capa: ${selectedObject.name || selectedObject.type}`;
    } else if (eraserMode === ERASER_MODES.CLEAR_LAYER && !selectedObject) {
      hint = 'Selecciona la capa que quieres vaciar';
    } else if (eraserMode === ERASER_MODES.CLEAR_LAYER && selectedObject) {
      hint = `Se vaciará: ${selectedObject.name || selectedObject.type} · la capa permanece en la lista`;
    }

    const showConfirmSlide = isEraserConfirmMode(eraserMode);
    const showDrawSize = isEraserDrawMode(eraserMode);
    const hasModeDrop = showConfirmSlide || showDrawSize;

    return (
      <div className={`tool-mode-bar tool-mode-bar-eraser ${hasModeDrop ? 'has-mode-drop' : ''}`}>
        <div className="tool-mode-row">
          <span className="tool-mode-label">Modo borrador</span>
          <div className="tool-mode-options tool-mode-options-draw">
            {ERASER_DRAW_MODES.map((mode) => (
              <ModeAnchorButton
                key={mode.id}
                mode={mode}
                active={eraserMode === mode.id}
                onSelect={setEraserMode}
                drop={
                  showDrawSize && eraserMode === mode.id ? (
                    <EraserSizeDrop size={eraserSize} onChange={setEraserSize} />
                  ) : null
                }
              />
            ))}
          </div>
          <div className="tool-mode-options tool-mode-options-confirm">
            {ERASER_CONFIRM_MODES.map((mode) => (
              <ModeAnchorButton
                key={mode.id}
                mode={mode}
                active={eraserMode === mode.id}
                onSelect={setEraserMode}
                buttonClassName="confirm-mode"
                drop={
                  showConfirmSlide && eraserMode === mode.id ? (
                    <div className="tool-mode-anchor-drop">
                      {mode.id === ERASER_MODES.CLEAR_ALL && (
                        <SlideToConfirm
                          compact
                          label="Desliza →"
                          onConfirm={onClearAllContent}
                        />
                      )}
                      {mode.id === ERASER_MODES.CLEAR_LAYER && (
                        <SlideToConfirm
                          compact
                          label="Desliza →"
                          disabled={!selectedObject}
                          disabledHint="Selecciona capa"
                          onConfirm={onEmptySelectedLayer}
                        />
                      )}
                    </div>
                  ) : null
                }
              />
            ))}
          </div>
          <span className="tool-mode-hint">{hint}</span>
        </div>
      </div>
    );
  }

  return null;
}
