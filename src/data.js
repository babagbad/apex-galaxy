// =====================================================================
// DATA — loading athletes, the GOAT formula, and axis definitions.
// No three.js in here: this is pure numbers.
// =====================================================================
import { settings } from './settings.js';

// Shared app state. Other modules import this and read/write it.
export const state = {
  athletes: [],
  axes: ['height', 'length', 'separation'],
  activeSports: new Set(Object.keys(settings.colors.sports)),
  showEveryone: false,
  minGoat: 0,
  weights: { ...settings.scoring.defaultWeights },
  hovered: -1,
  selected: -1,
  pinned: [],
  revealed: new Set(),     // non-curated athletes shown because you searched for them
  showLabels: true,
  showOutliers: false,     // label the one-axis outliers instead of the top stars
};

// Each metric can be put on any axis. `get` returns the number used for position.
export const METRICS = {
  height:     { label: 'Height · best 3 seasons',   short: 'Height',     get: a => a.H,
                desc: 'Peak. Their 3 best seasons, each measured against that year\'s best players.' },
  length:     { label: 'Length · elite seasons',    short: 'Length',     get: a => a.L, integer: true,
                desc: 'Longevity. How many seasons they finished among their league\'s elite (about the top 1 in 8).' },
  separation: { label: 'Separation · margin',       short: 'Separation', get: a => a.S,
                desc: 'Dominance. How far ahead of the next best player they were, in their 2 biggest seasons.' },
  lasted:     { label: 'Lasted · vs their peak',    short: 'Lasted',     get: a => a.xL, centered: true,
                desc: 'Elite seasons beyond what their peak would predict. +5 = five more than players with the same Height usually get. Negative = burned out early.' },
  pulled:     { label: 'Pulled away · vs their peak', short: 'Pulled away', get: a => a.xS, centered: true,
                desc: 'Separation beyond what their peak would predict. High = they lapped the field more than their level says they should have.' },
  goat:       { label: 'GOAT score',                short: 'GOAT',       get: a => a.G,
                desc: 'All three axes mixed together using the sliders below. 99 is the best career on the map.' },
  era:        { label: 'Era (peak year)',           short: 'Era',        get: a => a.py, year: true,
                desc: 'The year of their best season.' },
  debut:      { label: 'Debut year',                short: 'Debut',      get: a => a.y0, year: true,
                desc: 'Their first season in the data.' },
  seasons:    { label: 'Qualified seasons',         short: 'Seasons',    get: a => a.nq, integer: true,
                desc: 'Seasons where they played enough to count.' },
  born:       { label: 'Birth year',                short: 'Born',       get: a => a.by, year: true,
                desc: 'Birth year, when I have it.' },
};

export async function loadAthletes(url = './athletes.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('athletes.json ' + res.status);
  state.athletes = await res.json();
  state.athletes.forEach(a => {
    a._j = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
    a._q = normalizeText(a.n);
  });
  scaleAxes();
  styleAxes();
  computeScores();
  state.athletes.sort((a, b) => b.raw - a.raw);
  return state.athletes;
}

export const normalizeText = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ---------------------------------------------------------------------
// Putting every sport on one scale.
// hz, lz, sz are standardized axis values from the Python pipeline.
// We take the top N careers of each sport (a balanced pool), then map
// so the pool average = 50 and the single best = 99.
// ---------------------------------------------------------------------
function balancedPool(key) {
  const bySport = {};
  for (const a of state.athletes) (bySport[a.s] ||= []).push(a);
  const pool = [];
  for (const list of Object.values(bySport)) {
    pool.push(...[...list].sort((x, y) => y[key] - x[key]).slice(0, settings.scoring.poolSize));
  }
  return pool;
}
function toScore(key, outKey) {
  const pool = balancedPool(key);
  const mu = pool.reduce((s, a) => s + a[key], 0) / pool.length;
  const top = Math.max(...state.athletes.map(a => a[key]));
  for (const a of state.athletes) a[outKey] = 50 + 49 * (a[key] - mu) / (top - mu);
}
function scaleAxes() {
  toScore('hz', 'H');
  toScore('sz', 'S');
}

// ---------------------------------------------------------------------
// Style axes. Height, Length and Separation move together (great players
// are great at all three), which squeezes everyone onto one diagonal.
// These two take Height out: fit a straight line on the default view,
// then keep only what's left over. Positive = more than their peak predicts.
// ---------------------------------------------------------------------
function fitLine(xs, ys) {
  const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxy / sxx; return x => my + b * (x - mx);
}
function styleAxes() {
  const pool = state.athletes.filter(a => a.cur);
  const predL = fitLine(pool.map(a => a.H), pool.map(a => a.L));
  const predS = fitLine(pool.map(a => a.H), pool.map(a => a.S));
  for (const a of state.athletes) { a.xL = a.L - predL(a.H); a.xS = a.S - predS(a.H); }
}

// The GOAT formula. Weights come from the sliders (any numbers; we normalize).
export function computeScores(weights = state.weights) {
  const total = weights.height + weights.length + weights.separation || 1;
  const wH = weights.height / total, wL = weights.length / total, wS = weights.separation / total;
  for (const a of state.athletes) a.raw = wH * a.hz + wL * a.lz + wS * a.sz;
  toScore('raw', 'G');
  // ranks
  const all = [...state.athletes].sort((a, b) => b.raw - a.raw);
  all.forEach((a, k) => { a.gr = k + 1; });
  const seen = {};
  all.forEach(a => { seen[a.s] = (seen[a.s] || 0) + 1; a.sr = seen[a.s]; });
  const curated = all.filter(a => a.cur);
  curated.forEach((a, k) => { a.cr = k + 1; });
  return all;
}

// Clamp a display score to 0-100 for text.
export const shown = v => Math.max(0, Math.min(100, v));

// Is athlete `a` part of the current view (before sport / min-score filters)?
export const inView = a => a.cur || state.showEveryone || state.revealed.has(a);
