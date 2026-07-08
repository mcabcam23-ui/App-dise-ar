import {
  ArrowRight,
  Circle,
  Eraser,
  Hand,
  ImagePlus,
  Minus,
  MousePointer2,
  PaintBucket,
  Pencil,
  Pipette,
  Square,
  Type,
  Waypoints,
} from 'lucide-react';
import { TOOLS } from './pageSizes';

export const DOCK_TOOLS = [
  { id: TOOLS.SELECT, icon: MousePointer2, label: 'Seleccionar' },
  { id: TOOLS.PEN, icon: Pencil, label: 'Lápiz' },
  { id: TOOLS.TEXT, icon: Type, label: 'Texto' },
  { id: TOOLS.ERASER, icon: Eraser, label: 'Borrar' },
];

export const SHAPE_TOOLS = [
  { id: TOOLS.RECT, icon: Square, label: 'Rectángulo' },
  { id: TOOLS.CIRCLE, icon: Circle, label: 'Círculo' },
  { id: TOOLS.LINE, icon: Minus, label: 'Línea' },
  { id: TOOLS.POLYLINE, icon: Waypoints, label: 'Multilínea' },
  { id: TOOLS.ARROW, icon: ArrowRight, label: 'Flecha' },
];

export const UTILITY_TOOLS = [
  { id: TOOLS.PAN, icon: Hand, label: 'Mover vista' },
  { id: TOOLS.EYEDROPPER, icon: Pipette, label: 'Cuentagotas' },
  { id: TOOLS.BUCKET, icon: PaintBucket, label: 'Relleno' },
  { id: TOOLS.IMAGE, icon: ImagePlus, label: 'Imagen' },
];

export const DESKTOP_TOOL_GROUPS = [
  {
    id: 'select',
    label: 'Selección',
    tools: [
      { id: TOOLS.SELECT, icon: MousePointer2, label: 'Seleccionar', key: 'V' },
      { id: TOOLS.PAN, icon: Hand, label: 'Mover vista', key: 'H' },
    ],
  },
  {
    id: 'draw',
    label: 'Dibujar',
    tools: [
      { id: TOOLS.PEN, icon: Pencil, label: 'Lápiz', key: 'P' },
      { id: TOOLS.TEXT, icon: Type, label: 'Texto', key: 'T' },
      { id: TOOLS.ERASER, icon: Eraser, label: 'Borrador', key: 'E' },
    ],
  },
  {
    id: 'shapes',
    label: 'Formas',
    tools: SHAPE_TOOLS.map((t) => ({ ...t, key: t.id === TOOLS.POLYLINE ? 'M' : undefined })),
    dropdown: true,
  },
  {
    id: 'utils',
    label: 'Utilidades',
    tools: [
      { id: TOOLS.EYEDROPPER, icon: Pipette, label: 'Cuentagotas', key: 'I' },
      { id: TOOLS.BUCKET, icon: PaintBucket, label: 'Relleno', key: 'B' },
      { id: TOOLS.IMAGE, icon: ImagePlus, label: 'Imagen' },
    ],
  },
];

export const SHAPE_TOOL_IDS = new Set(SHAPE_TOOLS.map((t) => t.id));
