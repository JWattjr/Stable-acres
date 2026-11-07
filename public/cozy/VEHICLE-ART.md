# Vehicle artwork provenance

Created on 2026-11-07 using **Gemini in the owner's Chrome browser**, as requested. [Generation chat](https://gemini.google.com/app/8fd2054348e7b58d).

Style inputs: this project's `sprites/coop.png` and `sprites/idle.png`. A screenshot captured from [Happy Farm](https://cozy-farm-2d.rork.app/) was supplied only as a benchmark for small-vehicle polish/readability. No reference-game car sprites, source code, map or pixels are shipped in Stable Acres.

Gemini produced a 2400×1792 JPEG sheet. Its original stays locally under ignored `art/src/vehicles/`. `scripts/prepare-vehicles.py` removes the returned magenta matte and trims/resizes the four isolated cars to 320px wide. The game mirrors the rear views at render time to follow its northeast lane. The transparent PNGs embed this prompt and origin. Generated output is subject to the owner's Gemini terms; no CC/public-domain licence is claimed.

Files: `vehicle_pickup_front.png`, `vehicle_pickup_rear.png`, `vehicle_hatchback_front.png`, `vehicle_hatchback_rear.png` under `sprites/`.

## Generation prompt

Generate an ORIGINAL 2x2 game sprite sheet of four vehicle sprites for Stable Acres. Images 1 (coop) and 2 (farmer) are OUR art style: match their warm painted shading, rounded shapes, soft same-hue brown contours and cozy storybook finish. Image 3 is a DIFFERENT game: use only as a polish/readability benchmark for small passing cars; do NOT copy its car design, colours, UI, map or pixels.

Output only a sprite sheet, not a scene or mockup. Exactly 4 equal square cells in a clean 2x2 grid on perfectly flat solid magenta #FF00FF for chroma-key removal, with generous magenta gutters. No ground tiles, no cast shadows on magenta, no labels, text, logos or people. Vehicles fully inside their cells, same scale, no cropped wheels.

Our road runs from screen UPPER-RIGHT to LOWER-LEFT, at about 28 degrees to horizontal. Align every vehicle along this diagonal. Camera is three-quarter isometric from above.

TOP LEFT: small butter-yellow farm pickup, FRONT facing screen LOWER-LEFT (southwest). Rounded cab, pale blue windshield, open wooden cargo bed with two plain produce crates, visible wheels.

TOP RIGHT: SAME pickup driving the opposite way, FRONT facing screen UPPER-RIGHT (northeast), so the REAR/cargo bed is closest to the viewer and cab farther away.

BOTTOM LEFT: small dusty-sage-green rounded hatchback, FRONT facing screen LOWER-LEFT (southwest), ivory roof, pale blue windows, visible wheels.

BOTTOM RIGHT: SAME hatchback driving the opposite way, FRONT facing screen UPPER-RIGHT (northeast), so its REAR window and small tail lamps are closest to the viewer.

Finished polished bitmap game art, readable at 70 pixels wide. No geometric placeholders, no photorealism, no glossy 3D render. Create original vehicles, not replicas of the reference screenshot.
