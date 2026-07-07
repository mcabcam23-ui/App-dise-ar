import { Eye, EyeOff, Lock, Trash2, ArrowDown, ArrowUp, ChevronsDown, ChevronsUp } from 'lucide-react';
import { PAGE_SIZES } from '../constants/pageSizes';
import { displayColor, getObjectStyleCaps } from '../utils/objectStyles';
import ShapePicker from './ShapePicker';

export default function RightPanel({
  pageSizeKey,
  resizePage,
  backgroundColor,
  setBackground,
  setBackgroundImage,
  clearBackgroundImage,
  addPresetShape,
  strokeColor,
  onShapeFilePick,
  selectedObject,
  selectionCount,
  updateSelectedProps,
  fontSize,
  strokeWidth,
  objects,
  selectObjectByRef,
  toggleObjectVisibility,
  removeObject,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
}) {
  const isText = selectedObject?.type === 'textbox' || selectedObject?.type === 'i-text' || selectedObject?.type === 'text';
  const caps = getObjectStyleCaps(selectedObject);
  const isStrokeShape = selectedObject?.strokeOnly && ['path', 'group'].includes(selectedObject?.type);
  const isFillOnlyShape = selectedObject?.fillOnly;
  const hasSelection = selectedObject || selectionCount > 1;
  const multi = selectionCount > 1;
  const showShapeStyles = hasSelection && !isText && !(selectionCount === 1 && selectedObject?.customNumber && !caps.fill && !caps.stroke);

  return (
    <aside className="right-panel">
      <div className="panel-block">
        <h3>Página</h3>
        <label className="field">
          <span>Tamaño</span>
          <select value={pageSizeKey} onChange={(e) => resizePage(e.target.value)}>
            {Object.entries(PAGE_SIZES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel-block">
        <h3>Fondo</h3>
        <label className="field inline">
          <span>Color</span>
          <input type="color" value={backgroundColor} onChange={(e) => setBackground(e.target.value)} />
        </label>
        <label className="btn-block">
          Imagen de fondo
          <input type="file" accept="image/*" hidden onChange={(e) => setBackgroundImage(e.target.files?.[0])} />
        </label>
        <button type="button" className="link-btn" onClick={clearBackgroundImage}>Quitar imagen</button>
      </div>

      <div className="panel-block">
        <h3>Figuras prefabricadas</h3>
        <ShapePicker addPresetShape={addPresetShape} />
        <label className="btn-block muted" style={{ marginTop: 8 }}>
          Imagen externa…
          <input type="file" accept="image/*,.svg" hidden onChange={(e) => onShapeFilePick(e.target.files?.[0])} />
        </label>
      </div>

      {hasSelection && (
        <div className="panel-block">
          <h3>
            {multi ? `${selectionCount} seleccionados` : 'Propiedades'}
            {!multi && selectedObject?.name && (
              <span className="panel-subtitle">{selectedObject.name}</span>
            )}
          </h3>
          <label className="field">
            <span>Opacidad</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedObject?.opacity ?? 1}
              onChange={(e) => updateSelectedProps({ opacity: Number(e.target.value) })}
            />
          </label>
          {isText && !multi && (
            <>
              <label className="field">
                <span>Tamaño</span>
                <input
                  type="number"
                  min={8}
                  max={200}
                  value={selectedObject.fontSize ?? fontSize}
                  onChange={(e) => updateSelectedProps({ fontSize: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>Fuente</span>
                <select
                  value={selectedObject.fontFamily ?? 'Segoe UI'}
                  onChange={(e) => updateSelectedProps({ fontFamily: e.target.value })}
                >
                  <option value="Segoe UI">Segoe UI</option>
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Times New Roman">Times New Roman</option>
                </select>
              </label>
              <label className="field inline">
                <span>Color</span>
                <input type="color" value={displayColor(selectedObject.fill, '#000000')} onChange={(e) => updateSelectedProps({ fill: e.target.value })} />
              </label>
            </>
          )}
          {!isText && !multi && selectedObject?.customNumber && (
            <label className="field">
              <span>Número en señal</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={selectedObject.customNumberValue ?? ''}
                onChange={(e) => updateSelectedProps({ customNumberValue: e.target.value.replace(/[^\d]/g, '') })}
              />
            </label>
          )}
          {!isText && !multi && selectedObject?.customArrow && (
            <label className="field">
              <span>Dirección de la flecha</span>
              <select
                value={selectedObject.customArrowDirection ?? 'right'}
                onChange={(e) => updateSelectedProps({ customArrowDirection: e.target.value })}
              >
                <option value="right">Señala a la derecha ↗</option>
                <option value="left">Señala a la izquierda ↖</option>
              </select>
            </label>
          )}
          {showShapeStyles && (
            <>
              {(multi || caps.stroke || isStrokeShape || isFillOnlyShape) && (
                <>
                  {(multi || caps.stroke || isStrokeShape) && (
                    <>
                      <label className="field inline">
                        <span>{isStrokeShape ? 'Color' : 'Trazo'}</span>
                        <input
                          type="color"
                          value={displayColor(selectedObject?.stroke, '#000000')}
                          onChange={(e) => updateSelectedProps({ stroke: e.target.value })}
                        />
                      </label>
                      {(multi || caps.strokeWidth) && (
                        <label className="field">
                          <span>Grosor del trazo</span>
                          <input
                            type="range"
                            min={1}
                            max={40}
                            value={selectedObject?.strokeWidth ?? strokeWidth ?? 2}
                            onChange={(e) => updateSelectedProps({ strokeWidth: Number(e.target.value) })}
                          />
                          <span className="field-hint">{selectedObject?.strokeWidth ?? strokeWidth ?? 2} px</span>
                        </label>
                      )}
                    </>
                  )}
                  {(multi || (caps.fill && !isStrokeShape)) && !isFillOnlyShape && (
                    <label className="field inline">
                      <span>Relleno</span>
                      <input
                        type="color"
                        value={displayColor(selectedObject?.fill, '#ffffff')}
                        onChange={(e) => updateSelectedProps({ fill: e.target.value })}
                      />
                    </label>
                  )}
                  {isFillOnlyShape && !multi && (
                    <label className="field inline">
                      <span>Color</span>
                      <input
                        type="color"
                        value={displayColor(selectedObject?.fill, '#000000')}
                        onChange={(e) => updateSelectedProps({ fill: e.target.value })}
                      />
                    </label>
                  )}
                  {(multi || caps.fill) && !isStrokeShape && !isFillOnlyShape && (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => updateSelectedProps({ fill: '' })}
                    >
                      Sin relleno
                    </button>
                  )}
                </>
              )}
              {!multi && (
                <div className="layer-order-btns">
                  <button type="button" className="mini-btn" title="Subir capa" onClick={bringForward}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="mini-btn" title="Bajar capa" onClick={sendBackward}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="mini-btn" title="Traer al frente" onClick={bringToFront}>
                    <ChevronsUp size={14} />
                  </button>
                  <button type="button" className="mini-btn" title="Enviar al fondo" onClick={sendToBack}>
                    <ChevronsDown size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="panel-block">
        <h3>Capas <span className="count">{objects.length}</span></h3>
        <ul className="layer-list">
          {[...objects].reverse().map((item) => (
            <li
              key={item.id}
              className={`layer-row ${selectedObject === item.object ? 'sel' : ''} ${item.locked ? 'locked' : ''}`}
              onClick={() => selectObjectByRef(item.object)}
            >
              <span className="layer-label">{item.name}</span>
              <div className="layer-btns">
                {item.locked && <Lock size={12} />}
                <button
                  type="button"
                  title={item.visible ? 'Ocultar' : 'Mostrar'}
                  onClick={(e) => { e.stopPropagation(); toggleObjectVisibility(item.object); }}
                >
                  {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  type="button"
                  title="Eliminar"
                  onClick={(e) => { e.stopPropagation(); removeObject(item.object); }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
