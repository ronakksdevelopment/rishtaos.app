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
};

const CATEGORY_META = {
  anniversary: { icon: 'fa-heart', label: 'Anniversary', bg: 'var(--coral-soft)', color: '#C2574A' },
  birthday: { icon: 'fa-cake-candles', label: 'Birthday', bg: 'var(--saffron-soft)', color: '#AD7418' },
  date: { icon: 'fa-utensils', label: 'Date Plan', bg: 'var(--teal-soft)', color: 'var(--teal-dark)' },
  festival: { icon: 'fa-star', label: 'Festival', bg: 'var(--saffron-soft)', color: '#AD7418' },
  other: { icon: 'fa-calendar', label: 'Other', bg: 'var(--cream-dim)', color: 'var(--ink-muted)' },
};

const MICROCOPY = {
  heroFooter: [
    "Relationship uptime looking healthy.",
    "Support mode: ON.",
    "Calendar ne yaad rakha. Tum bhi rakhna.",
    "Boss, system's running smooth.",
  ],
  todayStatus: "Today 🎉",
  tomorrowStatus: "Tomorrow",
  pastStatus: "Already survived this one 😄",
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
  document.getElementById('greetingText').innerHTML = `${g}, ${escapeHtml(name)} <span class="wave">👋</span>`;
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
        <div class="hero-eyebrow"><span class="pulse-dot"></span> RELATIONSHIP UPTIME</div>
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
      <div class="hero-eyebrow"><span class="pulse-dot"></span> RELATIONSHIP UPTIME</div>
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
  showToast('Relationship uptime is live. 🎉');
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
      <div class="card empty-state" style="padding:28px 16px;">
        <div class="es-icon"><i class="fa-solid fa-calendar-plus"></i></div>
        <h4>Nothing on the radar yet</h4>
        <p>Add her birthday, your anniversary, or an upcoming date plan, we'll keep count.</p>
        <button class="btn btn-coral" id="emptyAddDateBtn" style="width:auto;padding:11px 20px;">Add a date</button>
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
        <span style="font-size:0.78rem;font-weight:700;color:var(--teal-dark);">Running smooth</span>
      </div>
      <div class="health-note"><i class="fa-solid fa-circle-info"></i>&nbsp; Just a fun way to track your own consistency, not an assessment of your relationship.</div>
    </div>`;
}

function renderNotes() {
  const wrap = document.getElementById('notesWrap');
  if (state.notes.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:14px 10px;">
        <div class="es-icon" style="width:48px;height:48px;font-size:1.1rem;"><i class="fa-solid fa-note-sticky"></i></div>
        <h4 style="font-size:0.88rem;">No notes yet</h4>
        <p style="font-size:0.78rem;">Jot down things she mentions, favourite food, a hint, anything.</p>
      </div>`;
    return;
  }
  const recent = [...state.notes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  wrap.innerHTML = recent.map(n => `
    <div class="note-item" data-id="${n.id}">
      <i class="fa-solid fa-note-sticky"></i>
      <div class="ni-text">${escapeHtml(n.text)}<div class="ni-date">${new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div>
      <button class="ni-del" aria-label="Delete note"><i class="fa-solid fa-xmark"></i></button>
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
        <button class="btn btn-coral" id="emptyAddDateBtn2" style="width:auto;padding:11px 20px;">Add a date</button>
      </div>`;
    document.getElementById('emptyAddDateBtn2').addEventListener('click', () => openAddDateSheet());
    return;
  }
  wrap.innerHTML = items.map(sd => {
    const meta = CATEGORY_META[sd.category] || CATEGORY_META.other;
    const status = statusForDays(sd.daysLeft);
    return `
      <div class="card" data-id="${sd.id}" style="margin-bottom:12px;display:flex;align-items:center;gap:13px;">
        <div class="cat-icon" style="background:${meta.bg};color:${meta.color};width:44px;height:44px;flex-shrink:0;"><i class="fa-solid ${meta.icon}"></i></div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:0.92rem;">${escapeHtml(sd.title)}</div>
          <div style="font-size:0.76rem;color:var(--ink-faint);margin:2px 0 6px;">${formatDateHuman(sd.date)}${sd.note ? ' · ' + escapeHtml(sd.note.slice(0, 40)) + (sd.note.length > 40 ? '…' : '') : ''}</div>
          <span class="status-pill ${status.cls}">${status.label}</span>
        </div>
        <button class="chi-del" aria-label="Delete" data-del="${sd.id}" style="background:none;border:none;color:var(--ink-faint);font-size:1rem;width:34px;height:34px;flex-shrink:0;"><i class="fa-solid fa-trash-can"></i></button>
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
// ---------------------------------------------------------------------------
const AVG_CYCLE_FALLBACK = 28;

function getAvgCycleLength() {
  const cycles = [...state.cycles].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (cycles.length < 2) return AVG_CYCLE_FALLBACK;
  let total = 0, count = 0;
  for (let i = 1; i < cycles.length; i++) {
    const diff = (new Date(cycles[i].date) - new Date(cycles[i - 1].date)) / 86400000;
    if (diff > 10 && diff < 60) { total += diff; count++; }
  }
  return count > 0 ? Math.round(total / count) : AVG_CYCLE_FALLBACK;
}

function renderPeriod() {
  const cycles = [...state.cycles].sort((a, b) => new Date(b.date) - new Date(a.date));
  const statusWrap = document.getElementById('ptStatusWrap');
  const weekWrap = document.getElementById('ptWeekWrap');
  const monthWrap = document.getElementById('ptMonthWrap');
  const historyWrap = document.getElementById('cycleHistoryWrap');

  if (cycles.length === 0) {
    statusWrap.innerHTML = `
      <div class="card empty-state">
        <div class="es-icon"><i class="fa-solid fa-calendar-days"></i></div>
        <h4>No cycle data yet</h4>
        <p>Log a start date to begin estimating timelines. It's private and stays on this device.</p>
        <button class="btn btn-primary" id="emptyAddCycleBtn" style="width:auto;padding:11px 20px;">Log a date</button>
      </div>`;
    document.getElementById('emptyAddCycleBtn').addEventListener('click', openAddCycleSheet);
    weekWrap.innerHTML = `<p style="font-size:0.82rem;color:var(--ink-faint);">Nothing to show yet.</p>`;
    monthWrap.innerHTML = `<div class="stat-box"><div class="sb-num">--</div><div class="sb-lbl">Avg cycle</div></div><div class="stat-box"><div class="sb-num">${cycles.length}</div><div class="sb-lbl">Logged entries</div></div>`;
    historyWrap.innerHTML = `<p style="font-size:0.82rem;color:var(--ink-faint);">No history logged.</p>`;
    return;
  }

  const avgLen = getAvgCycleLength();
  const lastStart = new Date(cycles[0].date + 'T00:00:00');
  const nextEstimate = new Date(lastStart.getTime() + avgLen * 86400000);
  const now = new Date();
  const dayInCycle = Math.floor((now - lastStart) / 86400000) + 1;
  const daysToNext = Math.ceil((nextEstimate - now) / 86400000);

  // Single source of truth for cycle phase — everything below (headline, progress bar,
  // and the "This week" copy) derives from this one value so the messaging can never
  // contradict itself across cards.
  const IN_WINDOW_DAYS = 5;      // typical bleed-window length used for the estimate
  const APPROACHING_DAYS = 3;    // "heads up" window before the next estimated start

  let phase, phaseLabel, headline, weekCopy;
  if (dayInCycle <= IN_WINDOW_DAYS) {
    phase = 'in-window';
    phaseLabel = 'Estimated: Period window';
    headline = `Day ${dayInCycle} of the estimated window`;
    weekCopy = "Likely in the estimated period window this week. A little extra patience and comfort go a long way. 🧡";
  } else if (daysToNext <= APPROACHING_DAYS) {
    phase = 'approaching';
    phaseLabel = 'Estimated: Period approaching';
    headline = daysToNext > 0 ? `Next window in ~${daysToNext} day${daysToNext === 1 ? '' : 's'}` : 'Expected window now';
    weekCopy = "Getting closer to the estimated window, might be worth keeping her favourite snack handy.";
  } else {
    phase = 'mid-cycle';
    phaseLabel = 'Estimated: Mid-cycle';
    headline = `Next window in ~${daysToNext} days`;
    weekCopy = "No major changes expected this week based on current estimates.";
  }

  const progressPct = Math.min(100, Math.max(0, Math.round((dayInCycle / avgLen) * 100)));

  statusWrap.innerHTML = `
    <div class="pt-status-card">
      <div class="pt-phase">${phaseLabel}</div>
      <div class="pt-big">${headline}</div>
      <div class="pt-progress-track"><div class="pt-progress-fill" style="width:${progressPct}%;"></div></div>
      <div class="pt-meta-row">
        <span>Day ${dayInCycle} of ~${avgLen}</span>
        <span>Est. next: ${nextEstimate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
      </div>
    </div>
    <div style="margin-top:10px;">
      <button class="btn btn-ghost btn-sm" id="addCycleBtn2"><i class="fa-solid fa-plus"></i> Log new start date</button>
    </div>`;
  document.getElementById('addCycleBtn2').addEventListener('click', openAddCycleSheet);

  weekWrap.innerHTML = `<p style="font-size:0.84rem;line-height:1.6;color:var(--ink-muted);">${weekCopy}</p>`;

  monthWrap.innerHTML = `
    <div class="stat-box"><div class="sb-num">${avgLen}</div><div class="sb-lbl">Avg cycle (days)</div></div>
    <div class="stat-box"><div class="sb-num">${cycles.length}</div><div class="sb-lbl">Logged entries</div></div>`;

  historyWrap.innerHTML = cycles.slice(0, 6).map((c, i) => {
    const prevCycle = cycles[i + 1];
    const len = prevCycle ? Math.round((new Date(c.date) - new Date(prevCycle.date)) / 86400000) : null;
    return `
      <div class="cycle-history-item" data-id="${c.id}">
        <div>
          <div class="chi-date">${formatDateHuman(c.date)}</div>
          ${len ? `<div class="chi-len">${len}-day cycle</div>` : `<div class="chi-len">Most recent</div>`}
        </div>
        <button class="chi-del" data-del="${c.id}" aria-label="Delete entry"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
  }).join('');

  historyWrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await askConfirm('Delete this entry?', 'This cycle log will be removed.');
      if (!ok) return;
      state.cycles = state.cycles.filter(c => c.id !== btn.dataset.del);
      saveState();
      renderPeriod();
      showToast('Entry removed.');
    });
  });
}

function openAddCycleSheet() {
  document.getElementById('cycleDateInput').value = '';
  clearFieldErrors('sheetAddCycle');
  openSheet('sheetAddCycle');
}
document.getElementById('addCycleBtn').addEventListener('click', openAddCycleSheet);
document.getElementById('saveCycleBtn').addEventListener('click', () => {
  const date = document.getElementById('cycleDateInput').value;
  clearFieldErrors('sheetAddCycle');
  if (!date) { document.getElementById('cycleDateInput').closest('.field').classList.add('has-error'); return; }
  state.cycles.push({ id: uid(), date });
  saveState();
  closeSheet('sheetAddCycle');
  showToast('Logged. Thanks for staying on top of this.');
  renderPeriod();
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
  document.documentElement.setAttribute('data-theme', state.profile.darkMode ? 'dark' : 'light');
  document.querySelector('meta[name="theme-color"]').setAttribute('content', state.profile.darkMode ? '#101827' : '#101827');
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
    statusText.textContent = 'Already installed ✓';
  } else if (deferredPrompt) {
    statusText.textContent = 'Available, tap to install';
  } else {
    statusText.textContent = 'Use your browser menu → "Add to Home Screen"';
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
