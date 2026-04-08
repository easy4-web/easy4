'use strict';

/* =========================================================
   Easy4 Disc Golf Club — script.js
   Single-page navigation + mobile menu + utilities
   ========================================================= */

const VALID_PAGES = new Set(['home', 'events', 'leaderboards', 'contact']);

const navToggle = document.getElementById('navToggle');
const navMenu   = document.getElementById('navMenu');

/* ── navigate(pageId) ────────────────────────────────────
   Show the requested page section, update nav state,
   close the mobile menu, and push a history entry.
   ─────────────────────────────────────────────────────── */
function navigate(pageId) {
  if (!VALID_PAGES.has(pageId)) pageId = 'home';

  // Toggle page sections
  document.querySelectorAll('.page').forEach(section => {
    section.classList.toggle('active', section.id === pageId);
  });

  // Update nav link active state + aria-current
  document.querySelectorAll('.nav-link').forEach(link => {
    const isActive = link.dataset.nav === pageId;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  // Close mobile menu
  closeMobileMenu();

  // Keep URL in sync (avoids duplicate history entries on first load)
  const hash = '#' + pageId;
  if (window.location.hash !== hash) {
    history.pushState({ page: pageId }, '', hash);
  }

  // Scroll to top instantly (no smooth scroll between pages)
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ── Mobile menu helpers ─────────────────────────────── */
function closeMobileMenu() {
  navMenu.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
}

navToggle.addEventListener('click', () => {
  const opening = !navMenu.classList.contains('is-open');
  navMenu.classList.toggle('is-open', opening);
  navToggle.setAttribute('aria-expanded', String(opening));
});

// Close on outside click (mobile)
document.addEventListener('click', e => {
  if (navMenu.classList.contains('is-open') &&
      !navMenu.contains(e.target) &&
      !navToggle.contains(e.target)) {
    closeMobileMenu();
  }
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMobileMenu();
});

/* ── Wire up all [data-nav] elements ─────────────────── */
document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.nav);
  });
});

/* ── Browser back / forward ──────────────────────────── */
window.addEventListener('popstate', e => {
  const page = e.state?.page ?? window.location.hash.replace('#', '') ?? 'home';
  navigate(page);
});

/* ── Init ────────────────────────────────────────────── */
(function init() {
  // Resolve page from URL hash, default to home
  const hash = window.location.hash.replace('#', '');
  navigate(VALID_PAGES.has(hash) ? hash : 'home');

  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
