import cv2
import numpy as np
from pathlib import Path
from skimage.morphology import skeletonize

SRC = Path(
    r"C:\Users\itsmo\.cursor\projects\d-app-dise-ar\assets\c__Users_itsmo_AppData_Roaming_Cursor_User_workspaceStorage_81ee1419c2b38281fd6a4424abaa5951_images_Sin_t_tulo-16b92642-d353-4e46-bbc7-be6ccbcd81a0.png"
)
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "shapes"

img = cv2.imread(str(SRC), cv2.IMREAD_GRAYSCALE)
h, w = img.shape
_, bw = cv2.threshold(img, 200, 255, cv2.THRESH_BINARY_INV)

# Esqueleto = línea central de cada trazo (sin rellenar huecos)
skel = skeletonize(bw // 255).astype(np.uint8) * 255

# Unir píxeles del esqueleto en polilíneas
visited = np.zeros_like(skel)
paths = []


def neighbors(y, x):
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and skel[ny, nx]:
                yield ny, nx


def trace_from(sy, sx):
    line = [(sx, sy)]
    visited[sy, sx] = 1
    cy, cx = sy, sx
    prev = None
    while True:
        nbs = [p for p in neighbors(cy, cx) if not visited[p[0], p[1]] or p == prev]
        if prev is not None:
            nbs = [p for p in nbs if p != prev]
        if not nbs:
            break
        nxt = nbs[0]
        prev = (cy, cx)
        cy, cx = nxt
        visited[cy, cx] = 1
        line.append((cx, cy))
    return line


def simplify_points(pts, epsilon=1.8):
    if len(pts) < 3:
        return pts
    arr = np.array(pts, dtype=np.float32).reshape(-1, 1, 2)
    approx = cv2.approxPolyDP(arr, epsilon, False)
    return [(int(p[0][0]), int(p[0][1])) for p in approx]


def pts_to_path(pts):
    if len(pts) < 2:
        return None
    simplified = simplify_points(pts)
    if len(simplified) < 2:
        return None
    return "M " + " L ".join(f"{px} {py}" for px, py in simplified)


for y in range(h):
    for x in range(w):
        if skel[y, x] and not visited[y, x]:
            pts = trace_from(y, x)
            path_d = pts_to_path(pts)
            if path_d:
                paths.append(path_d)

path_els = "\n    ".join(f'<path d="{d}"/>' for d in paths)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
  <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">
    {path_els}
  </g>
</svg>'''

OUT_DIR.mkdir(parents=True, exist_ok=True)
(OUT_DIR / "dientes.svg").write_text(svg, encoding="utf-8")

# PNG con alpha (solo trazos negros, fondo transparente)
bgra = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
bgra[:, :, 3] = np.where(img > 200, 0, 255).astype(np.uint8)
cv2.imwrite(str(OUT_DIR / "dientes.png"), bgra)

print(f"Stroke paths: {len(paths)}, viewBox 0 0 {w} {h}")
