"""Build the README showcase images: dashboard screenshots framed in a browser window on a consistent background.

Usage:
    python scripts/make_showcase.py SHOTS_DIR

SHOTS_DIR must contain raw headless-Chrome screenshots of the live site:
    why.png (index.html, 1280 wide), cost.png (cost.html), picker.png (picker.html?lang=Hindi&cricket=1),
    phone.png (picker at 390px wide)
Writes docs/screenshots/showcase-*.png. Pillow comes with matplotlib, so no new dependency.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT = REPO_ROOT / "docs" / "screenshots"

CANVAS_W = 1600          # every showcase image has the same width
PAD = 90                 # space around the window
BAR = 44                 # browser title-bar height
RADIUS = 18
BG_TOP, BG_BOTTOM = (24, 28, 40), (10, 10, 12)
BAR_COLOR, BORDER = (32, 32, 34), (60, 60, 64)
DOTS = [(237, 106, 94), (245, 191, 79), (98, 197, 84)]


def gradient(width: int, height: int) -> Image.Image:
    bg = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(bg)
    for y in range(height):
        t = y / max(height - 1, 1)
        draw.line([(0, y), (width, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    return bg


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius, fill=255)
    return mask


def window(shot: Image.Image, width: int, url: str) -> Image.Image:
    """The screenshot scaled to `width`, under a browser title bar, with rounded corners."""
    shot = shot.convert("RGB")
    shot = shot.resize((width, round(shot.height * width / shot.width)), Image.LANCZOS)
    win = Image.new("RGB", (width, shot.height + BAR), BAR_COLOR)
    win.paste(shot, (0, BAR))
    draw = ImageDraw.Draw(win)
    for i, colour in enumerate(DOTS):
        cx = 24 + i * 22
        draw.ellipse([cx - 6, BAR // 2 - 6, cx + 6, BAR // 2 + 6], fill=colour)
    draw.rounded_rectangle([110, 10, width - 110, BAR - 10], 8, fill=(22, 22, 24))
    draw.text((126, BAR // 2 - 6), url, fill=(170, 170, 176))
    draw.rounded_rectangle([0, 0, width - 1, win.height - 1], RADIUS, outline=BORDER, width=2)
    win.putalpha(rounded_mask(win.size, RADIUS))
    return win


def phone(shot: Image.Image, height: int) -> Image.Image:
    """The phone screenshot in a simple dark device frame."""
    bezel = 14
    shot = shot.convert("RGB")
    inner_h = height - 2 * bezel
    shot = shot.resize((round(shot.width * inner_h / shot.height), inner_h), Image.LANCZOS)
    body = Image.new("RGB", (shot.width + 2 * bezel, height), (18, 18, 20))
    screen_mask = rounded_mask(shot.size, 22)
    body.paste(shot, (bezel, bezel), screen_mask)
    draw = ImageDraw.Draw(body)
    draw.rounded_rectangle([0, 0, body.width - 1, body.height - 1], 36, outline=(70, 70, 76), width=3)
    body.putalpha(rounded_mask(body.size, 36))
    return body


def place(canvas: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    """Paste with a soft drop shadow."""
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    alpha = layer.getchannel("A").point(lambda a: 150 if a else 0)
    shadow.paste((0, 0, 0, 255), (xy[0] + 10, xy[1] + 18), alpha)
    canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))
    canvas.alpha_composite(layer, xy)


def showcase(shot: Image.Image, url: str, phone_shot: Image.Image | None = None) -> Image.Image:
    """One framed browser window; with phone_shot, the phone stands beside it (never covering content)."""
    gap, phone_w = 56, 290
    win_w = CANVAS_W - 2 * PAD - (gap + phone_w if phone_shot is not None else 0)
    win = window(shot, win_w, url)
    canvas = gradient(CANVAS_W, win.height + 2 * PAD).convert("RGBA")
    place(canvas, win, (PAD, PAD))
    if phone_shot is not None:
        ph = phone(phone_shot, win.height)
        place(canvas, ph, (PAD + win_w + gap, PAD))
    return canvas.convert("RGB")


def main(shots: Path) -> None:
    def load(name: str, box: tuple[int, int, int, int] | None = None) -> Image.Image:
        image = Image.open(shots / name)
        return image.crop(box) if box else image

    site = "sangitazare.github.io/india-ott-dashboard"
    jobs = {
        "showcase-why.png": showcase(load("why.png", (0, 0, 1280, 1270)), f"{site}/"),
        "showcase-picker.png": showcase(load("picker.png", (0, 0, 1280, 1215)), f"{site}/picker.html",
                                        phone_shot=load("phone.png", (0, 0, 390, 1650))),
        "showcase-cost.png": showcase(load("cost.png", (0, 0, 1280, 1395)), f"{site}/cost.html"),
        "showcase-bundles.png": showcase(load("cost.png", (0, 2790, 1280, 3585)), f"{site}/cost.html"),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    for name, image in jobs.items():
        image.save(OUT / name, optimize=True)
        print(f"wrote {name} {image.size}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
