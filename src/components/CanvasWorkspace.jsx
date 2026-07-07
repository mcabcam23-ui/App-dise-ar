import { useRef, useCallback, useEffect, useState } from 'react';
import { PanelRight, PanelRightClose } from 'lucide-react';
import { useFabricCanvas } from '../hooks/useFabricCanvas';
import { loadProjectsFromStorage, upsertProject } from '../utils/storage';
import AppChrome from './AppChrome';
import TopToolbar from './TopToolbar';
import RightPanel from './RightPanel';
import Header from './Header';
import StatusBar from './StatusBar';
import ContextMenu from './ContextMenu';

const PANEL_WIDTH_KEY = 'estudio-panel-width';
const CHROME_HEIGHT_KEY = 'estudio-chrome-height';
const CHROME_COLLAPSED_KEY = 'estudio-chrome-collapsed';
const PANEL_MIN = 220;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 260;
const CHROME_MIN = 88;
const CHROME_MAX = 420;
const COMPACT_QUERY = '(max-width: 768px)';
const VIEWPORT_DRAWING_TOOLS = new Set(['pen', 'rect', 'circle', 'line', 'polyline', 'arrow']);

function touchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function touchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

export default function CanvasWorkspace() {
  const containerRef = useRef(null);
  const scrollRef = useRef(null);
  const imageInputRef = useRef(null);
  const canvas = useFabricCanvas(containerRef);
  const panelDragRef = useRef({ active: false, startX: 0, startWidth: PANEL_DEFAULT });
  const chromeDragRef = useRef({ active: false, startY: 0, startHeight: CHROME_MIN });
  const gestureRef = useRef({ mode: 'idle', lastDist: 0, lastCenter: null, lastX: 0, lastY: 0, startX: 0, startY: 0 });

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    return saved >= PANEL_MIN && saved <= PANEL_MAX ? saved : PANEL_DEFAULT;
  });
  const [panelDragging, setPanelDragging] = useState(false);
  const [chromeHeight, setChromeHeight] = useState(() => {
    const saved = Number(localStorage.getItem(CHROME_HEIGHT_KEY));
    return saved >= CHROME_MIN && saved <= CHROME_MAX ? saved : null;
  });
  const [chromeResizerDragging, setChromeResizerDragging] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia(COMPACT_QUERY).matches);
  const [chromeCollapsed, setChromeCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(COMPACT_QUERY).matches && localStorage.getItem(CHROME_COLLAPSED_KEY) === '1';
  });

  const onImagePick = useCallback(() => imageInputRef.current?.click(), []);

  const handleImageFile = (file) => {
    if (file) canvas.addImageFromFile(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) canvas.addImageFromFile(file);
  };

  const panRef = useRef({ active: false, x: 0, y: 0 });

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = (e) => {
      setIsCompact(e.matches);
      if (!e.matches) {
        setPanelOpen(true);
        setChromeCollapsed(false);
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleChromeCollapsed = useCallback(() => {
    setChromeCollapsed((prev) => {
      const next = !prev;
      if (isCompact) localStorage.setItem(CHROME_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }, [isCompact]);

  const applyZoomAtPoint = useCallback((newZoom, clientX, clientY) => {
    const el = scrollRef.current;
    const clamped = Math.min(4, Math.max(0.2, newZoom));
    if (!el) {
      canvas.setCanvasZoom(clamped);
      return;
    }
    const oldZoom = canvas.zoom;
    if (Math.abs(clamped - oldZoom) < 0.0001) return;
    const rect = el.getBoundingClientRect();
    const offsetX = clientX - rect.left + el.scrollLeft;
    const offsetY = clientY - rect.top + el.scrollTop;
    const ratio = clamped / oldZoom;
    canvas.setCanvasZoom(clamped);
    requestAnimationFrame(() => {
      el.scrollLeft = offsetX * ratio - (clientX - rect.left);
      el.scrollTop = offsetY * ratio - (clientY - rect.top);
    });
  }, [canvas]);

  const applyZoomAtCenter = useCallback((newZoom) => {
    const el = scrollRef.current;
    if (!el) {
      canvas.setCanvasZoom(newZoom);
      return;
    }
    const rect = el.getBoundingClientRect();
    applyZoomAtPoint(newZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [applyZoomAtPoint, canvas]);

  const saveCurrentProject = useCallback(() => {
    const data = canvas.getProjectData();
    if (!data) return;
    upsertProject(loadProjectsFromStorage(), data);
    canvas.markSaved();
  }, [canvas]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      applyZoomAtPoint(canvas.zoom + delta, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoomAtPoint, canvas.zoom]);

  // Gestos táctiles: pellizco (zoom+desplazar) y un dedo (desplazar vista)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const resetGesture = () => {
      if (gestureRef.current.mode === 'pan' || gestureRef.current.mode === 'pan-pending') {
        canvas.setViewportGestureLock(false);
      }
      gestureRef.current = { mode: 'idle', lastDist: 0, lastCenter: null, lastX: 0, lastY: 0, startX: 0, startY: 0 };
      el.classList.remove('pinch-zooming', 'viewport-panning');
    };

    const canOneFingerPan = () => isCompact && !VIEWPORT_DRAWING_TOOLS.has(canvas.tool);

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        const center = touchCenter(e.touches);
        gestureRef.current = {
          mode: 'pinch',
          lastDist: touchDistance(e.touches),
          lastCenter: center,
          lastX: center.x,
          lastY: center.y,
        };
        el.classList.add('pinch-zooming');
        canvas.setViewportGestureLock(true);
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        if (canOneFingerPan() || canvas.tool === 'pan') {
          gestureRef.current = {
            mode: 'pan-pending',
            startX: t.clientX,
            startY: t.clientY,
            lastX: t.clientX,
            lastY: t.clientY,
            lastDist: 0,
            lastCenter: null,
          };
        }
      }
    };

    const onTouchMove = (e) => {
      const g = gestureRef.current;
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      if (g.mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault();
        const dist = touchDistance(e.touches);
        const center = touchCenter(e.touches);
        if (g.lastDist > 0) {
          const scale = dist / g.lastDist;
          applyZoomAtPoint(canvas.zoom * scale, center.x, center.y);
        }
        if (g.lastCenter) {
          scrollEl.scrollLeft -= center.x - g.lastCenter.x;
          scrollEl.scrollTop -= center.y - g.lastCenter.y;
        }
        g.lastDist = dist;
        g.lastCenter = center;
        return;
      }

      if (e.touches.length !== 1) return;
      const t = e.touches[0];

      if (g.mode === 'pan-pending') {
        const dx = t.clientX - g.startX;
        const dy = t.clientY - g.startY;
        if (Math.hypot(dx, dy) > 6) {
          g.mode = 'pan';
          canvas.setViewportGestureLock(true);
          el.classList.add('viewport-panning');
        }
      }

      if (g.mode === 'pan') {
        e.preventDefault();
        scrollEl.scrollLeft -= t.clientX - g.lastX;
        scrollEl.scrollTop -= t.clientY - g.lastY;
        g.lastX = t.clientX;
        g.lastY = t.clientY;
      }
    };

    const onTouchEnd = () => resetGesture();

    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    el.addEventListener('touchend', onTouchEnd, { capture: true });
    el.addEventListener('touchcancel', onTouchEnd, { capture: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart, { capture: true });
      el.removeEventListener('touchmove', onTouchMove, { capture: true });
      el.removeEventListener('touchend', onTouchEnd, { capture: true });
      el.removeEventListener('touchcancel', onTouchEnd, { capture: true });
    };
  }, [applyZoomAtPoint, canvas, isCompact]);

  useEffect(() => {
    const onMove = (e) => {
      if (panelDragRef.current.active) {
        const delta = panelDragRef.current.startX - e.clientX;
        const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, panelDragRef.current.startWidth + delta));
        setPanelWidth(next);
      }
      if (chromeDragRef.current.active) {
        const delta = e.clientY - chromeDragRef.current.startY;
        const next = Math.min(CHROME_MAX, Math.max(CHROME_MIN, chromeDragRef.current.startHeight + delta));
        setChromeHeight(next);
      }
    };
    const onUp = () => {
      if (panelDragRef.current.active) {
        panelDragRef.current.active = false;
        setPanelDragging(false);
        setPanelWidth((w) => {
          localStorage.setItem(PANEL_WIDTH_KEY, String(w));
          return w;
        });
      }
      if (chromeDragRef.current.active) {
        chromeDragRef.current.active = false;
        setChromeResizerDragging(false);
        setChromeHeight((h) => {
          if (h != null) localStorage.setItem(CHROME_HEIGHT_KEY, String(h));
          return h;
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onPanelResizeDown = (e) => {
    panelDragRef.current = { active: true, startX: e.clientX, startWidth: panelWidth };
    setPanelDragging(true);
    e.preventDefault();
  };

  const onChromeResizeDown = (e) => {
    const node = e.currentTarget.parentElement;
    const current = node?.getBoundingClientRect().height ?? CHROME_MIN;
    chromeDragRef.current = { active: true, startY: e.clientY, startHeight: current };
    setChromeResizerDragging(true);
    e.preventDefault();
  };

  const onPanDown = (e) => {
    if (canvas.tool !== 'pan') return;
    panRef.current = { active: true, x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  };
  const onPanMove = (e) => {
    if (!panRef.current.active || !scrollRef.current) return;
    scrollRef.current.scrollLeft -= e.clientX - panRef.current.x;
    scrollRef.current.scrollTop -= e.clientY - panRef.current.y;
    panRef.current.x = e.clientX;
    panRef.current.y = e.clientY;
  };
  const onPanUp = (e) => {
    panRef.current.active = false;
    e.currentTarget.style.cursor = canvas.tool === 'pan' ? 'grab' : '';
  };

  return (
    <div className="app-shell">
      <AppChrome
        collapsed={chromeCollapsed}
        onToggleCollapsed={toggleChromeCollapsed}
        height={chromeHeight}
        onResizeStart={onChromeResizeDown}
        resizerDragging={chromeResizerDragging}
        isCompact={isCompact}
        projectName={canvas.projectName}
        onSave={saveCurrentProject}
      >
        <Header canvas={canvas} handlers={{ onImagePick }} />
        <TopToolbar
          tool={canvas.tool}
          setTool={canvas.setTool}
          strokeColor={canvas.strokeColor}
          setStrokeColor={canvas.setStrokeColor}
          fillColor={canvas.fillColor}
          setFillColor={canvas.setFillColor}
          strokeWidth={canvas.strokeWidth}
          setStrokeWidth={canvas.setStrokeWidth}
          colorTarget={canvas.colorTarget}
          setColorTarget={canvas.setColorTarget}
          savedColors={canvas.savedColors}
          applyColorToTarget={canvas.applyColorToTarget}
          saveColorToPalette={canvas.saveColorToPalette}
          removeSavedColor={canvas.removeSavedColor}
          canUndo={canvas.canUndo}
          canRedo={canvas.canRedo}
          canPaste={canvas.canPaste}
          selectionCount={canvas.selectionCount}
          undo={canvas.undo}
          redo={canvas.redo}
          copySelected={canvas.copySelected}
          cutSelected={canvas.cutSelected}
          pasteClipboard={canvas.pasteClipboard}
          deleteSelected={canvas.deleteSelected}
          addText={canvas.addText}
          onImagePick={onImagePick}
          zoom={canvas.zoom}
          onZoomIn={() => applyZoomAtCenter(canvas.zoom + 0.1)}
          onZoomOut={() => applyZoomAtCenter(canvas.zoom - 0.1)}
          onZoomReset={() => applyZoomAtCenter(1)}
        />
      </AppChrome>

      <div className={`workspace ${isCompact ? 'compact' : ''}`}>
        <main
          ref={scrollRef}
          className={`canvas-area ${canvas.tool === 'pan' ? 'pan-mode' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onContextMenu={canvas.handleContextMenu}
          onMouseDown={onPanDown}
          onMouseMove={onPanMove}
          onMouseUp={onPanUp}
          onMouseLeave={onPanUp}
        >
          {isCompact && (
            <button
              type="button"
              className="panel-toggle-fab"
              title={panelOpen ? 'Ocultar panel' : 'Mostrar panel'}
              aria-label={panelOpen ? 'Ocultar panel' : 'Mostrar panel'}
              onClick={() => setPanelOpen((open) => !open)}
            >
              {panelOpen ? <PanelRightClose size={22} /> : <PanelRight size={22} />}
            </button>
          )}
          <div
            className="canvas-scroll"
            style={{
              width: canvas.pageSize.width * canvas.zoom,
              height: canvas.pageSize.height * canvas.zoom,
            }}
          >
            <div
              className="canvas-frame"
              style={{
                width: canvas.pageSize.width * canvas.zoom,
                height: canvas.pageSize.height * canvas.zoom,
              }}
            >
              <div ref={containerRef} className="fabric-host" />
            </div>
          </div>
          <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(e) => handleImageFile(e.target.files?.[0])} />
        </main>

        {isCompact && panelOpen && (
          <button
            type="button"
            className="panel-backdrop"
            aria-label="Cerrar panel"
            onClick={() => setPanelOpen(false)}
          />
        )}

        <div
          className={`right-panel-wrap ${isCompact ? 'compact' : ''} ${panelOpen ? 'open' : ''}`}
          style={isCompact ? undefined : { width: panelWidth }}
        >
          <div
            className={`panel-resizer ${panelDragging ? 'dragging' : ''}`}
            onMouseDown={onPanelResizeDown}
            title="Arrastra para cambiar el ancho del panel"
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={panelWidth}
          />
          <RightPanel
            pageSizeKey={canvas.pageSizeKey}
            resizePage={canvas.resizePage}
            backgroundColor={canvas.backgroundColor}
            setBackground={canvas.setBackground}
            setBackgroundImage={canvas.setBackgroundImage}
            clearBackgroundImage={canvas.clearBackgroundImage}
            addPresetShape={canvas.addPresetShape}
            strokeColor={canvas.strokeColor}
            onShapeFilePick={async (file) => {
              if (!file) return;
              const url = URL.createObjectURL(file);
              try {
                await canvas.addPresetShape(url);
              } finally {
                URL.revokeObjectURL(url);
              }
            }}
            selectedObject={canvas.selectedObject}
            selectionCount={canvas.selectionCount}
            updateSelectedProps={canvas.updateSelectedProps}
            fontSize={canvas.fontSize}
            strokeWidth={canvas.strokeWidth}
            objects={canvas.objects}
            selectObjectByRef={canvas.selectObjectByRef}
            toggleObjectVisibility={canvas.toggleObjectVisibility}
            removeObject={canvas.removeObject}
            bringForward={canvas.bringForward}
            sendBackward={canvas.sendBackward}
            bringToFront={canvas.bringToFront}
            sendToBack={canvas.sendToBack}
          />
        </div>
      </div>

      <StatusBar canvas={canvas} isCompact={isCompact} />

      <ContextMenu menu={canvas.contextMenu} canvas={canvas} onClose={canvas.closeContextMenu} />
    </div>
  );
}
