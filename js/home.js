import { local, session } from './store.js';
import { wireForm, shouldShowPopup } from './capture.js';
import { applySchool } from './school-theme.js';

const doc = document;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAGE = 8;

// ---- motion: text and rows arrive as you scroll; photos are never hidden ----
// Only switched on when motion is welcome and the tab is actually visible, with two safety nets:
// a hidden tab shows everything at once, and a sweep shows anything already on screen.
const motionTargets = [...doc.querySelectorAll('[data-reveal], [data-write], [data-rise]')];
if (!reducedMotion && !doc.hidden && 'IntersectionObserver' in window) {
  doc.documentElement.classList.add('motion');
  doc.querySelectorAll('[data-rise]').forEach((row) => [...row.children].forEach((c, i) => c.style.setProperty('--i', String(Math.min(i, 8)))));
  const showAll = () => motionTargets.forEach((t) => t.classList.add('is-in'));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -6% 0px' });
  motionTargets.forEach((t) => io.observe(t));
  const sweep = () => motionTargets.forEach((t) => { if (!t.classList.contains('is-in') && t.getBoundingClientRect().top < innerHeight) t.classList.add('is-in'); });
  let sweepTimer;
  addEventListener('scroll', () => { clearTimeout(sweepTimer); sweepTimer = setTimeout(sweep, 350); }, { passive: true });
  setTimeout(sweep, 1200);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) showAll(); });
}

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
more.addEventListener('click', () => {
  const before = new Set(cards.filter((c) => !c.hidden));
  limit += PAGE;
  render();
  cards.filter((c) => !c.hidden && !before.has(c)).forEach((c) => { c.classList.remove('is-new'); void c.offsetWidth; c.classList.add('is-new'); });
});
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

// ---- game-day pass: the school you tap goes on the ticket stub, barcode in its colors ----
const stub = popup.querySelector('.ticket__stub');
const stubName = popup.querySelector('[data-stub-school]');
const stubLogo = popup.querySelector('[data-stub-logo]');
popup.querySelectorAll('.pick input').forEach((radio) => radio.addEventListener('change', () => {
  const pick = radio.closest('.pick');
  const logo = pick.querySelector('img');
  stubName.textContent = pick.dataset.short;
  if (logo) { stubLogo.src = logo.getAttribute('src'); stubLogo.width = logo.width; stubLogo.height = logo.height; }
  const s = schools[radio.value];
  if (s) { stub.style.setProperty('--stub-1', s.primary); stub.style.setProperty('--stub-2', s.secondary); }
}));

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

// ---- Vanderbilt hero: one colorway at a time, crossfading; tabs, arrows, swipe, gentle autoplay ----
const vu = doc.getElementById('vanderbilt');
const vuSlides = [...vu.querySelectorAll('.vu-slide')];
const vuTabs = [...vu.querySelectorAll('[data-slide-to]')];
const vuCount = vu.querySelector('[data-slide-count]');
const vuPause = vu.querySelector('[data-slide-pause]');
const VU_INTERVAL = 6000;
const two = (n) => String(n).padStart(2, '0');
let vuIndex = 0;
let vuPlaying = !reducedMotion;
let vuHold = false; // hover, focus or a hidden tab holds autoplay without turning it off
let vuTimer = null;

function vuSchedule() {
  clearTimeout(vuTimer);
  vu.classList.remove('is-playing');
  if (!vuPlaying || vuHold) return;
  void vu.offsetWidth; // restart the progress bar on the active tab
  vu.classList.add('is-playing');
  vuTimer = setTimeout(() => vuShow(vuIndex + 1), VU_INTERVAL);
}
let vuSwap = null;
function vuShow(i) {
  vuIndex = (i + vuSlides.length) % vuSlides.length;
  vuRender();
  vuSchedule();
}
// The tabs move at once; the new photo is uncovered behind the varsity bars, then the old one is dropped.
function vuRender() {
  vuTabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === vuIndex)); t.tabIndex = k === vuIndex ? 0 : -1; });
  vuCount.textContent = `${two(vuIndex + 1)} / ${two(vuSlides.length)}`;
  const next = vuSlides[vuIndex];
  const prev = vuSlides.find((sl) => sl !== next && sl.hasAttribute('data-active'));
  const settle = () => vuSlides.forEach((sl) => {
    sl.toggleAttribute('data-active', sl === next);
    sl.setAttribute('aria-hidden', String(sl !== next));
    sl.classList.remove('is-entering', 'is-leaving');
  });
  clearTimeout(vuSwap);
  if (!prev || reducedMotion || !doc.documentElement.classList.contains('motion')) { settle(); return; }
  vuSlides.forEach((sl) => sl.classList.remove('is-entering', 'is-leaving'));
  prev.classList.add('is-leaving');
  next.setAttribute('data-active', '');
  next.setAttribute('aria-hidden', 'false');
  void next.offsetWidth; // restart the reveal and the bars together
  next.classList.add('is-entering');
  vu.classList.remove('is-wiping');
  void vu.offsetWidth;
  vu.classList.add('is-wiping');
  vuSwap = setTimeout(settle, 1100);
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
// Swipe left/right on the photos; a swipe means the shopper took over.
const vuStage = vu.querySelector('.vu__slider');
let swipeX = null;
vuStage.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
vuStage.addEventListener('pointercancel', () => { swipeX = null; });
vuStage.addEventListener('pointerup', (e) => {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) < 40) return;
  vuStop();
  vuShow(vuIndex + (dx < 0 ? 1 : -1));
});
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
