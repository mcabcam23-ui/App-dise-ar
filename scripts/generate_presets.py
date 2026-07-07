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
    "Normales",
    "Preanuncio",
    "Retroceso",
    "Trayecto",
    "Velocidad",
]

# Variante con velocidad al final del nombre (70, 100, 100derecha…)
NUMBERED_VARIANT = re.compile(
    r"^(?P<base>.+?)(?P<num>\d{2,3})(?P<dir>derecha|izquierda)?$",
    re.IGNORECASE,
)

DEFAULT_NUMBER_OVERLAY = {
    "fontFamily": "Arial Black, Arial, sans-serif",
    "fontWeight": "bold",
    "fill": "#111111",
    "fontSizeRatio": 0.2,
    "leftRatio": 0.5,
    "topRatio": 0.56,
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


def filter_folder_pngs(pngs: list[Path]) -> list[tuple[Path, bool]]:
    """
    Si la carpeta mezcla señales vacías y con número en el nombre,
    excluye las numeradas y marca las vacías con customNumber.
    Si solo hay numeradas (p. ej. con pantalla), se incluyen todas.
    """
    stems = [p.stem for p in pngs]
    has_numbered = any(is_numbered_variant(s) for s in stems)
    has_empty_base = any(not is_numbered_variant(s) and is_empty_base(s, stems) for s in stems)

    if not has_numbered:
        return [(p, False) for p in pngs]

    if has_empty_base:
        result: list[tuple[Path, bool]] = []
        for p in pngs:
            stem = p.stem
            if is_numbered_variant(stem):
                continue
            result.append((p, is_empty_base(stem, stems)))
        return result

    return [(p, False) for p in pngs]


def build_shape_entry(
    png: Path,
    cat_name: str,
    group_label: str | None,
    custom_number: bool,
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
        entry["numberOverlay"] = dict(DEFAULT_NUMBER_OVERLAY)
    return entry


def process_png_list(
    pngs: list[Path],
    cat_name: str,
    group_label: str | None,
    dest_base: Path,
) -> list[dict]:
    shapes: list[dict] = []
    for png, custom_number in filter_folder_pngs(pngs):
        if group_label:
            dest_rel = Path(cat_name) / group_label / png.name
        else:
            dest_rel = Path(cat_name) / png.name
        dest = dest_base / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(png, dest)
        remove_outer_white(dest)
        shapes.append(build_shape_entry(png, cat_name, group_label, custom_number))
    return shapes


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
