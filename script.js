'use strict';

/* =========================================================
   Easy4 Disc Golf Club — script.js
   ========================================================= */

/* ── Config ──────────────────────────────────────────────── */
const CAL_ID  = 'c_f3d2623080b0ef7b825ba98532ae9e981600ae66429111ff5032f35dc539dec0@group.calendar.google.com';
const API_KEY = 'AIzaSyDXfsxcLQ7raquqvUxWvdjBTq8uDyrFsmo';
const TZ      = 'Europe/Tallinn';

/* ── Page navigation ─────────────────────────────────────── */
const VALID_PAGES = new Set(['home', 'events', 'leaderboards', 'contact']);
const navToggle   = document.getElementById('navToggle');
const navMenu     = document.getElementById('navMenu');

function navigate(pageId) {
  if (!VALID_PAGES.has(pageId)) pageId = 'home';

  document.querySelectorAll('.page').forEach(s => {
    s.classList.toggle('active', s.id === pageId);
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    const active = link.dataset.nav === pageId;
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });

  closeMobileMenu();

  const hash = '#' + pageId;
  if (window.location.hash !== hash) history.pushState({ page: pageId }, '', hash);
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Lazy-load calendar on first visit to events page
  if (pageId === 'events') initCalendar();
}

function closeMobileMenu() {
  navMenu.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
}

navToggle.addEventListener('click', () => {
  const opening = !navMenu.classList.contains('is-open');
  navMenu.classList.toggle('is-open', opening);
  navToggle.setAttribute('aria-expanded', String(opening));
});
document.addEventListener('click', e => {
  if (navMenu.classList.contains('is-open') &&
      !navMenu.contains(e.target) && !navToggle.contains(e.target)) closeMobileMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.nav); });
});
window.addEventListener('popstate', e => {
  navigate(e.state?.page ?? window.location.hash.replace('#', '') ?? 'home');
});

/* ── Init ────────────────────────────────────────────────── */
(function init() {
  const hash = window.location.hash.replace('#', '');
  navigate(VALID_PAGES.has(hash) ? hash : 'home');
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();


/* =========================================================
   CALENDAR
   ========================================================= */
let calLoaded   = false;
let allEvents   = [];   // raw event objects from API
let monthCursor = new Date(); // first day of displayed month

/* ── Fetch ───────────────────────────────────────────────── */
async function initCalendar() {
  if (calLoaded) return;
  calLoaded = true;

  const status = document.getElementById('calStatus');

  try {
    const now      = new Date().toISOString();
    const twoMonths = new Date();
    twoMonths.setMonth(twoMonths.getMonth() + 2);
    const future   = twoMonths.toISOString();
    const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events`
      + `?key=${API_KEY}`
      + `&timeMin=${now}`
      + `&timeMax=${future}`
      + `&singleEvents=true`
      + `&orderBy=startTime`
      + `&maxResults=100`
      + `&timeZone=${encodeURIComponent(TZ)}`;

    const res  = await fetch(endpoint);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    allEvents  = data.items || [];
  } catch (err) {
    status.innerHTML = `<p style="color:rgba(255,255,255,.4)">Could not load events. Please try again later.</p>`;
    return;
  }

  status.classList.add('hidden');

  // Set month cursor to current month
  monthCursor = new Date();
  monthCursor.setDate(1);

  renderUpcoming();
  renderMonth();
  setupCalTabs();
  setupMonthNav();
}

/* ── Helpers ─────────────────────────────────────────────── */
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                      'Jul','Aug','Sep','Oct','Nov','Dec'];

function eventStart(ev) {
  return ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00');
}
function eventEnd(ev) {
  return ev.end.dateTime ? new Date(ev.end.dateTime) : new Date(ev.end.date + 'T00:00:00');
}
function isAllDay(ev) { return !!ev.start.date && !ev.start.dateTime; }

function formatTime(ev) {
  if (isAllDay(ev)) return 'All day';
  const s = eventStart(ev), e = eventEnd(ev);
  const fmt = d => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  return `${fmt(s)} – ${fmt(e)}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

/* ── Upcoming view ───────────────────────────────────────── */
function renderUpcoming() {
  const list  = document.getElementById('eventList');
  const empty = document.getElementById('upcomingEmpty');
  list.innerHTML = '';

  if (!allEvents.length) { empty.hidden = false; return; }
  empty.hidden = true;

  allEvents.forEach(ev => {
    const start = eventStart(ev);
    const li    = document.createElement('li');
    li.className = 'event-item';
    li.innerHTML = `
      <div class="event-date-badge" aria-hidden="true">
        <span class="event-date-day">${start.getDate()}</span>
        <span class="event-date-month">${MONTHS_SHORT[start.getMonth()]}</span>
      </div>
      <div class="event-info">
        <div class="event-name">${escHtml(ev.summary || 'Event')}</div>
        <div class="event-time">${formatTime(ev)}</div>
        ${ev.description ? `<div class="event-desc">${escHtml(ev.description)}</div>` : ''}
      </div>`;
    list.appendChild(li);
  });
}

/* ── Month view ──────────────────────────────────────────── */
function renderMonth() {
  const label = document.getElementById('monthLabel');
  const grid  = document.getElementById('monthGrid');
  label.textContent = `${MONTHS[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;
  grid.innerHTML = '';

  const year  = monthCursor.getFullYear();
  const month = monthCursor.getMonth();

  // Mon=1 … Sun=7; JS getDay() is Sun=0
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon-based offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // Events that fall in this month (by start date)
  const monthEvents = allEvents.filter(ev => {
    const s = eventStart(ev);
    return s.getFullYear() === year && s.getMonth() === month;
  });

  // Build a map: day-of-month → [events]
  const dayMap = {};
  monthEvents.forEach(ev => {
    const d = eventStart(ev).getDate();
    (dayMap[d] = dayMap[d] || []).push(ev);
  });

  // Empty cells before the 1st
  for (let i = 0; i < firstDow; i++) {
    const cell = document.createElement('div');
    cell.className = 'month-day empty';
    grid.appendChild(cell);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const cell    = document.createElement('div');
    const thisDay = new Date(year, month, d);
    const events  = dayMap[d] || [];

    cell.className = 'month-day';
    if (sameDay(thisDay, today)) cell.classList.add('today');
    if (events.length) cell.classList.add('has-event');

    cell.innerHTML = `<span>${d}</span>${events.length ? '<div class="event-dot"></div>' : ''}`;

    if (events.length) {
      cell.addEventListener('click', () => showDayDetail(thisDay, events, cell));
    }
    grid.appendChild(cell);
  }
}

function showDayDetail(day, events, cell) {
  // Deselect previous
  document.querySelectorAll('.month-day.selected').forEach(c => c.classList.remove('selected'));
  cell.classList.add('selected');

  const detail = document.getElementById('monthDetail');
  const dTitle = document.getElementById('monthDetailDate');
  const dList  = document.getElementById('monthDetailList');

  dTitle.textContent = day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  dList.innerHTML = events.map(ev => `
    <li>
      <div class="det-name">${escHtml(ev.summary || 'Event')}</div>
      <div class="det-time">${formatTime(ev)}</div>
      ${ev.description ? `<div class="det-desc">${escHtml(ev.description)}</div>` : ''}
    </li>`).join('');

  detail.hidden = false;
}

/* ── Tabs ────────────────────────────────────────────────── */
function setupCalTabs() {
  document.querySelectorAll('.cal-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      document.querySelectorAll('.cal-tab').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      document.getElementById('view-upcoming').hidden = view !== 'upcoming';
      document.getElementById('view-month').hidden    = view !== 'month';
    });
  });
}

/* ── Month nav ───────────────────────────────────────────── */
function setupMonthNav() {
  document.getElementById('prevMonth').addEventListener('click', () => {
    monthCursor.setMonth(monthCursor.getMonth() - 1);
    document.getElementById('monthDetail').hidden = true;
    renderMonth();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    monthCursor.setMonth(monthCursor.getMonth() + 1);
    document.getElementById('monthDetail').hidden = true;
    renderMonth();
  });
}

/* ── Utility ─────────────────────────────────────────────── */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
