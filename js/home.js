import { local, session } from './store.js';
import { wireForm, shouldShowPopup } from './capture.js';
import { applySchool } from './school-theme.js';

const doc = document;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGE = 8;

const schools = await fetch('data/schools.json').then((r) => r.json()).catch(() => ({}));

// ---- shop by school: tiles filter the shop grid, 8 at a time ----
const shop = doc.getElementById('shop');
const tiles = [...doc.querySelectorAll('.school-tile[data-school]')];
const cards = [...doc.querySelectorAll('#shop-grid .card')];
const follow = doc.getElementById('shop-follow');
const label = doc.querySelector('[data-shop-label]');
const count = doc.querySelector('[data-shop-count]');
const more = doc.querySelector('[data-load-more]');
const VARS = ['--school-primary', '--school-secondary', '--school-on-primary', '--school-on-secondary'];
let current = 'all';
let limit = PAGE;

function render() {
  const matches = cards.filter((c) => current === 'all' || c.dataset.school === current);
  cards.forEach((c) => { c.hidden = true; });
  matches.forEach((c, i) => { c.hidden = i >= limit; });
  count.textContent = `${matches.length} ${matches.length === 1 ? 'style' : 'styles'}`;
  more.hidden = matches.length <= limit;
  if (!more.hidden) more.textContent = `Load more (${matches.length - limit})`;
}

function pick(slug, { remember = true } = {}) {
  const s = schools[slug];
  if (slug !== 'all' && !s) return;
  current = slug;
  limit = PAGE;
  tiles.forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.school === slug)));
  if (slug === 'all') {
    label.textContent = 'All schools';
    VARS.forEach((k) => shop.style.removeProperty(k));
    follow.hidden = true;
  } else {
    label.textContent = s.name;
    applySchool(shop, slug, s); // school colors stay on the shop results
    follow.hidden = false;
    follow.dataset.school = slug;
    follow.querySelector('[data-school-name]').textContent = s.short;
  }
  render();
  if (remember) local.set('hs-school', slug);
}

tiles.forEach((t) => t.addEventListener('click', () => {
  pick(t.dataset.school);
  shop.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}));
more.addEventListener('click', () => { limit += PAGE; render(); });
const saved = local.get('hs-school');
pick(saved && (saved === 'all' || schools[saved]) ? saved : 'all', { remember: false });

// ---- rails: arrows scroll the track ----
doc.querySelectorAll('.band').forEach((band) => {
  const track = band.querySelector('.rail__track');
  if (!track) return;
  const step = () => Math.max(240, track.clientWidth * 0.8);
  band.querySelector('[data-rail-next]')?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
  band.querySelector('[data-rail-prev]')?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reducedMotion ? 'auto' : 'smooth' }));
});

// ---- colorway dots swap the photo in place (links still work without JS) ----
doc.querySelectorAll('.card .dot').forEach((dot) => {
  dot.addEventListener('click', (e) => {
    const card = dot.closest('.card');
    const img = card.querySelector('.card__img');
    if (!dot.dataset.img || !img) return;
    e.preventDefault();
    img.removeAttribute('srcset');
    img.src = dot.dataset.img;
    card.querySelector('.card__img--alt')?.remove();
    card.querySelectorAll('.dot').forEach((d) => d.removeAttribute('aria-current'));
    dot.setAttribute('aria-current', 'true');
    card.querySelectorAll('.card__media, .card__title a').forEach((a) => { a.href = dot.href; });
  });
});

// ---- dialogs: phone menu, signup popup, restock ----
const menu = doc.getElementById('menu');
const popup = doc.getElementById('popup');
const restock = doc.getElementById('restock');
// Focus lands on the dialog itself, so no focus ring flashes on its close button; Tab reaches the controls.
const open = (d) => { d.showModal(); d.focus(); };
for (const d of [menu, popup, restock]) {
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}
doc.querySelector('[data-menu-open]')?.addEventListener('click', () => open(menu));

let popupState = session.get('hs-popup'); // memory copy survives blocked storage within this page
popup.addEventListener('close', () => { popupState = 'dismissed'; session.set('hs-popup', 'dismissed'); });
function maybePopup(exitIntent = false) {
  if (popup.open || restock.open || menu.open) return;
  const max = doc.documentElement.scrollHeight - innerHeight;
  const scrollRatio = max > 0 ? scrollY / max : 0;
  if (shouldShowPopup({ shown: popupState === 'shown', dismissed: popupState === 'dismissed', scrollRatio, exitIntent })) {
    popupState = 'shown';
    session.set('hs-popup', 'shown');
    open(popup);
  }
}
addEventListener('scroll', () => maybePopup(false), { passive: true });
doc.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY <= 0) maybePopup(true); });

doc.querySelectorAll('[data-restock]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    restock.querySelector('form').dataset.handle = a.dataset.restock;
    open(restock);
  });
});

// ---- in-page links glide to their section ----
doc.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    const target = id && doc.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (a.dataset.pick) pick(a.dataset.pick);
    if (menu.open) menu.close();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  });
});

// ---- reels play while on screen ----
const reels = [...doc.querySelectorAll('#reels video')];
if (!reducedMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { v.preload = 'auto'; v.play().then(() => v.closest('.reel')?.classList.add('is-playing')).catch(() => {}); }
      else { v.pause(); v.closest('.reel')?.classList.remove('is-playing'); }
    }
  }, { threshold: 0.5 });
  reels.forEach((v) => { v.muted = true; io.observe(v); });
}

// ---- Vanderbilt slider: one slide per colorway, tabs + arrows, gentle autoplay ----
const vu = doc.getElementById('vanderbilt');
const vuTrack = vu.querySelector('[data-slides]');
const vuSlides = [...vuTrack.children];
const vuTabs = [...vu.querySelectorAll('[data-slide-to]')];
const vuCount = vu.querySelector('[data-slide-count]');
const vuPause = vu.querySelector('[data-slide-pause]');
const VU_INTERVAL = 6000;
const two = (n) => String(n).padStart(2, '0');
let vuIndex = 0;
let vuTarget = null; // slide a programmatic scroll is heading to; ignore slides passed on the way
let vuPlaying = !reducedMotion;
let vuHold = false; // hover, focus or a hidden tab holds autoplay without turning it off
let vuTimer = null;

function vuRender() {
  vuTabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === vuIndex)); t.tabIndex = k === vuIndex ? 0 : -1; });
  vuCount.textContent = `${two(vuIndex + 1)} / ${two(vuSlides.length)}`;
}
function vuSchedule() {
  clearTimeout(vuTimer);
  const on = vuPlaying && !vuHold;
  vu.classList.remove('is-playing');
  if (!on) return;
  void vu.offsetWidth; // restart the progress bar on the active tab
  vu.classList.add('is-playing');
  vuTimer = setTimeout(() => vuShow(vuIndex + 1), VU_INTERVAL);
}
function vuShow(i) {
  vuIndex = (i + vuSlides.length) % vuSlides.length;
  vuTarget = vuIndex;
  vuTrack.scrollTo({ left: vuSlides[vuIndex].offsetLeft, behavior: reducedMotion ? 'auto' : 'smooth' });
  vuRender();
  vuSchedule();
}
function vuStop() {
  vuPlaying = false;
  vuPause.setAttribute('aria-pressed', 'true');
  vuPause.setAttribute('aria-label', 'Play slideshow');
  vuSchedule();
}
vu.style.setProperty('--vu-interval', `${VU_INTERVAL}ms`);
vu.querySelector('[data-slide-next]').addEventListener('click', () => { vuStop(); vuShow(vuIndex + 1); });
vu.querySelector('[data-slide-prev]').addEventListener('click', () => { vuStop(); vuShow(vuIndex - 1); });
vuTabs.forEach((t, k) => {
  t.addEventListener('click', () => { vuStop(); vuShow(k); });
  t.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    vuStop();
    vuShow(vuIndex + step);
    vuTabs[vuIndex].focus();
  });
});
vuPause.addEventListener('click', () => {
  if (vuPlaying) { vuStop(); return; }
  vuPlaying = true;
  vuPause.setAttribute('aria-pressed', 'false');
  vuPause.setAttribute('aria-label', 'Pause slideshow');
  vuSchedule();
});
if (!vuPlaying) { vuPause.setAttribute('aria-pressed', 'true'); vuPause.setAttribute('aria-label', 'Play slideshow'); }
// Swipes update the tabs; a swipe means the shopper took over.
if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const k = vuSlides.indexOf(e.target);
      if (vuTarget !== null) { if (k === vuTarget) vuTarget = null; continue; }
      if (k !== vuIndex) { vuIndex = k; vuStop(); vuRender(); }
    }
  }, { root: vuTrack, threshold: 0.6 });
  vuSlides.forEach((sl) => seen.observe(sl));
}
const vuHoldOn = () => { vuHold = true; vuSchedule(); };
const vuHoldOff = () => { vuHold = vu.matches(':hover') || vu.contains(doc.activeElement) || doc.hidden; vuSchedule(); };
vu.addEventListener('mouseenter', vuHoldOn);
vu.addEventListener('mouseleave', vuHoldOff);
vu.addEventListener('focusin', vuHoldOn);
vu.addEventListener('focusout', () => setTimeout(vuHoldOff));
doc.addEventListener('visibilitychange', () => (doc.hidden ? vuHoldOn() : vuHoldOff()));
vuRender();
vuSchedule();

doc.querySelectorAll('form[data-capture]').forEach((f) => wireForm(f));
window.__hs = { ready: true };
