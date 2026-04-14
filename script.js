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
        ${ev.location ? `<div class="event-location"><svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.4"/></svg>${escHtml(ev.location)}</div>` : ''}
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
      ${ev.location ? `<div class="det-location"><svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.4"/></svg>${escHtml(ev.location)}</div>` : ''}
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


/* =========================================================
   LEADERBOARDS
   ========================================================= */

/* Add a new entry here when a new competition sheet is ready:
   { label: 'Display Name', subtitle: 'Short description', tab: 'ExactTabName' }
   tab is the sheet tab name exactly as it appears at the bottom of the spreadsheet */
const SHEETS = [
  { label: 'Holariäss 2026', subtitle: 'Easy4 members who have hit the perfect throw.', tab: 'HOLARIÄSS2026' }
];

let lbLoaded = false;
let lbActive = 0; // index into SHEETS

/* ── Init (lazy, called on first navigation to leaderboards) ── */
function initLeaderboard() {
  if (lbLoaded) return;
  lbLoaded = true;

  const tabBar = document.getElementById('lbTabs');

  // Build tabs — only show bar when there are multiple sheets
  if (SHEETS.length > 1) {
    tabBar.hidden = false;
    SHEETS.forEach((sheet, i) => {
      const btn = document.createElement('button');
      btn.className = 'lb-tab' + (i === 0 ? ' active' : '');
      btn.textContent = sheet.label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(i === 0));
      btn.addEventListener('click', () => switchSheet(i));
      tabBar.appendChild(btn);
    });
  }

  loadSheet(0);
}

function switchSheet(index) {
  if (index === lbActive) return;
  lbActive = index;

  document.querySelectorAll('.lb-tab').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
    btn.setAttribute('aria-selected', String(i === index));
  });

  document.getElementById('lbTableWrap').innerHTML = '';
  showLbStatus(true);
  loadSheet(index);
}

async function loadSheet(index) {
  const sheet = SHEETS[index];
  const SHEET_ID = '11Mxat9KsjcNWBkfUEDaqzyay8zE6v1Wo';

  // Update heading
  document.getElementById('lbTitle').textContent    = sheet.label;
  document.getElementById('lbSubtitle').textContent = sheet.subtitle;

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheet.tab)}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    // Strip the JS wrapper: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
    const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\)\s*;?\s*$/);
    if (!match) throw new Error('Unexpected response format');
    const data  = JSON.parse(match[1]);
    const table = data.table;

    // Column headers — only A–H (first 8)
    const allCols = table.cols.slice(0, 8).map(c => c.label || c.id);

    // Rows — each cell has .v (value) and .f (formatted string), capped at 8 cols
    const allRows = (table.rows || []).map(r =>
      r.c.slice(0, 8).map(cell => (cell ? (cell.f ?? (cell.v !== null ? String(cell.v) : '')) : ''))
    );

    // Drop columns that have no header AND no data in any row
    const keepIdx = allCols
      .map((col, i) => ({ col, i }))
      .filter(({ col, i }) => {
        if (col.trim()) return true; // has a header — keep
        return allRows.some(row => (row[i] ?? '').toString().trim()); // has any data — keep
      })
      .map(({ i }) => i);

    let cols = keepIdx.map(i => allCols[i]);
    let rows = allRows.map(row => keepIdx.map(i => row[i] ?? ''));

    // Move "Nodi" column to the end if present
    const nodiIdx = cols.findIndex(c => c.trim().toLowerCase() === 'nodi');
    if (nodiIdx !== -1 && nodiIdx !== cols.length - 1) {
      cols = [...cols.slice(0, nodiIdx), ...cols.slice(nodiIdx + 1), cols[nodiIdx]];
      rows = rows.map(row => [...row.slice(0, nodiIdx), ...row.slice(nodiIdx + 1), row[nodiIdx]]);
    }

    // Calculate leader(s) — sum MEETRIT per NIMI
    const nimiIdx   = cols.findIndex(c => c.trim().toUpperCase() === 'NIMI');
    const meetritIdx = cols.findIndex(c => c.trim().toUpperCase() === 'MEETRIT');
    let leaders = [];
    if (nimiIdx !== -1 && meetritIdx !== -1) {
      const totals = {};
      rows.forEach(row => {
        const name  = (row[nimiIdx] || '').trim();
        const dist  = parseFloat((row[meetritIdx] || '0').toString().replace(',', '.')) || 0;
        if (name) totals[name] = (totals[name] || 0) + dist;
      });
      const maxTotal = Math.max(...Object.values(totals));
      leaders = Object.entries(totals)
        .filter(([, total]) => total === maxTotal)
        .map(([name, total]) => ({ name, total }));
    }

    renderLeaderCard(leaders);
    renderTable(cols, rows, leaders.map(l => l.name));
    showLbStatus(false);
  } catch (err) {
    showLbStatus(false);
    document.getElementById('lbTableWrap').innerHTML =
      `<p class="lb-error">Could not load leaderboard. Please try again later.</p>`;
  }
}

function renderLeaderCard(leaders) {
  const card = document.getElementById('lbLeaderCard');
  if (!leaders.length) { card.hidden = true; return; }

  const isTie = leaders.length > 1;
  const total = leaders[0].total;
  const names = leaders.map(l => escHtml(l.name)).join(' &amp; ');

  card.innerHTML = `
    <div class="lb-leader-inner">
      <div class="lb-leader-icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 14l6 10 8-16 8 16 6-10v12c0 2-1.5 4-4 4H14c-2.5 0-4-2-4-4V14z" fill="#F7941E" opacity=".15" stroke="#F7941E" stroke-width="2" stroke-linejoin="round"/>
          <path d="M16 40h16M24 30v10" stroke="#F7941E" stroke-width="2" stroke-linecap="round"/>
          <circle cx="10" cy="13" r="3" fill="#F7941E"/>
          <circle cx="38" cy="13" r="3" fill="#F7941E"/>
          <circle cx="24" cy="8"  r="3" fill="#F7941E"/>
        </svg>
      </div>
      <div class="lb-leader-info">
        <p class="lb-leader-label">${isTie ? 'Current Leaders' : 'Current Leader'}</p>
        <p class="lb-leader-name">${names}</p>
        <p class="lb-leader-total">${total} m total</p>
      </div>
    </div>`;
  card.hidden = false;
}

function renderTable(cols, rows, leaderNames = []) {
  const wrap = document.getElementById('lbTableWrap');
  const leaderSet = new Set(leaderNames.map(n => n.trim().toLowerCase()));

  const nimiIdx = cols.findIndex(c => c.trim().toUpperCase() === 'NIMI');

  const table = document.createElement('table');
  table.className = 'lb-table';

  // Header
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr>' + cols.map(c => `<th>${escHtml(String(c))}</th>`).join('') + '</tr>';
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    const name = nimiIdx !== -1 ? (row[nimiIdx] || '').trim().toLowerCase() : '';
    if (leaderSet.has(name)) tr.classList.add('lb-row-leader');
    tr.innerHTML = row.map(cell => `<td>${escHtml(String(cell))}</td>`).join('');
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
}

function showLbStatus(visible) {
  document.getElementById('lbStatus').hidden = !visible;
}

// Hook into navigation
const _origNavigate = navigate;
// Lazy-load leaderboard on first visit
document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', () => {
    if (el.dataset.nav === 'leaderboards') initLeaderboard();
  });
});
window.addEventListener('popstate', e => {
  if ((e.state?.page ?? window.location.hash.replace('#','')) === 'leaderboards') initLeaderboard();
});
// Also handle direct load via hash
(function () {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'leaderboards') setTimeout(initLeaderboard, 0);
})();
