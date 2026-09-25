# APEX Galaxy

**Live:** https://apex-galaxy.vercel.app

An interactive 3D map of the most dominant careers in sports history. 518 athletes across the NBA, NHL, MLB, NFL, Formula 1, tennis and soccer, each plotted as a star by three measures:

- **Height**: how good they were at their best (best 3 seasons vs that season's elite)
- **Length**: how long they stayed elite (seasons inside their league's elite tier)
- **Separation**: how far ahead of everyone they got (margin over the next best player)

Build your own GOAT formula with the sliders and watch the galaxy rearrange live.

Built by Babatunde Gbadegesin (University of Maryland, Technology and Information Design).

## Tech
Vanilla JavaScript, three.js (WebGL), Vite. Data pipeline in Python (pandas) using full league-season data: Basketball Reference, the Lahman baseball database, the NHL stats API, f1db, and the TML tennis database. Weights were fitted to published expert all-time rankings and checked by holding out one sport at a time.

## Run locally
```
npm install
npm run dev
```
See [ARCHITECTURE.md](ARCHITECTURE.md) for how the code is organized. Press **D** in the browser for live design settings.
