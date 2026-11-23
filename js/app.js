/* ==========================================================================
   RishtaOS · app.js
   Frontend-only. All state persisted to localStorage.
   ========================================================================== */

const STORAGE_KEY = 'rishtaos.v1';
const ONBOARD_KEY = 'rishtaos.onboarded';

const DEFAULT_STATE = {
  profile: {
    name: '',
    partnerName: '',
    birthday: '',
    reminders: true,
    darkMode: false,
  },
  relationship: {
    startDate: '',
    startTime: '',
  },
  specialDates: [],
  notes: [],
  cycles: [],
  periodSettings: {
    cycleLength: 28,
    periodLength: 5,
  },
};

const CATEGORY_META = {
  anniversary: { icon: 'fa-heart', label: 'Anniversary', bg: 'var(--brand-soft)', color: 'var(--brand)' },
  birthday: { icon: 'fa-cake-candles', label: 'Birthday', bg: 'var(--primary-dim)', color: 'var(--primary-ink)' },
  date: { icon: 'fa-utensils', label: 'Date Plan', bg: 'var(--accent-info-soft)', color: 'var(--accent-info)' },
  festival: { icon: 'fa-star', label: 'Festival', bg: 'var(--primary-dim)', color: 'var(--primary-ink)' },
  other: { icon: 'fa-calendar', label: 'Other', bg: 'var(--surface-sunken)', color: 'var(--ink-muted)' },
};

const MICROCOPY = {
  heroFooter: [
    "Relationship uptime looking healthy.",
    "Support mode: ON.",
    "Calendar ne yaad rakha. Tum bhi rakhna.",
    "Boss, system's running smooth.",
  ],
  todayStatus: "Today",
  tomorrowStatus: "Tomorrow",
  pastStatus: "Already survived this one",
};

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed,
      profile: { ...DEFAULT_STATE.profile, ...(parsed.profile || {}) },
      relationship: { ...DEFAULT_STATE.relationship, ...(parsed.relationship || {}) },
      periodSettings: { ...DEFAULT_STATE.periodSettings, ...(parsed.periodSettings || {}) },
    };
  } catch (e) {
    console.error('RishtaOS: failed to load state', e);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('RishtaOS: failed to save state', e);
    showToast('Could not save, storage might be full.', 'error');
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
const MAX_VISIBLE_TOASTS = 2;

function showToast(msg, type = 'success') {
  const stack = document.getElementById('toastStack');

  // Avoid piling up duplicate/near-duplicate toasts (e.g. double-taps) and cap visible count.
  const existing = Array.from(stack.children);
  if (existing.some(t => t.dataset.msg === msg && !t.classList.contains('leaving'))) return;
  while (stack.children.length >= MAX_VISIBLE_TOASTS) {
    dismissToast(stack.firstElementChild);
  }

  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  el.dataset.msg = msg;
  const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
  el.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(msg)}</span>`;
  stack.appendChild(el);
  el._timer = setTimeout(() => dismissToast(el), 2800);
}

function dismissToast(el) {
  if (!el || el.classList.contains('leaving')) return;
  clearTimeout(el._timer);
  el.classList.add('leaving');
  setTimeout(() => el.remove(), 200);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------------------------------------------------------------------------
// Sheets / modals
// ---------------------------------------------------------------------------
function openSheet(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeSheet(btn.dataset.close));
});
document.querySelectorAll('.sheet-overlay').forEach(ov => {
  ov.addEventListener('click', (e) => { if (e.target === ov) closeSheet(ov.id); });
});

let confirmResolve = null;
function askConfirm(title, msg) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg;
    document.getElementById('confirmOverlay').classList.add('open');
  });
}
document.getElementById('confirmCancel').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.remove('open');
  if (confirmResolve) confirmResolve(false);
});
document.getElementById('confirmOk').addEventListener('click', () => {
  document.getElementById('confirmOverlay').classList.remove('open');
  if (confirmResolve) confirmResolve(true);
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
function switchScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hide'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.remove('hide');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.screen === name);
  });
  // "dates" maps onto home nav highlight-less state; keep as separate screen
  window.scrollTo(0, 0);
  currentScreen = name;
  renderCurrentScreen();
  updateFabVisibility();
}

// FAB is only relevant on screens where "quick add a date" makes sense front-and-center.
// On Period/Profile it has no job to do and only covers content, so hide it there.
function updateFabVisibility() {
  const fab = document.getElementById('fabAdd');
  if (!fab) return;
  const showOn = ['home', 'dates'];
  fab.classList.toggle('fab-hidden', !showOn.includes(currentScreen));
}
let currentScreen = 'home';

document.querySelectorAll('.nav-item[data-screen]').forEach(btn => {
  btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
});

function renderCurrentScreen() {
  if (currentScreen === 'home') renderHome();
  else if (currentScreen === 'dates') renderAllDates();
  else if (currentScreen === 'period') renderPeriod();
  else if (currentScreen === 'profile') renderProfile();
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function pad(n) { return String(n).padStart(2, '0'); }

function getStartDateTime() {
  const { startDate, startTime } = state.relationship;
  if (!startDate) return null;
  return new Date(`${startDate}T${startTime || '00:00'}:00`);
}

function diffBreakdown(from, to) {
  let totalMs = to - from;
  if (totalMs < 0) totalMs = 0;
  const totalSeconds = Math.floor(totalMs / 1000);

  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  let hours = to.getHours() - from.getHours();
  let minutes = to.getMinutes() - from.getMinutes();
  let seconds = to.getSeconds() - from.getSeconds();

  if (seconds < 0) { seconds += 60; minutes--; }
  if (minutes < 0) { minutes += 60; hours--; }
  if (hours < 0) { hours += 24; days--; }
  if (days < 0) {
    const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0);
    days += prevMonth.getDate();
    months--;
  }
  if (months < 0) { months += 12; years--; }

  const totalDays = Math.floor(totalMs / 86400000);
  return { years, months, days, hours, minutes, seconds, totalDays, totalSeconds };
}

function formatDateHuman(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr, timeStr) {
  const now = new Date();
  const target = new Date(`${dateStr}T${timeStr || '00:00'}:00`);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((startOfTarget - startOfToday) / 86400000);
}

function nextOccurrence(dateStr) {
  // For yearly-recurring feel on birthdays/anniversaries shown on dashboard,
  // but we keep stored date literal; this just finds the next upcoming instance.
  const now = new Date();
  let target = new Date(dateStr + 'T00:00:00');
  const thisYear = new Date(now.getFullYear(), target.getMonth(), target.getDate());
  if (thisYear < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return new Date(now.getFullYear() + 1, target.getMonth(), target.getDate());
  }
  return thisYear;
}

function statusForDays(d) {
  if (d < 0) return { label: MICROCOPY.pastStatus, cls: 'status-past' };
  if (d === 0) return { label: MICROCOPY.todayStatus, cls: 'status-today' };
  if (d === 1) return { label: MICROCOPY.tomorrowStatus, cls: 'status-tomorrow' };
  if (d <= 7) return { label: `${d} days left`, cls: 'status-soon' };
  return { label: `${d} days left`, cls: 'status-later' };
}

// ---------------------------------------------------------------------------
// HOME RENDER
// ---------------------------------------------------------------------------
let uptimeInterval = null;

function renderGreeting() {
  const hour = new Date().getHours();
  let g = 'Good evening';
  if (hour < 12) g = 'Good morning';
  else if (hour < 17) g = 'Good afternoon';
  const name = state.profile.name || 'there';
  document.getElementById('greetingText').textContent = `${g}, ${name}`;
  const subs = [
    "Support mode: ON.",
    "No more 'date kya thi?' moments.",
    "Let's see what's on the radar.",
  ];
  document.getElementById('subGreeting').textContent = subs[Math.floor(Math.random() * subs.length)];
}

function renderHero() {
  const wrap = document.getElementById('heroSection');
  const start = getStartDateTime();

  if (!start) {
    wrap.innerHTML = `
      <div class="hero-uptime">
        <div class="hero-eyebrow"><i class="fa-solid fa-heart-pulse"></i> RELATIONSHIP UPTIME</div>
        <div class="no-start-date">
          <div class="big-icon"><i class="fa-solid fa-heart-circle-plus"></i></div>
          <p>Set your relationship start date to boot up the uptime counter.</p>
          <button class="btn btn-saffron" id="setStartDateBtn"><i class="fa-solid fa-calendar-plus"></i> Set start date</button>
        </div>
      </div>`;
    document.getElementById('setStartDateBtn').addEventListener('click', () => openStartDateSheet());
    return;
  }

  const now = new Date();
  const b = diffBreakdown(start, now);
  const footerMsg = MICROCOPY.heroFooter[Math.floor(Math.random() * MICROCOPY.heroFooter.length)];
  const partnerLine = state.profile.partnerName
    ? `You & <strong>${escapeHtml(state.profile.partnerName)}</strong> · since ${formatDateHuman(state.relationship.startDate)}`
    : `Since ${formatDateHuman(state.relationship.startDate)}`;

  wrap.innerHTML = `
    <div class="hero-uptime">
      <div class="hero-eyebrow"><i class="fa-solid fa-heart-pulse"></i> RELATIONSHIP UPTIME</div>
      <div class="hero-names">${partnerLine}</div>
      <div class="uptime-grid">
        <div class="uptime-unit"><div class="num" id="upYears">${b.years}</div><div class="lbl">Years</div></div>
        <div class="uptime-unit"><div class="num" id="upMonths">${b.months}</div><div class="lbl">Months</div></div>
        <div class="uptime-unit"><div class="num" id="upDays">${b.days}</div><div class="lbl">Days</div></div>
        <div class="uptime-unit"><div class="num" id="upTotalDays">${b.totalDays}</div><div class="lbl">Total days</div></div>
      </div>
      <div class="uptime-sub-grid">
        <div class="uptime-sub"><div class="num" id="upHours">${pad(b.hours)}</div><div class="lbl">Hrs</div></div>
        <div class="uptime-sub"><div class="num" id="upMinutes">${pad(b.minutes)}</div><div class="lbl">Min</div></div>
        <div class="uptime-sub"><div class="num" id="upSeconds">${pad(b.seconds)}</div><div class="lbl">Sec</div></div>
      </div>
      <div class="hero-footer">
        <div class="hero-microcopy">${footerMsg}</div>
        <button class="hero-edit-btn" id="editUptimeBtn"><i class="fa-solid fa-pen"></i> Edit</button>
      </div>
    </div>`;

  document.getElementById('editUptimeBtn').addEventListener('click', () => openStartDateSheet());

  if (uptimeInterval) clearInterval(uptimeInterval);
  uptimeInterval = setInterval(() => {
    if (currentScreen !== 'home') return;
    const s = getStartDateTime();
    if (!s) return;
    const nb = diffBreakdown(s, new Date());
    const yEl = document.getElementById('upYears');
    if (!yEl) return;
    yEl.textContent = nb.years;
    document.getElementById('upMonths').textContent = nb.months;
    document.getElementById('upDays').textContent = nb.days;
    document.getElementById('upTotalDays').textContent = nb.totalDays;
    document.getElementById('upHours').textContent = pad(nb.hours);
    document.getElementById('upMinutes').textContent = pad(nb.minutes);
    document.getElementById('upSeconds').textContent = pad(nb.seconds);
  }, 1000);
}

function openStartDateSheet() {
  document.getElementById('startDateInput').value = state.relationship.startDate || '';
  document.getElementById('startTimeInput').value = state.relationship.startTime || '';
  openSheet('sheetStartDate');
}

document.getElementById('saveStartDateBtn').addEventListener('click', () => {
  const d = document.getElementById('startDateInput').value;
  if (!d) { showToast('Pick a date first.', 'error'); return; }
  state.relationship.startDate = d;
  state.relationship.startTime = document.getElementById('startTimeInput').value;
  saveState();
  closeSheet('sheetStartDate');
  showToast('Relationship uptime is live.');
  renderHero();
  renderProfile();
});

function getUpcomingDates(limit = null) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const items = state.specialDates.map(sd => {
    const d = daysUntil(sd.date, sd.time);
    return { ...sd, daysLeft: d };
  });
  items.sort((a, b) => {
    // upcoming/today first ascending, then past items last
    const aPast = a.daysLeft < 0, bPast = b.daysLeft < 0;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return a.daysLeft - b.daysLeft;
  });
  return limit ? items.slice(0, limit) : items;
}

function dateChipHtml(sd) {
  const meta = CATEGORY_META[sd.category] || CATEGORY_META.other;
  const status = statusForDays(sd.daysLeft);
  return `
    <div class="date-chip-card" data-id="${sd.id}">
      <div class="cat-icon" style="background:${meta.bg};color:${meta.color};"><i class="fa-solid ${meta.icon}"></i></div>
      <div class="dc-title">${escapeHtml(sd.title)}</div>
      <div class="dc-date">${formatDateHuman(sd.date)}</div>
      <span class="status-pill ${status.cls}">${status.label}</span>
    </div>`;
}

function renderComingUp() {
  const wrap = document.getElementById('comingUpWrap');
  const upcoming = getUpcomingDates().filter(d => d.daysLeft >= 0).slice(0, 8);
  if (upcoming.length === 0) {
    wrap.innerHTML = `
      <div class="card empty-state empty-state-compact">
        <div class="es-icon"><i class="fa-solid fa-calendar-plus"></i></div>
        <h4>Nothing on the radar yet</h4>
        <p>Add her birthday, your anniversary, or an upcoming date plan, we'll keep count.</p>
        <button class="btn btn-coral btn-inline" id="emptyAddDateBtn">Add a date</button>
      </div>`;
    const btn = document.getElementById('emptyAddDateBtn');
    if (btn) btn.addEventListener('click', () => openAddDateSheet());
    return;
  }
  wrap.innerHTML = `<div class="coming-up-scroll">${upcoming.map(dateChipHtml).join('')}</div>`;
}

function renderHealth() {
  const wrap = document.getElementById('healthSection');
  const start = getStartDateTime();
  if (!start) { wrap.innerHTML = ''; return; }
  const totalDays = Math.floor((new Date() - start) / 86400000);
  // Playful organisational indicator only — explicitly not a psychological/medical assessment.
  const pct = Math.min(95, 55 + Math.min(40, Math.floor(totalDays / 20)));
  wrap.innerHTML = `
    <div class="section-head"><h2 class="section-title">System status</h2></div>
    <div class="card">
      <div class="health-row">
        <div class="health-track"><div class="health-fill" style="width:${pct}%;"></div></div>
        <span class="running-smooth">Running smooth</span>
      </div>
      <div class="health-note"><i class="fa-solid fa-circle-info"></i><span>Just a fun way to track your own consistency, not an assessment of your relationship.</span></div>
    </div>`;
}

function renderNotes() {
  const wrap = document.getElementById('notesWrap');
  if (state.notes.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state empty-state-inline">
        <div class="es-icon"><i class="fa-solid fa-note-sticky"></i></div>
        <h4>No notes yet</h4>
        <p>Jot down things she mentions, favourite food, a hint, anything.</p>
      </div>`;
    return;
  }
  const recent = [...state.notes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  wrap.innerHTML = recent.map(n => `
    <div class="note-item" data-id="${n.id}">
      <i class="fa-solid fa-note-sticky"></i>
      <div class="ni-text">${escapeHtml(n.text)}<div class="ni-date">${new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div>
      <button class="ni-del icon-btn" aria-label="Delete note"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join('');
  wrap.querySelectorAll('.ni-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.note-item').dataset.id;
      const ok = await askConfirm('Delete this note?', 'This note will be removed permanently.');
      if (!ok) return;
      state.notes = state.notes.filter(n => n.id !== id);
      saveState();
      renderNotes();
      showToast('Note deleted.');
    });
  });
}

function renderHome() {
  renderGreeting();
  renderHero();
  renderComingUp();
  renderHealth();
  renderNotes();
}

// ---------------------------------------------------------------------------
// ALL DATES SCREEN
// ---------------------------------------------------------------------------
function renderAllDates() {
  const wrap = document.getElementById('allDatesWrap');
  const items = getUpcomingDates();
  if (items.length === 0) {
    wrap.innerHTML = `
      <div class="card empty-state">
        <div class="es-icon"><i class="fa-solid fa-calendar-check"></i></div>
        <h4>No special dates yet</h4>
        <p>Birthdays, anniversaries, date plans, add the ones worth remembering.</p>
        <button class="btn btn-coral btn-inline" id="emptyAddDateBtn2">Add a date</button>
      </div>`;
    document.getElementById('emptyAddDateBtn2').addEventListener('click', () => openAddDateSheet());
    return;
  }
  wrap.innerHTML = items.map(sd => {
    const meta = CATEGORY_META[sd.category] || CATEGORY_META.other;
    const status = statusForDays(sd.daysLeft);
    return `
      <div class="card date-list-row" data-id="${sd.id}">
        <div class="cat-icon" style="background:${meta.bg};color:${meta.color};"><i class="fa-solid ${meta.icon}"></i></div>
        <div class="dlr-body">
          <div class="dlr-title">${escapeHtml(sd.title)}</div>
          <div class="dlr-meta">${formatDateHuman(sd.date)}${sd.note ? ' · ' + escapeHtml(sd.note.slice(0, 40)) + (sd.note.length > 40 ? '…' : '') : ''}</div>
          <span class="status-pill ${status.cls}">${status.label}</span>
        </div>
        <button class="chi-del icon-btn" aria-label="Delete" data-del="${sd.id}"><i class="fa-solid fa-trash-can"></i></button>
      </div>`;
  }).join('');
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      const sd = state.specialDates.find(s => s.id === id);
      const ok = await askConfirm('Delete this date?', `"${sd ? sd.title : 'This date'}" will be removed permanently.`);
      if (!ok) return;
      state.specialDates = state.specialDates.filter(s => s.id !== id);
      saveState();
      renderAllDates();
      renderComingUp();
      showToast('Date removed.');
    });
  });
}

// ---------------------------------------------------------------------------
// Add Date sheet
// ---------------------------------------------------------------------------
let selectedCategory = 'anniversary';
let selectedReminder = 'none';

function openAddDateSheet() {
  document.getElementById('addDateHeading').textContent = 'Add special date';
  document.getElementById('sdTitle').value = '';
  document.getElementById('sdDate').value = '';
  document.getElementById('sdTime').value = '';
  document.getElementById('sdNote').value = '';
  selectedCategory = 'anniversary';
  selectedReminder = 'none';
  syncCategoryChips();
  syncReminderChips();
  clearFieldErrors('sheetAddDate');
  openSheet('sheetAddDate');
}

function syncCategoryChips() {
  document.querySelectorAll('#sdCategoryChips .chip-opt').forEach(c => {
    c.classList.toggle('selected', c.dataset.cat === selectedCategory);
  });
}
function syncReminderChips() {
  document.querySelectorAll('#sdReminderChips .chip-opt').forEach(c => {
    c.classList.toggle('selected', c.dataset.rem === selectedReminder);
  });
}
document.querySelectorAll('#sdCategoryChips .chip-opt').forEach(c => {
  c.addEventListener('click', () => { selectedCategory = c.dataset.cat; syncCategoryChips(); });
});
document.querySelectorAll('#sdReminderChips .chip-opt').forEach(c => {
  c.addEventListener('click', () => { selectedReminder = c.dataset.rem; syncReminderChips(); });
});

function clearFieldErrors(sheetId) {
  document.getElementById(sheetId).querySelectorAll('.field').forEach(f => f.classList.remove('has-error'));
}

document.getElementById('saveDateBtn').addEventListener('click', () => {
  const title = document.getElementById('sdTitle').value.trim();
  const date = document.getElementById('sdDate').value;
  let valid = true;
  clearFieldErrors('sheetAddDate');
  if (!title) { document.getElementById('sdTitle').closest('.field').classList.add('has-error'); valid = false; }
  if (!date) { document.getElementById('sdDate').closest('.field').classList.add('has-error'); valid = false; }
  if (!valid) return;

  state.specialDates.push({
    id: uid(),
    title,
    date,
    time: document.getElementById('sdTime').value,
    category: selectedCategory,
    note: document.getElementById('sdNote').value.trim(),
    reminder: selectedReminder,
    createdAt: Date.now(),
  });
  saveState();
  closeSheet('sheetAddDate');
  showToast('Bro, this one is worth remembering. Saved.');
  renderComingUp();
  if (currentScreen === 'dates') renderAllDates();
});

// ---------------------------------------------------------------------------
// Add Note sheet
// ---------------------------------------------------------------------------
function openAddNoteSheet() {
  document.getElementById('noteText').value = '';
  clearFieldErrors('sheetAddNote');
  openSheet('sheetAddNote');
}
document.getElementById('saveNoteBtn').addEventListener('click', () => {
  const text = document.getElementById('noteText').value.trim();
  clearFieldErrors('sheetAddNote');
  if (!text) { document.getElementById('noteText').closest('.field').classList.add('has-error'); return; }
  state.notes.push({ id: uid(), text, createdAt: Date.now() });
  saveState();
  closeSheet('sheetAddNote');
  showToast('Noted. Literally.');
  renderNotes();
});

// ---------------------------------------------------------------------------
// Quick action wiring
// ---------------------------------------------------------------------------
document.getElementById('qaAddDate').addEventListener('click', openAddDateSheet);
document.getElementById('addDateBtn2').addEventListener('click', openAddDateSheet);
document.getElementById('qaAddNote').addEventListener('click', openAddNoteSheet);
document.getElementById('qaAddNote2').addEventListener('click', openAddNoteSheet);
document.getElementById('qaPeriod').addEventListener('click', () => switchScreen('period'));
document.getElementById('qaProfile').addEventListener('click', () => switchScreen('profile'));
document.getElementById('seeAllDates').addEventListener('click', () => switchScreen('dates'));
document.getElementById('fabAdd').addEventListener('click', openAddDateSheet);

// ---------------------------------------------------------------------------
// PERIOD TRACKER
//
// Data model (state.cycles[]):
//   { id, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD'|null,
//     status: 'confirmed' | 'predicted', confirmedAt?: timestamp }
//
// state.periodSettings: { cycleLength: number, periodLength: number }
//
// Rules:
// - Only 'confirmed' entries are real history; they are never auto-deleted
//   or silently overwritten.
// - 'predicted' entries are regenerated from scratch every time we render/
//   recalc: based off the most recent confirmed start date, cycleLength and
//   periodLength, projecting PREDICT_AHEAD future cycles.
// - Predictions recalc automatically whenever a confirmed date changes or
//   cycle settings change.
// - A predicted entry can be "confirmed" by editing it (dates can be
//   adjusted) which converts it into real history and regenerates the
//   predictions after it.
// - Duplicate confirmed start dates are rejected.
// ---------------------------------------------------------------------------
const PREDICT_AHEAD = 3; // how many future predicted cycles to keep generated at any time
const AVG_CYCLE_FALLBACK = 28;
const DEFAULT_PERIOD_LENGTH = 5;

function ensurePeriodSettings() {
  if (!state.periodSettings || typeof state.periodSettings !== 'object') {
    state.periodSettings = { cycleLength: AVG_CYCLE_FALLBACK, periodLength: DEFAULT_PERIOD_LENGTH };
  }
  if (!state.periodSettings.cycleLength) state.periodSettings.cycleLength = AVG_CYCLE_FALLBACK;
  if (!state.periodSettings.periodLength) state.periodSettings.periodLength = DEFAULT_PERIOD_LENGTH;
  return state.periodSettings;
}

// One-time migration from the old { id, date } shape (pre-2.1) to the new
// { id, startDate, endDate, status } shape. Preserves every existing entry
// as confirmed history, loses no data.
function migrateCycleData() {
  if (!Array.isArray(state.cycles)) { state.cycles = []; return; }
  let changed = false;
  state.cycles = state.cycles.map(c => {
    if (c && typeof c === 'object' && !c.status && c.date) {
      changed = true;
      return { id: c.id || uid(), startDate: c.date, endDate: null, status: 'confirmed', confirmedAt: c.confirmedAt || Date.now() };
    }
    return c;
  }).filter(Boolean);
  ensurePeriodSettings();
  if (changed) saveState();
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

function getConfirmedCycles() {
  return state.cycles
    .filter(c => c.status === 'confirmed')
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

function getAvgCycleLength() {
  const confirmed = getConfirmedCycles();
  if (confirmed.length < 2) return ensurePeriodSettings().cycleLength;
  let total = 0, count = 0;
  for (let i = 1; i < confirmed.length; i++) {
    const diff = daysBetween(confirmed[i - 1].startDate, confirmed[i].startDate);
    if (diff > 10 && diff < 60) { total += diff; count++; }
  }
  return count > 0 ? Math.round(total / count) : ensurePeriodSettings().cycleLength;
}

// Regenerates the 'predicted' entries from the latest confirmed cycle.
// Confirmed entries are never touched by this function.
function recalcPredictedCycles() {
  ensurePeriodSettings();
  const confirmed = getConfirmedCycles();
  // Drop all existing predictions; they're always derived, never hand-authored.
  state.cycles = state.cycles.filter(c => c.status !== 'predicted');

  if (confirmed.length === 0) { saveState(); return; }

  const { cycleLength, periodLength } = state.periodSettings;
  const avgLen = getAvgCycleLength();
  const last = confirmed[confirmed.length - 1];
  const confirmedStarts = new Set(confirmed.map(c => c.startDate));

  let cursorStart = addDays(last.startDate, avgLen || cycleLength);
  for (let i = 0; i < PREDICT_AHEAD; i++) {
    if (!confirmedStarts.has(cursorStart)) {
      state.cycles.push({
        id: uid(),
        startDate: cursorStart,
        endDate: addDays(cursorStart, Math.max(0, periodLength - 1)),
        status: 'predicted',
      });
    }
    cursorStart = addDays(cursorStart, cycleLength);
  }
  saveState();
}

function renderPeriod() {
  ensurePeriodSettings();
  recalcPredictedCycles();

  const all = [...state.cycles].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const confirmed = getConfirmedCycles();
  const statusWrap = document.getElementById('ptStatusWrap');
  const weekWrap = document.getElementById('ptWeekWrap');
  const monthWrap = document.getElementById('ptMonthWrap');
  const historyWrap = document.getElementById('cycleHistoryWrap');
  const settingsWrap = document.getElementById('ptSettingsWrap');

  renderCycleSettingsCard(settingsWrap);

  if (confirmed.length === 0) {
    statusWrap.innerHTML = `
      <div class="card empty-state">
        <div class="es-icon"><i class="fa-solid fa-calendar-days"></i></div>
        <h4>No cycle data yet</h4>
        <p>Log your first confirmed period start date to begin automatic predictions. It's private and stays on this device.</p>
        <button class="btn btn-primary btn-inline" id="emptyAddCycleBtn">Log a date</button>
      </div>`;
    document.getElementById('emptyAddCycleBtn').addEventListener('click', () => openAddCycleSheet());
    weekWrap.innerHTML = `<p class="muted-note">Nothing to show yet.</p>`;
    monthWrap.innerHTML = `<div class="stat-box"><div class="sb-num">${state.periodSettings.cycleLength}</div><div class="sb-lbl">Cycle length (days)</div></div><div class="stat-box"><div class="sb-num">0</div><div class="sb-lbl">Confirmed logs</div></div>`;
    historyWrap.innerHTML = `<p class="muted-note u-pad-note">No history logged.</p>`;
    return;
  }

  const avgLen = getAvgCycleLength();
  const { periodLength } = state.periodSettings;
  const last = confirmed[confirmed.length - 1];
  const lastStart = new Date(last.startDate + 'T00:00:00');
  const nextEstimateStart = addDays(last.startDate, avgLen);
  const nextEstimateEnd = addDays(nextEstimateStart, Math.max(0, periodLength - 1));
  const now = new Date();
  const dayInCycle = Math.floor((now - lastStart) / 86400000) + 1;
  const daysToNext = Math.ceil((new Date(nextEstimateStart + 'T00:00:00') - now) / 86400000);

  // Single source of truth for cycle phase — everything below (headline, progress bar,
  // and the "This week" copy) derives from this one value so the messaging can never
  // contradict itself across cards.
  const APPROACHING_DAYS = 3; // "heads up" window before the next estimated start

  let phase, phaseLabel, headline, weekCopy;
  if (dayInCycle >= 1 && dayInCycle <= periodLength) {
    phase = 'in-window';
    phaseLabel = 'Confirmed: Period window';
    headline = `Day ${dayInCycle} of the current period`;
    weekCopy = "Currently in the confirmed period window. A little extra patience and comfort go a long way.";
  } else if (daysToNext <= APPROACHING_DAYS) {
    phase = 'approaching';
    phaseLabel = 'Predicted: Period approaching';
    headline = daysToNext > 0 ? `Next window in ~${daysToNext} day${daysToNext === 1 ? '' : 's'}` : 'Expected window now';
    weekCopy = "Getting closer to the predicted window, might be worth keeping her favourite snack handy.";
  } else {
    phase = 'mid-cycle';
    phaseLabel = 'Predicted: Mid-cycle';
    headline = `Next window in ~${daysToNext} days`;
    weekCopy = "No major changes expected this week based on current predictions.";
  }

  const progressPct = Math.min(100, Math.max(0, Math.round((dayInCycle / avgLen) * 100)));

  statusWrap.innerHTML = `
    <div class="pt-status-card">
      <div class="pt-phase">${phaseLabel}</div>
      <div class="pt-big">${headline}</div>
      <div class="pt-progress-track" role="img" aria-label="Cycle day ${dayInCycle} of ${avgLen}">
        <div class="pt-progress-fill" style="width:${progressPct}%;"></div>
        <div class="pt-progress-period-band" style="width:${Math.min(100, Math.round((periodLength / avgLen) * 100))}%;"></div>
      </div>
      <div class="pt-meta-row">
        <span>Day ${Math.max(1, dayInCycle)} of ~${avgLen}</span>
        <span>Predicted next: ${formatDateHuman(nextEstimateStart)}–${formatDateHuman(nextEstimateEnd)}</span>
      </div>
    </div>
    <div class="pt-log-row">
      <button class="btn btn-ghost btn-sm" id="addCycleBtn2"><i class="fa-solid fa-plus"></i> Log new period</button>
    </div>`;
  document.getElementById('addCycleBtn2').addEventListener('click', () => openAddCycleSheet());

  weekWrap.innerHTML = `<p class="week-copy">${weekCopy}</p>`;

  monthWrap.innerHTML = `
    <div class="stat-box"><div class="sb-num">${avgLen}</div><div class="sb-lbl">Avg cycle (days)</div></div>
    <div class="stat-box"><div class="sb-num">${confirmed.length}</div><div class="sb-lbl">Confirmed logs</div></div>`;

  historyWrap.innerHTML = all.slice(0, 10).map((c) => {
    const isPredicted = c.status === 'predicted';
    const dateLabel = c.endDate && c.endDate !== c.startDate
      ? `${formatDateHuman(c.startDate)} – ${formatDateHuman(c.endDate)}`
      : formatDateHuman(c.startDate);
    return `
      <button class="cycle-history-item" data-id="${c.id}" data-status="${c.status}">
        <div class="chi-left">
          <div class="chi-icon ${isPredicted ? 'chi-icon-predicted' : 'chi-icon-confirmed'}"><i class="fa-solid ${isPredicted ? 'fa-wand-magic-sparkles' : 'fa-circle-check'}"></i></div>
          <div>
            <div class="chi-date">${dateLabel}</div>
            <div class="chi-len">${isPredicted ? 'Predicted' : 'Confirmed'}</div>
          </div>
        </div>
        <i class="fa-solid fa-chevron-right lr-chev"></i>
      </button>`;
  }).join('');

  historyWrap.querySelectorAll('.cycle-history-item').forEach(row => {
    row.addEventListener('click', () => {
      const cycle = state.cycles.find(c => c.id === row.dataset.id);
      if (cycle) openAddCycleSheet(cycle);
    });
  });
}

function renderCycleSettingsCard(wrap) {
  if (!wrap) return;
  const { cycleLength, periodLength } = ensurePeriodSettings();
  wrap.innerHTML = `
    <div class="stat-pair">
      <div class="stat-box"><div class="sb-num">${cycleLength}</div><div class="sb-lbl">Cycle length (days)</div></div>
      <div class="stat-box"><div class="sb-num">${periodLength}</div><div class="sb-lbl">Period duration (days)</div></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Add / edit cycle sheet — handles both logging a brand-new entry and
// editing/confirming an existing confirmed or predicted entry.
// ---------------------------------------------------------------------------
let editingCycleId = null;

function openAddCycleSheet(existing) {
  editingCycleId = existing ? existing.id : null;
  clearFieldErrors('sheetAddCycle');

  const heading = document.getElementById('cycleSheetHeading');
  const hint = document.getElementById('cycleSheetHint');
  const deleteBtn = document.getElementById('deleteCycleBtn');
  const statusChips = document.getElementById('cycleStatusChips');

  if (existing) {
    heading.textContent = existing.status === 'predicted' ? 'Confirm predicted period' : 'Edit period log';
    hint.textContent = existing.status === 'predicted'
      ? 'This is an automatic prediction. Adjust the dates if needed and confirm it once the period actually starts, that turns it into real history and recalculates future predictions.'
      : 'Editing a confirmed entry recalculates all predicted cycles that follow it.';
    document.getElementById('cycleDateInput').value = existing.startDate;
    document.getElementById('cycleEndDateInput').value = existing.endDate || '';
    deleteBtn.classList.remove('hide-el');
    setCycleStatusChip(existing.status);
  } else {
    heading.textContent = 'Log period';
    hint.textContent = 'Logging a confirmed period helps RishtaOS predict the next window more accurately. Future cycles are generated automatically from your cycle settings.';
    document.getElementById('cycleDateInput').value = '';
    document.getElementById('cycleEndDateInput').value = '';
    deleteBtn.classList.add('hide-el');
    setCycleStatusChip('confirmed');
  }

  openSheet('sheetAddCycle');
}

function setCycleStatusChip(status) {
  document.querySelectorAll('#cycleStatusChips .chip-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.status === status);
  });
}

document.getElementById('cycleStatusChips').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip-opt');
  if (!btn) return;
  setCycleStatusChip(btn.dataset.status);
});

document.getElementById('addCycleBtn').addEventListener('click', () => openAddCycleSheet());

document.getElementById('saveCycleBtn').addEventListener('click', () => {
  clearFieldErrors('sheetAddCycle');
  const startDate = document.getElementById('cycleDateInput').value;
  const endDateRaw = document.getElementById('cycleEndDateInput').value;
  const selectedChip = document.querySelector('#cycleStatusChips .chip-opt.selected');
  const status = selectedChip ? selectedChip.dataset.status : 'confirmed';

  if (!startDate) {
    document.getElementById('cycleDateInput').closest('.field').classList.add('has-error');
    return;
  }
  if (endDateRaw && daysBetween(startDate, endDateRaw) < 0) {
    document.getElementById('cycleEndDateInput').closest('.field').classList.add('has-error');
    return;
  }
  const endDate = endDateRaw || null;

  // Duplicate prevention: no two CONFIRMED entries may share a start date.
  if (status === 'confirmed') {
    const dupe = state.cycles.find(c => c.status === 'confirmed' && c.startDate === startDate && c.id !== editingCycleId);
    if (dupe) {
      document.getElementById('cycleDateInput').closest('.field').classList.add('has-error');
      document.getElementById('cycleDateInput').closest('.field').querySelector('.field-error').textContent = 'A confirmed period already starts on this date.';
      return;
    }
  }

  if (editingCycleId) {
    const idx = state.cycles.findIndex(c => c.id === editingCycleId);
    if (idx !== -1) {
      const wasPredicted = state.cycles[idx].status === 'predicted';
      state.cycles[idx] = {
        ...state.cycles[idx],
        startDate, endDate, status,
        confirmedAt: status === 'confirmed' ? (state.cycles[idx].confirmedAt || Date.now()) : null,
      };
      showToast(status === 'confirmed' && wasPredicted ? 'Confirmed. Future cycles recalculated.' : 'Entry updated.');
    }
  } else {
    state.cycles.push({ id: uid(), startDate, endDate, status, confirmedAt: status === 'confirmed' ? Date.now() : null });
    showToast(status === 'confirmed' ? 'Logged. Thanks for staying on top of this.' : 'Prediction saved.');
  }

  saveState();
  closeSheet('sheetAddCycle');
  renderPeriod();
});

document.getElementById('deleteCycleBtn').addEventListener('click', async () => {
  if (!editingCycleId) return;
  const ok = await askConfirm('Delete this entry?', 'This cycle log will be removed. Future predictions will be recalculated.');
  if (!ok) return;
  state.cycles = state.cycles.filter(c => c.id !== editingCycleId);
  saveState();
  closeSheet('sheetAddCycle');
  renderPeriod();
  showToast('Entry removed.');
});

// ---------------------------------------------------------------------------
// Cycle settings sheet
// ---------------------------------------------------------------------------
document.getElementById('editCycleSettingsBtn').addEventListener('click', () => {
  ensurePeriodSettings();
  clearFieldErrors('sheetCycleSettings');
  document.getElementById('cycleLengthInput').value = state.periodSettings.cycleLength;
  document.getElementById('periodLengthInput').value = state.periodSettings.periodLength;
  openSheet('sheetCycleSettings');
});

document.getElementById('saveCycleSettingsBtn').addEventListener('click', () => {
  clearFieldErrors('sheetCycleSettings');
  const cycleLength = parseInt(document.getElementById('cycleLengthInput').value, 10);
  const periodLength = parseInt(document.getElementById('periodLengthInput').value, 10);

  let hasError = false;
  if (!Number.isFinite(cycleLength) || cycleLength < 15 || cycleLength > 60) {
    document.getElementById('cycleLengthInput').closest('.field').classList.add('has-error');
    hasError = true;
  }
  if (!Number.isFinite(periodLength) || periodLength < 1 || periodLength > 15) {
    document.getElementById('periodLengthInput').closest('.field').classList.add('has-error');
    hasError = true;
  }
  if (hasError) return;

  ensurePeriodSettings();
  state.periodSettings.cycleLength = cycleLength;
  state.periodSettings.periodLength = periodLength;
  saveState();
  closeSheet('sheetCycleSettings');
  renderPeriod();
  showToast('Cycle settings saved. Predictions recalculated.');
});

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------
function renderProfile() {
  const name = state.profile.name || 'Your Name';
  document.getElementById('profileAvatar').textContent = name.trim().charAt(0).toUpperCase() || 'R';
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileCoupleSub').textContent = state.profile.partnerName
    ? `& ${state.profile.partnerName}`
    : "Add your partner's name in settings";
  document.getElementById('startDateSub').textContent = state.relationship.startDate
    ? formatDateHuman(state.relationship.startDate)
    : 'Not set';
  document.getElementById('remindersToggle').checked = !!state.profile.reminders;
  document.getElementById('darkModeToggle').checked = !!state.profile.darkMode;
  updateInstallStatusUI();
}

document.getElementById('editProfileBtn').addEventListener('click', () => {
  document.getElementById('profNameInput').value = state.profile.name;
  document.getElementById('profPartnerInput').value = state.profile.partnerName;
  document.getElementById('profBirthdayInput').value = state.profile.birthday;
  clearFieldErrors('sheetEditProfile');
  openSheet('sheetEditProfile');
});
document.getElementById('saveProfileBtn').addEventListener('click', () => {
  const name = document.getElementById('profNameInput').value.trim();
  clearFieldErrors('sheetEditProfile');
  if (!name) { document.getElementById('profNameInput').closest('.field').classList.add('has-error'); return; }
  state.profile.name = name;
  state.profile.partnerName = document.getElementById('profPartnerInput').value.trim();
  const bday = document.getElementById('profBirthdayInput').value;
  if (bday && bday !== state.profile.birthday) {
    // Auto-add as special date if not already present
    const exists = state.specialDates.some(sd => sd.title.toLowerCase().includes('birthday') && sd.date === bday);
    if (!exists) {
      state.specialDates.push({
        id: uid(), title: `${state.profile.partnerName || 'Her'}'s Birthday`, date: bday, time: '',
        category: 'birthday', note: '', reminder: '3day', createdAt: Date.now(),
      });
    }
  }
  state.profile.birthday = bday;
  saveState();
  closeSheet('sheetEditProfile');
  showToast('Profile updated.');
  renderProfile();
  renderGreeting();
  renderComingUp();
});

document.getElementById('editStartDateBtn').addEventListener('click', () => openStartDateSheet());

document.getElementById('remindersToggle').addEventListener('change', (e) => {
  state.profile.reminders = e.target.checked;
  saveState();
  if (e.target.checked) requestNotificationPermission();
});
document.getElementById('darkModeToggle').addEventListener('change', (e) => {
  state.profile.darkMode = e.target.checked;
  applyTheme();
  saveState();
});

function applyTheme() {
  const isDark = !!state.profile.darkMode;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', '#571F09');
  renderBgPattern(isDark);
}

// ---------------------------------------------------------------------------
// Decorative background pattern
// A subtle, randomly-scattered mix of relationship-themed icons (heart,
// calendar, gift, note, star, etc.) in low opacity, WhatsApp-wallpaper
// style: varied icons, sizes, rotations and positions, never one repeated
// glyph. Same icon pool in both themes; only the color token changes.
// Purely decorative, sits behind all content (aria-hidden, pointer-events:none).
// Regenerated once per theme change so the scatter stays fresh but stable
// for the duration of a session (not re-randomized on every re-render call
// elsewhere in the app, since this is only invoked from applyTheme()).
// ---------------------------------------------------------------------------
const BG_PATTERN_ICONS = [
  'fa-heart', 'fa-calendar-days', 'fa-gift', 'fa-note-sticky',
  'fa-star', 'fa-calendar-check', 'fa-cake-candles', 'fa-comments',
  'fa-gear', 'fa-bell', 'fa-mug-hot', 'fa-camera', 'fa-music',
  'fa-umbrella', 'fa-cloud', 'fa-leaf',
];
const BG_PATTERN_COUNT = 64;

function renderBgPattern(isDark) {
  const wrap = document.getElementById('bgPattern');
  if (!wrap) return;
  let html = '';
  for (let i = 0; i < BG_PATTERN_COUNT; i++) {
    const icon = BG_PATTERN_ICONS[Math.floor(Math.random() * BG_PATTERN_ICONS.length)];
    const px = (Math.random() * 100).toFixed(2);
    const py = (Math.random() * 100).toFixed(2);
    const size = (14 + Math.random() * 20).toFixed(0); // 14px–34px
    const rot = (Math.random() * 40 - 20).toFixed(1); // -20deg..20deg
    const opacity = (0.35 + Math.random() * 0.65).toFixed(2); // varied faintness
    html += `<i class="fa-solid ${icon}" style="--px:${px}%;--py:${py}%;--ps:${size}px;--pr:${rot}deg;--po:${opacity};"></i>`;
  }
  wrap.innerHTML = html;
}

// About
document.getElementById('aboutBtn').addEventListener('click', () => openSheet('sheetAbout'));

// Export
document.getElementById('exportDataBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rishtaos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded.');
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
let pendingImportData = null;
let pendingImportFileName = '';

function isValidRishtaBackup(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.profile || typeof obj.profile !== 'object') return false;
  if (!obj.relationship || typeof obj.relationship !== 'object') return false;
  if (!Array.isArray(obj.specialDates)) return false;
  if (!Array.isArray(obj.notes)) return false;
  if (!Array.isArray(obj.cycles)) return false;
  return true;
}

function resetImportSheetUI() {
  pendingImportData = null;
  pendingImportFileName = '';
  document.getElementById('importFileChipWrap').innerHTML = '';
  document.getElementById('importSummaryWrap').innerHTML = '';
  document.getElementById('importConfirmBtn').disabled = true;
  document.getElementById('importFileInput').value = '';
  document.getElementById('importDropZone').classList.remove('hide');
}

document.getElementById('importDataBtn').addEventListener('click', () => {
  resetImportSheetUI();
  openSheet('sheetImportData');
});

document.getElementById('importFileInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  handleImportFile(file);
});

function handleImportFile(file) {
  pendingImportFileName = file.name;
  const chipWrap = document.getElementById('importFileChipWrap');
  const summaryWrap = document.getElementById('importSummaryWrap');
  const confirmBtn = document.getElementById('importConfirmBtn');

  chipWrap.innerHTML = `
    <div class="import-file-chip">
      <i class="fa-solid fa-file-code"></i>
      <span>${escapeHtml(file.name)}</span>
      <button id="importFileClear" aria-label="Remove file"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  document.getElementById('importFileClear').addEventListener('click', resetImportSheetUI);

  if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
    summaryWrap.innerHTML = `<div class="import-summary" style="background:var(--accent-danger-soft);color:var(--accent-danger);"><i class="fa-solid fa-circle-exclamation"></i> This doesn't look like a .json file. Please choose a RishtaOS backup file.</div>`;
    confirmBtn.disabled = true;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!isValidRishtaBackup(parsed)) {
        summaryWrap.innerHTML = `<div class="import-summary" style="background:var(--accent-danger-soft);color:var(--accent-danger);"><i class="fa-solid fa-circle-exclamation"></i> This file doesn't match the RishtaOS backup format, so it can't be imported safely.</div>`;
        confirmBtn.disabled = true;
        pendingImportData = null;
        return;
      }
      pendingImportData = parsed;
      const nameLine = parsed.profile.name ? `Profile for <strong>${escapeHtml(parsed.profile.name)}</strong>` : 'Profile (no name set)';
      summaryWrap.innerHTML = `
        <div class="import-summary">
          <i class="fa-solid fa-circle-check"></i> Valid RishtaOS backup found.
          <ul>
            <li><span>${nameLine}</span></li>
            <li><span>Special dates</span><span>${parsed.specialDates.length}</span></li>
            <li><span>Quick notes</span><span>${parsed.notes.length}</span></li>
            <li><span>Cycle logs</span><span>${parsed.cycles.length}</span></li>
          </ul>
        </div>`;
      confirmBtn.disabled = false;
    } catch (err) {
      summaryWrap.innerHTML = `<div class="import-summary" style="background:var(--accent-danger-soft);color:var(--accent-danger);"><i class="fa-solid fa-circle-exclamation"></i> This file couldn't be read as valid JSON. It may be corrupted.</div>`;
      confirmBtn.disabled = true;
      pendingImportData = null;
    }
  };
  reader.onerror = () => {
    summaryWrap.innerHTML = `<div class="import-summary" style="background:var(--accent-danger-soft);color:var(--accent-danger);"><i class="fa-solid fa-circle-exclamation"></i> Could not read this file. Please try again.</div>`;
    confirmBtn.disabled = true;
  };
  reader.readAsText(file);
}

// Drag & drop support on the drop zone
const importDropZone = document.getElementById('importDropZone');
['dragenter', 'dragover'].forEach(evt => {
  importDropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    importDropZone.classList.add('drag-over');
  });
});
['dragleave', 'drop'].forEach(evt => {
  importDropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    importDropZone.classList.remove('drag-over');
  });
});
importDropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) handleImportFile(file);
});

document.getElementById('importConfirmBtn').addEventListener('click', async () => {
  if (!pendingImportData) return;
  const ok = await askConfirm(
    'Replace current data?',
    `Importing "${pendingImportFileName}" will overwrite your current profile, dates, notes, and cycle history on this device. This cannot be undone.`
  );
  if (!ok) return;
  try {
    state = {
      ...structuredClone(DEFAULT_STATE),
      ...pendingImportData,
      profile: { ...DEFAULT_STATE.profile, ...(pendingImportData.profile || {}) },
      relationship: { ...DEFAULT_STATE.relationship, ...(pendingImportData.relationship || {}) },
      periodSettings: { ...DEFAULT_STATE.periodSettings, ...(pendingImportData.periodSettings || {}) },
    };
    migrateCycleData();
    saveState();
    closeSheet('sheetImportData');
    resetImportSheetUI();
    applyTheme();
    renderCurrentScreen();
    renderProfile();
    showToast('Backup imported successfully.');
  } catch (err) {
    console.error('RishtaOS: import failed', err);
    showToast('Something went wrong while importing. Nothing was changed.', 'error');
  }
});

// Reset
document.getElementById('resetDataBtn').addEventListener('click', async () => {
  const ok = await askConfirm('Reset all data?', 'This will permanently erase your profile, dates, notes, and cycle history from this device. This cannot be undone.');
  if (!ok) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(DEFAULT_STATE);
  saveState();
  showToast('All data reset.');
  applyTheme();
  switchScreen('home');
  renderProfile();
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Browser notifications are not supported here.', 'error');
    state.profile.reminders = false;
    document.getElementById('remindersToggle').checked = false;
    saveState();
    return;
  }
  Notification.requestPermission().then(perm => {
    if (perm !== 'granted') {
      showToast('Notifications permission not granted.', 'error');
      state.profile.reminders = false;
      document.getElementById('remindersToggle').checked = false;
      saveState();
    } else {
      showToast('Reminders enabled.');
    }
  });
}

document.getElementById('notifBtn').addEventListener('click', () => {
  const upcoming = getUpcomingDates().filter(d => d.daysLeft >= 0 && d.daysLeft <= 7);
  if (upcoming.length === 0) {
    showToast('No reminders due this week.');
  } else {
    showToast(`${upcoming.length} date${upcoming.length > 1 ? 's' : ''} coming up this week.`);
  }
});

// ---------------------------------------------------------------------------
// PWA Install
// ---------------------------------------------------------------------------
let deferredPrompt = null;
let isInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isInstalled && !sessionStorage.getItem('installBannerDismissed')) {
    document.getElementById('installBanner').classList.remove('hide');
  }
  updateInstallStatusUI();
});

window.addEventListener('appinstalled', () => {
  isInstalled = true;
  deferredPrompt = null;
  document.getElementById('installBanner').classList.add('hide');
  updateInstallStatusUI();
  showToast('RishtaOS installed. Welcome home.');
});

function updateInstallStatusUI() {
  const statusText = document.getElementById('installStatusText');
  if (!statusText) return;
  if (isInstalled) {
    statusText.textContent = 'Already installed';
  } else if (deferredPrompt) {
    statusText.textContent = 'Available, tap to install';
  } else {
    statusText.textContent = 'Use your browser menu, then "Add to Home Screen"';
  }
}

async function triggerInstall() {
  if (isInstalled) { showToast("You're already running RishtaOS as an app."); return; }
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('installBanner').classList.add('hide');
    if (choice.outcome !== 'accepted') showToast('Install dismissed.');
  } else {
    const ua = navigator.userAgent;
    let msg = 'Open your browser menu and choose "Add to Home Screen" or "Install app".';
    if (/iPhone|iPad|iPod/.test(ua)) {
      msg = 'On iPhone: tap the Share icon, then "Add to Home Screen".';
    }
    showToast(msg);
  }
}
document.getElementById('installBtn').addEventListener('click', triggerInstall);
document.getElementById('installProfileBtn').addEventListener('click', triggerInstall);
document.getElementById('installDismiss').addEventListener('click', () => {
  document.getElementById('installBanner').classList.add('hide');
  sessionStorage.setItem('installBannerDismissed', '1');
});

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
let obIndex = 0;
const obSlideCount = 3;

function initOnboarding() {
  const dotsWrap = document.getElementById('obDots');
  dotsWrap.innerHTML = Array.from({ length: obSlideCount }).map((_, i) =>
    `<div class="ob-dot ${i === 0 ? 'active' : ''}"></div>`).join('');
  updateObSlidePosition();
}
function updateObSlidePosition() {
  document.getElementById('obSlides').style.transform = '';
  document.querySelectorAll('.ob-slide').forEach((s, i) => {
    s.style.transform = `translateX(${(i - obIndex) * 100}%)`;
    s.style.position = i === obIndex ? 'relative' : 'absolute';
    s.style.opacity = i === obIndex ? '1' : '0';
  });
  document.querySelectorAll('.ob-dot').forEach((d, i) => d.classList.toggle('active', i === obIndex));
  document.getElementById('obNext').textContent = obIndex === obSlideCount - 1 ? "Let's go" : 'Continue';
}
document.getElementById('obNext').addEventListener('click', () => {
  if (obIndex < obSlideCount - 1) { obIndex++; updateObSlidePosition(); }
  else completeOnboarding();
});
document.getElementById('obSkip').addEventListener('click', completeOnboarding);

function completeOnboarding() {
  localStorage.setItem(ONBOARD_KEY, '1');
  document.getElementById('onboarding').classList.add('hide');
  document.getElementById('app').classList.remove('hide');
  document.getElementById('bottomNav').classList.remove('hide');
  document.getElementById('fabAdd').classList.remove('hide');
  renderHome();
  updateFabVisibility();
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  migrateCycleData();
  applyTheme();

  setTimeout(() => {
    document.getElementById('splash').classList.add('hide');
    const onboarded = localStorage.getItem(ONBOARD_KEY);
    if (!onboarded) {
      document.getElementById('onboarding').classList.remove('hide');
      initOnboarding();
    } else {
      document.getElementById('app').classList.remove('hide');
      document.getElementById('bottomNav').classList.remove('hide');
      document.getElementById('fabAdd').classList.remove('hide');
      renderHome();
      updateFabVisibility();
    }
  }, 900);

  // Register service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.warn('RishtaOS: service worker registration failed', err);
      });
    });
  }
}

boot();
