import { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { exportCanvasJPEG, exportCanvasPDF, exportCanvasPNG, exportCanvasSVG, exportCanvasWebP, exportProjectJSON } from '../utils/export';
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

  const saveCurrent = () => {
    const data = canvas.getProjectData();
    if (!data) return;
    setProjects((prev) => upsertProject(prev, data));
    canvas.markSaved();
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const data = canvas.getProjectData();
        if (!data) return;
        setProjects((prev) => upsertProject(prev, data));
        canvas.markSaved();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canvas]);

  const loadProject = async (project) => {
    await canvas.loadProjectData(project);
    setShowProjects(false);
  };

  const handleImportJSON = (file) => {
    if (!file) return;
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
      if (window.confirm('¿Crear proyecto nuevo? Los cambios sin guardar se perderán.')) canvas.newProject();
    },
    save: saveCurrent,
    openProjects: () => setShowProjects(true),
    importJson: () => document.getElementById('import-json-input')?.click(),
    exportPng: () => {
      const c = canvas.exportCanvas();
      if (c) exportCanvasPNG(c, `${canvas.projectName || 'ficha'}.png`);
    },
    exportJpeg: () => {
      const c = canvas.exportCanvas();
      if (c) exportCanvasJPEG(c, `${canvas.projectName || 'ficha'}.jpg`);
    },
    exportWebp: () => {
      const c = canvas.exportCanvas();
      if (c) exportCanvasWebP(c, `${canvas.projectName || 'ficha'}.webp`);
    },
    exportSvg: () => {
      const c = canvas.exportCanvas();
      if (c) exportCanvasSVG(c, `${canvas.projectName || 'ficha'}.svg`);
    },
    exportPdf: () => {
      const c = canvas.exportCanvas();
      if (c) exportCanvasPDF(c, `${canvas.projectName || 'ficha'}.pdf`);
    },
    exportJson: () => {
      const data = canvas.getProjectData();
      if (data) exportProjectJSON(data, `${data.name || 'proyecto'}.json`);
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
    zoomIn: () => canvas.setCanvasZoom(Math.min(2, canvas.zoom + 0.1)),
    zoomOut: () => canvas.setCanvasZoom(Math.max(0.4, canvas.zoom - 0.1)),
    zoomReset: () => canvas.setCanvasZoom(1),
    zoomFit: () => canvas.setCanvasZoom(0.85),
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
          <button type="button" className="title-btn primary" onClick={saveCurrent}>
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
                    <button type="button" className="project-row" onClick={() => loadProject(p)}>
                      <strong>{p.name}</strong>
                      <span>{new Date(p.updatedAt).toLocaleString('es-ES')}</span>
                    </button>
                    <button
                      type="button"
                      className="project-del"
                      title="Eliminar"
                      onClick={() => {
                        if (window.confirm('¿Eliminar este proyecto?')) setProjects(deleteProject(projects, p.id));
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
