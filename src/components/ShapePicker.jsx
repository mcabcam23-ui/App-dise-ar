import { useEffect, useRef, useState } from 'react';
import { PRESET_CATEGORIES, PRESET_SHAPES, getPresetShape } from '../constants/presetShapes';
import { resolveAssetUrl } from '../utils/assetUrl';
import { previewSignalFontSize, getArrowOverlayStyle, getNumberSlots, isMultiNumberPreset } from '../utils/signalNumberOverlay';
import { previewTrayectoSvg, trayectoNativeWidth, trayectoDefaultStationGap, trayectoDefaultStationWidth, TRAYECTO_TRACK_MODES } from '../utils/trayectoLine';
import { filterPickerGridShapes, formatSignalAspectLabel, getBaseVariantId } from '../utils/presetVariants';
import SignalEditorPanel from './SignalEditorPanel';
import TrayectoNumberInput from './ui/TrayectoNumberInput';

export default function ShapePicker({ addPresetShape }) {
  const [selectedId, setSelectedId] = useState(PRESET_SHAPES[0]?.id ?? '');
  const [open, setOpen] = useState(false);
  const [insertWidth, setInsertWidth] = useState(PRESET_SHAPES[0]?.width ?? 61);
  const [insertHeight, setInsertHeight] = useState(PRESET_SHAPES[0]?.height ?? 172);
  const [lockRatio, setLockRatio] = useState(true);
  const [signalNumber, setSignalNumber] = useState('100');
  const [signalNumbers, setSignalNumbers] = useState([]);
  const [signalArrow, setSignalArrow] = useState('right');
  const [stationCount, setStationCount] = useState(6);
  const [stationGap, setStationGap] = useState(100);
  const [stationWidth, setStationWidth] = useState(62);
  const pickerRef = useRef(null);
  const skipSizeResetRef = useRef(false);

  const selected = getPresetShape(selectedId) || PRESET_SHAPES[0];
  const numberSlots = getNumberSlots(selected);
  const isMultiNumber = isMultiNumberPreset(selected);
  const gridBaseId = getBaseVariantId(selectedId);
  const trayectoGeometry = selected?.customStationCount
    ? { trayectoStationGap: stationGap, trayectoStationWidth: stationWidth }
    : null;
  const aspectRatio = selected?.customStationCount
    ? trayectoNativeWidth(selected, stationCount, trayectoGeometry) / (selected.height || 1)
    : selected
      ? selected.width / selected.height
      : 1;

  useEffect(() => {
    if (!selected) return;
    if (skipSizeResetRef.current) {
      skipSizeResetRef.current = false;
      return;
    }
    setInsertWidth(selected.width);
    setInsertHeight(selected.height);
    if (selected.customNumber) {
      if (isMultiNumberPreset(selected)) {
        setSignalNumbers(getNumberSlots(selected).map(() => ''));
      } else {
        setSignalNumber('100');
      }
    }
    if (selected.customArrow) setSignalArrow(selected.arrowOverlay?.defaultDirection ?? 'right');
    if (selected.customStationCount) {
      const count = selected.defaultStationCount ?? 6;
      setStationCount(count);
      setStationGap(trayectoDefaultStationGap(selected));
      setStationWidth(trayectoDefaultStationWidth(selected));
      setInsertWidth(trayectoNativeWidth(selected, count, {
        trayectoStationGap: trayectoDefaultStationGap(selected),
        trayectoStationWidth: trayectoDefaultStationWidth(selected),
      }));
      setInsertHeight(selected.height);
    }
  }, [selectedId, selected?.width, selected?.height, selected?.customNumber, selected?.customArrow, selected?.customStationCount, selected?.defaultStationCount, selected?.defaultStationGap, selected?.defaultStationWidth, selected?.arrowOverlay?.defaultDirection]);

  useEffect(() => {
    const close = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const onWidthChange = (value) => {
    const w = Math.max(1, Number(value) || 1);
    setInsertWidth(w);
    if (lockRatio && selected) setInsertHeight(Math.max(1, Math.round(w / aspectRatio)));
  };

  const onHeightChange = (value) => {
    const h = Math.max(1, Number(value) || 1);
    setInsertHeight(h);
    if (lockRatio && selected) setInsertWidth(Math.max(1, Math.round(h * aspectRatio)));
  };

  const resetSize = () => {
    if (!selected) return;
    if (selected.customStationCount) {
      syncTrayectoWidth(stationCount, stationGap, stationWidth);
      return;
    }
    setInsertWidth(selected.width);
    setInsertHeight(selected.height);
  };

  const syncTrayectoWidth = (count, gap, width) => {
    if (!selected?.customStationCount) return;
    const w = trayectoNativeWidth(selected, count, {
      trayectoStationGap: gap,
      trayectoStationWidth: width,
    });
    setInsertWidth(w);
    if (lockRatio) setInsertHeight(selected.height);
  };

  const onStationCountChange = (count) => {
    if (!selected?.customStationCount) return;
    setStationCount(count);
    syncTrayectoWidth(count, stationGap, stationWidth);
  };

  const onStationGapChange = (gap) => {
    if (!selected?.customStationCount) return;
    setStationGap(gap);
    syncTrayectoWidth(stationCount, gap, stationWidth);
  };

  const onStationWidthChange = (width) => {
    if (!selected?.customStationCount) return;
    setStationWidth(width);
    syncTrayectoWidth(stationCount, stationGap, width);
  };

  const previewScale = selected
    ? Math.min(1, 72 / insertHeight, 120 / insertWidth)
    : 1;

  const overlayStyle = selected?.customNumber && !isMultiNumber && selected?.numberOverlay
    ? {
        fontSize: previewSignalFontSize(insertHeight * previewScale, selected.numberOverlay, signalNumber),
        left: `${(selected.numberOverlay.leftRatio ?? 0.5) * 100}%`,
        top: `${(selected.numberOverlay.topRatio ?? 0.56) * 100}%`,
        color: selected.numberOverlay.fill ?? '#111',
        fontFamily: selected.numberOverlay.fontFamily ?? 'Arial Black, Arial, sans-serif',
        fontWeight: selected.numberOverlay.fontWeight ?? 'bold',
      }
    : null;

  const multiOverlays = isMultiNumber
    ? numberSlots.map((overlay, i) => ({
        value: signalNumbers[i] ?? '',
        style: {
          fontSize: previewSignalFontSize(
            insertHeight * previewScale,
            overlay,
            signalNumbers[i] || '00',
            insertWidth * previewScale,
          ),
          left: `${(overlay.leftRatio ?? 0.5) * 100}%`,
          top: `${(overlay.topRatio ?? 0.5) * 100}%`,
          color: overlay.fill ?? '#111',
          fontFamily: overlay.fontFamily ?? 'Arial Black, Arial, sans-serif',
          fontWeight: overlay.fontWeight ?? 'bold',
        },
      }))
    : [];

  const arrowPreviewStyle = selected?.customArrow
    ? getArrowOverlayStyle(
        selected,
        signalArrow,
        insertWidth * previewScale,
        insertHeight * previewScale,
      )
    : null;

  const trayectoPreviewW = selected?.customStationCount
    ? trayectoNativeWidth(selected, stationCount, trayectoGeometry)
    : insertWidth;
  const trayectoPreviewSvg = selected?.customStationCount
    ? previewTrayectoSvg(
        stationCount,
        selected.height,
        selected.trayectoTrackMode === TRAYECTO_TRACK_MODES.DOUBLE
          ? TRAYECTO_TRACK_MODES.DOUBLE
          : TRAYECTO_TRACK_MODES.SINGLE,
        trayectoGeometry,
        selected,
      )
    : null;

  const changePreset = (newId) => {
    if (!newId || newId === selectedId) return;
    skipSizeResetRef.current = true;
    setSelectedId(newId);
  };

  const handleInsert = () => {
    if (selectedId) {
      addPresetShape(selectedId, undefined, {
        width: insertWidth,
        height: insertHeight,
        signalNumber: selected?.customNumber && !isMultiNumber ? signalNumber : undefined,
        signalNumbers: isMultiNumber ? signalNumbers : undefined,
        signalArrow: selected?.customArrow ? signalArrow : undefined,
        stationCount: selected?.customStationCount ? stationCount : undefined,
        stationGap: selected?.customStationCount ? stationGap : undefined,
        stationWidth: selected?.customStationCount ? stationWidth : undefined,
      });
    }
  };

  return (
    <div className="shape-picker" ref={pickerRef}>
      <label className="field">
        <span>Figura prefabricada</span>
        <button
          type="button"
          className="shape-picker-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {selected?.imageAsset && (
            <span className="shape-picker-thumb">
              <img src={resolveAssetUrl(selected.imageAsset)} alt="" />
            </span>
          )}
          <span className="shape-picker-label">
            {selected?.label ?? 'Elegir figura'}
            {gridBaseId !== selectedId && (
              <span className="shape-picker-aspect-tag">
                {' · '}
                {formatSignalAspectLabel(selected)}
              </span>
            )}
          </span>
          <span className="shape-picker-caret" aria-hidden>{open ? '▲' : '▼'}</span>
        </button>
      </label>

      {open && (
        <div className="shape-picker-drop">
          {PRESET_CATEGORIES.map((cat) => (
            <div key={cat.label} className="shape-cat">
              <div className="shape-cat-title">{cat.label}</div>
              {cat.groups.map((group) => (
                <div key={group.label ?? cat.label} className="shape-group">
                  {group.label && <div className="shape-group-title">{group.label}</div>}
                  <div className="shape-grid">
                    {filterPickerGridShapes(group.shapes).map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        className={`shape-item ${gridBaseId === shape.id ? 'sel' : ''}`}
                        title={`${shape.label} (${shape.width}×${shape.height})`}
                        onClick={() => {
                          setSelectedId(shape.id);
                          setOpen(false);
                        }}
                      >
                        <img
                          src={resolveAssetUrl(shape.imageAsset)}
                          alt={shape.label}
                          width={shape.width}
                          height={shape.height}
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="shape-preview">
            <div
              className="shape-preview-inner"
              style={{
                width: Math.round((selected.customStationCount ? trayectoPreviewW : insertWidth) * previewScale),
                height: Math.round(insertHeight * previewScale),
              }}
            >
              {trayectoPreviewSvg ? (
                <div
                  className="shape-trayecto-preview"
                  dangerouslySetInnerHTML={{ __html: trayectoPreviewSvg }}
                />
              ) : (
                <img
                  src={resolveAssetUrl(selected.imageAsset)}
                  alt={selected.label}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
              {overlayStyle && signalNumber && (
                <span className="shape-number-preview" style={overlayStyle}>
                  {signalNumber}
                </span>
              )}
              {multiOverlays.map((ov, i) => (
                ov.value ? (
                  <span key={i} className="shape-number-preview" style={ov.style}>
                    {ov.value}
                  </span>
                ) : null
              ))}
              {arrowPreviewStyle && selected?.arrowOverlay?.[signalArrow]?.imageAsset && (
                <img
                  className="shape-arrow-preview"
                  src={resolveAssetUrl(selected.arrowOverlay[signalArrow].imageAsset)}
                  alt=""
                  style={arrowPreviewStyle}
                />
              )}
            </div>
          </div>

          <SignalEditorPanel
            presetId={selectedId}
            onPresetChange={changePreset}
            showTypePicker={false}
          />

          {selected.customArrow && (
            <label className="field">
              <span>Dirección de la flecha</span>
              <select value={signalArrow} onChange={(e) => setSignalArrow(e.target.value)}>
                <option value="right">Señala a la derecha ↗</option>
                <option value="left">Señala a la izquierda ↖</option>
              </select>
            </label>
          )}

          {selected.customStationCount && (
            <>
              <TrayectoNumberInput
                label="Estaciones"
                value={stationCount}
                min={selected.minStationCount ?? 1}
                max={selected.maxStationCount ?? 24}
                onCommit={onStationCountChange}
              />
              <TrayectoNumberInput
                label="Distancia entre estaciones (px)"
                value={stationGap}
                min={selected.minStationGap ?? 20}
                max={selected.maxStationGap ?? 400}
                onCommit={onStationGapChange}
              />
              <TrayectoNumberInput
                label="Ancho de estación (px)"
                value={stationWidth}
                min={selected.minStationWidth ?? 20}
                max={selected.maxStationWidth ?? 200}
                onCommit={onStationWidthChange}
              />
            </>
          )}

          {selected.customNumber && !isMultiNumber && (
            <label className="field">
              <span>Número en la señal</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="Ej. 120"
                value={signalNumber}
                onChange={(e) => setSignalNumber(e.target.value.replace(/[^\d]/g, ''))}
              />
            </label>
          )}

          {selected.customNumber && isMultiNumber && (
            <div className="field">
              <span>Velocidades (de arriba a abajo)</span>
              <div className="shape-multi-number-inputs">
                {numberSlots.map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={`V${i + 1}`}
                    value={signalNumbers[i] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setSignalNumbers((prev) => {
                        const next = numberSlots.map((__, idx) => (
                          idx === i ? val : (prev[idx] ?? '')
                        ));
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="shape-size-fields">
            <label className="field">
              <span>Ancho (px)</span>
              <input
                type="number"
                min={1}
                max={4000}
                value={insertWidth}
                onChange={(e) => onWidthChange(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Alto (px)</span>
              <input
                type="number"
                min={1}
                max={4000}
                value={insertHeight}
                onChange={(e) => onHeightChange(e.target.value)}
              />
            </label>
          </div>

          <div className="shape-size-actions">
            <button
              type="button"
              className={`tb-text-btn ${lockRatio ? 'on' : ''}`}
              onClick={() => setLockRatio((v) => !v)}
            >
              {lockRatio ? 'Proporción fija' : 'Proporción libre'}
            </button>
            <button type="button" className="link-btn" onClick={resetSize}>
              Original ({selected.width}×{selected.height})
            </button>
          </div>
        </>
      )}

      <button type="button" className="btn-block" onClick={handleInsert}>
        Insertar figura
      </button>
    </div>
  );
}
