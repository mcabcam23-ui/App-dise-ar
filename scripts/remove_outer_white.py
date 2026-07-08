"""Quita el fondo blanco exterior y el halo blanco fino alrededor de las figuras."""
from pathlib import Path

import cv2
import numpy as np

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets" / "prefabricados"
DOCS_ASSETS = Path(__file__).resolve().parent.parent / "docs" / "assets" / "prefabricados"
WHITE_THRESHOLD = 248
FRINGE_THRESHOLD = 232
PROTECT_RADIUS = 2
MAX_FRINGE_LAYERS = 20


def imread_unicode(path: Path):
    data = np.fromfile(str(path), dtype=np.uint8)
    if data.size == 0:
        return None
    return cv2.imdecode(data, cv2.IMREAD_UNCHANGED)


def imwrite_unicode(path: Path, img) -> bool:
    ext = path.suffix or ".png"
    ok, buf = cv2.imencode(ext, img)
    if not ok:
        return False
    buf.tofile(str(path))
    return True


def _ensure_bgra(img: np.ndarray) -> np.ndarray:
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    if img.shape[2] == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img


def _remove_border_connected_white(b, g, r, a, threshold: int, protect_radius: int) -> int:
    white = (r >= threshold) & (g >= threshold) & (b >= threshold)
    colored = ~white
    h, w = white.shape
    exterior = np.zeros((h, w), dtype=np.uint8)
    stack: list[tuple[int, int]] = []

    for x in range(w):
        if white[0, x]:
            stack.append((0, x))
        if white[h - 1, x]:
            stack.append((h - 1, x))
    for y in range(h):
        if white[y, 0]:
            stack.append((y, 0))
        if white[y, w - 1]:
            stack.append((y, w - 1))

    while stack:
        y, x = stack.pop()
        if exterior[y, x] or not white[y, x]:
            continue
        exterior[y, x] = 1
        if y > 0:
            stack.append((y - 1, x))
        if y < h - 1:
            stack.append((y + 1, x))
        if x > 0:
            stack.append((y, x - 1))
        if x < w - 1:
            stack.append((y, x + 1))

    if protect_radius > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE,
            (protect_radius * 2 + 1, protect_radius * 2 + 1),
        )
        protect = cv2.dilate(colored.astype(np.uint8), kernel, iterations=1) > 0
        exterior = exterior & ~protect

    removed = int(exterior.sum())
    a[exterior == 1] = 0
    return removed


def _peel_near_white_fringe(b, g, r, a, threshold: int, max_layers: int) -> int:
    """Elimina halos blancos/casi blancos expuestos al canal alpha (borde fino)."""
    h, w = a.shape
    removed = 0
    kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))

    for _ in range(max_layers):
        opaque = a >= 128
        if not opaque.any():
            break

        near_white = (r >= threshold) & (g >= threshold) & (b >= threshold)
        transparent = a < 128
        touch_transparent = cv2.dilate(transparent.astype(np.uint8), kernel, iterations=1) > 0
        peel = opaque & near_white & touch_transparent
        if not peel.any():
            break

        removed += int(peel.sum())
        a[peel] = 0

    return removed


def remove_outer_white(
    path: Path,
    threshold: int = WHITE_THRESHOLD,
    fringe_threshold: int = FRINGE_THRESHOLD,
    protect_radius: int = PROTECT_RADIUS,
    max_fringe_layers: int = MAX_FRINGE_LAYERS,
) -> bool:
    img = imread_unicode(path)
    if img is None:
        print(f"  omitido (no legible): {path.name}")
        return False

    img = _ensure_bgra(img)
    b, g, r, a = cv2.split(img)

    border_removed = _remove_border_connected_white(b, g, r, a, threshold, protect_radius)
    fringe_removed = _peel_near_white_fringe(b, g, r, a, fringe_threshold, max_fringe_layers)

    out = cv2.merge([b, g, r, a])
    if not imwrite_unicode(path, out):
        print(f"  error al guardar: {path.name}")
        return False

    total = border_removed + fringe_removed
    print(f"  {path.name} — {total} px transparentes ({border_removed} borde + {fringe_removed} halo)")
    return True


def process_all(root: Path = ASSETS) -> int:
    count = 0
    if not root.exists():
        return 0
    for png in sorted(root.rglob("*.png")):
        if remove_outer_white(png):
            count += 1
    return count


if __name__ == "__main__":
    roots = [ASSETS]
    if DOCS_ASSETS.exists():
        roots.append(DOCS_ASSETS)

    total = 0
    for root in roots:
        if not root.exists():
            print(f"No existe: {root}")
            continue
        print(f"Procesando {root}...")
        total += process_all(root)

    print(f"Procesadas: {total} imagenes")
