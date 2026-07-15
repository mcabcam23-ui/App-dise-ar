import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  ClipboardPaste,
  ZoomIn,
  ZoomOut,
  Shapes,
} from 'lucide-react';
import { TOOLS } from '../constants/pageSizes';
import { DESKTOP_TOOL_GROUPS, SHAPE_TOOL_IDS } from '../constants/toolGroups';
import ColorPalette from './ColorPalette';
import { ToolbarDropdown, DropMenuItem } from './ui/ToolbarDropdown';
import { getStyleControlsVisibility } from '../utils/styleControlsVisibility';

export default function TopToolbar({
  tool,
  setTool,
  strokeColor,
  setStrokeColor,
  fillColor,
  setFillColor,
  strokeWidth,
  setStrokeWidth,
  colorTarget,
  setColorTarget,
  savedColors,
  applyColorToTarget,
  saveColorToPalette,
  removeSavedColor,
  canUndo,
  canRedo,
  canPaste,
  selectionCount,
  undo,
  redo,
  copySelected,
  cutSelected,
  pasteClipboard,
  deleteSelected,
  onImagePick,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  textFormatActive = false,
  onCaptureTextFormatSelection,
  isCompact = false,
  selectedObject = null,
  modifyMode,
  onModifyPick,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  const styleVis = getStyleControlsVisibility({
    tool,
    selectedObject,
    selectionCount,
  });

  const { showStroke, showFill, showStrokeWidth, showAny: showStyleControls } = styleVis;

  if (isCompact && !showStyleControls) {
    return null;
  }

  const pick = (id) => {
    if (id === TOOLS.IMAGE) {
      onImagePick();
      return;
    }
    setTool(id);
  };

  const keepTextEditingFocus = (e) => {
    if (!textFormatActive) return;
    e.preventDefault();
    onCaptureTextFormatSelection?.();
  };

  const activeShape = [...DESKTOP_TOOL_GROUPS]
    .flatMap((g) => g.tools ?? [])
    .find((t) => t.id === tool && SHAPE_TOOL_IDS.has(t.id));

  const activeModify = tool === TOOLS.MODIFY
    ? DESKTOP_TOOL_GROUPS.find((g) => g.id === 'modify')?.tools.find((t) => t.modifyMode === modifyMode)
    : null;

  return (
    <div className={`top-toolbar ${isCompact ? 'is-compact' : ''}`}>
      <div className="top-toolbar-main">
        {!isCompact && (
          <>
            <div className="tb-group">
              <button type="button" className="tb-btn" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
                <Undo2 size={17} />
              </button>
              <button type="button" className="tb-btn" title="Rehacer (Ctrl+Y)" disabled={!canRedo} onClick={redo}>
                <Redo2 size={17} />
              </button>
            </div>
            <div className="tb-divider" />
            <div className="tb-group">
              <button type="button" className="tb-btn" title="Cortar (Ctrl+X)" disabled={!selectionCount} onClick={cutSelected}>
                <Scissors size={17} />
              </button>
              <button type="button" className="tb-btn" title="Copiar (Ctrl+C)" disabled={!selectionCount} onClick={copySelected}>
                <Copy size={17} />
              </button>
              <button type="button" className="tb-btn" title="Pegar (Ctrl+V)" disabled={!canPaste} onClick={pasteClipboard}>
                <ClipboardPaste size={17} />
              </button>
              <button type="button" className="tb-btn" title="Eliminar (Supr)" disabled={!selectionCount} onClick={deleteSelected}>
                <Trash2 size={17} />
              </button>
            </div>
            <div className="tb-divider" />

            <div className="tb-groups-labeled">
              {DESKTOP_TOOL_GROUPS.map((group) => {
                if (group.dropdown) {
                  const isModify = group.id === 'modify';
                  const suffix = isModify ? activeModify?.label : activeShape?.label;
                  const isActive = isModify ? tool === TOOLS.MODIFY : Boolean(activeShape);
                  return (
                    <div key={group.id} className="tb-labeled-group">
                      <span className="tb-group-label">{group.label}</span>
                      <ToolbarDropdown
                        label={group.dropdownLabel ?? group.label}
                        suffix={suffix}
                        title={group.dropdownLabel ?? group.label}
                        icon={group.dropdownIcon ?? Shapes}
                        className={`tb-shapes-drop ${isActive ? 'has-active' : ''}`}
                        minWidth={180}
                      >
                        {group.tools.map(({ id, icon: Icon, label, key, modifyMode: modeId }) => (
                          <DropMenuItem
                            key={modeId || id}
                            active={isModify ? tool === TOOLS.MODIFY && modifyMode === modeId : tool === id}
                            onClick={() => (isModify ? onModifyPick?.(modeId) : pick(id))}
                          >
                            <Icon size={16} />
                            <span>{key ? `${label} (${key})` : label}</span>
                          </DropMenuItem>
                        ))}
                      </ToolbarDropdown>
                    </div>
                  );
                }

                return (
                  <div key={group.id} className="tb-labeled-group">
                    <span className="tb-group-label">{group.label}</span>
                    <div className="tb-group">
                      {group.tools.map(({ id, icon: Icon, label, key }) => (
                        <button
                          key={id}
                          type="button"
                          className={`tb-btn tool ${tool === id ? 'active' : ''}`}
                          title={key ? `${label} (${key})` : label}
                          onClick={() => pick(id)}
                        >
                          <Icon size={17} />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!isCompact && showStyleControls && <div className="tb-divider" />}

        {showStyleControls && (
        <div className="tb-group colors" onMouseDown={keepTextEditingFocus}>
          {showStroke && (
          <label className="color-swatch" title="Color de trazo">
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => {
                setColorTarget('stroke');
                setStrokeColor(e.target.value);
              }}
            />
            <span>Trazo</span>
          </label>
          )}
          {showFill && (
          <>
          <label className="color-swatch" title="Color de relleno">
            <input
              type="color"
              value={fillColor === 'transparent' ? '#ffffff' : fillColor}
              onChange={(e) => {
                setColorTarget('fill');
                setFillColor(e.target.value);
              }}
            />
            <span>Relleno</span>
          </label>
          <button
            type="button"
            className={`tb-text-btn ${fillColor === 'transparent' ? 'on' : ''}`}
            onClick={() => {
              setColorTarget('fill');
              setFillColor(fillColor === 'transparent' ? '#f0f0f0' : 'transparent');
            }}
          >
            Sin relleno
          </button>
          </>
          )}
          {showStrokeWidth && (
          <label className="stroke-size">
            <span>{strokeWidth}px</span>
            <input type="range" min={1} max={40} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
          </label>
          )}
          {isCompact && (
            <button
              type="button"
              className={`tb-text-btn palette-toggle ${paletteOpen ? 'on' : ''}`}
              onClick={() => setPaletteOpen((v) => !v)}
              aria-expanded={paletteOpen}
            >
              Paleta
              {paletteOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
        )}

        {!isCompact && (
          <>
            {showStyleControls && <div className="tb-divider" />}
            <div className="tb-group zoom-group">
              <button type="button" className="tb-btn" title="Alejar (Ctrl+rueda)" onClick={onZoomOut}>
                <ZoomOut size={17} />
              </button>
              <button type="button" className="tb-btn zoom-label" title="Zoom 100%" onClick={onZoomReset}>
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" className="tb-btn" title="Acercar (Ctrl+rueda)" onClick={onZoomIn}>
                <ZoomIn size={17} />
              </button>
            </div>
          </>
        )}
      </div>

      {showStyleControls && (!isCompact || paletteOpen) && (
        <div className="top-toolbar-palette" onMouseDown={keepTextEditingFocus}>
          <ColorPalette
            savedColors={savedColors}
            colorTarget={colorTarget}
            setColorTarget={setColorTarget}
            strokeColor={strokeColor}
            fillColor={fillColor}
            onApplyColor={applyColorToTarget}
            onSaveColor={saveColorToPalette}
            onRemoveColor={removeSavedColor}
            fillOnly={tool === TOOLS.BUCKET}
          />
        </div>
      )}
    </div>
  );
}
