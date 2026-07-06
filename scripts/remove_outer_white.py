"""Quita el fondo blanco exterior (conectado al borde), conservando blanco interior."""
from pathlib import Path

import cv2
import numpy as np

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets" / "prefabricados"
WHITE_THRESHOLD = 248
PROTECT_RADIUS = 3


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


def remove_outer_white(path: Path, threshold: int = WHITE_THRESHOLD, protect_radius: int = PROTECT_RADIUS) -> bool:
    img = imread_unicode(path)
    if img is None:
        print(f"  omitido (no legible): {path.name}")
        return False

    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

    b, g, r, a = cv2.split(img)
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
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (protect_radius * 2 + 1, protect_radius * 2 + 1))
        protect = cv2.dilate(colored.astype(np.uint8), kernel, iterations=1) > 0
        exterior = exterior & ~protect

    a[exterior == 1] = 0
    out = cv2.merge([b, g, r, a])
    if not imwrite_unicode(path, out):
        print(f"  error al guardar: {path.name}")
        return False
    removed = int(exterior.sum())
    print(f"  {path.relative_to(ASSETS)} — {removed} px exteriores transparentes")
    return True


def process_all(root: Path = ASSETS) -> int:
    count = 0
    for png in sorted(root.rglob("*.png")):
        if remove_outer_white(png):
            count += 1
    return count


if __name__ == "__main__":
    if not ASSETS.exists():
        print(f"No existe: {ASSETS}")
        raise SystemExit(1)
    n = process_all()
    print(f"Procesadas: {n} imagenes")
