import { TEXT_MODE_OPTIONS } from '../constants/toolModes';
import { readTextStyleFromSelection, getTextFormatHint } from '../utils/textSelectionStyles';
import { selectionHasTextbox } from '../constants/textStyles';
import TextFormatControls from './TextFormatControls';

export default function TextStyleBar({
  textMode,
  setTextMode,
  textStyle,
  onTextStyleChange,
  selectedObject,
  selectionCount = 0,
  editing = false,
  textEditRevision = 0,
  onCaptureTextFormatSelection,
}) {
  void textEditRevision;

  const style = editing
    ? readTextStyleFromSelection(selectedObject, textStyle)
    : textStyle;

  const hint = editing
    ? (getTextFormatHint(selectedObject)
      || (selectedObject?.name
        ? `Editando: ${selectedObject.name}`
        : selectionCount > 1
          ? `${selectionCount} textos seleccionados`
          : 'Texto seleccionado'))
    : TEXT_MODE_OPTIONS.find((m) => m.id === textMode)?.hint;

  const showBackground = editing ? selectionHasTextbox(selectedObject) : true;

  const keepTextEditingFocus = (e) => {
    if (!editing) return;
    e.preventDefault();
    onCaptureTextFormatSelection?.();
  };

  return (
    <div
      className="tool-mode-bar tool-mode-bar-text"
      onMouseDown={keepTextEditingFocus}
    >
      <div className="txt-bar-head">
        <span className="tool-mode-label">{editing ? 'Formato texto' : 'Texto'}</span>
        <TextFormatControls
          layout="toolbar"
          style={style}
          onChange={onTextStyleChange}
          textMode={editing ? undefined : textMode}
          setTextMode={editing ? undefined : setTextMode}
          showBackground={showBackground}
          showOutline
          showOpacity
        />
        {hint && <span className="txt-bar-hint">{hint}</span>}
      </div>
    </div>
  );
}
