import { useCallback, useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import {
  exportCanvasJPEG,
  exportCanvasPDF,
  exportCanvasPNG,
  exportCanvasSVG,
  exportCanvasWebP,
  saveProjectJSON,
  exportSheetsAsPDF,
  exportSheetsAsPNG,
  sanitizeFilename,
} from '../utils/export';
import { deleteProject, loadProjectsFromStorage, upsertProject } from '../utils/storage';
import MenuBar from './MenuBar';
import MobileMenuSheet from './MobileMenuSheet';

export default function Header({ canvas, handlers, isCompact = false, mobileMenuOpen = false, onMobileMenuClose }) {
  const [projects, setProjects] = useState([]);
  const [showProjects, setShowProjects] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    setProjects(loadProjectsFromStorage());
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) setShowProjects(false);
    };
    if (showProjects) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showProjects]);

  const confirmDiscardChanges = () => {
    if (!canvas.isProjectDirty?.()) return true;
    return window.confirm('Hay cambios sin guardar. ¿Continuar sin guardar?');
  };

  const persistProject = useCallback(async () => {
    const data = await canvas.getProjectData();
    if (!data) return false;
    const { projects: next, ok, error } = upsertProject(projects, data);
    if (!ok) {
      window.alert(
        error === 'quota'
          ? 'No hay espacio suficiente en el navegador para guardar. Exporta el proyecto como .json o libera espacio.'
          : 'No se pudo guardar el proyecto.',
      );
      return false;
    }
    setProjects(next);
    canvas.markSaved();
    return true;
  }, [canvas, projects]);

  const saveCurrent = useCallback(async () => {
    await persistProject();
  }, [persistProject]);

  const saveProjectAsJson = useCallback(async (scope = 'all') => {
    const data = scope === 'sheet'
      ? await canvas.getActiveSheetProjectData?.()
      : await canvas.getProjectData();
    if (!data) return;
    const saved = await saveProjectJSON(data, sanitizeFilename(data.name || 'proyecto', 'json'));
    if (saved) canvas.showSavedHint?.('Proyecto guardado como .json');
  }, [canvas]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          void saveProjectAsJson('all');
        } else {
          void persistProject();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persistProject, saveProjectAsJson]);

  const loadProject = async (project) => {
    if (!confirmDiscardChanges()) return;
    await canvas.loadProjectData(project);
    setShowProjects(false);
  };

  const handleImportJSON = (file) => {
    if (!file) return;
    if (!confirmDiscardChanges()) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await canvas.loadProjectData(JSON.parse(e.target.result));
      } catch {
        window.alert('Archivo no válido.');
      }
    };
    reader.readAsText(file);
  };

  const menuHandlers = {
    new: () => {
      if (!confirmDiscardChanges()) return;
      canvas.newProject();
    },
    save: () => { void saveCurrent(); },
    saveAsJson: () => { void saveProjectAsJson('all'); },
    saveAsJsonSheet: () => { void saveProjectAsJson('sheet'); },
    openProjects: () => setShowProjects(true),
    importJson: () => document.getElementById('import-json-input')?.click(),
    exportPng: () => {
      const c = canvas.exportCanvas();
      if (c) void exportCanvasPNG(c, sanitizeFilename(canvas.projectName || 'ficha', 'png'));
    },
    exportJpeg: () => {
      const c = canvas.exportCanvas();
      if (c) void exportCanvasJPEG(c, sanitizeFilename(canvas.projectName || 'ficha', 'jpg'));
    },
    exportWebp: () => {
      const c = canvas.exportCanvas();
      if (c) void exportCanvasWebP(c, sanitizeFilename(canvas.projectName || 'ficha', 'webp'));
    },
    exportSvg: () => {
      const c = canvas.exportCanvas();
      if (c) void exportCanvasSVG(c, sanitizeFilename(canvas.projectName || 'ficha', 'svg'));
    },
    exportPdf: () => {
      const c = canvas.exportCanvas();
      if (c) void exportCanvasPDF(c, sanitizeFilename(canvas.projectName || 'ficha', 'pdf'));
    },
    exportPdfAll: async () => {
      const pages = await canvas.exportAllSheets('png');
      if (pages.length) {
        await exportSheetsAsPDF(pages, sanitizeFilename(canvas.projectName || 'proyecto', 'pdf'));
      }
    },
    exportPngAll: async () => {
      const pages = await canvas.exportAllSheets('png');
      if (pages.length) {
        await exportSheetsAsPNG(pages, canvas.projectName || 'proyecto');
      }
    },
    undo: canvas.undo,
    redo: canvas.redo,
    cut: canvas.cutSelected,
    copy: canvas.copySelected,
    paste: canvas.pasteClipboard,
    duplicate: canvas.duplicateSelected,
    selectAll: canvas.selectAll,
    delete: canvas.deleteSelected,
    clearAll: () => {
      if (window.confirm('¿Vaciar todo el lienzo?')) canvas.deleteAll();
    },
    group: canvas.groupSelected,
    ungroup: canvas.ungroupSelected,
    lock: canvas.lockSelected,
    unlock: canvas.unlockAll,
    zoomIn: () => canvas.zoomStepMultiply(1.25),
    zoomOut: () => canvas.zoomStepMultiply(1 / 1.25),
    zoomReset: () => canvas.setCanvasZoom(1),
    zoomFit: handlers.fitPageToViewport ?? (() => canvas.setCanvasZoom(1)),
    addText: canvas.addText,
    addImage: handlers.onImagePick,
    toolRect: () => canvas.setTool('rect'),
    toolCircle: () => canvas.setTool('circle'),
    toolLine: () => canvas.setTool('line'),
    toolPolyline: () => canvas.setTool('polyline'),
    toolArrow: () => canvas.setTool('arrow'),
    alignLeft: () => canvas.alignSelected('left'),
    alignCenterH: () => canvas.alignSelected('centerH'),
    alignRight: () => canvas.alignSelected('right'),
    alignTop: () => canvas.alignSelected('top'),
    alignCenterV: () => canvas.alignSelected('centerV'),
    alignBottom: () => canvas.alignSelected('bottom'),
    front: canvas.bringToFront,
    back: canvas.sendToBack,
    ...handlers,
  };

  return (
    <>
      <header className="title-bar">
        <div className="title-left">
          <span className="app-name">Estudio</span>
          <input
            className="doc-title"
            value={canvas.projectName}
            onChange={(e) => canvas.setProjectName(e.target.value)}
            placeholder="Sin título"
          />
          {canvas.savedHint && <span className="save-tag">{canvas.savedHint}</span>}
        </div>
        <div className="title-right">
          <button type="button" className="title-btn primary" onClick={() => { void saveCurrent(); }}>
            <Save size={15} />
            Guardar
          </button>
        </div>
      </header>

      <MenuBar canvas={canvas} handlers={menuHandlers} isCompact={isCompact} />

      {isCompact && (
        <MobileMenuSheet
          open={mobileMenuOpen}
          onClose={onMobileMenuClose}
          canvas={canvas}
          handlers={menuHandlers}
        />
      )}

      <input id="import-json-input" type="file" accept=".json" hidden onChange={(e) => handleImportJSON(e.target.files?.[0])} />

      {showProjects && (
        <div className="modal-overlay">
          <div className="modal" ref={modalRef}>
            <div className="modal-head">
              <h2>Proyectos guardados</h2>
              <button type="button" className="modal-close" onClick={() => setShowProjects(false)}>×</button>
            </div>
            {projects.length === 0 ? (
              <p className="modal-empty">Aún no has guardado ningún proyecto.</p>
            ) : (
              <ul className="project-list">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="project-row" onClick={() => { void loadProject(p); }}>
                      <strong>{p.name}</strong>
                      <span>{new Date(p.updatedAt).toLocaleString('es-ES')}</span>
                    </button>
                    <button
                      type="button"
                      className="project-del"
                      title="Eliminar"
                      onClick={() => {
                        if (window.confirm('¿Eliminar este proyecto?')) {
                          const { projects: next } = deleteProject(projects, p.id);
                          setProjects(next);
                        }
                      }}
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
