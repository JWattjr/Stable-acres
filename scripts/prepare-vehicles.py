"""Prepare the Gemini vehicle sheet: key its magenta matte, split and trim.
Developer asset utility only; the game itself has no Python/npm dependency.
python scripts/prepare-vehicles.py art/src/vehicles/gemini-vehicles-2026-11-07.jpg
"""
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw, PngImagePlugin

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
im = Image.open(source).convert('RGB')
prompt = (root / 'public/cozy/VEHICLE-ART.md').read_text(encoding='utf-8').split('## Generation prompt\n\n', 1)[1].strip()
names = ['vehicle_pickup_front', 'vehicle_pickup_rear', 'vehicle_hatchback_front', 'vehicle_hatchback_rear']
out = root / 'public/cozy/sprites'
preview = Image.new('RGB', (760, 560), '#d8e7cd')
for k, name in enumerate(names):
    x, y = k % 2 * im.width // 2, k // 2 * im.height // 2
    rgb = np.asarray(im.crop((x, y, x + im.width // 2, y + im.height // 2))).astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # The returned JPEG matte is dusty magenta rather than exact #ff00ff.
    # Hue separation leaves yellow paint, sage paint and blue windows intact.
    key = np.clip((np.minimum(r, b) - g - 42) / 43, 0, 1)
    alpha = np.uint8((1 - key) * 255)
    mask = Image.fromarray(np.uint8(alpha > 12) * 255).copy()
    ys, xs = np.nonzero(np.asarray(mask))
    seed = np.argmin((xs - mask.width / 2) ** 2 + (ys - mask.height / 2) ** 2)
    ImageDraw.floodfill(mask, (int(xs[seed]), int(ys[seed])), 128)
    connected = np.asarray(mask) == 128  # exclude detached marks outside the car
    if not connected.any():
        raise ValueError('Vehicle silhouette could not be isolated')
    alpha[~connected] = 0
    # Remove residual matte colour only at partially transparent silhouette pixels.
    edge = (alpha > 0) & (alpha < 255)
    spill = np.maximum(0, np.minimum(r, b) - g) * edge
    rgb[..., 0] -= spill * .45
    rgb[..., 2] -= spill * .45
    rgba = Image.fromarray(np.dstack([np.uint8(np.clip(rgb, 0, 255)), alpha]))
    box = rgba.getbbox()
    rgba = rgba.crop(box)
    rgba = rgba.resize((320, round(rgba.height * 320 / rgba.width)), Image.Resampling.LANCZOS)
    meta = PngImagePlugin.PngInfo()
    meta.add_text('Source', 'Gemini browser generation, 2026-11-07; https://gemini.google.com/app/8fd2054348e7b58d')
    meta.add_text('Prompt', prompt)
    rgba.save(out / (name + '.png'), pnginfo=meta)
    preview.paste(rgba, (k % 2 * 380 + 30, k // 2 * 280 + 20), rgba)
    print(name, rgba.size)
preview.save(root / 'out/vehicle-sprites-preview.png')
