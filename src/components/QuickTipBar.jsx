import { useState } from 'react';
import { X } from 'lucide-react';

const TIP_KEY = 'estudio-quick-tip-dismissed';

export default function QuickTipBar({ isCompact }) {
  const [visible, setVisible] = useState(() => {
    if (!isCompact) return false;
    try {
      return sessionStorage.getItem(TIP_KEY) !== '1';
    } catch {
      return true;
    }
  });

  if (!visible || !isCompact) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(TIP_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="quick-tip-bar" role="note">
      <p>
        <strong>Empieza aquí:</strong> elige una herramienta abajo · desliza con un dedo para mover la hoja ·
        mantén pulsado para el menú · <strong>Panel</strong> abre capas y propiedades
      </p>
      <button type="button" className="quick-tip-dismiss" aria-label="Entendido" onClick={dismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
