import { useEffect } from 'react';
import {
  ClipboardList,
  Layers,
  LayoutTemplate,
  PackagePlus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  PANEL_SECTIONS,
  PANEL_SECTION_OPTIONS,
  savePanelSection,
} from '../constants/panelSections';
import DocumentPanel from './panels/DocumentPanel';
import InsertPanel from './panels/InsertPanel';
import LayersPanel from './panels/LayersPanel';
import PagePanel from './panels/PagePanel';
import PropertiesPanel from './panels/PropertiesPanel';

const SECTION_ICONS = {
  [PANEL_SECTIONS.LAYERS]: Layers,
  [PANEL_SECTIONS.INSERT]: PackagePlus,
  [PANEL_SECTIONS.PROPERTIES]: SlidersHorizontal,
  [PANEL_SECTIONS.PAGE]: LayoutTemplate,
  [PANEL_SECTIONS.DOCUMENT]: ClipboardList,
};

export default function RightPanel({ isCompact = false, section, onSectionChange, onClose, ...props }) {
  const activeSection = section ?? PANEL_SECTIONS.LAYERS;

  useEffect(() => {
    savePanelSection(activeSection);
  }, [activeSection]);

  const changeSection = (id) => {
    onSectionChange?.(id);
  };

  const activeMeta = PANEL_SECTION_OPTIONS.find((s) => s.id === activeSection);

  return (
    <aside className={`right-panel-shell ${isCompact ? 'is-compact' : ''}`}>
      <div className="right-panel-content">
        <div className="panel-content-header">
          <div className="panel-content-head-text">
            <span className="panel-content-title">{activeMeta?.label}</span>
            <span className="panel-content-hint">{activeMeta?.hint}</span>
          </div>
          {isCompact && onClose && (
            <button type="button" className="panel-close-btn" aria-label="Cerrar panel" onClick={onClose}>
              <X size={18} />
            </button>
          )}
        </div>

        {activeSection === PANEL_SECTIONS.LAYERS && (
          <LayersPanel
            objects={props.objects}
            selectedObject={props.selectedObject}
            selectionCount={props.selectionCount}
            selectObjectByRef={props.selectObjectByRef}
            toggleObjectVisibility={props.toggleObjectVisibility}
            toggleObjectLock={props.toggleObjectLock}
            renameObject={props.renameObject}
            duplicateObject={props.duplicateObject}
            removeObject={props.removeObject}
            moveLayer={props.moveLayer}
            reorderLayerToVisualIndex={props.reorderLayerToVisualIndex}
            setAllLayersVisibility={props.setAllLayersVisibility}
            unlockAll={props.unlockAll}
          />
        )}

        {activeSection === PANEL_SECTIONS.INSERT && (
          <InsertPanel
            addPresetShape={props.addPresetShape}
            onShapeFilePick={props.onShapeFilePick}
          />
        )}

        {activeSection === PANEL_SECTIONS.PROPERTIES && (
          <PropertiesPanel
            selectedObject={props.selectedObject}
            selectionCount={props.selectionCount}
            updateSelectedProps={props.updateSelectedProps}
            fontSize={props.fontSize}
            strokeWidth={props.strokeWidth}
            bringForward={props.bringForward}
            sendBackward={props.sendBackward}
            bringToFront={props.bringToFront}
            sendToBack={props.sendToBack}
          />
        )}

        {activeSection === PANEL_SECTIONS.PAGE && (
          <PagePanel
            pageSizeKey={props.pageSizeKey}
            resizePage={props.resizePage}
            backgroundColor={props.backgroundColor}
            setBackground={props.setBackground}
            applyBackgroundPreset={props.applyBackgroundPreset}
            pageOverlayType={props.pageOverlayType}
            pageOverlaySpacing={props.pageOverlaySpacing}
            pageOverlayColor={props.pageOverlayColor}
            setPageOverlay={props.setPageOverlay}
            setBackgroundImage={props.setBackgroundImage}
            clearBackgroundImage={props.clearBackgroundImage}
          />
        )}

        {activeSection === PANEL_SECTIONS.DOCUMENT && (
          <DocumentPanel
            objects={props.objects}
            selectionCount={props.selectionCount}
            unlockAll={props.unlockAll}
            deleteAll={props.deleteAll}
            duplicateSelected={props.duplicateSelected}
            groupSelected={props.groupSelected}
            ungroupSelected={props.ungroupSelected}
            deselectAll={props.deselectAll}
            removeHiddenLayers={props.removeHiddenLayers}
          />
        )}
      </div>

      <nav className="right-panel-rail" aria-label="Secciones del panel">
        {PANEL_SECTION_OPTIONS.map((opt) => {
          const Icon = SECTION_ICONS[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              className={`panel-rail-btn ${activeSection === opt.id ? 'active' : ''}`}
              title={`${opt.label} — ${opt.hint}`}
              aria-current={activeSection === opt.id ? 'page' : undefined}
              onClick={() => changeSection(opt.id)}
            >
              <Icon size={20} strokeWidth={1.75} />
              <span className="panel-rail-label">{opt.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
