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
]


def discover_categories() -> list[str]:
    """Categorías en SRC: primero las de CATEGORY_ORDER, luego el resto alfabéticamente."""
    if not SRC.is_dir():
        return list(CATEGORY_ORDER)
    found = sorted(
        [p.name for p in SRC.iterdir() if p.is_dir()],
        key=str.lower,
    )
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
            categories[cat_name]["groups"]["__root__"] = {"label": None, "shapes": []}

        for png in root_pngs:
            w, h = png_size(png)
            dest_rel = Path(cat_name) / png.name
            dest = OUT_ASSETS / dest_rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(png, dest)
            remove_outer_white(dest)
            shape_id = slug(f"{cat_name}-{png.stem}")
            categories[cat_name]["groups"]["__root__"]["shapes"].append(
                {
                    "id": shape_id,
                    "label": label_from_filename(png.name),
                    "name": label_from_filename(png.name),
                    "imageAsset": f"/assets/prefabricados/{dest_rel.as_posix()}",
                    "width": w,
                    "height": h,
                    "defaultScale": 1,
                    "imagePreset": True,
                }
            )

        for subdir in subdirs:
            group_key = subdir.name
            categories[cat_name]["groups"][group_key] = {"label": group_key, "shapes": []}
            for png in sorted(subdir.glob("*.png"), key=lambda p: p.name.lower()):
                w, h = png_size(png)
                dest_rel = Path(cat_name) / subdir.name / png.name
                dest = OUT_ASSETS / dest_rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(png, dest)
                remove_outer_white(dest)
                shape_id = slug(f"{cat_name}-{subdir.name}-{png.stem}")
                categories[cat_name]["groups"][group_key]["shapes"].append(
                    {
                        "id": shape_id,
                        "label": label_from_filename(png.name),
                        "name": label_from_filename(png.name),
                        "imageAsset": f"/assets/prefabricados/{dest_rel.as_posix()}",
                        "width": w,
                        "height": h,
                        "defaultScale": 1,
                        "imagePreset": True,
                    }
                )

    catalog = []
    all_shapes = []
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
    print(f"Catalogo: {len(all_shapes)} figuras en {len(catalog)} categorias")
    print(f"JS -> {OUT_JS}")
    print(f"Assets -> {OUT_ASSETS}")


if __name__ == "__main__":
    main()
