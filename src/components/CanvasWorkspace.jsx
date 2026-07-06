import { useRef, useCallback, useEffect, useState } from 'react';
import { PanelRight, PanelRightClose } from 'lucide-react';
import { useFabricCanvas } from '../hooks/useFabricCanvas';
import TopToolbar from './TopToolbar';
import RightPanel from './RightPanel';
import Header from './Header';
import StatusBar from './StatusBar';
import ContextMenu from './ContextMenu';

const PANEL_WIDTH_KEY = 'estudio-panel-width';
const PANEL_MIN = 220;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 260;
const COMPACT_QUERY = '(max-width: 768px)';

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
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
    return saved >= PANEL_MIN && saved <= PANEL_MAX ? saved : PANEL_DEFAULT;
  });
  const [panelDragging, setPanelDragging] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.matchMedia(COMPACT_QUERY).matches);
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia(COMPACT_QUERY).matches);

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
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const onChange = (e) => {
      setIsCompact(e.matches);
      if (!e.matches) setPanelOpen(true);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const applyZoomAtPoint = useCallback((newZoom, clientX, clientY) => {
    const el = scrollRef.current;
    const clamped = Math.min(3, Math.max(0.25, newZoom));
    if (!el) {
      canvas.setCanvasZoom(clamped);
      return;
    }
    const oldZoom = canvas.zoom;
    if (clamped === oldZoom) return;
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

  // Pellizco con dos dedos para zoom (móvil / tablet)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          active: true,
          startDist: touchDistance(e.touches),
          startZoom: canvas.zoom,
        };
        el.classList.add('pinch-zooming');
      } else if (e.touches.length === 1 && canvas.tool === 'pan') {
        panRef.current = { active: true, x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e) => {
      if (pinchRef.current.active && e.touches.length >= 2) {
        e.preventDefault();
        const dist = touchDistance(e.touches);
        if (!pinchRef.current.startDist) return;
        const center = touchCenter(e.touches);
        const scale = dist / pinchRef.current.startDist;
        applyZoomAtPoint(pinchRef.current.startZoom * scale, center.x, center.y);
      } else if (panRef.current.active && e.touches.length === 1 && scrollRef.current) {
        const t = e.touches[0];
        scrollRef.current.scrollLeft -= t.clientX - panRef.current.x;
        scrollRef.current.scrollTop -= t.clientY - panRef.current.y;
        panRef.current.x = t.clientX;
        panRef.current.y = t.clientY;
      }
    };

    const onTouchEnd = (e) => {
      if (e.touches.length < 2) {
        pinchRef.current.active = false;
        el.classList.remove('pinch-zooming');
      }
      if (e.touches.length === 0) {
        panRef.current.active = false;
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyZoomAtPoint, canvas.tool, canvas.zoom]);

  useEffect(() => {
    const onMove = (e) => {
      if (!panelDragRef.current.active) return;
      const delta = panelDragRef.current.startX - e.clientX;
      const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, panelDragRef.current.startWidth + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      if (!panelDragRef.current.active) return;
      panelDragRef.current.active = false;
      setPanelDragging(false);
      setPanelWidth((w) => {
        localStorage.setItem(PANEL_WIDTH_KEY, String(w));
        return w;
      });
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
          objects={canvas.objects}
          selectObjectByRef={canvas.selectObjectByRef}
          toggleObjectVisibility={canvas.toggleObjectVisibility}
          removeObject={canvas.removeObject}
          />
        </div>
      </div>

      <StatusBar canvas={canvas} />

      <ContextMenu menu={canvas.contextMenu} canvas={canvas} onClose={canvas.closeContextMenu} />
    </div>
  );
}
