import {
  ArrowRight,
  Circle,
  Eraser,
  GitMerge,
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
import { CurlyBracketIcon, RectBracketIcon } from '../components/icons/BracketIcons';
import { TOOLS } from './pageSizes';
import { MODIFY_MODE_OPTIONS } from './toolModes';

export const MODIFY_TOOLS = MODIFY_MODE_OPTIONS.map((mode) => ({
  id: TOOLS.MODIFY,
  modifyMode: mode.id,
  icon: GitMerge,
  label: mode.label,
  key: mode.key,
}));

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
  { id: TOOLS.BRACKETS, icon: CurlyBracketIcon, label: 'Corchete normal' },
  { id: TOOLS.RECT_BRACKET, icon: RectBracketIcon, label: 'Corchete rectangular' },
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
    id: 'modify',
    label: 'Modificar',
    tools: MODIFY_TOOLS,
    dropdown: true,
    dropdownLabel: 'Modificar trazos',
    dropdownIcon: GitMerge,
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
