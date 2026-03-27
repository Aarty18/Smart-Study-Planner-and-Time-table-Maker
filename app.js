/* =============================================
   Smart Study Planner — app.js
   ============================================= */

// ── State ──────────────────────────────────────
var tasks = JSON.parse(localStorage.getItem('sp_tasks') || '[]');
var slots  = JSON.parse(localStorage.getItem('sp_slots') || '[]');
var filt   = 'all';

// ── Constants ──────────────────────────────────
var DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var DAYF  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
var COLS  = [
  '#c84b2f', '#2d6a4f', '#2563ab', '#7c3aed',
  '#d97706', '#be185d', '#0891b2', '#65a30d',
  '#9f1239', '#475569'
];
var selC = COLS[0]; // currently selected colour for new sessions

// ── Initialise ─────────────────────────────────
(function init() {
  // Default task deadline to today
  document.getElementById('tdl').valueAsDate = new Date();

  // Apply saved theme
  var savedTheme = localStorage.getItem('sp_theme') || 'light';
  if (savedTheme === 'dark') applyDark(true);

  // Build day checkboxes
  var dbsEl = document.getElementById('dbs');
  DAYS.forEach(function (d) {
    var inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.className = 'dc';
    inp.id = 'dc_' + d;
    inp.value = d;

    var lbl = document.createElement('label');
    lbl.className = 'dl';
    lbl.htmlFor = 'dc_' + d;
    lbl.textContent = d;

    dbsEl.appendChild(inp);
    dbsEl.appendChild(lbl);
  });
  // Pre-check Mon–Fri
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (d) {
    document.getElementById('dc_' + d).checked = true;
  });

  // Build colour picker
  var crEl = document.getElementById('cr');
  COLS.forEach(function (c) {
    var dot = document.createElement('div');
    dot.className = 'cd' + (c === selC ? ' sel' : '');
    dot.style.background = c;
    dot.onclick = function () {
      selC = c;
      document.querySelectorAll('.cd').forEach(function (x) { x.classList.remove('sel'); });
      dot.classList.add('sel');
    };
    crEl.appendChild(dot);
  });

  // Enter-key shortcuts
  document.getElementById('tn').addEventListener('keydown',  function (e) { if (e.key === 'Enter') addTask(); });
  document.getElementById('ts').addEventListener('keydown',  function (e) { if (e.key === 'Enter') addTask(); });
  document.getElementById('ttn').addEventListener('keydown', function (e) { if (e.key === 'Enter') addSession(); });

  renderTasks();
  renderTimetable();
})();

// =============================================
// TAB SWITCHING
// =============================================
function sw(name, btn) {
  document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('on'); });
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
  document.getElementById('panel-' + name).classList.add('on');
  btn.classList.add('on');
}

// =============================================
// DARK MODE
// =============================================
function applyDark(on) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  document.getElementById('di').textContent = on ? '☀️' : '🌙';
  document.getElementById('dl').textContent = on ? 'Light Mode' : 'Dark Mode';
}
function tgD() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyDark(!isDark);
  localStorage.setItem('sp_theme', isDark ? 'light' : 'dark');
}

// =============================================
// PERSISTENCE
// =============================================
function saveT() { localStorage.setItem('sp_tasks', JSON.stringify(tasks)); }
function saveS() { localStorage.setItem('sp_slots', JSON.stringify(slots)); }

// =============================================
// UTILITY HELPERS
// =============================================
/** Convert "HH:MM" to total minutes */
function toMs(s) {
  var p = s.split(':').map(Number);
  return p[0] * 60 + p[1];
}
/** Convert total minutes to "HH:MM" */
function toHM(m) {
  var h = Math.floor(m / 60);
  var n = m % 60;
  return (h < 10 ? '0' : '') + h + ':' + (n < 10 ? '0' : '') + n;
}
/** Days until a deadline date string (negative = overdue) */
function du(ds) {
  var t = new Date(); t.setHours(0, 0, 0, 0);
  var d = new Date(ds); d.setHours(0, 0, 0, 0);
  return Math.round((d - t) / 86400000);
}
/** Whether a task counts as "urgent" (pending & due within 2 days) */
function isU(t) {
  if (t.completed) return false;
  var d = du(t.deadline);
  return d >= 0 && d <= 2;
}
/** Human-readable deadline label */
function dlL(ds, done) {
  if (done) return fm(ds);
  var d = du(ds);
  if (d < 0) return 'Overdue ' + Math.abs(d) + 'd';
  if (d === 0) return 'Due Today!';
  if (d === 1) return 'Tomorrow';
  if (d === 2) return 'In 2 days';
  return fm(ds);
}
/** CSS class for deadline emphasis */
function dlC(ds, done) {
  if (done) return '';
  var d = du(ds);
  if (d <= 0) return 'tod';
  if (d <= 2) return 'urg';
  return '';
}
/** Format a date string to "dd Mon yyyy" */
function fm(ds) {
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}
/** Escape HTML special chars */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
/** Unique ID */
function uid() {
  return Date.now().toString() + Math.random().toString(36).slice(2, 6);
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================
var _toastTimer;
function sT(msg) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('sh');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { el.classList.remove('sh'); }, 2800);
}

// =============================================
// TASKS — ADD / TOGGLE / DELETE
// =============================================
function addTask() {
  var name  = document.getElementById('tn').value.trim();
  var subj  = document.getElementById('ts').value.trim();
  var dl    = document.getElementById('tdl').value;
  if (!name) { sT('Enter a task name!'); return; }
  if (!subj) { sT('Enter a subject!');   return; }
  if (!dl)   { sT('Pick a deadline!');   return; }

  tasks.unshift({
    id: uid(), name: name, subj: subj,
    deadline: dl, completed: false
  });
  saveT();
  renderTasks();

  document.getElementById('tn').value  = '';
  document.getElementById('ts').value  = '';
  document.getElementById('tdl').valueAsDate = new Date();
  sT('Task added!');
}

function toggleTask(id) {
  var t = tasks.find(function (x) { return x.id === id; });
  if (!t) return;
  t.completed = !t.completed;
  saveT();
  renderTasks();
  sT(t.completed ? '✅ Complete!' : 'Task reopened.');
}

function deleteTask(id) {
  tasks = tasks.filter(function (x) { return x.id !== id; });
  saveT();
  renderTasks();
  sT('Task removed.');
}

// ── Filter ─────────────────────────────────────
function setFilter(f, btn) {
  filt = f;
  document.querySelectorAll('.fb').forEach(function (x) { x.classList.remove('on'); });
  btn.classList.add('on');
  var labels = {
    all: 'All Tasks', pending: 'Pending Tasks',
    completed: 'Completed Tasks', urgent: 'Urgent (within 2 days)'
  };
  document.getElementById('ll').textContent = labels[f];
  renderTasks();
}

function getFiltered() {
  switch (filt) {
    case 'pending':   return tasks.filter(function (t) { return !t.completed; });
    case 'completed': return tasks.filter(function (t) { return t.completed; });
    case 'urgent':    return tasks.filter(function (t) { return isU(t); });
    default:          return tasks;
  }
}

// ── Render ─────────────────────────────────────
function renderTasks() {
  // Update stats
  var tot  = tasks.length;
  var done = tasks.filter(function (t) { return t.completed; }).length;
  var pct  = tot ? Math.round(done / tot * 100) : 0;
  document.getElementById('st').textContent  = tot;
  document.getElementById('sd').textContent  = done;
  document.getElementById('sp').textContent  = tot - done;
  document.getElementById('pct').textContent = pct + '%';
  document.getElementById('pb').style.width  = pct + '%';

  // Smart priority suggestion banner
  var pend = tasks.filter(function (t) { return !t.completed; })
                  .sort(function (a, b) { return new Date(a.deadline) - new Date(b.deadline); });
  var ban = document.getElementById('sgb');
  if (pend.length) {
    var top = pend[0];
    var d   = du(top.deadline);
    var msg = '<strong>' + esc(top.name) + '</strong> (' + esc(top.subj) + ')';
    if      (d < 0) msg += ' — ⚠ Overdue ' + Math.abs(d) + 'd!';
    else if (d === 0) msg += ' — Due today!';
    else if (d === 1) msg += ' — Due tomorrow!';
    else              msg += ' — in ' + d + ' days';
    document.getElementById('sgt').innerHTML = msg;
    ban.classList.remove('hid');
  } else {
    ban.classList.add('hid');
  }

  // Render task cards
  var list = document.getElementById('tl');
  var f    = getFiltered();
  if (!f.length) {
    list.innerHTML = '<div class="emp"><div class="ic">📚</div><p>No tasks here. Add one above!</p></div>';
    return;
  }
  list.innerHTML = f.map(function (t) {
    var u = isU(t);
    return '<div class="tc2 ' + (t.completed ? 'dn ' : '') + (u ? 'urg' : '') + '">' +
      '<div class="ck" onclick="toggleTask(\'' + t.id + '\')">' + (t.completed ? '✓' : '') + '</div>' +
      '<div class="ti">' +
        '<div class="ttl">' + esc(t.name) + '</div>' +
        '<div class="tm">' +
          '<span class="tsj">' + esc(t.subj) + '</span>' +
          '<span class="tdl ' + dlC(t.deadline, t.completed) + '">📅 ' + dlL(t.deadline, t.completed) + '</span>' +
          (u ? '<span class="ub">Urgent</span>' : '') +
        '</div>' +
      '</div>' +
      '<button class="td2" onclick="deleteTask(\'' + t.id + '\')">✕</button>' +
    '</div>';
  }).join('');
}

// =============================================
// TIMETABLE — ADD / DELETE SESSION
// =============================================
function addSession() {
  var name = document.getElementById('ttn').value.trim();
  var st   = document.getElementById('tts').value;
  var en   = document.getElementById('tte').value;
  var days = [].slice.call(document.querySelectorAll('.dc:checked'))
               .map(function (c) { return c.value; });

  if (!name)         { sT('Enter a session name!');       return; }
  if (!st || !en)    { sT('Set start and end time!');     return; }
  if (st >= en)      { sT('End must be after start!');    return; }
  if (!days.length)  { sT('Select at least one day!');   return; }

  slots.push({
    id: uid(), name: name, start: st, end: en,
    days: days, color: selC, autoGen: false
  });
  saveS();
  renderTimetable();

  document.getElementById('ttn').value = '';
  sT('"' + name + '" added!');
}

function deleteSession(id, name, isAuto) {
  if (isAuto) {
    // Remove all auto-generated blocks for this subject name
    slots = slots.filter(function (s) { return !(s.autoGen && s.name === name); });
  } else {
    slots = slots.filter(function (s) { return s.id !== id; });
  }
  saveS();
  renderTimetable();
  sT('Session removed.');
}

function clearTimetable() {
  if (!slots.length) return;
  if (confirm('Clear all timetable sessions?')) {
    slots = [];
    saveS();
    renderTimetable();
    sT('Timetable cleared.');
  }
}

// =============================================
// AUTO-GENERATE SCHEDULE (Smart Algorithm)
// =============================================
/**
 * Distributes study time across Mon–Fri proportionally to
 * task urgency (deadline proximity), with configurable
 * hours/day, break duration, and start time.
 */
function generateSchedule() {
  var pend = tasks.filter(function (t) { return !t.completed; })
                  .sort(function (a, b) { return new Date(a.deadline) - new Date(b.deadline); });
  if (!pend.length) { sT('No pending tasks to schedule!'); return; }

  var hoursPerDay = Math.max(1, parseInt(document.getElementById('tth').value) || 4);
  var dayStart    = document.getElementById('ttds').value || '08:00';
  var breakMin    = Math.max(0, parseInt(document.getElementById('ttb').value) || 10);

  // Remove previously auto-generated slots
  slots = slots.filter(function (s) { return !s.autoGen; });

  // Compute urgency weights (higher weight = more time)
  var weights = pend.map(function (t) {
    var d = du(t.deadline);
    return d <= 0 ? 6 : d <= 1 ? 5 : d <= 3 ? 4 : d <= 7 ? 2 : 1;
  });
  var totalWeight = weights.reduce(function (a, b) { return a + b; }, 0);
  var totalMinutes = hoursPerDay * 60 * 5; // 5 working days

  // Minutes allocated per subject
  var subjectMinutes = {};
  pend.forEach(function (t, i) {
    subjectMinutes[t.subj] = (subjectMinutes[t.subj] || 0) +
      Math.round((weights[i] / totalWeight) * totalMinutes);
  });

  // Assign colours — re-use existing slot colours where possible
  var subjectColors = {};
  slots.forEach(function (s) { subjectColors[s.name] = s.color; });
  Object.keys(subjectMinutes).forEach(function (s, i) {
    if (!subjectColors[s]) subjectColors[s] = COLS[i % COLS.length];
  });

  // Queue sorted by most-needed-first
  var queue = Object.entries(subjectMinutes)
    .sort(function (a, b) { return b[1] - a[1]; });
  var qi = 0;

  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(function (day) {
    var cur = toMs(dayStart);
    var end = cur + hoursPerDay * 60;

    while (cur < end && qi < queue.length) {
      var subj = queue[qi][0];
      var dur  = Math.min(60, end - cur);
      if (dur < 15) { qi++; continue; }

      slots.push({
        id: 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        name: subj,
        start: toHM(cur),
        end: toHM(cur + dur),
        days: [day],
        color: subjectColors[subj] || COLS[qi % COLS.length],
        autoGen: true
      });

      cur += dur + breakMin;
      queue[qi] = [subj, queue[qi][1] - dur];
      if (queue[qi][1] <= 0) qi++;
    }
  });

  saveS();
  renderTimetable();
  sT('✨ Schedule generated for ' + Object.keys(subjectMinutes).length + ' subject' +
     (Object.keys(subjectMinutes).length > 1 ? 's' : '') + '!');
}

// =============================================
// RENDER TIMETABLE
// =============================================
function renderTimetable() {
  var slEl = document.getElementById('sl');
  document.getElementById('sc').textContent = slots.length;

  // ── Session sidebar list ──────────────────────
  if (!slots.length) {
    slEl.innerHTML = '<div class="emp" style="padding:16px 8px"><p>No sessions yet</p></div>';
  } else {
    // Collapse auto-generated slots by subject name for cleaner display
    var shown = [], seen = {};
    slots.forEach(function (s) {
      if (s.autoGen) {
        if (!seen[s.name]) {
          seen[s.name] = true;
          shown.push(Object.assign({}, s, { _merged: true }));
        }
      } else {
        shown.push(s);
      }
    });
    slEl.innerHTML = shown.map(function (s) {
      return '<div class="si">' +
        '<div class="sd" style="background:' + s.color + '"></div>' +
        '<div class="sif">' +
          '<div class="sn">' + esc(s.name) +
            (s.autoGen ? ' <span style="font-size:.56rem;opacity:.55;font-family:\'DM Mono\',monospace">[auto]</span>' : '') +
          '</div>' +
          '<div class="st">' +
            (s.autoGen
              ? s.days.join(', ')
              : s.days.join(', ') + ' · ' + s.start + '–' + s.end) +
          '</div>' +
        '</div>' +
        '<button class="sdl" onclick="deleteSession(\'' + s.id + '\',\'' +
          esc(s.name) + '\',' + (!!s.autoGen) + ')">✕</button>' +
      '</div>';
    }).join('');
  }

  // ── Grid ─────────────────────────────────────
  var gc = document.getElementById('gg');

  if (!slots.length) {
    gc.innerHTML = '<div class="te"><div class="ic">🗓</div>' +
      '<p>Add sessions or auto-generate to see your timetable.</p></div>';
    return;
  }

  // Only show days that have at least one session
  var activeDays = DAYS.filter(function (d) {
    return slots.some(function (s) { return s.days.includes(d); });
  });

  // Determine hour range from session times
  var minMin = 23 * 60, maxMin = 0;
  slots.forEach(function (s) {
    minMin = Math.min(minMin, toMs(s.start));
    maxMin = Math.max(maxMin, toMs(s.end));
  });
  minMin = Math.floor(minMin / 60) * 60;
  maxMin = Math.ceil(maxMin  / 60) * 60;
  var hourSlots = [];
  for (var m = minMin; m < maxMin; m += 60) hourSlots.push(m);

  // Highlight today's column
  var todayIdx  = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
  var todayName = DAYS[todayIdx];

  // Build grid using DOM elements
  var grid = document.createElement('div');
  grid.className = 'gg';
  grid.style.gridTemplateColumns = '58px repeat(' + activeDays.length + ', 1fr)';

  // Header row — Time + day names
  var timeHeader = document.createElement('div');
  timeHeader.className = 'gc th';
  timeHeader.innerHTML = '<span style="font-size:.54rem;opacity:.5">TIME</span>';
  grid.appendChild(timeHeader);

  activeDays.forEach(function (d) {
    var cell = document.createElement('div');
    cell.className = 'gc th' + (d === todayName ? ' tdc' : '');
    cell.innerHTML = DAYF[DAYS.indexOf(d)] +
      (d === todayName
        ? ' <span style="font-size:.5rem;background:var(--ac3);color:#000;' +
          'border-radius:3px;padding:1px 4px">TODAY</span>'
        : '');
    grid.appendChild(cell);
  });

  // Data rows — one per hour
  hourSlots.forEach(function (hm) {
    // Time label cell
    var timeCell = document.createElement('div');
    timeCell.className = 'gc tmc';
    timeCell.textContent = toHM(hm);
    grid.appendChild(timeCell);

    // One cell per active day
    activeDays.forEach(function (d) {
      var cell = document.createElement('div');
      cell.className = 'gc' + (d === todayName ? ' tdc2' : '');
      cell.style.padding = '3px';

      // Sessions that start within this hour slot on this day
      var cellSlots = slots.filter(function (s) {
        return s.days.includes(d) &&
               toMs(s.start) >= hm &&
               toMs(s.start) < hm + 60;
      });

      cellSlots.forEach(function (s) {
        var blk = document.createElement('div');
        blk.className = 'sb';
        blk.style.background = s.color;
        var dur = toMs(s.end) - toMs(s.start);
        blk.innerHTML = esc(s.name) + '<span>' + s.start + '–' + s.end + ' (' + dur + 'm)</span>';
        cell.appendChild(blk);
      });

      grid.appendChild(cell);
    });
  });

  gc.innerHTML = '';
  gc.appendChild(grid);

  // Update week label
  var now = new Date();
  document.getElementById('wl').textContent = 'Week of ' +
    now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
