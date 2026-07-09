import {
  PenTool,
  Hand,
  Sparkles,
  Compass,
  Magnet,
  RotateCcw,
} from 'lucide-react';
import ToggleSwitch from '../ui/ToggleSwitch';
import { isTouchUiPreferred } from '../../constants/breakpoints';

const DEFAULTS = {
  palmRejection: false,
  penSmoothing: true,
  snapRotation: true,
  trackSnap: true,
};

export default function SettingsPanel({ settings, updateSetting, resetLayout }) {
  const value = { ...DEFAULTS, ...(settings || {}) };
  const set = (key) => (next) => updateSetting?.(key, next);
  const touchUi = typeof window !== 'undefined' && isTouchUiPreferred();

  return (
    <div className="panel-section settings-panel">
      <div className="panel-section-head">
        <h3>Ajustes</h3>
      </div>
      <p className="settings-intro">
        Preferencias de dibujo e interacción. Se guardan en este dispositivo.
      </p>

      <section className="settings-group">
        <h4 className="settings-group-title">
          <PenTool size={15} strokeWidth={2} />
          Lápiz y dibujo
        </h4>
        <div className="settings-list">
          <ToggleSwitch
            icon={Hand}
            label="Solo lápiz óptico"
            hint={touchUi
              ? 'Solo para stylus: con el dedo no podrás dibujar ni borrar. Desactívalo si usas el dedo en móvil/tablet.'
              : 'Apoya la mano sin pintar: al dibujar, solo responde el lápiz (ignora dedos y palma).'}
            checked={value.palmRejection}
            onChange={set('palmRejection')}
          />
          <ToggleSwitch
            icon={Sparkles}
            label="Suavizar trazo"
            hint="Redondea las líneas del lápiz para un trazo más limpio."
            checked={value.penSmoothing}
            onChange={set('penSmoothing')}
          />
        </div>
      </section>

      <section className="settings-group">
        <h4 className="settings-group-title">
          <Magnet size={15} strokeWidth={2} />
          Imán y ajuste
        </h4>
        <div className="settings-list">
          <ToggleSwitch
            icon={Compass}
            label="Ajustar rotación"
            hint="Al girar objetos, encaja en ángulos fijos (0°, 45°, 90°…)."
            checked={value.snapRotation}
            onChange={set('snapRotation')}
          />
          <ToggleSwitch
            icon={Magnet}
            label="Imán a la vía"
            hint="Al acercar una señal a la vía, se alinea al trazo; al alejarla, se suelta."
            checked={value.trackSnap}
            onChange={set('trackSnap')}
          />
        </div>
      </section>

      <section className="settings-group">
        <h4 className="settings-group-title">
          <RotateCcw size={15} strokeWidth={2} />
          Interfaz
        </h4>
        <div className="settings-list">
          <button type="button" className="btn-block" onClick={resetLayout}>
            Restablecer disposición
          </button>
          <p className="settings-note">
            Devuelve paneles, barras y tamaños a sus valores por defecto. Recarga la página.
          </p>
        </div>
      </section>
    </div>
  );
}
