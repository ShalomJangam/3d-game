# NEON DRIVE — Synthwave 3D Racer

A browser-based 3D synthwave-aesthetic car racing game built with [Three.js](https://threejs.org/).

## Features
- **Synthwave / retrowave visual style** — gradient purple-magenta sky, neon road markings, glowing retrowave sun disc, star field, neon-lit buildings
- **Neon underglow cars** — player car emits dynamic cyan/magenta point lights that illuminate the road
- **Procedural world** — infinite road chunks with neon grid markings, dark cityscape buildings with glowing window lights and neon roof trims, silhouette trees
- **Physics & gameplay** — lane-based steering, collision detection, near-miss scoring, nitro boost
- **Styled HUD** — Orbitron font, animated nitro bar, pulsing status text, CRT scanline overlay

## Controls
| Key | Action |
|-----|--------|
| W / ↑ | Accelerate |
| S / ↓ | Brake |
| A / ← | Steer left |
| D / → | Steer right |
| Shift | Nitro boost |
| Space | Start / Restart |

## Running Locally
```bash
# Python 3
python3 -m http.server 8000

# Node.js (npx)
npx serve .
```
Then open `http://localhost:8000` in your browser.

> No build step required — the game loads Three.js directly from a CDN.
