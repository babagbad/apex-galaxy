// =====================================================================
// SETTINGS — the one file to edit when you want the galaxy to look or
// feel different. Every number here is used somewhere in the code.
//
// Fastest way to tune: open the site, press D (or add ?design to the
// URL), move the sliders, click "Copy settings", and paste the result
// over the `settings` object below.
// =====================================================================

export const settings = {
  colors: {
    background: '#04060c',
    gold: '#f5c451',         // selection, highlights, GOAT ring
    sports: {
      NBA: '#ff9f1c',
      NHL: '#5ac8fa',
      MLB: '#ff5a4e',
      NFL: '#2ee6a8',
      F1: '#ff3da8',
      TENNIS: '#9be564',
      SOCCER: '#a77bff',
    },
  },

  stars: {
    scoreFloor: 20,          // GOAT score that counts as "dimmest" (below = same as floor)
    minSize: 1.3,            // size of the weakest star
    maxSize: 8,            // size of the GOAT
    sizeCurve: 2.6,          // higher = only the very best get big
    minAlpha: 0.3,           // brightness of the weakest star
    alphaCurve: 1.6,         // higher = only the very best glow
    glow: 0.55,              // soft halo around each star
    coreWhite: 0.7,          // how white the center of each star is
    everyoneDim: 0.35,       // brightness multiplier for non-curated athletes
    jitter: 0.35,            // random offset so identical values don't stack
  },

  scene: {
    cubeSize: 50,            // half-width of the data cube
    fog: 0.0022,             // depth fade
    gridOpacity: 0.07,
    edgeOpacity: 0.12,
    nebulaOpacity: 0.13,     // colored cloud behind each sport
    backgroundStars: 2600,
  },

  camera: {
    fov: 50,
    home: [150, 78, 172],    // starting camera position
    flyDistance: 26,         // how close the camera gets when you pick someone
    flyDuration: 1.3,        // seconds
    autoRotateSpeed: 0.35,
    sidePanelOffset: 130,    // px the galaxy shifts left to make room for the panel
  },

  motion: {
    axisTransition: 1.4,     // seconds for stars to glide to new axes
    fadeSpeed: 7,            // how fast stars fade in/out on filter changes
  },

  labels: {
    count: 22,               // how many of the brightest stars get names
    fontSize: 11,
  },

  scoring: {
    // Default GOAT formula = weights fitted to expert rankings (see docs/RANKING_V6.md)
    defaultWeights: { height: 20, length: 30, separation: 50 },
    poolSize: 100,           // top N per sport used to put all sports on one scale
  },
};

// Weight presets for the "Build your own GOAT formula" panel
export const WEIGHT_PRESETS = [
  { name: 'Experts', weights: { height: 20, length: 30, separation: 50 } },
  { name: 'Equal', weights: { height: 34, length: 33, separation: 33 } },
  { name: 'Peak', weights: { height: 70, length: 10, separation: 20 } },
  { name: 'Longevity', weights: { height: 15, length: 70, separation: 15 } },
  { name: 'Dominance', weights: { height: 10, length: 10, separation: 80 } },
];

// Axis presets
export const AXIS_PRESETS = [
  { name: 'APEX core', axes: ['height', 'length', 'separation'] },
  { name: 'Time tunnel', axes: ['era', 'goat', 'height'] },
  { name: 'Iron men', axes: ['seasons', 'length', 'goat'] },
  { name: 'Tyrants', axes: ['separation', 'height', 'era'] },
];

export const SPORT_LABELS = {
  NBA: 'NBA', NHL: 'NHL', MLB: 'MLB', NFL: 'NFL', F1: 'Formula 1', TENNIS: 'Tennis', SOCCER: 'Soccer',
};

// How much to trust each sport's numbers (shown in the side panel)
export const CONFIDENCE = {
  NBA: 'High', NHL: 'High', MLB: 'High', F1: 'High', TENNIS: 'High', NFL: 'Medium', SOCCER: 'Low',
};
