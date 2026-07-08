import { readTextStyleFromSelection } from '../../utils/textSelectionStyles';
import { displayColor, effectiveStrokeWidth, getObjectStyleCaps } from '../../utils/objectStyles';
import { findPresetHost, getObjectPresetId } from '../../utils/presetVariants';
import { getPresetShape } from '../../constants/presetShapes';
import { previewTrayectoSvg, TRAYECTO_TRACK_MODES } from '../../utils/trayectoLine';
import TextFormatControls from '../TextFormatControls';
import SignalEditorPanel from '../SignalEditorPanel';
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp } from 'lucide-react';

export default function PropertiesPanel({
  selectedObject,
  selectionCount,
  updateSelectedProps,
  fontSize,
  strokeWidth,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
}) {
  const isText = selectedObject?.type === 'textbox' || selectedObject?.type === 'i-text' || selectedObject?.type === 'text';
  const caps = getObjectStyleCaps(selectedObject);
  const isLineLike = selectedObject && ['line', 'polyline', 'path'].includes(selectedObject.type);
  const shownStrokeWidth = effectiveStrokeWidth(selectedObject, strokeWidth);
  const isStrokeShape = selectedObject?.strokeOnly && ['path', 'group'].includes(selectedObject?.type);
  const isFillOnlyShape = selectedObject?.fillOnly;
  const hasSelection = selectedObject || selectionCount > 1;
  const multi = selectionCount > 1;
  const showShapeStyles = hasSelection && !isText && !(selectionCount === 1 && selectedObject?.customNumber && !caps.fill && !caps.stroke);
  const textStyle = isText && selectedObject
    ? readTextStyleFromSelection(selectedObject, { fontSize })
    : null;
  const presetHost = !multi && selectedObject ? findPresetHost(selectedObject) : null;
  const presetId = getObjectPresetId(presetHost);
  const trayectoPreset = presetId && presetHost?.customStationCount ? getPresetShape(presetId) : null;

  if (!hasSelection) {
    return (
      <div className="panel-section">
        <div className="panel-section-head">
          <h3>Propiedades</h3>
        </div>
        <p className="panel-empty-state">
          Selecciona un elemento en la hoja o en la lista de capas para editar su estilo.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <h3>{multi ? `${selectionCount} seleccionados` : 'Propiedades'}</h3>
        {!multi && selectedObject?.name && (
          <span className="panel-subtitle">{selectedObject.name}</span>
        )}
      </div>

      <label className="field field-opacity">
        <span>Opacidad</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          disabled={multi}
          value={multi ? 1 : (selectedObject?.opacity ?? 1)}
          onChange={(e) => updateSelectedProps({ opacity: Number(e.target.value) })}
        />
        <span className="field-hint">
          {multi ? '—' : `${Math.round((selectedObject?.opacity ?? 1) * 100)}%`}
        </span>
      </label>

      {isText && (
        <>
          <div className="panel-text-format">
            <TextFormatControls
              layout="inspector"
              style={textStyle ?? { fontSize }}
              onChange={updateSelectedProps}
              showBackground={!multi && selectedObject?.type === 'textbox'}
              showOutline
            />
          </div>
          {!multi && (
            <>
              <label className="field">
                <span>Rotación</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={Math.round(selectedObject?.angle ?? 0)}
                  onChange={(e) => updateSelectedProps({ angle: Number(e.target.value) })}
                />
                <span className="field-hint">{Math.round(selectedObject?.angle ?? 0)}°</span>
              </label>
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
            </>
          )}
        </>
      )}

      {!isText && presetId && (
        <SignalEditorPanel
          presetId={presetId}
          onPresetChange={(newId) => updateSelectedProps({ signalPresetId: newId })}
          numberValues={presetHost?.multiNumber
            ? (presetHost?.customNumberValues ?? [])
            : [presetHost?.customNumberValue ?? '']}
          onNumberValuesChange={(values, isMulti) => updateSelectedProps(
            isMulti ? { customNumberValues: values } : { customNumberValue: values[0] ?? '' },
          )}
        />
      )}

      {!isText && !multi && selectedObject?.customStationCount && trayectoPreset && (
        <>
          <div className="shape-preview trayecto-props-preview">
            <div
              className="shape-preview-inner shape-trayecto-preview"
              style={{ width: '100%', height: 56 }}
              dangerouslySetInnerHTML={{
                __html: previewTrayectoSvg(
                  selectedObject.customStationCountValue ?? trayectoPreset.defaultStationCount ?? 6,
                  trayectoPreset.height ?? 83,
                  trayectoPreset.trayectoTrackMode === TRAYECTO_TRACK_MODES.DOUBLE
                    ? TRAYECTO_TRACK_MODES.DOUBLE
                    : TRAYECTO_TRACK_MODES.SINGLE,
                  {
                    trayectoStationGap: selectedObject.trayectoStationGap,
                    trayectoStationWidth: selectedObject.trayectoStationWidth,
                  },
                  trayectoPreset,
                ),
              }}
            />
          </div>
          <label className="field">
            <span>Estaciones</span>
            <input
              type="number"
              min={trayectoPreset.minStationCount ?? 1}
              max={trayectoPreset.maxStationCount ?? 24}
              value={selectedObject.customStationCountValue ?? trayectoPreset.defaultStationCount ?? 6}
              onChange={(e) => {
                const min = trayectoPreset.minStationCount ?? 1;
                const max = trayectoPreset.maxStationCount ?? 24;
                const count = Math.min(max, Math.max(min, Number(e.target.value) || min));
                updateSelectedProps({ customStationCountValue: count });
              }}
            />
          </label>
          <label className="field">
            <span>Distancia entre estaciones (px)</span>
            <input
              type="number"
              min={trayectoPreset.minStationGap ?? 20}
              max={trayectoPreset.maxStationGap ?? 400}
              value={selectedObject.trayectoStationGap ?? trayectoPreset.defaultStationGap ?? 100}
              onChange={(e) => {
                const min = trayectoPreset.minStationGap ?? 20;
                const max = trayectoPreset.maxStationGap ?? 400;
                const gap = Math.min(max, Math.max(min, Number(e.target.value) || min));
                updateSelectedProps({ trayectoStationGap: gap });
              }}
            />
          </label>
          <label className="field">
            <span>Ancho de estación (px)</span>
            <input
              type="number"
              min={trayectoPreset.minStationWidth ?? 20}
              max={trayectoPreset.maxStationWidth ?? 200}
              value={selectedObject.trayectoStationWidth ?? trayectoPreset.defaultStationWidth ?? 62}
              onChange={(e) => {
                const min = trayectoPreset.minStationWidth ?? 20;
                const max = trayectoPreset.maxStationWidth ?? 200;
                const width = Math.min(max, Math.max(min, Number(e.target.value) || min));
                updateSelectedProps({ trayectoStationWidth: width });
              }}
            />
          </label>
        </>
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
                    <span>{isLineLike ? 'Color de línea' : isStrokeShape ? 'Color' : 'Trazo'}</span>
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
                        value={shownStrokeWidth}
                        onChange={(e) => updateSelectedProps({ strokeWidth: Number(e.target.value) })}
                      />
                      <span className="field-hint">{shownStrokeWidth} px</span>
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
                <button type="button" className="link-btn" onClick={() => updateSelectedProps({ fill: '' })}>
                  Sin relleno
                </button>
              )}
            </>
          )}
          {!multi && (
            <>
              <label className="field">
                <span>Rotación</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={Math.round(selectedObject?.angle ?? 0)}
                  onChange={(e) => updateSelectedProps({ angle: Number(e.target.value) })}
                />
                <span className="field-hint">{Math.round(selectedObject?.angle ?? 0)}°</span>
              </label>
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
            </>
          )}
        </>
      )}
    </div>
  );
}
