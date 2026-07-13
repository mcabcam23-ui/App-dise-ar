import { PencilBrush } from 'fabric';

/**
 * Lápiz que conserva el trazo exacto: al soltar no suaviza ni simplifica puntos.
 * Fabric usa curvas cuadráticas por defecto (getSmoothPathFromPoints), lo que
 * cambia la forma respecto a la vista previa en pantalla.
 */
export class ExactPencilBrush extends PencilBrush {
  convertPointsToSVGPath(points) {
    if (!points?.length) return [];
    const path = [['M', points[0].x, points[0].y]];
    for (let i = 1; i < points.length; i += 1) {
      path.push(['L', points[i].x, points[i].y]);
    }
    return path;
  }
}
