import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Minus,
  Plus,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { TEXT_MODE_OPTIONS } from '../constants/toolModes';
import { displayColor } from '../utils/objectStyles';
import { FONT_FAMILIES, FONT_SIZE_PRESETS } from '../constants/textStyles';
import {
  DropMenuDivider,
  DropMenuField,
  DropMenuFooter,
  DropMenuItem,
  DropMenuSection,
  DropSubmenu,
  ToolbarDropdown,
} from './ui/ToolbarDropdown';

const ALIGN_OPTIONS = [
  { id: 'left', icon: AlignLeft, label: 'Izquierda' },
  { id: 'center', icon: AlignCenter, label: 'Centro' },
  { id: 'right', icon: AlignRight, label: 'Derecha' },
  { id: 'justify', icon: AlignJustify, label: 'Justificado' },
];

function SegToggle({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      className={`txt-seg-btn ${active ? 'active' : ''}`}
      title={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function FontGroups({ value, onPick }) {
  const groups = [...new Set(FONT_FAMILIES.map((f) => f.group))];
  return groups.map((group, index) => (
    <div key={group}>
      {index > 0 && <DropMenuDivider />}
      <DropMenuSection label={group}>
        {FONT_FAMILIES.filter((f) => f.group === group).map((font) => (
          <DropMenuItem
            key={font.value}
            active={value === font.value}
            style={{ fontFamily: font.value }}
            onClick={() => onPick(font.value)}
          >
            {font.label}
          </DropMenuItem>
        ))}
      </DropMenuSection>
    </div>
  ));
}

function InspectorSection({ title, children, defaultOpen = true }) {
  return (
    <details className="txt-inspector-block" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="txt-inspector-body">{children}</div>
    </details>
  );
}

function TextToolbar({
  style,
  onChange,
  textMode,
  setTextMode,
  showBackground,
  showOutline,
  showOpacity,
}) {
  const patch = (next) => onChange?.(next);
  const modeMeta = TEXT_MODE_OPTIONS.find((m) => m.id === textMode) ?? TEXT_MODE_OPTIONS[0];
  const alignMeta = ALIGN_OPTIONS.find((a) => a.id === (style.textAlign ?? 'left')) ?? ALIGN_OPTIONS[0];
  const AlignIcon = alignMeta.icon;

  const nudgeSize = (delta) => {
    patch({ fontSize: Math.min(200, Math.max(8, (style.fontSize ?? 22) + delta)) });
  };

  return (
    <div className="txt-toolbar">
      {setTextMode && (
        <>
          <ToolbarDropdown
            label={modeMeta.label}
            title="Tipo de texto"
            className="txt-drop-type"
            minWidth={240}
          >
            {TEXT_MODE_OPTIONS.map((mode) => (
              <DropMenuItem
                key={mode.id}
                active={textMode === mode.id}
                onClick={() => setTextMode(mode.id)}
              >
                <span className="txt-drop-type-item">
                  <strong>{mode.label}</strong>
                  <small>{mode.hint}</small>
                </span>
              </DropMenuItem>
            ))}
          </ToolbarDropdown>
          <span className="txt-toolbar-sep" aria-hidden />
        </>
      )}

      <ToolbarDropdown
        label={style.fontFamily ?? 'Segoe UI'}
        title="Fuente"
        className="txt-drop-font"
        minWidth={220}
      >
        <FontGroups value={style.fontFamily ?? 'Segoe UI'} onPick={(v) => patch({ fontFamily: v })} />
      </ToolbarDropdown>

      <ToolbarDropdown
        label={String(style.fontSize ?? 22)}
        suffix="px"
        title="Tamaño"
        className="txt-drop-size"
        minWidth={148}
      >
        {FONT_SIZE_PRESETS.map((size) => (
          <DropMenuItem
            key={size}
            active={style.fontSize === size}
            onClick={() => patch({ fontSize: size })}
          >
            {size} px
          </DropMenuItem>
        ))}
        <DropMenuFooter>
          <div className="txt-size-stepper">
            <button type="button" className="txt-size-step" onClick={() => nudgeSize(-1)} aria-label="Reducir">
              <Minus size={13} />
            </button>
            <input
              type="number"
              min={8}
              max={200}
              value={style.fontSize ?? 22}
              onChange={(e) => patch({ fontSize: Number(e.target.value) })}
            />
            <button type="button" className="txt-size-step" onClick={() => nudgeSize(1)} aria-label="Aumentar">
              <Plus size={13} />
            </button>
          </div>
        </DropMenuFooter>
      </ToolbarDropdown>

      <label className="txt-color-swatch" title="Color del texto">
        <span style={{ background: displayColor(style.fill, '#222222') }} />
        <input
          type="color"
          value={displayColor(style.fill, '#222222')}
          onChange={(e) => patch({ fill: e.target.value })}
        />
      </label>

      <span className="txt-toolbar-sep" aria-hidden />

      <div className="txt-segment" role="group" aria-label="Estilo">
        <SegToggle
          active={style.fontWeight === 'bold'}
          title="Negrita"
          onClick={() => patch({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })}
        >
          <Bold size={14} strokeWidth={2.25} />
        </SegToggle>
        <SegToggle
          active={style.fontStyle === 'italic'}
          title="Cursiva"
          onClick={() => patch({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
        >
          <Italic size={14} strokeWidth={2.25} />
        </SegToggle>
        <SegToggle
          active={!!style.underline}
          title="Subrayado"
          onClick={() => patch({ underline: !style.underline })}
        >
          <Underline size={14} strokeWidth={2.25} />
        </SegToggle>
        <SegToggle
          active={!!style.linethrough}
          title="Tachado"
          onClick={() => patch({ linethrough: !style.linethrough })}
        >
          <Strikethrough size={14} strokeWidth={2.25} />
        </SegToggle>
      </div>

      <span className="txt-toolbar-sep" aria-hidden />

      <ToolbarDropdown
        icon={<AlignIcon size={15} strokeWidth={2.25} />}
        label={alignMeta.label}
        iconOnly
        title="Alineación"
        minWidth={160}
      >
        {ALIGN_OPTIONS.map(({ id, icon: Icon, label }) => (
          <DropMenuItem
            key={id}
            active={(style.textAlign ?? 'left') === id}
            onClick={() => patch({ textAlign: id })}
          >
            <span className="txt-drop-icon-row">
              <Icon size={14} strokeWidth={2.25} />
              {label}
            </span>
          </DropMenuItem>
        ))}
      </ToolbarDropdown>

      <ToolbarDropdown label="Opciones" title="Opciones avanzadas" className="txt-drop-more" minWidth={196}>
        <DropSubmenu label="Espaciado" minWidth={228}>
          <DropMenuField label="Interlineado">
            <input
              type="range"
              min={0.8}
              max={3}
              step={0.05}
              value={style.lineHeight ?? 1.2}
              onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
            />
            <em>{(style.lineHeight ?? 1.2).toFixed(2)}</em>
          </DropMenuField>
          <DropMenuField label="Entre letras">
            <input
              type="range"
              min={-50}
              max={400}
              step={5}
              value={style.charSpacing ?? 0}
              onChange={(e) => patch({ charSpacing: Number(e.target.value) })}
            />
            <em>{style.charSpacing ?? 0}</em>
          </DropMenuField>
        </DropSubmenu>

        <DropSubmenu label="Apariencia" minWidth={228}>
          {showOpacity && (
            <DropMenuField label="Opacidad">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={style.opacity ?? 1}
                onChange={(e) => patch({ opacity: Number(e.target.value) })}
              />
              <em>{Math.round((style.opacity ?? 1) * 100)}%</em>
            </DropMenuField>
          )}
          {showBackground && (
            <DropMenuField label="Fondo">
              <input
                type="color"
                value={displayColor(style.backgroundColor, '#ffffff')}
                onChange={(e) => patch({ backgroundColor: e.target.value })}
              />
            </DropMenuField>
          )}
          {showOutline && (
            <>
              <DropMenuField label="Contorno">
                <input
                  type="color"
                  value={displayColor(style.stroke, '#000000')}
                  onChange={(e) => patch({
                    stroke: e.target.value,
                    strokeWidth: Math.max(1, style.strokeWidth || 1),
                  })}
                />
              </DropMenuField>
              <DropMenuField label="Grosor">
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.5}
                  value={style.strokeWidth ?? 0}
                  onChange={(e) => {
                    const strokeWidth = Number(e.target.value);
                    patch({
                      strokeWidth,
                      stroke: strokeWidth > 0 ? (style.stroke || '#000000') : '',
                    });
                  }}
                />
                <em>{style.strokeWidth ?? 0}px</em>
              </DropMenuField>
              {(style.strokeWidth ?? 0) > 0 && (
                <button
                  type="button"
                  className="tb-drop-link"
                  onClick={() => patch({ stroke: '', strokeWidth: 0 })}
                >
                  Quitar contorno
                </button>
              )}
            </>
          )}
        </DropSubmenu>
      </ToolbarDropdown>
    </div>
  );
}

function TextInspector({ style, onChange, showBackground, showOutline }) {
  const patch = (next) => onChange?.(next);

  return (
    <div className="txt-inspector">
      <InspectorSection title="Tipografía">
        <label className="field">
          <span>Fuente</span>
          <select
            value={style.fontFamily ?? 'Segoe UI'}
            onChange={(e) => patch({ fontFamily: e.target.value })}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tamaño</span>
          <input
            type="number"
            min={8}
            max={200}
            value={style.fontSize ?? 22}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          />
        </label>
      </InspectorSection>

      <InspectorSection title="Estilo">
        <div className="txt-segment txt-segment-block">
          <SegToggle
            active={style.fontWeight === 'bold'}
            title="Negrita"
            onClick={() => patch({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })}
          >
            <Bold size={14} />
          </SegToggle>
          <SegToggle
            active={style.fontStyle === 'italic'}
            title="Cursiva"
            onClick={() => patch({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
          >
            <Italic size={14} />
          </SegToggle>
          <SegToggle
            active={!!style.underline}
            title="Subrayado"
            onClick={() => patch({ underline: !style.underline })}
          >
            <Underline size={14} />
          </SegToggle>
          <SegToggle
            active={!!style.linethrough}
            title="Tachado"
            onClick={() => patch({ linethrough: !style.linethrough })}
          >
            <Strikethrough size={14} />
          </SegToggle>
        </div>
      </InspectorSection>

      <InspectorSection title="Párrafo">
        <label className="field">
          <span>Alineación</span>
          <select
            value={style.textAlign ?? 'left'}
            onChange={(e) => patch({ textAlign: e.target.value })}
          >
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
            <option value="justify">Justificado</option>
          </select>
        </label>
        <label className="field">
          <span>Interlineado</span>
          <input
            type="range"
            min={0.8}
            max={3}
            step={0.05}
            value={style.lineHeight ?? 1.2}
            onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
          />
          <span className="field-hint">{(style.lineHeight ?? 1.2).toFixed(2)}</span>
        </label>
        <label className="field">
          <span>Espaciado</span>
          <input
            type="range"
            min={-50}
            max={400}
            step={5}
            value={style.charSpacing ?? 0}
            onChange={(e) => patch({ charSpacing: Number(e.target.value) })}
          />
          <span className="field-hint">{style.charSpacing ?? 0}</span>
        </label>
      </InspectorSection>

      <InspectorSection title="Colores">
        <label className="field inline">
          <span>Texto</span>
          <input
            type="color"
            value={displayColor(style.fill, '#222222')}
            onChange={(e) => patch({ fill: e.target.value })}
          />
        </label>
        {showBackground && (
          <label className="field inline">
            <span>Fondo</span>
            <input
              type="color"
              value={displayColor(style.backgroundColor, '#ffffff')}
              onChange={(e) => patch({ backgroundColor: e.target.value })}
            />
          </label>
        )}
        {showOutline && (
          <>
            <label className="field inline">
              <span>Contorno</span>
              <input
                type="color"
                value={displayColor(style.stroke, '#000000')}
                onChange={(e) => patch({
                  stroke: e.target.value,
                  strokeWidth: Math.max(1, style.strokeWidth || 1),
                })}
              />
            </label>
            <label className="field">
              <span>Grosor contorno</span>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={style.strokeWidth ?? 0}
                onChange={(e) => {
                  const strokeWidth = Number(e.target.value);
                  patch({
                    strokeWidth,
                    stroke: strokeWidth > 0 ? (style.stroke || '#000000') : '',
                  });
                }}
              />
              <span className="field-hint">{style.strokeWidth ?? 0} px</span>
            </label>
          </>
        )}
      </InspectorSection>
    </div>
  );
}

export default function TextFormatControls({
  style,
  onChange,
  layout = 'toolbar',
  textMode,
  setTextMode,
  showBackground = true,
  showOutline = true,
  showOpacity = true,
}) {
  if (layout === 'inspector') {
    return (
      <TextInspector
        style={style}
        onChange={onChange}
        showBackground={showBackground}
        showOutline={showOutline}
      />
    );
  }

  return (
    <TextToolbar
      style={style}
      onChange={onChange}
      textMode={textMode}
      setTextMode={setTextMode}
      showBackground={showBackground}
      showOutline={showOutline}
      showOpacity={showOpacity}
    />
  );
}
