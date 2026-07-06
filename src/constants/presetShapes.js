import { resolveAssetUrl } from '../utils/assetUrl';

export {
  PRESET_CATEGORIES,
  PRESET_SHAPES,
  getPresetCategories,
  getPresetShape,
} from './presetCatalog';

export function shapePreviewHtml(shape) {
  if (!shape) return '';
  if (shape.imageAsset) {
    const src = resolveAssetUrl(shape.imageAsset);
    return `<img src="${src}" alt="${shape.label}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto;" />`;
  }
  if (shape.svgAsset) {
    return `<img src="${resolveAssetUrl(shape.svgAsset)}" alt="${shape.label}" style="max-width:100%;max-height:100%;object-fit:contain;display:block;margin:0 auto;" />`;
  }
  const dash = shape.strokeDashArray ? `stroke-dasharray="${shape.strokeDashArray.join(' ')}"` : '';
  const fill = shape.strokeOnly ? 'none' : '#222222';
  const stroke = '#222222';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shape.width} ${shape.height}" width="100%" height="100%">
    <path d="${shape.path}" fill="${fill}" stroke="${stroke}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${dash}/>
  </svg>`;
}

export async function fetchShapePreviewSvg(shape, color = '#222222') {
  if (shape?.imageAsset) return shapePreviewHtml(shape);
  if (!shape?.svgAsset) return shapePreviewHtml(shape);
  const raw = await fetch(resolveAssetUrl(shape.svgAsset)).then((r) => r.text());
  return raw
    .replace(/stroke="currentColor"/g, `stroke="${color}"`)
    .replace(/fill="currentColor"/g, `fill="${color}"`)
    .replace(/<svg /, '<svg width="100%" height="100%" ');
}
