
// ---------------------------------------------------------------------------
// Custom themed date / time pickers
//
// Replaces the browser's native date/time popups with in-brand brown/cream
// calendar and time-wheel panels, consistent with the rest of RishtaOS's UI.
//
// How it works: each `input[type=date]` / `input[type=time]` in a sheet is
// converted into a hidden native input (still the real source of truth —
// every existing `.value` read/write in the rest of app.js keeps working
// untouched) plus a visible styled "trigger" button that opens a themed
// picker overlay. Selecting a value in the picker writes back to the
// native input and fires a real `change` event, so all existing listeners
// (validation, field-error clearing, etc.) keep working exactly as before.
// ---------------------------------------------------------------------------
(function () {
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatDateDisplay(value) {
    if (!value) return '';
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatTimeDisplay(value) {
    if (!value) return '';
    const [h, m] = value.split(':').map(Number);
    if (Number.isNaN(h)) return '';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${pad2(m)} ${h < 12 ? 'AM' : 'PM'}`;
  }

  function fireChange(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // -------------------------------------------------------------------------
  // Date picker (calendar)
  // -------------------------------------------------------------------------
  function buildDatePanel(input, overlay) {
    const existing = input.value ? new Date(input.value + 'T00:00:00') : null;
    let viewYear = (existing || new Date()).getFullYear();
    let viewMonth = (existing || new Date()).getMonth();
    let selected = input.value || null;

    const min = input.min ? new Date(input.min + 'T00:00:00') : null;
    const max = input.max ? new Date(input.max + 'T00:00:00') : null;

    const panel = document.createElement('div');
    panel.className = 'dt-panel';

    function render() {
      const firstOfMonth = new Date(viewYear, viewMonth, 1);
      const startOffset = firstOfMonth.getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
      const todayStr = new Date().toISOString().slice(0, 10);

      let cells = '';
      for (let i = 0; i < startOffset; i++) {
        const day = daysInPrevMonth - startOffset + 1 + i;
        cells += `<div class="dtc-day dtc-muted">${day}</div>`;
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(viewYear, viewMonth, day);
        const cellStr = `${cellDate.getFullYear()}-${pad2(cellDate.getMonth() + 1)}-${pad2(day)}`;
        let cls = 'dtc-day';
        if (cellStr === todayStr) cls += ' dtc-today';
        if (cellStr === selected) cls += ' dtc-selected';
        if ((min && cellDate < min) || (max && cellDate > max)) cls += ' dtc-disabled';
        cells += `<div class="${cls}" data-date="${cellStr}">${day}</div>`;
      }
      const totalCells = startOffset + daysInMonth;
      const trailing = (7 - (totalCells % 7)) % 7;
      for (let day = 1; day <= trailing; day++) {
        cells += `<div class="dtc-day dtc-muted">${day}</div>`;
      }

      panel.innerHTML = `
        <div class="dt-panel-head">
          <h4>Select date</h4>
          <button class="dt-panel-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="dtc-nav">
          <button class="dtc-nav-btn" type="button" data-nav="-1" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
          <span class="dtc-month-label">${MONTH_NAMES[viewMonth]} ${viewYear}</span>
          <button class="dtc-nav-btn" type="button" data-nav="1" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="dtc-weekdays">${WEEKDAY_LABELS.map(w => `<span>${w}</span>`).join('')}</div>
        <div class="dtc-grid">${cells}</div>
        <div class="dtc-footer">
          <button class="btn btn-ghost" type="button" data-action="today">Today</button>
          <button class="btn btn-primary" type="button" data-action="done">Done</button>
        </div>`;

      panel.querySelector('.dt-panel-close').addEventListener('click', () => closeOverlay(overlay));
      panel.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
          viewMonth += parseInt(btn.dataset.nav, 10);
          if (viewMonth < 0) { viewMonth = 11; viewYear--; }
          if (viewMonth > 11) { viewMonth = 0; viewYear++; }
          render();
        });
      });
      panel.querySelectorAll('.dtc-day[data-date]').forEach(cell => {
        cell.addEventListener('click', () => {
          selected = cell.dataset.date;
          input.value = selected;
          fireChange(input);
          render();
        });
      });
      panel.querySelector('[data-action="today"]').addEventListener('click', () => {
        const now = new Date();
        viewYear = now.getFullYear();
        viewMonth = now.getMonth();
        selected = now.toISOString().slice(0, 10);
        input.value = selected;
        fireChange(input);
        render();
      });
      panel.querySelector('[data-action="done"]').addEventListener('click', () => closeOverlay(overlay));
    }

    render();
    return panel;
  }

  // -------------------------------------------------------------------------
  // Time picker (scrollable hour/minute wheels + AM/PM)
  // -------------------------------------------------------------------------
  function buildTimePanel(input, overlay) {
    let h24 = 9, m = 0;
    if (input.value) {
      const parts = input.value.split(':').map(Number);
      if (!Number.isNaN(parts[0])) h24 = parts[0];
      if (!Number.isNaN(parts[1])) m = parts[1];
    }
    let meridiem = h24 < 12 ? 'AM' : 'PM';
    let hour12 = h24 % 12 === 0 ? 12 : h24 % 12;

    const panel = document.createElement('div');
    panel.className = 'dt-panel';
    panel.innerHTML = `
      <div class="dt-panel-head">
        <h4>Select time</h4>
        <button class="dt-panel-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="dtt-wheel-row">
        <div class="dtt-wheel" id="dttHourWheel">
          <div class="dtt-wheel-pad"></div>
          ${Array.from({ length: 12 }, (_, i) => i + 1).map(v => `<div class="dtt-wheel-item" data-val="${v}">${pad2(v)}</div>`).join('')}
          <div class="dtt-wheel-pad"></div>
        </div>
        <span class="dtt-sep">:</span>
        <div class="dtt-wheel" id="dttMinWheel">
          <div class="dtt-wheel-pad"></div>
          ${Array.from({ length: 60 }, (_, i) => i).map(v => `<div class="dtt-wheel-item" data-val="${v}">${pad2(v)}</div>`).join('')}
          <div class="dtt-wheel-pad"></div>
        </div>
        <div class="dtt-meridiem">
          <button type="button" data-mer="AM">AM</button>
          <button type="button" data-mer="PM">PM</button>
        </div>
      </div>
      <div class="dtt-footer">
        <button class="btn btn-ghost" type="button" data-action="now">Now</button>
        <button class="btn btn-primary" type="button" data-action="done">Done</button>
      </div>`;

    const hourWheel = panel.querySelector('#dttHourWheel');
    const minWheel = panel.querySelector('#dttMinWheel');

    function markActive(wheel, val) {
      wheel.querySelectorAll('.dtt-wheel-item').forEach(item => {
        item.classList.toggle('dtt-active', Number(item.dataset.val) === val);
      });
    }
    function scrollToVal(wheel, val) {
      const item = wheel.querySelector(`.dtt-wheel-item[data-val="${val}"]`);
      if (item) wheel.scrollTop = item.offsetTop - (wheel.clientHeight / 2 - item.clientHeight / 2);
    }
    function updateCommit() {
      let hh = hour12 % 12;
      if (meridiem === 'PM') hh += 12;
      input.value = `${pad2(hh)}:${pad2(m)}`;
      fireChange(input);
    }
    function setMeridiem(val) {
      meridiem = val;
      panel.querySelectorAll('[data-mer]').forEach(btn => btn.classList.toggle('selected', btn.dataset.mer === val));
      updateCommit();
    }

    let hourScrollTimer = null, minScrollTimer = null;
    hourWheel.addEventListener('scroll', () => {
      clearTimeout(hourScrollTimer);
      hourScrollTimer = setTimeout(() => {
        const items = [...hourWheel.querySelectorAll('.dtt-wheel-item')];
        const center = hourWheel.scrollTop + hourWheel.clientHeight / 2;
        let closest = items[0];
        let closestDist = Infinity;
        items.forEach(item => {
          const dist = Math.abs((item.offsetTop + item.clientHeight / 2) - center);
          if (dist < closestDist) { closestDist = dist; closest = item; }
        });
        hour12 = Number(closest.dataset.val);
        markActive(hourWheel, hour12);
        updateCommit();
      }, 90);
    });
    minWheel.addEventListener('scroll', () => {
      clearTimeout(minScrollTimer);
      minScrollTimer = setTimeout(() => {
        const items = [...minWheel.querySelectorAll('.dtt-wheel-item')];
        const center = minWheel.scrollTop + minWheel.clientHeight / 2;
        let closest = items[0];
        let closestDist = Infinity;
        items.forEach(item => {
          const dist = Math.abs((item.offsetTop + item.clientHeight / 2) - center);
          if (dist < closestDist) { closestDist = dist; closest = item; }
        });
        m = Number(closest.dataset.val);
        markActive(minWheel, m);
        updateCommit();
      }, 90);
    });

    panel.querySelector('.dt-panel-close').addEventListener('click', () => closeOverlay(overlay));
    panel.querySelectorAll('[data-mer]').forEach(btn => btn.addEventListener('click', () => setMeridiem(btn.dataset.mer)));
    panel.querySelector('[data-action="now"]').addEventListener('click', () => {
      const now = new Date();
      hour12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
      m = now.getMinutes();
      meridiem = now.getHours() < 12 ? 'AM' : 'PM';
      markActive(hourWheel, hour12);
      markActive(minWheel, m);
      scrollToVal(hourWheel, hour12);
      scrollToVal(minWheel, m);
      panel.querySelectorAll('[data-mer]').forEach(btn => btn.classList.toggle('selected', btn.dataset.mer === meridiem));
      updateCommit();
    });
    panel.querySelector('[data-action="done"]').addEventListener('click', () => closeOverlay(overlay));

    // Initial paint, deferred so offsetTop values are measured after layout.
    requestAnimationFrame(() => {
      markActive(hourWheel, hour12);
      markActive(minWheel, m);
      scrollToVal(hourWheel, hour12);
      scrollToVal(minWheel, m);
      panel.querySelectorAll('[data-mer]').forEach(btn => btn.classList.toggle('selected', btn.dataset.mer === meridiem));
    });

    return panel;
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 260);
  }

  function openPicker(input) {
    const overlay = document.createElement('div');
    overlay.className = 'dt-overlay';
    const panel = input.type === 'time' ? buildTimePanel(input, overlay) : buildDatePanel(input, overlay);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(overlay); });
  }

  // Wraps a native date/time input with a styled trigger button. The input
  // itself stays in the DOM (display:none) as the real value holder so all
  // existing getElementById('...').value reads/writes elsewhere in app.js
  // continue to work with zero changes.
  function enhanceInput(input) {
    if (input.dataset.dtEnhanced) return;
    input.dataset.dtEnhanced = '1';

    const isTime = input.type === 'time';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dt-trigger';
    trigger.innerHTML = `<span class="dt-trigger-value dt-placeholder">${isTime ? 'Select time' : 'Select date'}</span><i class="fa-solid ${isTime ? 'fa-clock' : 'fa-calendar-days'}"></i>`;

    function syncTriggerLabel() {
      const valSpan = trigger.querySelector('.dt-trigger-value');
      const display = isTime ? formatTimeDisplay(input.value) : formatDateDisplay(input.value);
      if (display) {
        valSpan.textContent = display;
        valSpan.classList.remove('dt-placeholder');
      } else {
        valSpan.textContent = isTime ? 'Select time' : 'Select date';
        valSpan.classList.add('dt-placeholder');
      }
    }

    input.style.display = 'none';
    input.setAttribute('tabindex', '-1');
    input.setAttribute('aria-hidden', 'true');
    input.insertAdjacentElement('afterend', trigger);

    trigger.addEventListener('click', () => openPicker(input));
    input.addEventListener('input', syncTriggerLabel);
    input.addEventListener('change', syncTriggerLabel);

    // Mirror has-error state from the sibling .field onto the trigger so the
    // existing validation styling (clearFieldErrors/.has-error) still shows.
    const field = input.closest('.field');
    if (field) {
      const obs = new MutationObserver(() => {
        trigger.classList.toggle('has-error-border', field.classList.contains('has-error'));
      });
      obs.observe(field, { attributes: true, attributeFilter: ['class'] });
    }

    syncTriggerLabel();
  }

  function enhanceAllDateTimeInputs(root = document) {
    root.querySelectorAll('input[type="date"], input[type="time"]').forEach(enhanceInput);
  }

  // Enhance on load, and whenever a sheet opens (covers any inputs that
  // might be added dynamically in the future).
  document.addEventListener('DOMContentLoaded', () => enhanceAllDateTimeInputs());
  if (document.readyState !== 'loading') enhanceAllDateTimeInputs();

  window.RishtaDatePicker = { enhanceAllDateTimeInputs, enhanceInput };
})();
