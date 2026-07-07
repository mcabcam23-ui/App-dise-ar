import {
  Circle,
  Image,
  Layers,
  Minus,
  Pencil,
  Shapes,
  Square,
  Type,
  Waypoints,
} from 'lucide-react';

const TYPE_ICONS = {
  line: Minus,
  polyline: Waypoints,
  path: Pencil,
  rect: Square,
  circle: Circle,
  textbox: Type,
  'i-text': Type,
  text: Type,
  image: Image,
  group: Layers,
};

export function layerTypeIcon(type) {
  return TYPE_ICONS[type] || Shapes;
}

export function layerMatchesFilter(item, typeFilter) {
  if (typeFilter === 'all') return true;
  if (typeFilter === 'line') return ['line', 'polyline'].includes(item.type);
  if (typeFilter === 'path') return ['path', 'polyline'].includes(item.type);
  if (typeFilter === 'textbox') return ['textbox', 'i-text', 'text'].includes(item.type);
  return item.type === typeFilter;
}
