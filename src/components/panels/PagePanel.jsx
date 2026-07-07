import { PAGE_SIZES } from '../../constants/pageSizes';
import { BACKGROUND_PRESETS, OVERLAY_OPTIONS } from '../../constants/pageBackgrounds';

export default function PagePanel({
  pageSizeKey,
  resizePage,
  backgroundColor,
  setBackground,
  applyBackgroundPreset,
  pageOverlayType,
  pageOverlaySpacing,
  pageOverlayColor,
  setPageOverlay,
  setBackgroundImage,
  clearBackgroundImage,
}) {
  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <h3>Página</h3>
      </div>
      <label className="field">
        <span>Tamaño de hoja</span>
        <select value={pageSizeKey} onChange={(e) => resizePage(e.target.value)}>
          {Object.entries(PAGE_SIZES).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </label>

      <div className="panel-section-head sub">
        <h3>Fondos predeterminados</h3>
      </div>
      <div className="bg-preset-grid">
        {BACKGROUND_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="bg-preset-btn"
            title={preset.label}
            onClick={() => applyBackgroundPreset(preset.id)}
          >
            <span
              className="bg-preset-swatch"
              style={{
                backgroundColor: preset.color,
                backgroundImage: preset.overlay === 'grid'
                  ? 'linear-gradient(#0001 1px, transparent 1px), linear-gradient(90deg, #0001 1px, transparent 1px)'
                  : preset.overlay === 'lines'
                    ? 'linear-gradient(#0002 1px, transparent 1px)'
                    : undefined,
                backgroundSize: preset.overlay ? '12px 12px' : undefined,
              }}
            />
            <span className="bg-preset-label">{preset.label}</span>
          </button>
        ))}
      </div>

      <div className="panel-section-head sub">
        <h3>Fondo personalizado</h3>
      </div>
      <label className="field inline">
        <span>Color de fondo</span>
        <input type="color" value={backgroundColor} onChange={(e) => setBackground(e.target.value)} />
      </label>
      <label className="btn-block">
        Imagen de fondo
        <input type="file" accept="image/*" hidden onChange={(e) => setBackgroundImage(e.target.files?.[0])} />
      </label>
      <button type="button" className="link-btn" onClick={clearBackgroundImage}>Quitar imagen de fondo</button>

      <div className="panel-section-head sub">
        <h3>Guías de la hoja</h3>
      </div>
      <label className="field">
        <span>Tipo de guía</span>
        <select
          value={pageOverlayType}
          onChange={(e) => setPageOverlay(e.target.value, pageOverlaySpacing, pageOverlayColor)}
        >
          {OVERLAY_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </label>
      {pageOverlayType !== 'none' && (
        <>
          <label className="field">
            <span>Separación ({pageOverlaySpacing}px)</span>
            <input
              type="range"
              min={8}
              max={80}
              value={pageOverlaySpacing}
              onChange={(e) => setPageOverlay(pageOverlayType, Number(e.target.value), pageOverlayColor)}
            />
          </label>
          <label className="field inline">
            <span>Color de guía</span>
            <input
              type="color"
              value={pageOverlayColor}
              onChange={(e) => setPageOverlay(pageOverlayType, pageOverlaySpacing, e.target.value)}
            />
          </label>
        </>
      )}
    </div>
  );
}
