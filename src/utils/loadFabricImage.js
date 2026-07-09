import { FabricImage } from 'fabric';
import { resolveAssetUrl } from './assetUrl';

function needsCrossOrigin(url) {
  if (!url || typeof window === 'undefined') return false;
  try {
    return new URL(url, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export function loadImageElement(src, { crossOrigin = null } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${src}`));
    img.src = src;
  });
}

/** Evita el suavizado al escalar PNG de señales (aspecto nítido). */
export function applyCrispImageSettings(img, { displayW, displayH } = {}) {
  if (!img) return img;
  const { width: nativeW, height: nativeH } = img.getOriginalSize?.() ?? {
    width: img.width ?? 1,
    height: img.height ?? 1,
  };
  const patch = {
    objectCaching: false,
    imageSmoothing: false,
    dirty: true,
  };
  if (displayW > 0 && displayH > 0 && nativeW > 0 && nativeH > 0) {
    patch.width = nativeW;
    patch.height = nativeH;
    patch.scaleX = displayW / nativeW;
    patch.scaleY = displayH / nativeH;
  }
  img.set(patch);
  return img;
}

export async function loadFabricImageFromAsset(assetPath, imageOptions = {}) {
  const url = resolveAssetUrl(assetPath);
  const crossOrigin = needsCrossOrigin(url) ? 'anonymous' : null;
  const element = await loadImageElement(url, { crossOrigin });
  if (typeof element.decode === 'function') {
    try {
      await element.decode();
    } catch {
      /* decode() puede fallar en algunos PNG; onload ya bastó */
    }
  }

  const img = new FabricImage(element, imageOptions);
  const { width, height } = img.getOriginalSize();
  if (width > 0 && height > 0) {
    img.set({ width, height });
  }
  applyCrispImageSettings(img);
  return img;
}

export async function loadFabricImageFromUrl(url, imageOptions = {}) {
  const crossOrigin = needsCrossOrigin(url) ? 'anonymous' : null;
  const element = await loadImageElement(url, { crossOrigin });
  if (typeof element.decode === 'function') {
    try {
      await element.decode();
    } catch {
      /* ignore */
    }
  }
  const img = new FabricImage(element, imageOptions);
  const { width, height } = img.getOriginalSize();
  if (width > 0 && height > 0) {
    img.set({ width, height });
  }
  applyCrispImageSettings(img);
  return img;
}
