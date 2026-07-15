"""Copia prefabricados y genera src/constants/presetCatalog.js"""
import json
import re
import shutil
import struct
import unicodedata
from pathlib import Path

from remove_outer_white import remove_outer_white

SRC = Path(r"c:\Users\itsmo\Documents\App diseñar")
OUT_ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets" / "prefabricados"
OUT_JS = Path(__file__).resolve().parent.parent / "src" / "constants" / "presetCatalog.js"

CATEGORY_ORDER = [
    "A. Precaución",
    "AC cerradas",
    "con P",
    "Indicadora posicion agujas",
    "3 focos",
    "4 focos",
    "Señales AV",
    "Preanuncio",
    "Retroceso",
    "Trayecto",
    "Velocidad",
]

NUMBERED_VARIANT = re.compile(
    r"^(?P<base>.+?)(?P<num>\d{2,3})(?P<dir>derecha|izquierda)?$",
    re.IGNORECASE,
)

DEFAULT_NUMBER_OVERLAY = {
    "fontFamily": "Arial Black, Arial, sans-serif",
    "fontWeight": "bold",
    "fill": "#111111",
    "fontSizeRatio": 0.07,
    "leftRatio": 0.5,
    "topRatio": 0.47,
}

# Ajustes finos por carpeta (tras calibración automática)
OVERLAY_TUNING = {
    "con pajarita": {
        "fontSizeRatioScale": 0.86,
        "topRatioOffset": 0.014,
        "fontBoost": 2.25,
        "numberFill": "#00a651",
    },
    "con pantalla": {
        "fontBoost": 1.35,
        "fontSizeRatioScale": 1.28,
        "topRatioOffset": 0.04,
        "maxWidthRatio": 0.78,
        "numberFill": "#FFFFFF",
        "forceFill": True,
    },
}

CATEGORY_OVERLAY_TUNING = {
    "Preanuncio": {
        "fontBoost": 1.0,
        "fontSizeRatioScale": 0.62,
        "topRatioOffset": 0.02,
        "maxWidthRatio": 0.52,
        "numberFill": "#FFD400",
        "forceFill": True,
    },
    "Velocidad": {
        "fontBoost": 1.5,
        "fontSizeRatioScale": 0.94,
        "topRatioOffset": 0.015,
        "numberFill": "#111111",
    },
    # Número un poco mayor y más abajo para no chocar con la flecha.
    # maxWidthRatio alto: si no, fitFontSize lo vuelve a encoger al rasterizar.
    "Indicadora posicion agujas": {
        "fontSizeRatioScale": 1.16,
        "topRatioOffset": 0.055,
        "maxWidthRatio": 0.86,
    },
}


def discover_categories() -> list[str]:
    if not SRC.is_dir():
        return list(CATEGORY_ORDER)
    found = sorted([p.name for p in SRC.iterdir() if p.is_dir()], key=str.lower)
    ordered = [name for name in CATEGORY_ORDER if name in found]
    extras = [name for name in found if name not in CATEGORY_ORDER]
    return ordered + extras


def png_size(path: Path):
    with open(path, "rb") as f:
        if f.read(8) != b"\x89PNG\r\n\x1a\n":
            return 61, 172
        f.read(8)
        w = struct.unpack(">I", f.read(4))[0]
        h = struct.unpack(">I", f.read(4))[0]
        return w, h


def slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "item"


def label_from_filename(name: str) -> str:
    return Path(name).stem


def is_numbered_variant(stem: str) -> bool:
    return bool(NUMBERED_VARIANT.match(stem))


def base_of_numbered(stem: str) -> str | None:
    match = NUMBERED_VARIANT.match(stem)
    return match.group("base") if match else None


def is_empty_base(stem: str, stems: list[str]) -> bool:
    stem_l = stem.lower()
    for other in stems:
        if not is_numbered_variant(other):
            continue
        base = base_of_numbered(other)
        if base and base.lower() == stem_l:
            return True
    return False


def find_alt_numbered(canonical: Path, group: list[Path]) -> Path | None:
    cm = NUMBERED_VARIANT.match(canonical.stem)
    if not cm:
        return None
    cnum = cm.group("num")
    for png in group:
        if png == canonical:
            continue
        match = NUMBERED_VARIANT.match(png.stem)
        if match and match.group("num") != cnum:
            return png
    return None


def pick_canonical_numbered(group: list[Path]) -> Path:
    for prefer in ("100", "70"):
        for png in group:
            match = NUMBERED_VARIANT.match(png.stem)
            if match and match.group("num") == prefer:
                return png
    return group[0]


def diff_number_mask(empty: "np.ndarray", numbered: "np.ndarray", threshold: int = 80):
    import numpy as np

    return (np.abs(numbered.astype(np.int16) - empty.astype(np.int16)).sum(axis=2) > threshold) & (
        numbered[:, :, 3] > 200
    )


def overlay_from_diff_mask(diff, w: int, h: int) -> dict:
    import numpy as np

    if not diff.any():
        return dict(DEFAULT_NUMBER_OVERLAY)

    ys, xs = np.where(diff)
    cx = (xs.min() + xs.max()) / (2 * w)
    cy = (ys.min() + ys.max()) / (2 * h)
    font_h = (ys.max() - ys.min() + 1) / h
    return {
        **DEFAULT_NUMBER_OVERLAY,
        "leftRatio": round(float(cx), 4),
        "topRatio": round(float(cy), 4),
        "fontSizeRatio": round(float(max(font_h, 0.04)), 4),
    }


def detect_number_fill(img: "np.ndarray", diff) -> str:
    import numpy as np

    ys, xs = np.where(diff)
    if len(xs) == 0:
        return DEFAULT_NUMBER_OVERLAY["fill"]

    pixels = img[diff][:, :3].astype(np.float32)
    if pixels.size == 0:
        return DEFAULT_NUMBER_OVERLAY["fill"]

    ink_lum = pixels.mean(axis=1)
    median_ink = float(np.median(ink_lum))
    dark_count = int((ink_lum < 100).sum())
    bright_count = int((ink_lum > 180).sum())
    # Píxeles del diff = tinta del número (a menudo con antialiasing).
    if median_ink < 90 or dark_count > bright_count:
        return "#111111"
    if median_ink > 165 or bright_count > dark_count:
        return "#FFFFFF"

    greenish = pixels[(pixels[:, 1] > pixels[:, 0] + 15) & (pixels[:, 1] > pixels[:, 2] + 20)]
    if greenish.shape[0] >= 8:
        avg = greenish.mean(axis=0).astype(np.uint8)
        return f"#{avg[0]:02x}{avg[1]:02x}{avg[2]:02x}"

    pad = 3
    y0, y1 = max(0, ys.min() - pad), min(img.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(img.shape[1], xs.max() + pad + 1)
    crop = img[y0:y1, x0:x1]
    rgb = crop[:, :, :3].astype(np.float32)
    lum = rgb.mean(axis=2)
    opaque = crop[:, :, 3] > 200
    plate = lum[(lum < 80) & opaque]
    plate_lum = float(np.median(plate)) if plate.size else float(lum[opaque].mean()) if opaque.any() else 128.0

    # Números en placas claras (amarillo, naranja, blanco): negro
    if plate_lum > 95:
        return "#111111"

    bright = rgb[(lum > plate_lum + 40) & (lum > 100) & opaque]
    if bright.size == 0:
        return DEFAULT_NUMBER_OVERLAY["fill"]
    avg = bright.mean(axis=0)
    return "#FFFFFF" if avg.mean() > 128 else "#111111"


def apply_overlay_tuning(
    overlay: dict,
    group_label: str | None,
    cat_name: str | None = None,
    *,
    multi_slot: bool = False,
) -> dict:
    out = dict(overlay)

    def apply_tune(tune: dict) -> None:
        nonlocal out
        if "fontSizeRatioScale" in tune:
            out["fontSizeRatio"] = round(out.get("fontSizeRatio", 0.07) * tune["fontSizeRatioScale"], 4)
        if "topRatioOffset" in tune and not multi_slot:
            out["topRatio"] = round(min(out.get("topRatio", 0.5) + tune["topRatioOffset"], 0.95), 4)
        if "fontBoost" in tune:
            out["fontBoost"] = tune["fontBoost"]
        if "maxWidthRatio" in tune:
            out["maxWidthRatio"] = tune["maxWidthRatio"]
        if "numberFill" in tune:
            if tune.get("forceFill") or out.get("fill") in (None, DEFAULT_NUMBER_OVERLAY["fill"]):
                out["fill"] = tune["numberFill"]
            elif out.get("fill") in ("#FFFFFF", "#ffffff"):
                # Referencias con número blanco en pantalla negra: forzar color de señal.
                if tune.get("numberFill"):
                    out["fill"] = tune["numberFill"]

    if cat_name and cat_name in CATEGORY_OVERLAY_TUNING:
        apply_tune(CATEGORY_OVERLAY_TUNING[cat_name])
    if group_label and group_label in OVERLAY_TUNING:
        apply_tune(OVERLAY_TUNING[group_label])
    return out


def compute_number_overlay_from_pair(ref_path: Path, alt_path: Path) -> dict:
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return dict(DEFAULT_NUMBER_OVERLAY)

    ref = np.array(Image.open(ref_path).convert("RGBA"))
    alt = np.array(Image.open(alt_path).convert("RGBA"))
    if ref.shape != alt.shape:
        return dict(DEFAULT_NUMBER_OVERLAY)

    h, w = ref.shape[:2]
    diff = diff_number_mask(ref, alt)
    overlay = overlay_from_diff_mask(diff, w, h)
    overlay["fill"] = detect_number_fill(ref, diff)
    return overlay


def erase_baked_number(ref_path: Path, alt_path: Path, dest: Path) -> None:
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        shutil.copy2(ref_path, dest)
        return

    ref = np.array(Image.open(ref_path).convert("RGBA"))
    alt = np.array(Image.open(alt_path).convert("RGBA"))
    if ref.shape != alt.shape:
        shutil.copy2(ref_path, dest)
        return

    diff = diff_number_mask(ref, alt)
    if not diff.any():
        Image.fromarray(ref).save(dest)
        return

    ys, xs = np.where(diff)
    pad = 2
    y0, y1 = max(0, ys.min() - pad), min(ref.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(ref.shape[1], xs.max() + pad + 1)
    crop_lum = ref[y0:y1, x0:x1, :3].astype(np.float32).mean(axis=2)
    plate_lum = crop_lum[crop_lum < 80]
    plate_rgb = (
        np.median(ref[y0:y1, x0:x1][crop_lum < 80, :3], axis=0).astype(np.uint8)
        if plate_lum.size
        else np.array([0, 0, 0], dtype=np.uint8)
    )

    out = ref.copy()
    out[diff, :3] = plate_rgb
    out[diff, 3] = 255
    Image.fromarray(out).save(dest)


def find_triple_numbered_reference(empty_stem: str, folder_pngs: list[Path]) -> Path | None:
    """Referencia numerada triple, p. ej. FinLTV3 → FinLTV3-100 100 100.png."""
    prefix = f"{empty_stem}-"
    candidates = [p for p in folder_pngs if p.stem.startswith(prefix)]
    if not candidates:
        return None
    return sorted(candidates, key=lambda p: p.name.lower())[0]


def _cluster_diff_bands(diff, count: int = 3) -> list[tuple[int, int]]:
    import numpy as np

    ys, _xs = np.where(diff)
    if len(ys) < count * 3:
        return []

    rows = sorted(set(ys.tolist()))
    bands: list[tuple[int, int]] = []
    start = rows[0]
    prev = rows[0]
    for row in rows[1:]:
        if row - prev > 4:
            bands.append((start, prev))
            start = row
        prev = row
    bands.append((start, prev))

    if len(bands) < count:
        y0, y1 = int(ys.min()), int(ys.max())
        step = max((y1 - y0 + 1) / count, 1)
        bands = [(int(y0 + i * step), int(y0 + (i + 1) * step - 1)) for i in range(count)]
    elif len(bands) > count:
        scored = sorted(
            ((int(diff[y0 : y1 + 1, :].sum()), y0, y1) for y0, y1 in bands),
            reverse=True,
        )
        bands = sorted([(y0, y1) for _score, y0, y1 in scored[:count]], key=lambda b: (b[0] + b[1]) / 2)

    return bands[:count]


def compute_triple_number_overlays_from_pair(empty_path: Path, numbered_path: Path) -> list[dict]:
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return []

    empty = np.array(Image.open(empty_path).convert("RGBA"))
    numbered = np.array(Image.open(numbered_path).convert("RGBA"))
    if empty.shape != numbered.shape:
        return []

    h, w = empty.shape[:2]
    diff = diff_number_mask(empty, numbered)
    if not diff.any():
        return []

    bands = _cluster_diff_bands(diff, 3)
    if len(bands) < 3:
        return []

    overlays: list[dict] = []
    for y0, y1 in sorted(bands, key=lambda b: (b[0] + b[1]) / 2):
        band_mask = np.zeros(diff.shape, dtype=bool)
        band_mask[y0 : y1 + 1, :] = diff[y0 : y1 + 1, :]
        overlay = overlay_from_diff_mask(band_mask, w, h)
        overlay["fill"] = detect_number_fill(numbered, band_mask)
        overlay["maxWidthRatio"] = 0.58
        overlays.append(overlay)
    return overlays


def find_reference_numbered(empty_stem: str, folder_pngs: list[Path], empty_path: Path | None = None) -> Path | None:
    """Elige una referencia numerada; prioriza mismo tamaño que la vacía."""
    stem_l = empty_stem.lower()
    candidates: list[Path] = []
    for prefer in ("100", "70"):
        for png in folder_pngs:
            match = NUMBERED_VARIANT.match(png.stem)
            if match and match.group("base").lower() == stem_l and match.group("num") == prefer:
                candidates.append(png)
    for png in folder_pngs:
        match = NUMBERED_VARIANT.match(png.stem)
        if match and match.group("base").lower() == stem_l and png not in candidates:
            candidates.append(png)
    if not candidates:
        return None
    if empty_path and empty_path.exists():
        ew, eh = png_size(empty_path)
        same = [p for p in candidates if png_size(p) == (ew, eh)]
        if same:
            return same[0]
    return candidates[0]


def find_directional_numbered(base_stem: str, folder_pngs: list[Path]) -> dict[str, Path]:
    """Referencias numeradas con variante derecha/izquierda (flecha)."""
    base_l = base_stem.lower()
    found: dict[str, Path] = {}
    for png in folder_pngs:
        match = NUMBERED_VARIANT.match(png.stem)
        if not match or match.group("base").lower() != base_l:
            continue
        direction = (match.group("dir") or "").lower()
        if direction not in ("derecha", "izquierda"):
            continue
        prev = found.get(direction)
        if not prev or match.group("num") == "100":
            found[direction] = png
    return found


def build_arrow_overlay(
    empty_path: Path,
    der_path: Path,
    izq_path: Path,
    assets_root: Path,
    cat_name: str,
    group_label: str | None,
    shape_slug: str,
) -> dict | None:
    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return None

    empty = np.array(Image.open(empty_path).convert("RGBA"))
    der = np.array(Image.open(der_path).convert("RGBA"))
    izq = np.array(Image.open(izq_path).convert("RGBA"))
    if empty.shape != der.shape or der.shape != izq.shape:
        return None

    h, w = der.shape[:2]
    directional = np.abs(der.astype(np.int16) - izq.astype(np.int16)).sum(axis=2) > 40
    if not directional.any():
        return None

    result: dict = {"defaultDirection": "right"}
    for _direction, img, key in (("derecha", der, "right"), ("izquierda", izq, "left")):
        from_empty = np.abs(empty.astype(np.int16) - img.astype(np.int16)).sum(axis=2) > 30
        mask = directional & from_empty & (img[:, :, 0] > 120)
        if not mask.any():
            mask = directional & (img[:, :, 0] > 120)
        if not mask.any():
            continue
        ys, xs = np.where(mask)
        y0, y1 = ys.min(), ys.max() + 1
        x0, x1 = xs.min(), xs.max() + 1
        patch = img[y0:y1, x0:x1].copy()
        local_mask = mask[y0:y1, x0:x1]
        patch[~local_mask, 3] = 0

        if group_label:
            arrow_dir = assets_root / cat_name / group_label / "arrows"
            rel = Path(cat_name) / group_label / "arrows" / f"{shape_slug}-arrow-{key}.png"
        else:
            arrow_dir = assets_root / cat_name / "arrows"
            rel = Path(cat_name) / "arrows" / f"{shape_slug}-arrow-{key}.png"
        arrow_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(patch).save(assets_root / rel)

        result[key] = {
            "imageAsset": f"/assets/prefabricados/{rel.as_posix()}",
            "leftRatio": round(float(x0 / w), 4),
            "topRatio": round(float(y0 / h), 4),
            "widthRatio": round(float(max((x1 - x0) / w, 0.02)), 4),
            "heightRatio": round(float(max((y1 - y0) / h, 0.02)), 4),
        }

    return result if "right" in result and "left" in result else None


def detect_speed_plate_overlay(img: "np.ndarray") -> dict | None:
    """Localiza la placa (naranja/amarilla/blanca) en señales de velocidad recortadas."""
    import numpy as np

    h, w = img.shape[:2]
    r, g, b, a = img[:, :, 0], img[:, :, 1], img[:, :, 2], img[:, :, 3]
    opaque = a > 200
    orange = opaque & (r > 180) & (g > 80) & (g < 200) & (b < 80)
    yellow = opaque & (r > 200) & (g > 200) & (b < 80)
    white = opaque & (r > 200) & (g > 200) & (b > 200)
    # Preferir placa grande (rombo), no el tipito naranja de LTVconCSV.
    for mask in (yellow, orange, white):
        rows = np.where(mask.sum(axis=1) > max(w * 0.28, 4))[0]
        if len(rows) == 0:
            continue
        # Primera banda contigua (= placa superior)
        start = int(rows[0])
        end = start
        for row in rows[1:]:
            if row - end > 4:
                break
            end = int(row)
        if (end - start + 1) / h < 0.12:
            continue
        cy = (start + end) / (2 * h)
        font_h = (end - start + 1) / h
        return {
            **DEFAULT_NUMBER_OVERLAY,
            "leftRatio": 0.5,
            "topRatio": round(float(cy), 4),
            "fontSizeRatio": round(float(max(font_h * 0.28, 0.045)), 4),
            "fill": "#111111",
        }
    return None


def compute_number_overlay(
    empty_path: Path,
    folder_pngs: list[Path],
    *,
    processed_path: Path | None = None,
) -> dict:
    """Calcula posición y tamaño del número comparando vacía vs numerada."""
    ref = find_reference_numbered(empty_path.stem, folder_pngs, empty_path)

    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return dict(DEFAULT_NUMBER_OVERLAY)

    plate_src = processed_path if processed_path and processed_path.exists() else empty_path

    if not ref or not ref.exists():
        plate = detect_speed_plate_overlay(np.array(Image.open(plate_src).convert("RGBA")))
        return plate or dict(DEFAULT_NUMBER_OVERLAY)

    empty = np.array(Image.open(empty_path).convert("RGBA"))
    numbered = np.array(Image.open(ref).convert("RGBA"))
    if empty.shape != numbered.shape:
        # Bases recortadas vs referencias antiguas: detectar placa en la vacía procesada.
        plate = detect_speed_plate_overlay(np.array(Image.open(plate_src).convert("RGBA")))
        return plate or dict(DEFAULT_NUMBER_OVERLAY)

    h, w = empty.shape[:2]
    diff = (np.abs(numbered.astype(np.int16) - empty.astype(np.int16)).sum(axis=2) > 60) & (
        numbered[:, :, 3] > 200
    )
    directional = find_directional_numbered(empty_path.stem, folder_pngs)
    if "derecha" in directional and "izquierda" in directional:
        try:
            der = np.array(Image.open(directional["derecha"]).convert("RGBA"))
            izq = np.array(Image.open(directional["izquierda"]).convert("RGBA"))
            arrow = np.abs(der.astype(np.int16) - izq.astype(np.int16)).sum(axis=2) > 40
            diff = diff & ~arrow
        except Exception:
            pass
    if not diff.any():
        plate = detect_speed_plate_overlay(np.array(Image.open(plate_src).convert("RGBA")))
        return plate or dict(DEFAULT_NUMBER_OVERLAY)

    overlay = overlay_from_diff_mask(diff, w, h)
    overlay["fill"] = detect_number_fill(numbered, diff)
    return overlay


def filter_folder_pngs(pngs: list[Path]) -> list[tuple[Path, bool, Path | None]]:
    """(archivo, numero personalizable, alternativa numerada para borrar el numero)."""
    stems = [p.stem for p in pngs]
    has_numbered = any(is_numbered_variant(s) for s in stems)
    has_empty_base = any(not is_numbered_variant(s) and is_empty_base(s, stems) for s in stems)

    if not has_numbered:
        return [(p, False, None) for p in pngs]

    if has_empty_base:
        result: list[tuple[Path, bool, Path | None]] = []
        for p in pngs:
            stem = p.stem
            if is_numbered_variant(stem):
                continue
            result.append((p, is_empty_base(stem, stems), None))
        return result

    groups: dict[tuple[str, str], list[Path]] = {}
    extras: list[Path] = []
    for p in pngs:
        match = NUMBERED_VARIANT.match(p.stem)
        if not match:
            extras.append(p)
            continue
        key = (match.group("base").lower(), (match.group("dir") or "").lower())
        groups.setdefault(key, []).append(p)

    result = [(p, False, None) for p in extras]
    for group in groups.values():
        canonical = pick_canonical_numbered(group)
        alt = find_alt_numbered(canonical, group)
        result.append((canonical, bool(alt), alt))
    return result


FIN_LTV_TRIPLE_FONT_PX = 9


def is_triple_speed_signal(stem: str) -> bool:
    return stem.endswith("3") and not is_numbered_variant(stem)


TRIPLE_SPEED_FALLBACK: dict[str, list[dict]] = {
    "FinLTV3": [
        {"leftRatio": 0.5, "topRatio": 0.22, "fontSizeRatio": 0.045, "maxWidthRatio": 0.50},
        {"leftRatio": 0.5, "topRatio": 0.40, "fontSizeRatio": 0.045, "maxWidthRatio": 0.62},
        {"leftRatio": 0.5, "topRatio": 0.58, "fontSizeRatio": 0.045, "maxWidthRatio": 0.50},
    ],
    "CSV3": [
        {"leftRatio": 0.5, "topRatio": 0.123, "fontSizeRatio": 0.0613, "maxWidthRatio": 0.70},
        {"leftRatio": 0.5, "topRatio": 0.373, "fontSizeRatio": 0.0613, "maxWidthRatio": 0.70},
        {"leftRatio": 0.5, "topRatio": 0.623, "fontSizeRatio": 0.0613, "maxWidthRatio": 0.70},
    ],
    "VM3": [
        {"leftRatio": 0.5, "topRatio": 0.123, "fontSizeRatio": 0.0613, "maxWidthRatio": 0.70},
        {"leftRatio": 0.5, "topRatio": 0.373, "fontSizeRatio": 0.0613, "maxWidthRatio": 0.70},
        {"leftRatio": 0.5, "topRatio": 0.623, "fontSizeRatio": 0.0613, "maxWidthRatio": 0.70},
    ],
    "AVM3": [
        {"leftRatio": 0.5, "topRatio": 0.256, "fontSizeRatio": 0.055, "maxWidthRatio": 0.55},
        {"leftRatio": 0.5, "topRatio": 0.502, "fontSizeRatio": 0.055, "maxWidthRatio": 0.55},
        {"leftRatio": 0.5, "topRatio": 0.748, "fontSizeRatio": 0.055, "maxWidthRatio": 0.55},
    ],
    "AVMconCSV3": [
        {"leftRatio": 0.5, "topRatio": 0.1341, "fontSizeRatio": 0.0622, "maxWidthRatio": 0.70},
        {"leftRatio": 0.5, "topRatio": 0.378, "fontSizeRatio": 0.0622, "maxWidthRatio": 0.70},
        {"leftRatio": 0.5, "topRatio": 0.626, "fontSizeRatio": 0.0622, "maxWidthRatio": 0.70},
    ],
}


def _overlay_slots_from_bands(
    bands: list[tuple[int, int]],
    h: int,
    w: int,
    font_ratio_scale: float = 0.30,
    max_width: float = 0.72,
) -> list[dict]:
    overlays: list[dict] = []
    for y0, y1 in bands:
        cy = ((y0 + y1) / 2) / h
        fh = (y1 - y0 + 1) / h
        overlays.append(
            {
                **DEFAULT_NUMBER_OVERLAY,
                "leftRatio": round(0.5, 4),
                "topRatio": round(cy, 4),
                "fontSizeRatio": round(max(fh * font_ratio_scale, 0.038), 4),
                "maxWidthRatio": round(max_width, 4),
            }
        )
    return overlays


def _detect_orange_stack_overlays(img: "np.ndarray") -> list[dict]:
    import numpy as np

    h, w = img.shape[:2]
    r, g, b, a = img[:, :, 0], img[:, :, 1], img[:, :, 2], img[:, :, 3]
    mask = (a > 200) & (r > 180) & (g > 80) & (g < 200) & (b < 80)
    mask[: int(h * 0.02)] = False
    mask[int(h * 0.98) :] = False
    rows = np.where(mask.any(axis=1))[0]
    if len(rows) == 0:
        return []
    bands: list[tuple[int, int]] = []
    start = rows[0]
    prev = rows[0]
    for row in rows[1:]:
        if row - prev > 8:
            if (prev - start + 1) / h >= 0.12:
                bands.append((start, prev))
            start = row
        prev = row
    if (prev - start + 1) / h >= 0.12:
        bands.append((start, prev))
    if len(bands) < 3:
        return []
    return _overlay_slots_from_bands(bands[:3], h, w, 0.30, 0.70)


def _detect_diamond_line_overlays(img: "np.ndarray") -> list[dict]:
    """Tres huecos del rombo: detecta las dos líneas horizontales internas."""
    import numpy as np

    h, w = img.shape[:2]
    lum = img[:, :, :3].mean(axis=2)
    a = img[:, :, 3]
    cx0, cx1 = int(w * 0.18), int(w * 0.82)
    span = max(cx1 - cx0, 1)

    limit = int(h * 0.72)
    white = (a > 200) & (lum > 215)
    white[limit:, :] = False
    white[: int(h * 0.02), :] = False
    rows = np.where(white.any(axis=1))[0]
    if len(rows) < 10:
        return []
    y0, y1 = int(rows[0]), int(rows[-1])
    if (y1 - y0) / h < 0.2:
        return []

    line_centers: list[int] = []
    in_line = False
    line_start = 0
    for y in range(y0 + 8, y1 - 8):
        frac = (((a[y, cx0:cx1] > 200) & (lum[y, cx0:cx1] < 60)).sum() / span)
        if frac > 0.42:
            if not in_line:
                line_start = y
                in_line = True
        elif in_line:
            line_centers.append((line_start + y - 1) // 2)
            in_line = False
    if in_line:
        line_centers.append((line_start + y) // 2)

    line_centers = [c for c in line_centers if y0 + 10 < c < y1 - 10]
    if len(line_centers) < 2:
        return []

    line_centers = sorted(line_centers)
    if len(line_centers) > 2:
        best_pair: tuple[int, int] | None = None
        best_score = -1.0
        for i in range(len(line_centers)):
            for j in range(i + 1, len(line_centers)):
                a_line, b_line = line_centers[i], line_centers[j]
                zones = [a_line - y0, b_line - a_line, y1 - b_line]
                if min(zones) < (y1 - y0) * 0.12:
                    continue
                score = min(zones) / max(zones)
                if score > best_score:
                    best_score = score
                    best_pair = (a_line, b_line)
        if not best_pair:
            return []
        line_centers = list(best_pair)

    bounds = [y0, line_centers[0], line_centers[1], y1]
    bands = [(bounds[i], bounds[i + 1]) for i in range(3)]
    return _overlay_slots_from_bands(bands, h, w, 0.34, 0.58)


def _detect_white_diamond_overlays(img: "np.ndarray") -> list[dict]:
    import numpy as np

    h, w = img.shape[:2]
    lum = img[:, :, :3].mean(axis=2)
    a = img[:, :, 3]
    limit = int(h * 0.68)
    white = (a > 200) & (lum > 215)
    white[limit:, :] = False
    white[: int(h * 0.04), :] = False
    rows = np.where(white.any(axis=1))[0]
    if len(rows) == 0:
        return []
    bands: list[tuple[int, int]] = []
    start = rows[0]
    prev = rows[0]
    for row in rows[1:]:
        if row - prev > 4:
            if (prev - start + 1) / h >= 0.08:
                bands.append((start, prev))
            start = row
        prev = row
    if (prev - start + 1) / h >= 0.08:
        bands.append((start, prev))
    if len(bands) < 3:
        return []
    return _overlay_slots_from_bands(bands[:3], h, w, 0.34, 0.58)


def _detect_circle_stack_overlays(img: "np.ndarray") -> list[dict]:
    import numpy as np

    h, w = img.shape[:2]
    lum = img[:, :, :3].mean(axis=2)
    a = img[:, :, 3]
    white = (a > 200) & (lum > 180)
    rows = np.where(white.any(axis=1))[0]
    if len(rows) == 0:
        return []
    bands: list[tuple[int, int]] = []
    start = rows[0]
    prev = rows[0]
    for row in rows[1:]:
        if row - prev > 10:
            if (prev - start + 1) >= h * 0.08:
                bands.append((start, prev))
            start = row
        prev = row
    if (prev - start + 1) >= h * 0.08:
        bands.append((start, prev))
    upper = [band for band in bands if ((band[0] + band[1]) / 2) < h * 0.85]
    upper.sort(key=lambda band: band[1] - band[0], reverse=True)
    pick = sorted(upper[:3], key=lambda band: (band[0] + band[1]) / 2)
    if len(pick) != 3:
        return []
    return _overlay_slots_from_bands(pick, h, w, 0.36, 0.55)


def compute_triple_number_overlays(
    png: Path,
    folder_pngs: list[Path] | None = None,
    *,
    source_png: Path | None = None,
) -> list[dict]:
    empty_for_pair = source_png or png
    if folder_pngs:
        ref = find_triple_numbered_reference(empty_for_pair.stem, folder_pngs)
        if ref and ref.exists() and empty_for_pair.exists():
            pair_overlays = compute_triple_number_overlays_from_pair(empty_for_pair, ref)
            if len(pair_overlays) == 3:
                return pair_overlays

    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return []

    img = np.array(Image.open(png).convert("RGBA"))
    overlays = (
        _detect_diamond_line_overlays(img)
        or _detect_orange_stack_overlays(img)
        or _detect_white_diamond_overlays(img)
        or _detect_circle_stack_overlays(img)
    )
    if len(overlays) == 3:
        return overlays

    fallback = TRIPLE_SPEED_FALLBACK.get(png.stem)
    if not fallback:
        return []
    return [{**DEFAULT_NUMBER_OVERLAY, **slot} for slot in fallback]


def build_shape_entry(
    png: Path,
    cat_name: str,
    group_label: str | None,
    custom_number: bool,
    folder_pngs: list[Path],
    alt_numbered: Path | None = None,
    assets_root: Path | None = None,
    processed_png: Path | None = None,
) -> dict:
    w, h = png_size(png)
    if group_label:
        dest_rel = Path(cat_name) / group_label / png.name
        shape_id = slug(f"{cat_name}-{group_label}-{png.stem}")
    else:
        dest_rel = Path(cat_name) / png.name
        shape_id = slug(f"{cat_name}-{png.stem}")

    entry = {
        "id": shape_id,
        "label": label_from_filename(png.name),
        "name": label_from_filename(png.name),
        "imageAsset": f"/assets/prefabricados/{dest_rel.as_posix()}",
        "width": w,
        "height": h,
        "defaultScale": 1,
        "imagePreset": True,
    }
    if custom_number:
        entry["customNumber"] = True
        if alt_numbered and alt_numbered.exists():
            overlay = compute_number_overlay_from_pair(png, alt_numbered)
        else:
            overlay = compute_number_overlay(png, folder_pngs, processed_path=processed_png)
        entry["numberOverlay"] = apply_overlay_tuning(overlay, group_label, cat_name)
        directional = find_directional_numbered(png.stem, folder_pngs)
        if "derecha" in directional and "izquierda" in directional and assets_root is not None:
            arrow_overlay = build_arrow_overlay(
                png,
                directional["derecha"],
                directional["izquierda"],
                assets_root,
                cat_name,
                group_label,
                shape_id,
            )
            if arrow_overlay:
                entry["customArrow"] = True
                entry["arrowOverlay"] = arrow_overlay
    elif is_triple_speed_signal(png.stem):
        overlays = compute_triple_number_overlays(processed_png or png, folder_pngs, source_png=png)
        if overlays:
            entry["customNumber"] = True
            tuned = [
                apply_overlay_tuning(overlay, group_label, cat_name, multi_slot=True)
                for overlay in overlays
            ]
            if group_label == "Fin LTV" and png.stem.lower() == "finltv3":
                for ov in tuned:
                    ov["fontSizePx"] = FIN_LTV_TRIPLE_FONT_PX
                    ov["leftRatio"] = 0.5
            entry["numberOverlays"] = tuned
    if cat_name == "Trayecto":
        entry["customStationCount"] = True
        entry["vectorTrayecto"] = True
        entry["defaultStationCount"] = 6
        entry["minStationCount"] = 1
        entry["maxStationCount"] = 24
        stem_l = png.stem.lower()
        entry["trayectoTrackMode"] = "double" if "doble" in stem_l else "single"
    return entry


def process_png_list(
    pngs: list[Path],
    cat_name: str,
    group_label: str | None,
    dest_base: Path,
) -> list[dict]:
    shapes: list[dict] = []
    for png, custom_number, alt_numbered in filter_folder_pngs(pngs):
        if group_label:
            dest_rel = Path(cat_name) / group_label / png.name
        else:
            dest_rel = Path(cat_name) / png.name
        dest = dest_base / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if custom_number and alt_numbered and alt_numbered.exists():
            erase_baked_number(png, alt_numbered, dest)
        else:
            shutil.copy2(png, dest)
        remove_outer_white(dest)
        shapes.append(
            build_shape_entry(
                png, cat_name, group_label, custom_number, pngs, alt_numbered, dest_base, dest,
            )
        )
    share_overlays_across_aspects(shapes)
    return shapes


ASPECT_LABEL_RE = re.compile(
    r"(verdedestellos|verdeamarillo|amarillodestellos|rojoblancodestellos|rojoblanco|"
    r"amarillodestellos|amarillo|destellos|blanco|rojoazuldestellos|rojoazul|rojo|verde)",
    re.IGNORECASE,
)


def _aspect_family_key(label: str) -> str:
    text = unicodedata.normalize("NFKD", str(label or ""))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = re.sub(r"[^a-z0-9]+", "", text)
    text = ASPECT_LABEL_RE.sub("", text)
    return text or "shape"


def share_overlays_across_aspects(shapes: list[dict]) -> None:
    """Si un aspecto tiene número/flecha calibrados, el resto de la familia los hereda.

    Así «con pantalla» (amarillo/rojo/verde) también permite velocidad y flecha,
    aunque solo verdeamarillo tenga PNGs de referencia numerados.
    """
    from collections import defaultdict

    buckets: dict[str, list[dict]] = defaultdict(list)
    for shape in shapes:
        if not shape.get("imageAsset"):
            continue
        buckets[_aspect_family_key(shape.get("label") or shape.get("name") or "")].append(shape)

    for family in buckets.values():
        if len(family) < 2:
            continue
        donor = next((s for s in family if s.get("customNumber") or s.get("customArrow")), None)
        if not donor:
            continue
        for shape in family:
            if shape is donor:
                continue
            if donor.get("customNumber"):
                shape["customNumber"] = True
                if donor.get("numberOverlay"):
                    shape["numberOverlay"] = dict(donor["numberOverlay"])
                if donor.get("numberOverlays"):
                    shape["numberOverlays"] = [dict(slot) for slot in donor["numberOverlays"]]
            if donor.get("customArrow") and donor.get("arrowOverlay"):
                shape["customArrow"] = True
                shape["arrowOverlay"] = {
                    key: (dict(val) if isinstance(val, dict) else val)
                    for key, val in donor["arrowOverlay"].items()
                }


def main():
    if OUT_ASSETS.exists():
        shutil.rmtree(OUT_ASSETS)
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)

    categories: dict[str, dict] = {}
    category_names = discover_categories()

    for cat_name in category_names:
        cat_path = SRC / cat_name
        if not cat_path.is_dir():
            continue
        categories[cat_name] = {"label": cat_name, "groups": {}}

        subdirs = sorted([p for p in cat_path.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
        root_pngs = sorted(cat_path.glob("*.png"), key=lambda p: p.name.lower())

        if root_pngs:
            shapes = process_png_list(root_pngs, cat_name, None, OUT_ASSETS)
            if shapes:
                categories[cat_name]["groups"]["__root__"] = {"label": None, "shapes": shapes}

        for subdir in subdirs:
            pngs = sorted(subdir.glob("*.png"), key=lambda p: p.name.lower())
            if not pngs:
                continue
            shapes = process_png_list(pngs, cat_name, subdir.name, OUT_ASSETS)
            if shapes:
                categories[cat_name]["groups"][subdir.name] = {
                    "label": subdir.name,
                    "shapes": shapes,
                }

    catalog = []
    all_shapes = []
    custom_count = 0
    for cat_name in category_names:
        if cat_name not in categories:
            continue
        cat = categories[cat_name]
        groups = []
        for group_key, group in cat["groups"].items():
            if not group["shapes"]:
                continue
            groups.append({"label": group["label"], "shapes": group["shapes"]})
            all_shapes.extend(group["shapes"])
            custom_count += sum(1 for s in group["shapes"] if s.get("customNumber"))
        if groups:
            catalog.append({"label": cat["label"], "groups": groups})

    js = f"""// Generado por scripts/generate_presets.py — no editar a mano
export const PRESET_CATEGORIES = {json.dumps(catalog, ensure_ascii=False, indent=2)};

export const PRESET_SHAPES = PRESET_CATEGORIES.flatMap((cat) =>
  cat.groups.flatMap((group) => group.shapes),
);

export function getPresetShape(id) {{
  return PRESET_SHAPES.find((s) => s.id === id);
}}

export function getPresetCategories() {{
  return PRESET_CATEGORIES;
}}
"""
    OUT_JS.write_text(js, encoding="utf-8")
    print(f"Catalogo: {len(all_shapes)} figuras en {len(catalog)} categorias ({custom_count} con numero personalizable)")
    print(f"JS -> {OUT_JS}")
    print(f"Assets -> {OUT_ASSETS}")


if __name__ == "__main__":
    main()
