// =====================================================================
// UI — wires the left control panel: axes, sports, GOAT formula sliders,
// the Everyone toggle, and search.
// =====================================================================
import { settings, AXIS_PRESETS, WEIGHT_PRESETS, SPORT_LABELS } from './settings.js';
import { state, METRICS, computeScores, shown } from './data.js';
import { controls } from './scene.js';
import { applyFilters, relayout, refreshAppearance } from './galaxy.js';
import { pickLabelSet, buildAxisLabels } from './labels.js';
import { select, refreshPanel, togglePin, clearPins } from './panel.js';

const $ = id => document.getElementById(id);

// ---------- shared actions ----------
export function setAxes(next) {
  state.axes = next;
  relayout();
  ['axX', 'axY', 'axZ'].forEach((id, i) => { $(id).value = next[i]; });
  document.querySelectorAll('#presets button').forEach(b => b.classList.toggle('on', b.dataset.axes === next.join(',')));
  buildAxisLabels();
}

export function refilter() {
  const n = applyFilters();
  $('visibleCount').textContent = n.toLocaleString();
  pickLabelSet();
}

function setWeights(w) {
  state.weights = { ...w };
  const total = w.height + w.length + w.separation || 1;
  for (const k of ['height', 'length', 'separation']) {
    $('w_' + k).value = w[k];
    $('w_' + k + '_v').textContent = Math.round(w[k] / total * 100) + '%';
  }
  document.querySelectorAll('#weightPresets button').forEach(b => {
    const p = WEIGHT_PRESETS.find(x => x.name === b.dataset.name).weights;
    b.classList.toggle('on', ['height', 'length', 'separation'].every(k => Math.abs(p[k] / 100 - w[k] / total) < 0.011));
  });
  computeScores();
  refreshAppearance();            // sizes + brightness follow the new GOAT score
  if (state.axes.includes('goat')) relayout();
  refilter();
  refreshPanel();
  updateLeader();
}

function updateLeader() {
  const top = state.athletes.filter(a => a.cur).reduce((b, a) => (a.raw > b.raw ? a : b));
  $('leader').innerHTML = `<span class="lbl">#1 with this formula</span><b>${top.n}</b> <span class="mono">${shown(top.G).toFixed(1)}</span>`;
}

// ---------- wiring ----------
export function initUI() {
  // axes
  ['axX', 'axY', 'axZ'].forEach((id, ai) => {
    const s = $(id);
    s.innerHTML = Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');
    s.value = state.axes[ai];
    s.onchange = () => { const n = [...state.axes]; n[ai] = s.value; setAxes(n); };
  });
  $('presets').innerHTML = AXIS_PRESETS.map(p => `<button data-axes="${p.axes.join(',')}">${p.name}</button>`).join('');
  document.querySelectorAll('#presets button').forEach(b => b.onclick = () => setAxes(b.dataset.axes.split(',')));

  // sports
  const counts = {};
  state.athletes.forEach(a => { if (a.cur) counts[a.s] = (counts[a.s] || 0) + 1; });
  const sEl = $('sports');
  sEl.innerHTML = Object.keys(settings.colors.sports).map(k => {
    const c = settings.colors.sports[k];
    return `<button class="sport" data-s="${k}" aria-pressed="true"><span class="dot" style="background:${c};color:${c}"></span>${SPORT_LABELS[k]}<span class="n">${counts[k] || 0}</span></button>`;
  }).join('');
  const syncSports = () => sEl.querySelectorAll('.sport').forEach(x => {
    const on = state.activeSports.has(x.dataset.s); x.classList.toggle('off', !on); x.setAttribute('aria-pressed', on);
  });
  sEl.querySelectorAll('.sport').forEach(b => {
    b.onclick = e => {
      const s = b.dataset.s;
      if (e.altKey || e.metaKey) { state.activeSports.clear(); state.activeSports.add(s); }
      else if (state.activeSports.has(s)) state.activeSports.delete(s); else state.activeSports.add(s);
      syncSports(); refilter();
    };
    b.ondblclick = () => { state.activeSports.clear(); state.activeSports.add(b.dataset.s); syncSports(); refilter(); };
  });

  // GOAT formula
  $('weightPresets').innerHTML = WEIGHT_PRESETS.map(p => `<button data-name="${p.name}">${p.name}</button>`).join('');
  document.querySelectorAll('#weightPresets button').forEach(b =>
    b.onclick = () => setWeights(WEIGHT_PRESETS.find(p => p.name === b.dataset.name).weights));
  let raf = 0;
  for (const k of ['height', 'length', 'separation']) {
    $('w_' + k).oninput = () => {
      const w = { ...state.weights, [k]: +$('w_' + k).value };
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setWeights(w));
    };
  }

  // everyone toggle
  const total = state.athletes.length, curated = state.athletes.filter(a => a.cur).length;
  $('everyoneCount').textContent = total.toLocaleString();
  $('curatedCount').textContent = curated.toLocaleString();
  $('toggleEveryone').onchange = e => { state.showEveryone = e.target.checked; relayout(); buildAxisLabels(); refilter(); };

  // min score, labels, drift
  const mg = $('minGoat');
  mg.oninput = () => { state.minGoat = +mg.value; $('minGoatVal').textContent = state.minGoat; refilter(); };
  $('toggleLabels').onchange = e => { state.showLabels = e.target.checked; pickLabelSet(); };
  $('toggleSpin').onchange = e => { controls.autoRotate = e.target.checked; };
  $('closePanel').onclick = () => select(-1);
  $('pinBtn').onclick = () => state.selected >= 0 && togglePin(state.selected);
  $('clearCompare').onclick = clearPins;

  initSearch(syncSports);
  setWeights(state.weights);
}

// ---------- search (covers everyone, even outside the curated view) ----------
function initSearch(syncSports) {
  const input = $('search'), list = $('results');
  let matches = [], active = 0;
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const render = () => {
    list.innerHTML = matches.map((i, k) => {
      const a = state.athletes[i];
      return `<li role="option" data-i="${i}" class="${k === active ? 'active' : ''}"><span class="dot" style="background:${settings.colors.sports[a.s]}"></span>${a.n}${a.cur ? '' : '<span class="tag">extra</span>'}<span class="sub mono">${SPORT_LABELS[a.s]} · ${shown(a.G).toFixed(1)}</span></li>`;
    }).join('');
    list.classList.toggle('open', matches.length > 0);
    list.querySelectorAll('li').forEach(li => li.onmousedown = e => { e.preventDefault(); go(+li.dataset.i); });
  };
  const go = i => {
    const a = state.athletes[i];
    list.classList.remove('open'); input.value = a.n; input.blur();
    let changed = false;
    if (!a.cur && !state.showEveryone && !state.revealed.has(a)) { state.revealed.add(a); changed = true; }
    if (!state.activeSports.has(a.s)) { state.activeSports.add(a.s); syncSports(); changed = true; }
    if (a.G < state.minGoat) { state.minGoat = 0; $('minGoat').value = 0; $('minGoatVal').textContent = 0; changed = true; }
    if (changed) refilter();
    select(i);
  };
  input.oninput = () => {
    const q = norm(input.value.trim());
    matches = q.length < 2 ? [] : state.athletes.map((a, i) => i).filter(i => state.athletes[i]._q.includes(q))
      .sort((x, y) => (state.athletes[y].cur - state.athletes[x].cur) || (state.athletes[y].raw - state.athletes[x].raw)).slice(0, 8);
    active = 0; render();
  };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, matches.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter' && matches[active] != null) go(matches[active]);
    else if (e.key === 'Escape') { list.classList.remove('open'); input.blur(); }
  };
  input.onblur = () => setTimeout(() => list.classList.remove('open'), 100);
}
