"""Render the Turrigan Guard icon SVG to the PNG sizes an MV3 extension + the stores need.

Renders the vector once at high resolution (PyMuPDF), then downscales with Pillow LANCZOS so the
small toolbar sizes stay crisp. Run with the real Python launcher:  py icons/make_icons.py
Outputs icon16/32/48/128/512.png next to the SVG (transparent background).
"""
import io
import os

import fitz  # PyMuPDF
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SVG = os.path.join(HERE, "guard-icon.svg")
MASTER = 512
SIZES = (128, 48, 32, 16)


def render_master() -> Image.Image:
    doc = fitz.open(SVG)
    page = doc[0]
    zoom = MASTER / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")


def main() -> None:
    master = render_master()
    master.save(os.path.join(HERE, "icon512.png"))
    made = ["icon512.png"]
    for s in SIZES:
        master.resize((s, s), Image.LANCZOS).save(os.path.join(HERE, f"icon{s}.png"))
        made.append(f"icon{s}.png")
    print("Wrote:", ", ".join(made))


if __name__ == "__main__":
    main()
