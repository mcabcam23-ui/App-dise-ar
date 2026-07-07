import { useEffect, useRef, useState } from 'react';
import { PRESET_CATEGORIES, PRESET_SHAPES, getPresetShape } from '../constants/presetShapes';
import { resolveAssetUrl } from '../utils/assetUrl';
import { previewSignalFontSize, getArrowOverlayStyle } from '../utils/signalNumberOverlay';

export default function ShapePicker({ addPresetShape }) {
  const [selectedId, setSelectedId] = useState(PRESET_SHAPES[0]?.id ?? '');
  const [open, setOpen] = useState(false);
  const [insertWidth, setInsertWidth] = useState(PRESET_SHAPES[0]?.width ?? 61);
  const [insertHeight, setInsertHeight] = useState(PRESET_SHAPES[0]?.height ?? 172);
  const [lockRatio, setLockRatio] = useState(true);
  const [signalNumber, setSignalNumber] = useState('100');
  const [signalArrow, setSignalArrow] = useState('right');
  const pickerRef = useRef(null);

  const selected = getPresetShape(selectedId) || PRESET_SHAPES[0];
  const aspectRatio = selected ? selected.width / selected.height : 1;

  useEffect(() => {
    if (!selected) return;
    setInsertWidth(selected.width);
    setInsertHeight(selected.height);
    if (selected.customNumber) setSignalNumber('100');
    if (selected.customArrow) setSignalArrow(selected.arrowOverlay?.defaultDirection ?? 'right');
  }, [selectedId, selected?.width, selected?.height, selected?.customNumber, selected?.customArrow, selected?.arrowOverlay?.defaultDirection]);

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
    setInsertWidth(selected.width);
    setInsertHeight(selected.height);
  };

  const previewScale = selected
    ? Math.min(1, 72 / insertHeight, 120 / insertWidth)
    : 1;

  const overlayStyle = selected?.customNumber && selected?.numberOverlay
    ? {
        fontSize: previewSignalFontSize(insertHeight * previewScale, selected.numberOverlay, signalNumber),
        left: `${(selected.numberOverlay.leftRatio ?? 0.5) * 100}%`,
        top: `${(selected.numberOverlay.topRatio ?? 0.56) * 100}%`,
        color: selected.numberOverlay.fill ?? '#111',
        fontFamily: selected.numberOverlay.fontFamily ?? 'Arial Black, Arial, sans-serif',
        fontWeight: selected.numberOverlay.fontWeight ?? 'bold',
      }
    : null;

  const arrowPreviewStyle = selected?.customArrow
    ? getArrowOverlayStyle(
        selected,
        signalArrow,
        insertWidth * previewScale,
        insertHeight * previewScale,
      )
    : null;

  const handleInsert = () => {
    if (selectedId) {
      addPresetShape(selectedId, undefined, {
        width: insertWidth,
        height: insertHeight,
        signalNumber: selected?.customNumber ? signalNumber : undefined,
        signalArrow: selected?.customArrow ? signalArrow : undefined,
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
          <span className="shape-picker-label">{selected?.label ?? 'Elegir figura'}</span>
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
                    {group.shapes.map((shape) => (
                      <button
                        key={shape.id}
                        type="button"
                        className={`shape-item ${shape.id === selectedId ? 'sel' : ''}`}
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
                width: Math.round(insertWidth * previewScale),
                height: Math.round(insertHeight * previewScale),
              }}
            >
              <img
                src={resolveAssetUrl(selected.imageAsset)}
                alt={selected.label}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
              {overlayStyle && signalNumber && (
                <span className="shape-number-preview" style={overlayStyle}>
                  {signalNumber}
                </span>
              )}
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

          {selected.customArrow && (
            <label className="field">
              <span>Dirección de la flecha</span>
              <select value={signalArrow} onChange={(e) => setSignalArrow(e.target.value)}>
                <option value="right">Señala a la derecha ↗</option>
                <option value="left">Señala a la izquierda ↖</option>
              </select>
            </label>
          )}

          {selected.customNumber && (
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
