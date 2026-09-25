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
};

// Each metric can be put on any axis. `get` returns the number used for position.
export const METRICS = {
  height:     { label: 'Height · best 3 seasons',   short: 'Height',     get: a => a.H,
                desc: 'How good they were at their best. Their 3 best seasons, each compared to the elite players that same year. Higher = a higher peak.' },
  length:     { label: 'Length · elite seasons',    short: 'Length',     get: a => a.L, integer: true,
                desc: 'How long they stayed elite. The number of seasons they finished inside their league\'s elite tier (roughly the top 1 in 8).' },
  separation: { label: 'Separation · margin',       short: 'Separation', get: a => a.S,
                desc: 'How far ahead of everyone else they got. The gap between them and the next best player, in their 2 biggest seasons.' },
  goat:       { label: 'GOAT score',                short: 'GOAT',       get: a => a.G,
                desc: 'Height, Length and Separation blended with the weights you set below. 99 = the best career in that sport pool.' },
  era:        { label: 'Era (peak year)',           short: 'Era',        get: a => a.py, year: true,
                desc: 'The year of their single best season.' },
  debut:      { label: 'Debut year',                short: 'Debut',      get: a => a.y0, year: true,
                desc: 'The first season in our data.' },
  seasons:    { label: 'Qualified seasons',         short: 'Seasons',    get: a => a.nq, integer: true,
                desc: 'Seasons where they played enough to count (games, innings, races or matches).' },
  born:       { label: 'Birth year',                short: 'Born',       get: a => a.by, year: true,
                desc: 'Year of birth, where known.' },
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
