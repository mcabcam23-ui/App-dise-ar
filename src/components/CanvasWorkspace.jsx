import { useRef, useCallback, useEffect, useState } from 'react';
import { useFabricCanvas } from '../hooks/useFabricCanvas';
import { fileToDataUrl } from '../utils/projectPersistence';
import AppChrome from './AppChrome';
import TopToolbar from './TopToolbar';
import ToolModeBar from './ToolModeBar';
import RightPanel from './RightPanel';
import Header from './Header';
import StatusBar from './StatusBar';
import ContextMenu from './ContextMenu';
import MobileDock from './MobileDock';
import MobileToolsSheet from './MobileToolsSheet';
import QuickTipBar from './QuickTipBar';
import { PANEL_SECTIONS, loadPanelSection } from '../constants/panelSections';
import { COMPACT_MQ, TOUCH_UI_MQ, isTouchUiPreferred } from '../constants/breakpoints';
import { TOOLS } from '../constants/pageSizes';
import { needsCompactChromeBody } from '../utils/styleControlsVisibility';

const PANEL_WIDTH_KEY = 'estudio-panel-width';
const CHROME_HEIGHT_KEY = 'estudio-chrome-height';
const CHROME_COLLAPSED_KEY = 'estudio-chrome-collapsed';
const PANEL_MIN = 220;
const PANEL_MAX = 560;
const PANEL_DEFAULT = 260;
const CHROME_MIN = 88;
const CHROME_MAX = 420;

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
  const scrollWrapRef = useRef(null);
  const frameRef = useRef(null);
  const imageInputRef = useRef(null);
  const canvas = useFabricCanvas(containerRef);
  const canvasApiRef = useRef(canvas);
  const wheelZoomRef = useRef({ pending: false, deltaY: 0, clientX: 0, clientY: 0 });
  const flushZoomTimerRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const panelDragRef = useRef({ active: false, startX: 0, startWidth: PANEL_DEFAULT });
  const chromeDragRef = useRef({ active: false, startY: 0, startHeight: CHROME_MIN });
  const gestureRef = useRef({ mode: 'idle', lastDist: 0, lastCenter: null, lastX: 0, lastY: 0, startX: 0, startY: 0 });

  const [displayZoom, setDisplayZoom] = useState(1);
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
  const [isCompact, setIsCompact] = useState(() => isTouchUiPreferred());
  const [panelOpen, setPanelOpen] = useState(() => !isTouchUiPreferred());
  const [chromeCollapsed, setChromeCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isC = isTouchUiPreferred();
    const saved = localStorage.getItem(CHROME_COLLAPSED_KEY);
    if (saved === '0') return false;
    if (saved === '1') return true;
    return isC;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [panelSection, setPanelSection] = useState(loadPanelSection);
  const [railModeDropOffset, setRailModeDropOffset] = useState(0);

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

  const panRef = useRef({ active: false, pending: false, x: 0, y: 0, startX: 0, startY: 0 });

  const canPanViewport = useCallback(
    () => canvas.tool === 'pan' || canvas.spacePanActive,
    [canvas.tool, canvas.spacePanActive],
  );

  useEffect(() => {
    const mqWidth = window.matchMedia(COMPACT_MQ);
    const mqTouch = window.matchMedia(TOUCH_UI_MQ);
    const onChange = () => {
      const touchUi = isTouchUiPreferred();
      setIsCompact(touchUi);
      if (touchUi) {
        setPanelOpen(false);
        setMobileMenuOpen(false);
        setMobileToolsOpen(false);
      } else {
        setPanelOpen(true);
        setChromeCollapsed(false);
      }
    };
    mqWidth.addEventListener('change', onChange);
    mqTouch.addEventListener('change', onChange);
    return () => {
      mqWidth.removeEventListener('change', onChange);
      mqTouch.removeEventListener('change', onChange);
    };
  }, []);

  const compactChromeNeeded = needsCompactChromeBody({
    tool: canvas.tool,
    selectedObject: canvas.selectedObject,
    selectionCount: canvas.selectionCount,
  });

  useEffect(() => {
    if (!isCompact) return;
    setChromeCollapsed(!compactChromeNeeded);
  }, [isCompact, compactChromeNeeded]);

  useEffect(() => {
    if (isCompact || chromeCollapsed) {
      setRailModeDropOffset(0);
      return undefined;
    }

    let raf = 0;
    let observedBar = null;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const bar = document.querySelector(
          '.app-chrome:not(.is-compact) .tool-mode-bar-aspect,'
          + ' .app-chrome:not(.is-compact) .tool-mode-bar-text,'
          + ' .app-chrome:not(.is-compact) .tool-mode-bar-eraser',
        );
        if (bar !== observedBar) {
          if (observedBar) resizeObserver.unobserve(observedBar);
          observedBar = bar;
          if (bar) resizeObserver.observe(bar);
        }
        if (!bar) {
          setRailModeDropOffset(0);
          return;
        }
        const workspace = document.querySelector('.workspace');
        if (!workspace) {
          setRailModeDropOffset(Math.ceil(bar.getBoundingClientRect().height));
          return;
        }
        const overlap = Math.max(
          0,
          Math.ceil(bar.getBoundingClientRect().bottom - workspace.getBoundingClientRect().top),
        );
        setRailModeDropOffset(overlap);
      });
    };

    const resizeObserver = new ResizeObserver(measure);
    measure();
    const chrome = document.querySelector('.app-chrome');
    const chromeBody = document.querySelector('.app-chrome-body');
    if (chrome) resizeObserver.observe(chrome);
    if (chromeBody) resizeObserver.observe(chromeBody);

    const mo = new MutationObserver(measure);
    if (chromeBody) mo.observe(chromeBody, { childList: true, subtree: true });

    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [
    isCompact,
    chromeCollapsed,
    chromeHeight,
    canvas.tool,
    canvas.selectionCount,
    canvas.selectedObject?.id,
    canvas.selectedObject?.presetId,
    canvas.selectedObject?.type,
  ]);

  const toggleChromeCollapsed = useCallback(() => {
    setChromeCollapsed((prev) => {
      const next = !prev;
      if (isCompact) localStorage.setItem(CHROME_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }, [isCompact]);

  const openPanel = useCallback((section = PANEL_SECTIONS.LAYERS) => {
    setPanelSection(section);
    setPanelOpen(true);
    setMobileToolsOpen(false);
    setMobileMenuOpen(false);
  }, []);

  const openPanelSmart = useCallback(() => {
    openPanel(canvas.selectionCount > 0 ? PANEL_SECTIONS.PROPERTIES : PANEL_SECTIONS.LAYERS);
  }, [canvas.selectionCount, openPanel]);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  canvasApiRef.current = canvas;

  const applyScrollWrapSize = useCallback((zoomLevel) => {
    const w = canvas.pageSize.width * zoomLevel;
    const h = canvas.pageSize.height * zoomLevel;
    if (scrollWrapRef.current) {
      scrollWrapRef.current.style.width = `${w}px`;
      scrollWrapRef.current.style.height = `${h}px`;
    }
    if (frameRef.current) {
      frameRef.current.style.width = `${w}px`;
      frameRef.current.style.height = `${h}px`;
    }
    setDisplayZoom(zoomLevel);
  }, [canvas.pageSize.height, canvas.pageSize.width]);

  useEffect(() => {
    applyScrollWrapSize(canvas.getCanvasZoom?.() ?? canvas.zoom);
  }, [applyScrollWrapSize, canvas.pageSize.height, canvas.pageSize.width, canvas.zoom]);

  const scheduleZoomUiFlush = useCallback(() => {
    if (flushZoomTimerRef.current) clearTimeout(flushZoomTimerRef.current);
    flushZoomTimerRef.current = setTimeout(() => {
      flushZoomTimerRef.current = null;
      canvasApiRef.current.flushCanvasZoom?.();
    }, 120);
  }, []);

  useEffect(() => () => {
    if (flushZoomTimerRef.current) clearTimeout(flushZoomTimerRef.current);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const sync = () => canvas.recalcCanvasOffset?.();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [canvas.recalcCanvasOffset]);

  const applyZoomAtPoint = useCallback((newZoom, clientX, clientY, { live = false } = {}) => {
    const api = canvasApiRef.current;
    const el = scrollRef.current;
    const content = scrollWrapRef.current;
    const clamped = Math.min(4, Math.max(0.2, newZoom));
    if (!el || !content) {
      api.setCanvasZoom(clamped, { live });
      return;
    }
    const oldZoom = api.getCanvasZoom?.() ?? api.zoom;
    if (Math.abs(clamped - oldZoom) < 0.0001) return;

    const contentRect = content.getBoundingClientRect();
    const pageX = (clientX - contentRect.left) / oldZoom;
    const pageY = (clientY - contentRect.top) / oldZoom;

    api.setCanvasZoom(clamped, { live });
    applyScrollWrapSize(clamped);
    void content.offsetHeight;

    const newContentRect = content.getBoundingClientRect();
    el.scrollLeft += newContentRect.left + pageX * clamped - clientX;
    el.scrollTop += newContentRect.top + pageY * clamped - clientY;

    api.recalcCanvasOffset?.();
    if (live) scheduleZoomUiFlush();
  }, [applyScrollWrapSize, canvas.pageSize.height, canvas.pageSize.width, scheduleZoomUiFlush]);

  const applyZoomAtCenter = useCallback((newZoom, options) => {
    const api = canvasApiRef.current;
    const el = scrollRef.current;
    if (!el) {
      api.setCanvasZoom(newZoom, options);
      return;
    }
    const rect = el.getBoundingClientRect();
    applyZoomAtPoint(newZoom, rect.left + rect.width / 2, rect.top + rect.height / 2, options);
  }, [applyZoomAtPoint]);

  const fitPageToViewport = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pad = 48;
    const zoomW = (el.clientWidth - pad) / canvas.pageSize.width;
    const zoomH = (el.clientHeight - pad) / canvas.pageSize.height;
    const fit = Math.min(4, Math.max(0.2, Math.min(zoomW, zoomH)));
    applyZoomAtCenter(fit);
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
    el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
  }, [applyZoomAtCenter, canvas.pageSize.height, canvas.pageSize.width]);

  useEffect(() => {
    if (!isCompact) return undefined;
    const timer = setTimeout(fitPageToViewport, 0);
    return () => clearTimeout(timer);
  }, [isCompact, canvas.pageSizeKey, fitPageToViewport]);

  useEffect(() => {
    if (!isCompact) return undefined;
    const onViewportChange = () => {
      fitPageToViewport();
      canvas.recalcCanvasOffset?.();
    };
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChange);
    }
    return () => {
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onViewportChange);
      }
    };
  }, [isCompact, fitPageToViewport, canvas.recalcCanvasOffset]);

  const applyZoomStep = useCallback((factor) => {
    const current = canvasApiRef.current.getCanvasZoom?.() ?? canvasApiRef.current.zoom;
    const { x, y, inside } = pointerRef.current;
    if (inside) {
      applyZoomAtPoint(current * factor, x, y);
    } else {
      applyZoomAtCenter(current * factor);
    }
  }, [applyZoomAtCenter, applyZoomAtPoint]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const runWheelZoom = () => {
      wheelZoomRef.current.pending = false;
      const { deltaY, clientX, clientY } = wheelZoomRef.current;
      wheelZoomRef.current.deltaY = 0;
      if (!deltaY) return;
      const api = canvasApiRef.current;
      const currentZoom = api.getCanvasZoom?.() ?? api.zoom;
      const factor = Math.exp(-deltaY * 0.0022);
      applyZoomAtPoint(currentZoom * factor, clientX, clientY, { live: true });
    };

    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const acc = wheelZoomRef.current;
        acc.deltaY += e.deltaY;
        acc.clientX = e.clientX;
        acc.clientY = e.clientY;
        if (!acc.pending) {
          acc.pending = true;
          requestAnimationFrame(runWheelZoom);
        }
        return;
      }

      if (e.altKey) {
        e.preventDefault();
        const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        el.scrollLeft += horizontal;
      }

      // Rueda sin modificadores: desplazamiento vertical nativo del contenedor.
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoomAtPoint]);

  // Gestos táctiles: pellizco (zoom+desplazar) y un dedo (desplazar vista)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const resetGesture = () => {
      if (
        gestureRef.current.mode === 'pinch'
        || gestureRef.current.mode === 'pan'
        || gestureRef.current.mode === 'pan-pending'
      ) {
        canvasApiRef.current.setViewportGestureLock?.(false);
      }
      if (gestureRef.current.mode === 'pinch') {
        canvasApiRef.current.flushCanvasZoom?.();
      }
      gestureRef.current = { mode: 'idle', lastDist: 0, lastCenter: null, lastX: 0, lastY: 0, startX: 0, startY: 0 };
      el.classList.remove('pinch-zooming', 'viewport-panning');
    };

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
        canvasApiRef.current.setViewportGestureLock?.(true);
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        const api = canvasApiRef.current;
        if (api.tool === 'pan' || api.spacePanActive) {
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
          const rawScale = dist / g.lastDist;
          const scale = rawScale ** 1.2;
          const currentZoom = canvasApiRef.current.getCanvasZoom?.() ?? canvasApiRef.current.zoom;
          applyZoomAtPoint(currentZoom * scale, center.x, center.y, { live: true });
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
          canvasApiRef.current.setViewportGestureLock?.(true);
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
  }, [applyZoomAtPoint, canvas.tool, canvas.spacePanActive]);

  // Menú contextual con pulsación larga (móvil)
  useEffect(() => {
    if (!isCompact) return undefined;
    const el = scrollRef.current;
    if (!el) return undefined;

    let longPress = null;

    const clearLongPress = () => {
      if (longPress?.timer) clearTimeout(longPress.timer);
      longPress = null;
    };

    const onTouchStart = (e) => {
      if (e.touches.length !== 1) return;
      if (canvasApiRef.current.tool !== 'select') return;
      if (gestureRef.current.mode !== 'idle') return;
      const t = e.touches[0];
      longPress = {
        x: t.clientX,
        y: t.clientY,
        timer: setTimeout(() => {
          canvasApiRef.current.openContextMenuAt?.(t.clientX, t.clientY);
          navigator.vibrate?.(12);
          longPress = null;
        }, 480),
      };
    };

    const onMarqueeStart = () => clearLongPress();

    const onTouchMove = (e) => {
      if (!longPress?.timer || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (Math.hypot(t.clientX - longPress.x, t.clientY - longPress.y) > 12) clearLongPress();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', clearLongPress);
    el.addEventListener('touchcancel', clearLongPress);
    document.addEventListener('estudio-canvas-marquee-start', onMarqueeStart);
    return () => {
      clearLongPress();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', clearLongPress);
      el.removeEventListener('touchcancel', clearLongPress);
      document.removeEventListener('estudio-canvas-marquee-start', onMarqueeStart);
    };
  }, [isCompact]);

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
    const node = e.currentTarget.parentElement?.querySelector('.app-chrome-body');
    const current = node?.getBoundingClientRect().height ?? CHROME_MIN;
    chromeDragRef.current = { active: true, startY: e.clientY, startHeight: current };
    setChromeResizerDragging(true);
    e.preventDefault();
  };

  const onPanDown = (e) => {
    if (e.button !== 0 || !scrollRef.current || !canPanViewport()) return;
    const el = scrollRef.current;

    panRef.current = {
      active: false,
      pending: true,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
    };
    el.style.cursor = 'grabbing';
  };

  const onPanMove = (e) => {
    const el = scrollRef.current;
    if (!el) return;

    const pan = panRef.current;
    if (!pan.pending && !pan.active) return;

    const dx = e.clientX - pan.startX;
    const dy = e.clientY - pan.startY;

    if (pan.pending && !pan.active) {
      if (Math.hypot(dx, dy) < 6) return;
      pan.active = true;
      pan.pending = false;
    }

    el.scrollLeft -= e.clientX - pan.x;
    el.scrollTop -= e.clientY - pan.y;
    pan.x = e.clientX;
    pan.y = e.clientY;
  };

  const onPanUp = () => {
    panRef.current = { active: false, pending: false, x: 0, y: 0, startX: 0, startY: 0 };
    if (!scrollRef.current) return;
    if (canPanViewport()) {
      scrollRef.current.style.cursor = canvas.tool === 'pan' ? 'grab' : '';
    } else {
      scrollRef.current.style.cursor = '';
    }
  };

  return (
    <div
      className={`app-shell ${isCompact ? 'is-compact-layout' : ''}`}
      style={{ '--rail-mode-drop-offset': `${railModeDropOffset}px` }}
    >
      <AppChrome
        collapsed={chromeCollapsed}
        onToggleCollapsed={toggleChromeCollapsed}
        height={chromeHeight}
        onResizeStart={onChromeResizeDown}
        resizerDragging={chromeResizerDragging}
        isCompact={isCompact}
        compactChromeNeeded={compactChromeNeeded}
        staticHeader={(
          <Header
            canvas={canvas}
            handlers={{ onImagePick, fitPageToViewport }}
            isCompact={isCompact}
            mobileMenuOpen={mobileMenuOpen}
            onMobileMenuClose={closeMobileMenu}
          />
        )}
      >
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
          onImagePick={onImagePick}
          zoom={canvas.zoom}
          onZoomIn={() => applyZoomStep(1.25)}
          onZoomOut={() => applyZoomStep(1 / 1.25)}
          onZoomReset={() => applyZoomAtCenter(1)}
          textFormatActive={!!canvas.selectedObject?.isEditing}
          onCaptureTextFormatSelection={canvas.captureTextFormatSelection}
          isCompact={isCompact}
          selectedObject={canvas.selectedObject}
        />
        <ToolModeBar
          tool={canvas.tool}
          textMode={canvas.textMode}
          setTextMode={canvas.setTextMode}
          textStyle={canvas.textStyle}
          onTextStyleChange={canvas.patchTextStyle}
          textEditRevision={canvas.textEditRevision}
          onCaptureTextFormatSelection={canvas.captureTextFormatSelection}
          eraserMode={canvas.eraserMode}
          setEraserMode={canvas.setEraserMode}
          eraserSize={canvas.eraserSize}
          setEraserSize={canvas.setEraserSize}
          selectedObject={canvas.selectedObject}
          selectionCount={canvas.selectionCount}
          onClearAllContent={canvas.clearAllContent}
          onEmptySelectedLayer={canvas.emptySelectedLayer}
          onSignalPresetChange={(newId) => canvas.updateSelectedProps({ signalPresetId: newId })}
          onSignalNumberChange={(values, isMulti) => canvas.updateSelectedProps(
            isMulti ? { customNumberValues: values } : { customNumberValue: (values?.[0] ?? '') },
          )}
          isCompact={isCompact}
        />
      </AppChrome>

      <div className={`workspace ${isCompact ? 'compact' : ''}`}>
        <main
          ref={scrollRef}
          className={`canvas-area ${canvas.tool === 'select' ? 'tool-select' : ''} ${canvas.tool === 'eraser' ? 'tool-eraser' : ''} ${canvas.tool === 'pan' ? 'pan-mode' : ''} ${canvas.spacePanActive ? 'space-pan-mode' : ''} ${isCompact ? 'compact-layout' : ''}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onContextMenu={canvas.handleContextMenu}
          onMouseDown={onPanDown}
          onMouseMove={(e) => {
            pointerRef.current = { x: e.clientX, y: e.clientY, inside: true };
            onPanMove(e);
          }}
          onMouseUp={onPanUp}
          onMouseLeave={() => {
            pointerRef.current.inside = false;
            onPanUp();
          }}
        >
          <div className="canvas-scroll-inner">
            <div
              ref={scrollWrapRef}
              className="canvas-scroll"
            >
              <div
                ref={frameRef}
                className="canvas-frame"
              >
                <div ref={containerRef} className="fabric-host" />
              </div>
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
            isCompact={isCompact}
            section={panelSection}
            onSectionChange={setPanelSection}
            onClose={isCompact ? () => setPanelOpen(false) : undefined}
            pageSizeKey={canvas.pageSizeKey}
            resizePage={canvas.resizePage}
            backgroundColor={canvas.backgroundColor}
            setBackground={canvas.setBackground}
            applyBackgroundPreset={canvas.applyBackgroundPreset}
            pageOverlayType={canvas.pageOverlayType}
            pageOverlaySpacing={canvas.pageOverlaySpacing}
            pageOverlayColor={canvas.pageOverlayColor}
            setPageOverlay={canvas.setPageOverlay}
            setBackgroundImage={canvas.setBackgroundImage}
            clearBackgroundImage={canvas.clearBackgroundImage}
            addPresetShape={canvas.addPresetShape}
            strokeColor={canvas.strokeColor}
            onShapeFilePick={async (file) => {
              if (!file) return;
              const dataUrl = await fileToDataUrl(file);
              await canvas.addPresetShape(dataUrl);
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
            renameObject={canvas.renameObject}
            toggleObjectLock={canvas.toggleObjectLock}
            duplicateObject={canvas.duplicateObject}
            moveLayer={canvas.moveLayer}
            reorderLayerToVisualIndex={canvas.reorderLayerToVisualIndex}
            setAllLayersVisibility={canvas.setAllLayersVisibility}
            removeHiddenLayers={canvas.removeHiddenLayers}
            duplicateSelected={canvas.duplicateSelected}
            groupSelected={canvas.groupSelected}
            ungroupSelected={canvas.ungroupSelected}
            deselectAll={canvas.deselectAll}
            deleteAll={canvas.deleteAll}
            bringForward={canvas.bringForward}
            sendBackward={canvas.sendBackward}
            bringToFront={canvas.bringToFront}
            sendToBack={canvas.sendToBack}
            settings={canvas.settings}
            updateSetting={canvas.updateSetting}
            resetLayout={canvas.resetLayout}
          />
        </div>
      </div>

      <StatusBar canvas={canvas} displayZoom={displayZoom} isCompact={isCompact} />

      {isCompact && <QuickTipBar isCompact={isCompact} />}

      {isCompact && canvas.tool === TOOLS.POLYLINE && canvas.polylinePoints > 0 && (
        <div className="polyline-mobile-bar" role="toolbar" aria-label="Multilínea">
          <span>{canvas.polylinePoints} puntos</span>
          <button type="button" onClick={canvas.finishPolyline}>Terminar</button>
          <button type="button" className="ghost" onClick={canvas.cancelPolylineDraft}>Cancelar</button>
        </div>
      )}

      {isCompact && (
        <MobileDock
          tool={canvas.tool}
          setTool={canvas.setTool}
          selectionCount={canvas.selectionCount}
          onOpenPanel={openPanelSmart}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onOpenTools={() => setMobileToolsOpen(true)}
        />
      )}

      {isCompact && (
        <MobileToolsSheet
          open={mobileToolsOpen}
          onClose={() => setMobileToolsOpen(false)}
          tool={canvas.tool}
          setTool={canvas.setTool}
          onImagePick={onImagePick}
          selectionCount={canvas.selectionCount}
          canPaste={canvas.canPaste}
          canUndo={canvas.canUndo}
          canRedo={canvas.canRedo}
          undo={canvas.undo}
          redo={canvas.redo}
          zoom={canvas.zoom}
          onZoomIn={() => applyZoomStep(1.25)}
          onZoomOut={() => applyZoomStep(1 / 1.25)}
          onZoomReset={() => applyZoomAtCenter(1)}
          copySelected={canvas.copySelected}
          cutSelected={canvas.cutSelected}
          pasteClipboard={canvas.pasteClipboard}
          deleteSelected={canvas.deleteSelected}
          onOpenPanel={openPanel}
        />
      )}

      <ContextMenu menu={canvas.contextMenu} canvas={canvas} onClose={canvas.closeContextMenu} isCompact={isCompact} />
    </div>
  );
}
