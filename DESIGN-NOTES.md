# Stable Acres — extension design evidence

Recorded 2026-11-07. This is an evidence note for an ordinary extension, not a replacement visual system. No PRODUCT.md or DESIGN.md was supplied or found in the project/parent for this pass. The incumbent implementation and the user's requirement to retain its painted farm, sprites, grid and controls remain the authority.

## Inherited appearance

- Keep the supplied painted isometric slab and sprite artwork over the blue background (`#cdebfd`), with grid-aligned soil and depth-sorted objects. Visitors reuse farmer frames; cars and butterflies are small original canvas shapes within that scene.
- Existing CSS tokens: ivory `--cream: #fff8ec`, warm ivory `--cream2: #fdf0d8`, sand `--edge: #efdcb8`, earth `--ink: #5b4632`, muted earth `--muted: #76634a`, green `--green: #356f32`, darker same-hue `--green-lip: #285827`, gold `--gold: #f2b736`, blue `--blue: #2f6fd0`. These are observed source values, not a newly proposed palette.
- Local Fredoka at weights 500/600/700 remains the shared UI face, with system/sans-serif fallbacks. The observed hierarchy uses 18px sheet titles; 21px lesson headings (19px at the mobile breakpoint); 16px lesson prose with 1.5 line-height; 13–15px controls; and 10–12px metadata. Canvas speech uses Fredoka 500 at 13px in world coordinates.
- Preserve rounded ivory HUD pills, 24px sheet corners, sand borders, earth text, green actions and their inset 3px darker bottom lips. Navigation keeps sprite illustrations and rounded ivory tiles. The existing depth treatments are retained by user direction; this note does not generalize detector warnings into rules for unrelated future surfaces.

## Extension fit and responsive evidence

Lessons and Orders use the existing bottom-sheet grammar. Weather, live/cached/demo rate labels, the separate read-only wallet line and sound controls use the existing HUD/material vocabulary. Ambient visitors, traffic, butterflies and animal-readiness bubbles remain subordinate to the painted farm.

Visually checked all ten captures under `.impeccable/review/screenshots/`: `desktop.png`, `desktop-orders.png`, `desktop-learn.png` (1280×720); `mobile.png`, `mobile-orders.png`, `mobile-learn.png` (390×844); `user-647.png`, `user-647-orders.png`, `user-647-learn.png` (647×764); and `rain.png` (647×764). The painted scene, ivory surfaces, Fredoka hierarchy and button treatment remain consistent across them. The narrow layout stacks HUD rows, reduces navigation tiles and fits scrollable sheets beneath the HUD; the farm scales down with substantial blue space on the tall phone capture.

Also checked `public/cozy/index.html` styles/markup; sampled `public/cozy/game.js` village, weather, lesson/order rendering, grid, crop, depth-sorting and readiness code; screenshot `report.json`; and README.md, PROGRESS.md, VERIFICATION.md and LIMITATIONS.md. The bounds report records fitting HUD/navigation, no document overflow and no JavaScript errors at all three sizes. The separate finish reviewer reported **ship**, with no material findings across this capture set and sampled source.

## Limits retained, not canonized

Small 10px metadata remains a legibility warning, not a recommended minimum. Existing glyph symbols, compact close controls and the canvas-only farm interaction are not an accessibility standard. Native buttons, visible focus, inert closed sheets and reduced-motion CSS improve the DOM controls, but keyboard/screen-reader farming, scalable type and a genuine reduced-motion canvas path remain incomplete; ambient canvas motion still runs. Screenshot checks do not replace physical-device, audio or assistive-technology testing.

Mixed-history supplied sprites, recoloured visitor frames and simple canvas vehicles remain a production-art consistency/provenance limit. No new identity or art-rights assurance is established here. Cow generation was unavailable and no cow/milk mechanic shipped. Publishing remains deferred by the user. Full functional and release limits stay in LIMITATIONS.md and VERIFICATION.md.
