"""Generates the demo photography and the PWA icon set.

The coursework needs a realistic-looking journal to demonstrate the map and the
photo pipeline. Rather than shipping stock photos, this script paints six
"travel poster" landscapes with numpy + Pillow. Re-run it with:

    python tools/make_assets.py

Outputs:
    public/demo/*.jpg       1200x900 demo photos
    public/icons/*.png      192 / 512 / maskable / apple-touch icons
"""

from __future__ import annotations

import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1200, 900
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO_DIR = os.path.join(ROOT, "public", "demo")
ICON_DIR = os.path.join(ROOT, "public", "icons")


def rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t: float):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def vertical_gradient(stops, width=W, height=H) -> Image.Image:
    """stops: [(position 0..1, colour), ...] sorted ascending."""
    rows = np.zeros((height, 3), dtype=np.float32)
    for y in range(height):
        t = y / max(1, height - 1)
        colour = stops[-1][1]
        for index in range(len(stops) - 1):
            p0, c0 = stops[index]
            p1, c1 = stops[index + 1]
            if p0 <= t <= p1:
                local = 0 if p1 == p0 else (t - p0) / (p1 - p0)
                colour = mix(c0, c1, local)
                break
        rows[y] = colour
    arr = np.repeat(rows[:, None, :], width, axis=1).astype(np.uint8)
    return Image.fromarray(arr, "RGB")


def ridge(width: int, base: float, amplitude: float, seed: int, octaves: int = 5) -> np.ndarray:
    rng = np.random.default_rng(seed)
    x = np.arange(width)
    y = np.zeros(width)
    frequency = 2
    for octave in range(octaves):
        count = max(3, frequency)
        points = rng.uniform(-1.0, 1.0, count)
        y += np.interp(x, np.linspace(0, width - 1, count), points) * (0.55**octave)
        frequency *= 2
    peak = np.max(np.abs(y)) or 1.0
    return base + (y / peak) * amplitude


def polygon_ridge(draw: ImageDraw.ImageDraw, ys: np.ndarray, colour, width=W, height=H, step=3):
    points = [(x, float(ys[x])) for x in range(0, width, step)]
    points += [(width - 1, height), (0, height)]
    draw.polygon(points, fill=colour)


def add_mist(img: Image.Image, y: float, height: float, alpha: int) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse((-W * 0.3, y - height / 2, W * 1.3, y + height / 2), fill=(255, 255, 255, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(height * 0.4))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def add_glow(img: Image.Image, cx: float, cy: float, radius: float, colour, strength: int) -> Image.Image:
    glow = Image.new("L", img.size, 0)
    ImageDraw.Draw(glow).ellipse(
        (cx - radius * 2.6, cy - radius * 2.6, cx + radius * 2.6, cy + radius * 2.6), fill=strength
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius * 0.9))
    return Image.composite(Image.new("RGB", img.size, colour), img, glow)


def add_sun(img: Image.Image, cx: float, cy: float, radius: float, colour, strength=120) -> Image.Image:
    img = add_glow(img, cx, cy, radius * 2.2, colour, strength)
    disc = Image.new("L", img.size, 0)
    ImageDraw.Draw(disc).ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=220)
    disc = disc.filter(ImageFilter.GaussianBlur(radius * 0.06))
    return Image.composite(Image.new("RGB", img.size, (255, 249, 228)), img, disc)


def water_block(top_colours, height: float, horizon: float) -> Image.Image:
    block = vertical_gradient(top_colours, width=W, height=int(H - horizon))
    return block.resize((W, int(height)))


def grain(img: Image.Image, amount: float = 6.0, seed: int = 3) -> Image.Image:
    arr = np.array(img).astype(np.float32)
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, amount, (img.size[1], img.size[0], 1))
    arr = np.clip(arr + noise, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGB")


def vignette(img: Image.Image, strength: float = 0.3) -> Image.Image:
    width, height = img.size
    xs = np.linspace(-1, 1, width)
    ys = np.linspace(-1, 1, height)
    xx, yy = np.meshgrid(xs, ys)
    distance = np.sqrt(xx**2 + yy**2) / math.sqrt(2)
    mask = 1 - strength * (distance**1.8)
    arr = np.array(img).astype(np.float32) * mask[:, :, None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def finish(img: Image.Image, seed: int = 1) -> Image.Image:
    soft = img.filter(ImageFilter.GaussianBlur(0.5))
    return vignette(grain(soft, 5.0, seed), 0.34)


# --------------------------------------------------------------------------
# Scenes
# --------------------------------------------------------------------------


def scene_quiraing() -> Image.Image:
    img = vertical_gradient(
        [(0, rgb("#8fa39b")), (0.45, rgb("#cfd9d2")), (0.62, rgb("#e8ece4")), (1, rgb("#d8ded4"))]
    )
    draw = ImageDraw.Draw(img, "RGBA")
    layers = [
        (520, 70, (96, 120, 108, 255), 11),
        (585, 90, (70, 94, 82, 255), 23),
        (655, 110, (46, 68, 57, 255), 37),
    ]
    for index, (base, amp, colour, seed) in enumerate(layers):
        polygon_ridge(draw, ridge(W, base, amp, seed), colour)
        if index < 2:
            img = add_mist(img, base - 5, 90, 90)
            draw = ImageDraw.Draw(img, "RGBA")
    img = add_mist(img, 600, 120, 110)
    draw = ImageDraw.Draw(img, "RGBA")
    polygon_ridge(draw, ridge(W, 760, 60, 51), (26, 43, 35, 255))
    return finish(img, 5)


def scene_glencoe() -> Image.Image:
    img = vertical_gradient(
        [(0, rgb("#b9c7c0")), (0.38, rgb("#e8e2c9")), (0.55, rgb("#f4e4bd")), (1, rgb("#d9cfae"))]
    )
    img = add_sun(img, 820, 285, 52, rgb("#ffe7ae"), 150)
    beam = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(beam).polygon(
        [(700, 50), (1010, 50), (600, 760), (380, 760)], fill=(255, 236, 186, 40)
    )
    img = Image.alpha_composite(img.convert("RGBA"), beam.filter(ImageFilter.GaussianBlur(46))).convert(
        "RGB"
    )

    draw = ImageDraw.Draw(img, "RGBA")
    layers = [
        (470, 90, (108, 126, 106, 255), 61),
        (545, 120, (74, 98, 76, 255), 71),
        (640, 130, (44, 68, 50, 255), 83),
    ]
    for index, (base, amp, colour, seed) in enumerate(layers):
        polygon_ridge(draw, ridge(W, base, amp, seed), colour)
        if index < 2:
            img = add_mist(img, base + 10, 70, 70)
            draw = ImageDraw.Draw(img, "RGBA")
    img = add_mist(img, 640, 110, 100)
    draw = ImageDraw.Draw(img, "RGBA")
    polygon_ridge(draw, ridge(W, 790, 45, 91), (30, 46, 33, 255))
    return finish(img, 9)


def scene_portobello() -> Image.Image:
    horizon = 540
    img = vertical_gradient(
        [(0, rgb("#63758a")), (0.26, rgb("#bd8b7c")), (0.46, rgb("#f0ac79")), (0.6, rgb("#ffd9a8"))]
    )
    img = add_sun(img, 655, horizon - 58, 40, rgb("#fff0c6"), 135)

    sea = water_block([(0, rgb("#cba28a")), (0.15, rgb("#839097")), (0.55, rgb("#415a63")), (1, rgb("#26404a"))], H - horizon, horizon)
    img.paste(sea, (0, horizon))

    # Glitter path: soft blurred dashes that narrow towards the horizon.
    glitter = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glitter)
    rng = random.Random(8)
    for step in range(110):
        y = horizon + 4 + step * 2.9
        spread = 12 + step * 2.4
        cx = 655 + rng.gauss(0, 7 + step * 0.12)
        length = rng.uniform(0.15, 1.0) * spread
        alpha = max(6, int(80 - step * 0.55))
        gd.ellipse((cx - length, y - 1.6, cx + length, y + 1.6), fill=(255, 233, 190, alpha))
    glitter = glitter.filter(ImageFilter.GaussianBlur(2.4))
    img = Image.alpha_composite(img.convert("RGBA"), glitter).convert("RGB")

    # Beach with a wet sand strip at the waterline.
    draw = ImageDraw.Draw(img, "RGBA")
    shoreline = ridge(W, 800, 8, 777, octaves=3)
    polygon_ridge(draw, shoreline, (221, 195, 153, 255), height=H)
    wet = Image.new("RGBA", img.size, (0, 0, 0, 0))
    wd = ImageDraw.Draw(wet)
    wd.polygon(
        [(x, float(shoreline[x])) for x in range(0, W, 3)] + [(W - 1, 862), (0, 862)],
        fill=(178, 154, 124, 160),
    )
    wet = wet.filter(ImageFilter.GaussianBlur(9))
    img = Image.alpha_composite(img.convert("RGBA"), wet).convert("RGB")

    draw = ImageDraw.Draw(img, "RGBA")
    foam = Image.new("RGBA", img.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(foam)
    for x in range(0, W, 4):
        y = float(shoreline[x])
        fd.ellipse((x - 6, y - 3, x + 6, y + 3), fill=(255, 250, 236, 120))
    img = Image.alpha_composite(img.convert("RGBA"), foam.filter(ImageFilter.GaussianBlur(3))).convert(
        "RGB"
    )

    img = add_mist(img, horizon + 4, 26, 40)
    return finish(img, 13)


def scene_royalmile() -> Image.Image:
    img = vertical_gradient(
        [(0, rgb("#2b3a45")), (0.3, rgb("#5c6a70")), (0.5, rgb("#9d8b7e")), (0.58, rgb("#b09a86"))]
    )
    img = add_mist(img, 470, 220, 55)
    draw = ImageDraw.Draw(img, "RGBA")

    rng = random.Random(21)
    street = 560
    x = -30
    buildings = []
    while x < W + 40:
        width = rng.randint(64, 132)
        height = rng.choice(
            [rng.randint(90, 170), rng.randint(170, 260), rng.randint(250, 360)]
        )
        top = street - height
        shade = rng.randint(24, 40)
        draw.rectangle((x, top, x + width, street + 30), fill=(shade, shade + 7, shade + 11, 255))
        # pitched roof or chimney for some buildings
        if rng.random() < 0.45:
            draw.polygon(
                [(x - 4, top), (x + width + 4, top), (x + width / 2, top - rng.randint(16, 40))],
                fill=(shade - 4, shade + 3, shade + 7, 255),
            )
        else:
            draw.rectangle((x + width * 0.2, top - 24, x + width * 0.34, top), fill=(shade, shade + 6, shade + 10, 255))
        buildings.append((x, top, width))
        x += width + rng.choice([0, 0, 0, 6, 12])

    # dense window grid
    for bx, top, width in buildings:
        for wy in range(top + 20, street - 26, 26):
            for wx in range(bx + 9, bx + width - 10, 17):
                if rng.random() < 0.42:
                    warm = rng.choice([(255, 203, 124), (255, 224, 168), (247, 175, 104)])
                    draw.rectangle((wx, wy, wx + 6, wy + 11), fill=(*warm, rng.randint(140, 230)))

    # shop fronts glowing at street level
    for bx, _, width in buildings:
        if rng.random() < 0.55:
            draw.rectangle((bx + 6, street - 22, bx + width - 6, street + 6), fill=(255, 196, 118, 45))
    draw.rectangle((0, street - 6, W, street + 14), fill=(52, 50, 47, 255))

    # wet street: dark asphalt with soft pools of light
    road = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(road)
    rd.rectangle((0, street + 14, W, H), fill=(20, 22, 25, 248))
    for bx, _, width in buildings:
        cx = bx + width / 2
        rd.ellipse((cx - 74, street + 4, cx + 74, street + 82), fill=(255, 190, 120, 20))
    road = road.filter(ImageFilter.GaussianBlur(12))
    img = Image.alpha_composite(img.convert("RGBA"), road).convert("RGB")

    draw = ImageDraw.Draw(img, "RGBA")
    draw.rectangle((0, street, W, street + 4), fill=(255, 232, 196, 40))
    # lamp post
    draw.line([(168, 900), (168, 500), (215, 500)], fill=(15, 17, 19, 255), width=6)
    draw.ellipse((201, 494, 229, 522), fill=(255, 216, 148, 255))
    img = add_glow(img, 215, 508, 26, rgb("#ffcf8a"), 70)
    return finish(img, 17)


def draw_pine(draw: ImageDraw.ImageDraw, x: float, base_y: float, height: float, width: float, colour):
    draw.line([(x, base_y), (x, base_y - height * 0.22)], fill=colour, width=max(2, int(width * 0.12)))
    tiers = 3
    for tier in range(tiers):
        top = base_y - height * (0.75 + 0.25 * (tiers - tier) / tiers)
        spread = width * (1 - tier * 0.22)
        bottom = base_y - height * (0.15 + 0.22 * (tiers - tier - 1))
        draw.polygon(
            [(x - spread / 2, bottom), (x + spread / 2, bottom), (x, top)],
            fill=colour,
        )


def scene_lochan() -> Image.Image:
    horizon = 545
    img = vertical_gradient(
        [(0, rgb("#93a6b1")), (0.28, rgb("#c6d0d3")), (0.48, rgb("#f0dfc4")), (0.58, rgb("#d9cebb"))]
    )
    img = add_sun(img, 320, 405, 30, rgb("#fff0cc"), 95)
    draw = ImageDraw.Draw(img, "RGBA")
    polygon_ridge(draw, ridge(W, 420, 55, 101), (96, 114, 112, 255))
    img = add_mist(img, 480, 90, 120)
    draw = ImageDraw.Draw(img, "RGBA")
    polygon_ridge(draw, ridge(W, 505, 38, 113), (62, 84, 78, 255))

    water = water_block(
        [(0, rgb("#c3bcab")), (0.14, rgb("#75908f")), (0.6, rgb("#38575a")), (1, rgb("#22393f"))],
        H - horizon,
        horizon,
    )
    img.paste(water, (0, horizon))

    # island + ruined castle
    island = Image.new("RGBA", img.size, (0, 0, 0, 0))
    idraw = ImageDraw.Draw(island)
    rng = random.Random(55)
    for _ in range(9):
        x0 = 640 + rng.randint(-90, 60)
        y0 = horizon - 6 + rng.randint(-10, 10)
        idraw.ellipse((x0 - 70, y0 - 16, x0 + 70, y0 + 18), fill=(40, 54, 47, 255))
    idraw.rectangle((610, 470, 700, 540), fill=(58, 51, 43, 255))
    idraw.rectangle((624, 430, 664, 474), fill=(50, 45, 39, 255))
    idraw.polygon([(618, 432), (670, 432), (644, 408)], fill=(43, 39, 34, 255))
    idraw.rectangle((686, 486, 706, 540), fill=(52, 46, 39, 255))
    for px in (620, 638, 656):
        idraw.rectangle((px, 424, px + 8, 434), fill=(50, 45, 39, 255))
    img = Image.alpha_composite(img.convert("RGBA"), island).convert("RGB")

    # island reflection: a soft, short smear directly beneath the island
    refl = img.crop((560, horizon - 6, 760, horizon + 8)).transpose(Image.FLIP_TOP_BOTTOM)
    refl = refl.filter(ImageFilter.GaussianBlur(8)).resize((260, 40)).convert("RGBA")
    refl.putalpha(45)
    img.paste(refl, (500, horizon + 8), refl)

    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(31)
    for step in range(46):
        y = horizon + 8 + step * 6.4
        alpha = max(8, 70 - step)
        draw.line(
            [(rng.randint(0, 640), y), (rng.randint(560, W), y)],
            fill=(228, 224, 204, alpha),
            width=1,
        )

    # pine woods either side, drawn tree by tree
    for side in (0, 1):
        for index in range(9):
            if side == 0:
                px = 10 + index * 21 + random.Random(index).randint(-6, 6)
            else:
                px = W - 10 - index * 21 + random.Random(index + 40).randint(-6, 6)
            height = 150 - index * 7 + random.Random(index + 80).randint(-14, 14)
            draw_pine(draw, px, 560, height, 46 - index * 2, (24, 40, 33, 255))
    img = add_mist(img, 548, 26, 55)
    return finish(img, 23)


def scene_oban() -> Image.Image:
    horizon = 520
    img = vertical_gradient(
        [(0, rgb("#4d5468")), (0.3, rgb("#97707a")), (0.5, rgb("#e79a72")), (0.62, rgb("#f6c08c"))]
    )
    img = add_sun(img, 900, 470, 34, rgb("#ffd7a6"), 110)

    water = water_block(
        [(0, rgb("#c08d80")), (0.16, rgb("#5c6676")), (0.6, rgb("#2b3944")), (1, rgb("#1b262e"))],
        H - horizon,
        horizon,
    )
    img.paste(water, (0, horizon))

    draw = ImageDraw.Draw(img, "RGBA")
    # distant shore with town lights
    shore = ridge(W, 512, 5, 141, octaves=3)
    polygon_ridge(draw, shore, (41, 52, 57, 255), height=horizon + 12)
    rng = random.Random(43)
    for _ in range(90):
        lx = rng.randint(0, W)
        ly = rng.randint(496, 512)
        draw.ellipse((lx, ly, lx + 2, ly + 2), fill=(255, 206, 138, rng.randint(60, 160)))

    boats = [(250, 650, 150), (640, 610, 120), (980, 672, 180)]
    for cx, waterline, length in boats:
        hull_top = waterline - 20
        half = length / 2
        draw.polygon(
            [
                (cx - half, hull_top),
                (cx + half, hull_top),
                (cx + half - 18, waterline + 10),
                (cx - half + 22, waterline + 10),
            ],
            fill=(26, 31, 35, 255),
        )
        draw.rectangle((cx - half * 0.28, hull_top - 16, cx + half * 0.16, hull_top), fill=(31, 37, 41, 255))
        draw.line([(cx + 6, hull_top - 12), (cx + 6, waterline - 118)], fill=(28, 32, 35, 255), width=3)
        draw.line([(cx - half * 0.3, hull_top - 10), (cx + half * 0.45, hull_top - 10)], fill=(28, 32, 35, 255), width=2)
        for light in range(3):
            lx = cx - 26 + light * 26
            draw.ellipse((lx - 2, hull_top - 6, lx + 2, hull_top - 2), fill=(255, 216, 150, 255))
        for step in range(9):
            y = waterline + 16 + step * 7
            draw.line(
                [
                    (cx - half * 0.5 + rng.randint(0, 18), y),
                    (cx + half * 0.5 - rng.randint(0, 18), y),
                ],
                fill=(255, 198, 142, max(8, 50 - step * 5)),
                width=2,
            )

    # pier in the foreground
    draw.polygon([(0, 742), (330, 742), (356, 772), (0, 772)], fill=(30, 36, 38, 255))
    draw.rectangle((0, 772, 356, 784), fill=(22, 27, 29, 255))
    for post in range(14, 356, 46):
        draw.line([(post, 784), (post, 880)], fill=(20, 25, 27, 255), width=7)
    draw.line([(0, 742), (330, 742)], fill=(120, 106, 96, 160), width=2)

    img = add_mist(img, horizon - 4, 26, 45)
    return finish(img, 29)


# --------------------------------------------------------------------------
# Icons
# --------------------------------------------------------------------------


def draw_icon(size: int, padding: float = 0.0, background: str = "#0e5c4a") -> Image.Image:
    scale = size / 512
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    inset = int(size * padding)
    radius = int((size - inset * 2) * 0.24)
    draw.rounded_rectangle((inset, inset, size - inset, size - inset), radius=radius, fill=rgb(background))

    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        (inset - size * 0.2, inset - size * 0.3, size * 0.9, size * 0.7),
        fill=(255, 255, 255, 26),
    )
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(size * 0.05)))
    draw = ImageDraw.Draw(img)

    cx = cy = size / 2
    ring = (size - inset * 2) * 0.3
    draw.ellipse(
        (cx - ring, cy - ring, cx + ring, cy + ring),
        outline=(246, 239, 221, 235),
        width=max(2, int(6 * scale)),
    )
    draw.ellipse(
        (cx - ring * 0.72, cy - ring * 0.72, cx + ring * 0.72, cy + ring * 0.72),
        outline=(246, 239, 221, 70),
        width=max(1, int(2 * scale)),
    )

    needle = ring * 0.86
    draw.polygon(
        [
            (cx, cy - needle),
            (cx + needle * 0.3, cy + needle * 0.38),
            (cx, cy + needle * 0.18),
            (cx - needle * 0.3, cy + needle * 0.38),
        ],
        fill=rgb("#e2946a"),
    )
    draw.polygon(
        [
            (cx, cy + needle),
            (cx + needle * 0.3, cy - needle * 0.38),
            (cx, cy - needle * 0.18),
            (cx - needle * 0.3, cy - needle * 0.38),
        ],
        fill=(246, 239, 221, 210),
    )
    draw.ellipse(
        (cx - 7 * scale, cy - 7 * scale, cx + 7 * scale, cy + 7 * scale),
        fill=rgb("#0e5c4a"),
        outline=(246, 239, 221, 255),
        width=max(1, int(3 * scale)),
    )
    return img


def main() -> None:
    os.makedirs(DEMO_DIR, exist_ok=True)
    os.makedirs(ICON_DIR, exist_ok=True)

    scenes = {
        "quiraing.jpg": scene_quiraing,
        "glencoe.jpg": scene_glencoe,
        "portobello.jpg": scene_portobello,
        "royalmile.jpg": scene_royalmile,
        "lochan.jpg": scene_lochan,
        "oban.jpg": scene_oban,
    }
    for name, factory in scenes.items():
        image = factory()
        image.save(os.path.join(DEMO_DIR, name), "JPEG", quality=86, optimize=True, progressive=True)
        print("wrote demo/" + name)

    draw_icon(512).save(os.path.join(ICON_DIR, "icon-512.png"))
    draw_icon(192).save(os.path.join(ICON_DIR, "icon-192.png"))
    draw_icon(512, padding=0.14).save(os.path.join(ICON_DIR, "icon-maskable-512.png"))
    apple = Image.new("RGB", (180, 180), rgb("#0e5c4a"))
    apple.paste(draw_icon(180), (0, 0), draw_icon(180))
    apple.save(os.path.join(ICON_DIR, "apple-touch-icon.png"))
    print("wrote icons")


if __name__ == "__main__":
    main()
