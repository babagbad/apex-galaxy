# APEX Galaxy — How the code works

A 3D map of the most dominant careers in seven sports. Each star is one athlete.
Plain JavaScript + [three.js](https://threejs.org) for 3D, [Vite](https://vitejs.dev) for the dev server, [lil-gui](https://lil-gui.georgealways.com) for the design panel. No framework.

## Run it on your PC (Windows)
1. Install Node.js LTS from https://nodejs.org (one time).
2. Open a terminal in this folder and run `npm install` (one time).
3. Run `npm run dev` and open the link it prints (usually http://localhost:5173).
4. Edit any file and save: the browser updates instantly (hot reload).
5. `npm run build` makes the final site in `dist/` (what gets deployed).

## Where to change what
| I want to change... | Edit |
|---|---|
| Colors, star size/glow, fog, camera, label count, animation speed | `src/settings.js` (or press **D** in the browser, tune sliders, click **Copy settings**, paste into `settings.js`) |
| Default GOAT weights and formula presets | `src/settings.js` → `scoring.defaultWeights`, `WEIGHT_PRESETS` |
| Axis presets (APEX core, Time tunnel...) | `src/settings.js` → `AXIS_PRESETS` |
| Text, layout of the side panels, the guide wording | `index.html` + `src/style.css` |
| What each axis option means | `src/data.js` → `METRICS` |
| Athlete detail card | `src/panel.js` |
| My take on a player | `src/takes.js` |

## File map (in the order the app runs)
```
index.html          page skeleton: canvas, top bar, control panel, detail panel
src/main.js         boots everything, mouse handling, the animation loop (tick)
src/settings.js     ALL tweakable numbers and colors
src/data.js         loads athletes.json, the GOAT formula, shared state, axis metrics
src/scene.js        three.js setup: renderer, camera, orbit controls, cube, star shader
src/galaxy.js       athletes -> stars: positions, size, brightness, fading, picking
src/labels.js       HTML name labels + axis ticks that follow the 3D scene
src/panel.js        right-side athlete card, career sparkline, comparison tray
src/takes.js        my one-line takes on specific players (edit freely)
src/ui.js           left control panel: axes, sports, formula sliders, Everyone, search
src/flight.js       smooth camera flights
src/designPanel.js  press D: live sliders bound to settings.js
src/guide.js        "How it works" overlay, first-visit welcome card, legend (words live in index.html)
src/style.css       all styling (CSS variables at the top)
public/athletes.json  the data (built by prep_v6.py from the ranking pipeline)
```

## How data flows
1. `data.js` loads `athletes.json`. Each athlete has three standardized axis values from the ranking pipeline: `hz` (Height), `lz` (Length), `sz` (Separation).
2. `computeScores()` applies the GOAT formula: `raw = wH·hz + wL·lz + wS·sz`. Then it rescales so the average of each sport's top 100 = 50 and the best athlete = 99. That is the GOAT score `G` you see.
3. `galaxy.js` turns each athlete into a point. Position = the three chosen axes. Size + brightness = GOAT score. Color = sport.
4. When you change axes, weights, or the Everyone toggle, `relayout()` computes new target positions and the loop glides every star there over `motion.axisTransition` seconds.

## athletes.json field key
| Field | Meaning |
|---|---|
| `i`, `n`, `s` | id, name, sport |
| `pos`, `nat`, `by` | position, nationality, birth year (may be null) |
| `y0`, `y1`, `py` | first season, last season, best season |
| `nq`, `n1`, `L` | qualified seasons, seasons as #1 in their league, elite-tier seasons (Length) |
| `hz`, `lz`, `sz` | standardized Height / Length / Separation |
| `act`, `cur` | active (played 2025 or 2025–26), part of the curated default view |
| `o` | outlier tag: `L` built to last, `H` burned bright, `S` ran away with it (see prep_v6.py) |
| `c` | career line: `[year, z]` per season, z = vs that season's elite (0 = elite average) |

Added at runtime: `H`, `S`, `G` (display scores), `gr`/`sr`/`cr` (overall / sport / curated ranks).

## The ranking itself
Method, validation against expert lists, and known gaps: `docs/RANKING_V6.md` in the project repo. Pipeline code: `data/pipeline_v6/`.
To refresh data: run the pipeline, then `python prep_v6.py` here.
