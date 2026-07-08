export const ROTATION_SNAP_ANGLES = [0, 90, 180, 270];
export const ROTATION_SNAP_THRESHOLD = 6;

export function normalizeRotation(angle) {
  let normalized = angle % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

export function snapRotationAngle(angle, threshold = ROTATION_SNAP_THRESHOLD) {
  if (typeof angle !== 'number' || Number.isNaN(angle)) return angle;

  const normalized = normalizeRotation(angle);
  for (const snap of ROTATION_SNAP_ANGLES) {
    const diff = Math.min(
      Math.abs(normalized - snap),
      360 - Math.abs(normalized - snap),
    );
    if (diff <= threshold) {
      const turns = Math.round((angle - normalized) / 360);
      return turns * 360 + snap;
    }
  }
  return angle;
}

export function applyRotationSnap(target) {
  if (!target || typeof target.angle !== 'number') return false;
  const snapped = snapRotationAngle(target.angle);
  if (snapped === target.angle) return false;
  target.set({ angle: snapped });
  target.setCoords?.();
  return true;
}

export function isNearCardinalAngle(angle, threshold = ROTATION_SNAP_THRESHOLD) {
  const normalized = normalizeRotation(angle ?? 0);
  return ROTATION_SNAP_ANGLES.some((snap) => {
    const diff = Math.min(
      Math.abs(normalized - snap),
      360 - Math.abs(normalized - snap),
    );
    return diff <= threshold;
  });
}
