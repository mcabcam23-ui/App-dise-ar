import { useRef, useCallback, useEffect, useState } from 'react';
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

      <div className="workspace">
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

        <div className="right-panel-wrap" style={{ width: panelWidth }}>
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
