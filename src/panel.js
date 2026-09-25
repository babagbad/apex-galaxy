// =====================================================================
// PANEL — the athlete detail card on the right, and the comparison tray.
// =====================================================================
import * as THREE from 'three';
import { settings, SPORT_LABELS, CONFIDENCE } from './settings.js';
import { state, shown } from './data.js';
import { haloMat, halo, drop, floorRing } from './scene.js';
import { setHi, targetOf } from './galaxy.js';
import { pickLabelSet } from './labels.js';
import { flyTo } from './flight.js';

const $ = id => document.getElementById(id);
const panel = $('panel');
const color = a => settings.colors.sports[a.s];

export function select(i, fly = true) {
  const prev = state.selected;
  if (prev >= 0 && prev !== state.hovered) setHi(prev, state.pinned.includes(prev) ? .6 : 0);
  state.selected = i;
  if (i < 0) {
    panel.hidden = true;
    halo.visible = drop.visible = floorRing.visible = false;
    pickLabelSet();
    return;
  }
  setHi(i, 1);
  const a = state.athletes[i];
  fillPanel(a);
  panel.hidden = false;
  halo.visible = drop.visible = floorRing.visible = true;
  haloMat.uniforms.uColor.value.set(color(a)).lerp(new THREE.Color('#ffffff'), .35);
  pickLabelSet();
  if (fly) flyTo(targetOf(i));
}

export function refreshPanel() {
  if (state.selected >= 0) fillPanel(state.athletes[state.selected]);
  renderCompare();
}

function fillPanel(a) {
  const c = color(a);
  $('pSport').innerHTML = `<span class="dot" style="background:${c};color:${c}"></span><span style="color:${c}">${SPORT_LABELS[a.s]}</span>`;
  $('pName').textContent = a.n;
  $('pBadges').innerHTML =
    (a.act ? '<span class="badge live">Career in progress</span>' : '') +
    (!a.cur ? '<span class="badge">Outside curated view</span>' : '') +
    `<span class="badge conf-${CONFIDENCE[a.s].toLowerCase()}" title="How complete this sport's data is">Data: ${CONFIDENCE[a.s]}</span>`;
  const meta = [a.pos, a.nat, a.by ? `born ${a.by}` : null, `peak ${a.py}`].filter(Boolean);
  $('pMeta').textContent = meta.join(' · ');
  $('pGoat').textContent = shown(a.G).toFixed(1);
  $('pRing').style.strokeDashoffset = 326.7 * (1 - shown(a.G) / 100);
  $('pGR').textContent = '#' + (a.cur ? a.cr : a.gr).toLocaleString();
  $('pGRl').textContent = a.cur ? 'Galaxy rank' : 'Overall rank';
  $('pSR').textContent = '#' + a.sr.toLocaleString();
  $('pSpan').textContent = a.y0 === a.y1 ? `${a.y0}` : `${a.y0}–${String(a.y1).slice(2)}`;
  const maxL = 22;
  const bars = [
    ['Height', 'best 3 seasons vs the elite', shown(a.H).toFixed(0), shown(a.H), 'var(--x)'],
    ['Length', 'seasons in the elite tier', a.L, a.L / maxL * 100, 'var(--y)'],
    ['Separation', 'margin over the next best', shown(a.S).toFixed(0), shown(a.S), 'var(--z)'],
  ];
  $('pBars').innerHTML = bars.map(([l, sub, v, w, col]) => `
    <div class="bar"><div class="bar-top"><span>${l} <em>${sub}</em></span><span class="mono">${v}</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, w))}%;background:${col}"></div></div></div>`).join('') +
    `<div class="facts"><span><b class="mono">${a.n1}</b> seasons as #1</span><span><b class="mono">${a.nq}</b> qualified seasons</span></div>`;
  drawSpark(a, c);
  $('pinBtn').textContent = state.pinned.includes(state.athletes.indexOf(a)) ? 'Remove from comparison' : 'Add to comparison';
}

// Career line: each season's z-score vs that season's elite tier (0 = elite average).
function drawSpark(a, c) {
  const svg = $('pSpark'), W = 300, H = 90, pts = a.c;
  if (!pts.length) { svg.innerHTML = ''; return; }
  const y0 = pts[0][0], y1 = pts[pts.length - 1][0];
  const zMin = Math.min(-2, ...pts.map(p => p[1])), zMax = Math.max(3, ...pts.map(p => p[1]));
  const X = y => pts.length === 1 ? W / 2 : (y - y0) / ((y1 - y0) || 1) * W;
  const Y = z => H - (z - zMin) / (zMax - zMin) * H;
  let peak = pts[0]; pts.forEach(p => { if (p[1] > peak[1]) peak = p; });
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const area = d + `L${X(y1)},${H}L${X(y0)},${H}Z`;
  svg.innerHTML = `
    <defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 4"/>
    <path d="${area}" fill="url(#sg)"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${X(peak[0])}" cy="${Y(peak[1])}" r="3.5" fill="var(--gold)"/>`;
  $('pY0').textContent = y0;
  $('pY1').textContent = y1;
  $('pPeak').textContent = `best ${peak[0]}`;
}

// ---------- comparison tray ----------
export function togglePin(i) {
  const k = state.pinned.indexOf(i);
  if (k >= 0) { state.pinned.splice(k, 1); if (i !== state.selected) setHi(i, 0); }
  else {
    if (state.pinned.length >= 5) { const old = state.pinned.shift(); if (old !== state.selected) setHi(old, 0); }
    state.pinned.push(i); if (i !== state.selected) setHi(i, .6);
  }
  refreshPanel(); pickLabelSet();
}
export function clearPins() { [...state.pinned].forEach(togglePin); }

function renderCompare() {
  const box = $('compare'), P = state.pinned.map(i => state.athletes[i]);
  box.hidden = P.length === 0;
  const best = k => Math.max(...P.map(a => a[k]));
  $('compareList').innerHTML = P.map((a, k) => {
    const v = (key, l, txt) => `<span>${l} <b class="${a[key] === best(key) && P.length > 1 ? 'best' : ''}">${txt}</b></span>`;
    return `<div class="cmp" data-i="${state.pinned[k]}"><div class="nm"><span class="dot" style="background:${color(a)}"></span>${a.n}</div>
      <div class="vals">${v('G', 'GOAT', shown(a.G).toFixed(0))}${v('H', 'H', shown(a.H).toFixed(0))}${v('L', 'L', a.L)}${v('S', 'S', shown(a.S).toFixed(0))}</div></div>`;
  }).join('');
  box.querySelectorAll('.cmp').forEach(el => el.onclick = () => select(+el.dataset.i));
}
