import {
  OsnapEndpointIcon,
  OsnapLineIcon,
  OsnapGridSnapIcon,
  GridToggleIcon,
} from './icons/OsnapIcons';

export default function SnapQuickToggles({ settings, updateSetting, compact = false }) {
  const snapEndpoint = settings?.snapEndpoint ?? true;
  const snapOnLine = settings?.snapOnLine ?? true;
  const snapGrid = settings?.snapGrid ?? false;
  const showGrid = settings?.showGrid ?? false;

  const toggle = (key) => () => updateSetting?.(key, !settings?.[key]);

  return (
    <div className={`snap-quick-toggles ${compact ? 'is-compact' : ''}`} role="group" aria-label="Referencia y cuadrícula">
      <button
        type="button"
        className={`snap-quick-btn snap-quick-btn--endpoint ${snapEndpoint ? 'active' : ''}`}
        title="Punto con punto — vértices, extremos y puntos medios (marca verde ·)"
        aria-pressed={snapEndpoint}
        onClick={toggle('snapEndpoint')}
      >
        <OsnapEndpointIcon size={14} />
        {!compact && <span>Punto</span>}
      </button>
      <button
        type="button"
        className={`snap-quick-btn snap-quick-btn--line ${snapOnLine ? 'active' : ''}`}
        title="Punto con línea — perpendicular o sobre el trazo (marca naranja ⊥)"
        aria-pressed={snapOnLine}
        onClick={toggle('snapOnLine')}
      >
        <OsnapLineIcon size={14} />
        {!compact && <span>Línea</span>}
      </button>
      <button
        type="button"
        className={`snap-quick-btn ${snapGrid ? 'active' : ''}`}
        title="Imán a cuadrícula — intersecciones; multilínea/línea solo horizontal o vertical"
        aria-pressed={snapGrid}
        onClick={toggle('snapGrid')}
      >
        <OsnapGridSnapIcon size={14} />
        {!compact && <span>Imán</span>}
      </button>
      <button
        type="button"
        className={`snap-quick-btn ${showGrid ? 'active' : ''}`}
        title="Cuadrícula visual (se adapta al zoom, como AutoCAD)"
        aria-pressed={showGrid}
        onClick={toggle('showGrid')}
      >
        <GridToggleIcon size={14} />
        {!compact && <span>Cuadrícula</span>}
      </button>
    </div>
  );
}
