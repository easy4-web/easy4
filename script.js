'use strict';

/* =========================================================
   Easy4 Disc Golf Club — script.js
   ========================================================= */

/* ── Config ──────────────────────────────────────────────── */
const CAL_ID  = 'c_f3d2623080b0ef7b825ba98532ae9e981600ae66429111ff5032f35dc539dec0@group.calendar.google.com';
const API_KEY = 'AIzaSyDXfsxcLQ7raquqvUxWvdjBTq8uDyrFsmo';
const TZ      = 'Europe/Tallinn';

/* ── i18n ────────────────────────────────────────────────── */
let lang = localStorage.getItem('e4lang') || 'en';

function t(key) {
  return (TRANSLATIONS[lang] && TRANSLATIONS[lang][key] !== undefined)
       ? TRANSLATIONS[lang][key]
       : (TRANSLATIONS.en[key] !== undefined ? TRANSLATIONS.en[key] : key);
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  // Weekday labels
  document.querySelectorAll('[data-i18n-wd]').forEach(el => {
    const idx = parseInt(el.dataset.i18nWd, 10);
    const wds = t('cal.weekdays');
    if (Array.isArray(wds) && wds[idx] !== undefined) el.textContent = wds[idx];
  });
  // Tee number badges
  document.querySelectorAll('[data-tee]').forEach(el => {
    el.textContent = t('sp.tee.prefix') + ' ' + el.dataset.tee;
  });
  document.documentElement.lang = lang === 'et' ? 'et' : 'en';
}

function setLanguage(newLang) {
  lang = newLang;
  localStorage.setItem('e4lang', lang);
  applyTranslations();
  document.querySelectorAll('.lang-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === lang)
  );
  if (calLoaded) {
    renderUpcoming();
    renderMonth();
    document.getElementById('monthDetail').hidden = true;
  }
  if (lbLoaded && lbPodium.length) {
    renderLeaderCard(lbPodium);
    const sheet = SHEETS[lbActive];
    const sub = sheet.subtitle;
    document.getElementById('lbSubtitle').textContent =
      (typeof sub === 'object' ? (sub[lang] || sub.en) : sub);
  }
}

/* ── Page navigation ─────────────────────────────────────── */
const VALID_PAGES = new Set(['home', 'events', 'leaderboards', 'sponsors', 'contact']);
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

  // Apply translations and set initial active lang button
  applyTranslations();
  document.querySelectorAll('.lang-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.lang === lang);
    b.addEventListener('click', () => setLanguage(b.dataset.lang));
  });
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
    twoMonths.setMonth(twoMonths.getMonth() + 1);
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
    status.innerHTML = `<p style="color:rgba(255,255,255,.4)">${t('events.error')}</p>`;
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
const getMonths      = () => t('cal.months');
const getMonthsShort = () => t('cal.months_short');

function eventStart(ev) {
  return ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date + 'T00:00:00');
}
function eventEnd(ev) {
  return ev.end.dateTime ? new Date(ev.end.dateTime) : new Date(ev.end.date + 'T00:00:00');
}
function isAllDay(ev) { return !!ev.start.date && !ev.start.dateTime; }

function formatTime(ev) {
  if (isAllDay(ev)) return t('cal.allday');
  const s = eventStart(ev), e = eventEnd(ev);
  const locale = lang === 'et' ? 'et-EE' : 'en-GB';
  const fmt = d => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: TZ });
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
        <span class="event-date-month">${getMonthsShort()[start.getMonth()]}</span>
      </div>
      <div class="event-info">
        <div class="event-name">${escHtml(ev.summary || 'Event')}</div>
        <div class="event-time">${formatTime(ev)}</div>
        ${ev.location ? `<div class="event-location"><svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.4"/></svg>${escHtml(ev.location)}</div>` : ''}
        ${ev.description ? `<div class="event-desc">${renderDesc(ev.description)}</div>` : ''}
      </div>`;
    list.appendChild(li);
  });
}

/* ── Month view ──────────────────────────────────────────── */
function renderMonth() {
  const label = document.getElementById('monthLabel');
  const grid  = document.getElementById('monthGrid');
  label.textContent = `${getMonths()[monthCursor.getMonth()]} ${monthCursor.getFullYear()}`;
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

  dTitle.textContent = day.toLocaleDateString(lang === 'et' ? 'et-EE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  dList.innerHTML = events.map(ev => `
    <li>
      <div class="det-name">${escHtml(ev.summary || 'Event')}</div>
      <div class="det-time">${formatTime(ev)}</div>
      ${ev.location ? `<div class="det-location"><svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" stroke-width="1.4"/></svg>${escHtml(ev.location)}</div>` : ''}
      ${ev.description ? `<div class="det-desc">${renderDesc(ev.description)}</div>` : ''}
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

/* Convert URLs in plain text to clickable links (safe — escapes HTML first) */
function linkify(str) {
  const urlRe = /(https?:\/\/\S+)/g;
  return str.split(urlRe).map((part, i) => {
    if (i % 2 === 1) {
      const trailMatch = part.match(/[.,!?);]+$/);
      const trail = trailMatch ? trailMatch[0] : '';
      const url   = part.slice(0, part.length - trail.length);
      return `<a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer" class="event-link">${escHtml(url)}</a>${escHtml(trail)}`;
    }
    return escHtml(part).replace(/\n/g, '<br>');
  }).join('');
}

/* Render event description — handles both plain text and HTML from Google Calendar */
function renderDesc(str) {
  if (!/<[a-z]/i.test(str)) return linkify(str); // plain text path
  // HTML path — sanitize then style any links
  const tmp = document.createElement('div');
  tmp.innerHTML = str;
  tmp.querySelectorAll('script,style,iframe,object,embed').forEach(el => el.remove());
  tmp.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('http://') && !href.startsWith('https://')) a.removeAttribute('href');
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.className = 'event-link';
    for (const attr of [...a.attributes]) {
      if (attr.name.startsWith('on')) a.removeAttribute(attr.name);
    }
  });
  return tmp.innerHTML;
}


/* =========================================================
   LEADERBOARDS
   ========================================================= */

/* Add a new entry here when a new competition sheet is ready:
   { label: 'Display Name', subtitle: 'Short description', tab: 'ExactTabName' }
   tab is the sheet tab name exactly as it appears at the bottom of the spreadsheet */
const SHEETS = [
  {
    label:    'Holariäss 2026',
    subtitle: { en: 'Easy4 members who have hit the perfect throw.', et: 'Easy4 liikmed, kes on sooritanud täiusliku viske.' },
    tab:      'HOLARIÄSS2026'
  },
  {
    label:    'Holariässad',
    subtitle: { en: 'All-time Easy4 Holariäss winners — the yearly hole-in-one challenge.', et: 'Easy4 Holariässi ajaloolised võitjad — iga-aastane hole-in-one väljakutse.' },
    tab:      'Holariässad'
  },
  {
    label:    'Klubi meistrid',
    subtitle: { en: 'Easy4 Club Championship winners through the years.', et: 'Easy4 klubi meistrivõistluste võitjad läbi aastate.' },
    tab:      'Klubi meistrid',
    headers:  ['AASTA', 'MEHED', 'NAISED', 'NOORED', 'RAJAD']
  }
];

let lbLoaded  = false;
let lbActive  = 0; // index into SHEETS
let lbPodium  = []; // last rendered podium for re-render on lang switch

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

  document.getElementById('lbLeaderCard').hidden = true;
  document.getElementById('lbTableWrap').innerHTML = '';
  showLbStatus(true);
  loadSheet(index);
}

async function loadSheet(index) {
  const sheet = SHEETS[index];
  const SHEET_ID = '11Mxat9KsjcNWBkfUEDaqzyay8zE6v1Wo';

  // Update heading
  document.getElementById('lbTitle').textContent    = sheet.label;
  const subVal = sheet.subtitle;
  document.getElementById('lbSubtitle').textContent =
    (typeof subVal === 'object' ? (subVal[lang] || subVal.en) : subVal);

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

    // Column headers — only A–H (first 8); use label only so columns
    // with no label (empty string) are correctly treated as headerless
    const allCols = table.cols.slice(0, 8).map(c => c.label);

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

    // Override column headers if the sheet config provides clean names
    if (sheet.headers) {
      cols = cols.map((c, i) => sheet.headers[i] || c);
    }

    // Move "Nodi" column to the end if present
    const nodiIdx = cols.findIndex(c => c.trim().toLowerCase() === 'nodi');
    if (nodiIdx !== -1 && nodiIdx !== cols.length - 1) {
      cols = [...cols.slice(0, nodiIdx), ...cols.slice(nodiIdx + 1), cols[nodiIdx]];
      rows = rows.map(row => [...row.slice(0, nodiIdx), ...row.slice(nodiIdx + 1), row[nodiIdx]]);
    }

    // Calculate top 3 — sum MEETRIT / MEETREID per NIMI, sort descending
    const nimiIdx    = cols.findIndex(c => c.trim().toUpperCase() === 'NIMI');
    const meetritIdx = cols.findIndex(c => ['MEETRIT', 'MEETREID'].includes(c.trim().toUpperCase()));
    let podium = [];
    if (nimiIdx !== -1 && meetritIdx !== -1) {
      const totals = {};
      rows.forEach(row => {
        const name = (row[nimiIdx] || '').trim();
        const dist = parseFloat((row[meetritIdx] || '0').toString().replace(',', '.')) || 0;
        if (name) totals[name] = (totals[name] || 0) + dist;
      });
      // Group by total to handle ties, then take top 3 positions
      const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
      const positions = [];
      let lastTotal = null, lastPos = 0;
      sorted.forEach(([name, total]) => {
        if (total !== lastTotal) { lastPos++; lastTotal = total; }
        if (lastPos <= 3) positions.push({ name, total, pos: lastPos });
      });
      podium = positions;
    }

    lbPodium = podium;
    renderLeaderCard(podium);
    renderTable(cols, rows);
    showLbStatus(false);
  } catch (err) {
    showLbStatus(false);
    document.getElementById('lbTableWrap').innerHTML =
      `<p class="lb-error">${t('lb.error')}</p>`;
  }
}

function renderLeaderCard(podium) {
  const card = document.getElementById('lbLeaderCard');
  if (!podium.length) { card.hidden = true; return; }

  const first  = podium.filter(p => p.pos === 1);
  const second = podium.filter(p => p.pos === 2);
  const third  = podium.filter(p => p.pos === 3);

  const nameStr = names => names.map(p => escHtml(p.name)).join(' &amp; ');

  const runnerUp = [
    ...second.map(p => ({ medal: t('lb.2nd'), ...p })),
    ...third.map(p =>  ({ medal: t('lb.3rd'), ...p }))
  ];

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
        <p class="lb-leader-label">${first.length > 1 ? t('lb.leaders') : t('lb.leader')}</p>
        <p class="lb-leader-name">${nameStr(first)}</p>
        <p class="lb-leader-total">${first[0].total} ${t('lb.m_total')}</p>
        ${runnerUp.length ? `<div class="lb-runner-up">${
          runnerUp.map(p => `<span class="lb-runner-item"><span class="lb-runner-pos">${p.medal}</span>${escHtml(p.name)} &middot; ${p.total} m</span>`).join('')
        }</div>` : ''}
      </div>
    </div>`;
  card.hidden = false;
}

function renderTable(cols, rows) {
  const wrap = document.getElementById('lbTableWrap');

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
