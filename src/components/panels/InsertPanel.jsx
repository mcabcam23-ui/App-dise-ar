import ShapePicker from '../ShapePicker';

export default function InsertPanel({ addPresetShape, onShapeFilePick }) {
  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <h3>Insertar figuras</h3>
      </div>
      <p className="panel-section-desc">
        Elige una figura prefabricada para colocarla en la hoja. También puedes importar SVG o imagen.
      </p>
      <ShapePicker addPresetShape={addPresetShape} />
      <label className="btn-block muted" style={{ marginTop: 10 }}>
        Imagen o SVG externo…
        <input type="file" accept="image/*,.svg" hidden onChange={(e) => onShapeFilePick(e.target.files?.[0])} />
      </label>
    </div>
  );
}
