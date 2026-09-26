// =====================================================================
// GUIDE — the "How it works" overlay, first-visit welcome card, legend.
// All the words live in index.html so they're easy to edit.
// =====================================================================
import { settings, SPORT_LABELS } from './settings.js';
import { state } from './data.js';

const $ = id => document.getElementById(id);

export function openGuide(section) {
  $('guide').hidden = false;
  $('welcome').hidden = true;
  localStorage.setItem('apex-welcomed', '1');
  const body = document.querySelector('.guide-body');
  body.scrollTop = section ? document.getElementById(section).offsetTop - 20 : 0;
  $('closeGuide').focus();
}
export const closeGuide = () => { $('guide').hidden = true; };
export const guideOpen = () => !$('guide').hidden;

export function initGuide() {
  // fill live numbers
  const cur = state.athletes.filter(a => a.cur).length;
  document.querySelectorAll('[data-curated]').forEach(e => e.textContent = cur.toLocaleString());
  document.querySelectorAll('[data-everyone]').forEach(e => e.textContent = state.athletes.length.toLocaleString());
  const per = {}; state.athletes.forEach(a => { if (a.cur) per[a.s] = (per[a.s] || 0) + 1; });
  document.querySelectorAll('[data-per-sport]').forEach(e => e.textContent = Math.min(...Object.values(per)));
  const W = settings.scoring.defaultWeights;
  document.querySelectorAll('[data-w]').forEach(e => e.textContent = W[e.dataset.w]);
  $('guideSports').innerHTML = Object.entries(settings.colors.sports)
    .map(([k, c]) => `<span><i style="background:${c}"></i>${SPORT_LABELS[k]}</span>`).join('');

  document.querySelectorAll('[data-guide]').forEach(b => b.onclick = () => openGuide());
  $('openGuide').onclick = () => openGuide();
  $('closeGuide').onclick = closeGuide;
  $('guide').onclick = e => { if (e.target.id === 'guide') closeGuide(); };
  addEventListener('keydown', e => { if (e.key === 'Escape' && guideOpen()) { e.stopImmediatePropagation(); closeGuide(); } }, true);

  // highlight the section you're reading
  const body = document.querySelector('.guide-body');
  const links = [...document.querySelectorAll('.guide-nav a')];
  body.addEventListener('scroll', () => {
    let on = links[0];
    for (const a of links) if (document.querySelector(a.getAttribute('href')).offsetTop <= body.scrollTop + 60) on = a;
    links.forEach(a => a.classList.toggle('on', a === on));
  });
  links.forEach(a => a.onclick = e => { e.preventDefault(); body.scrollTop = document.querySelector(a.getAttribute('href')).offsetTop - 20; });

  // first visit only
  if (!localStorage.getItem('apex-welcomed')) {
    $('welcome').hidden = false;
    $('welcomeGo').onclick = () => { $('welcome').hidden = true; localStorage.setItem('apex-welcomed', '1'); };
  }

  // hide the legend while the comparison tray is open (same spot on screen)
  new MutationObserver(() => $('legend').classList.toggle('hide', !$('compare').hidden))
    .observe($('compare'), { attributes: true, attributeFilter: ['hidden'] });
}
