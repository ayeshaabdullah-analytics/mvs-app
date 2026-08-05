import { useState, useCallback, useMemo } from 'react';
import {
  collection, addDoc, deleteDoc, doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCollection, useAdd, useDelete } from '../hooks/useFirestore';
import '../styles/habits.css';

const PRESET_EMOJIS = ['🏃', '📚', '💧', '🧘', '💪', '🎨', '🍎', '😴'];
const PRESET_COLORS = ['#c026d3', '#ff6b35', '#00d4ff', '#39ff14', '#f59e0b', '#f43f5e'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// All frequency types
const FREQ_TYPES = [
  { value: 'daily',      label: 'Every day' },
  { value: 'weekdays',   label: 'Weekdays (Mon–Fri)' },
  { value: 'custom',     label: 'Custom days' },
  { value: 'everyNDays', label: 'Every N days' },
  { value: 'xPerWeek',   label: 'X times per week' },
  { value: 'xPerMonth',  label: 'X times per month' },
];

// Legacy label lookup (daily/weekdays/custom)
const FIXED_FREQ_LABELS = { daily: 'Every day', weekdays: 'Weekdays (Mon–Fri)', custom: 'Custom days' };

const DEFAULT_FORM = {
  name: '', emoji: '🏃', color: PRESET_COLORS[0],
  frequencyType: 'daily', frequencyValue: 2, customDays: [], goalStreak: 7,
};

/* ── date helpers ── */
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayKey() { return dateKey(new Date()); }

function getWeekDates() {
  const today = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d);
  }
  return dates;
}

function isToday(d) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function isFuture(d) {
  const t = new Date(); t.setHours(23,59,59,999);
  return d > t;
}

/* ── streak for daily/weekdays/custom ── */
function computeStreak(habitId, map) {
  const set = map[habitId];
  if (!set || set.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (set.has(dateKey(d))) { streak++; } else { break; }
  }
  return streak;
}

/* ── everyNDays: days until next due (negative = overdue) ── */
function daysUntilDue(habitId, map, intervalDays) {
  const set = map[habitId];
  if (!set || set.size === 0) return 0; // never done → due today
  // find most-recent checkin
  const sorted = [...set].sort().reverse();
  const last = sorted[0]; // 'YYYY-MM-DD'
  const [y, m, day] = last.split('-').map(Number);
  const lastDate = new Date(y, m - 1, day);
  const nextDue = new Date(lastDate);
  nextDue.setDate(lastDate.getDate() + intervalDays);
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((nextDue - now) / 86_400_000);
}

/* ── xPerWeek: count checkins in current Mon–Sun week ── */
function countThisWeek(habitId, map) {
  const set = map[habitId];
  if (!set) return 0;
  const now = new Date();
  // Monday of current week
  const dow = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  let count = 0;
  set.forEach(dk => {
    const [y, m, d] = dk.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (date >= monday && date <= sunday) count++;
  });
  return count;
}

/* ── xPerMonth: count checkins in current calendar month ── */
function countThisMonth(habitId, map) {
  const set = map[habitId];
  if (!set) return 0;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const prefix = `${y}-${String(m).padStart(2,'0')}-`;
  let count = 0;
  set.forEach(dk => { if (dk.startsWith(prefix)) count++; });
  return count;
}

/* ── human-readable frequency label ── */
function freqLabel(habit) {
  const ft = habit.frequencyType ?? habit.frequency ?? 'daily';
  if (ft === 'everyNDays') return `Every ${habit.frequencyValue ?? 2} days`;
  if (ft === 'xPerWeek')   return `${habit.frequencyValue ?? 3}× per week`;
  if (ft === 'xPerMonth')  return `${habit.frequencyValue ?? 4}× per month`;
  return FIXED_FREQ_LABELS[ft] ?? ft;
}

export default function Habits() {
  const { user } = useAuth();
  const { docs: habits, loading } = useCollection('habits');
  const { docs: checkins }        = useCollection('habitCheckins');
  const addHabit                  = useAdd('habits');
  const deleteHabit               = useDelete('habits');

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState('all');
  const [form, setForm]         = useState(DEFAULT_FORM);

  const weekDates = useMemo(() => getWeekDates(), []);
  const tk        = todayKey();

  // Map: habitId → Set<dateKey>
  const checkinMap = useMemo(() => {
    const map = {};
    checkins.forEach(c => {
      if (!map[c.habitId]) map[c.habitId] = new Set();
      map[c.habitId].add(c.dateKey);
    });
    return map;
  }, [checkins]);

  /* ── stats ── */
  const totalHabits   = habits.length;
  const todayDone     = habits.filter(h => checkinMap[h.id]?.has(tk)).length;
  const todayPct      = totalHabits > 0 ? Math.round((todayDone / totalHabits) * 100) : 0;
  const totalCheckins = checkins.length;

  const longestStreak = useMemo(() => {
    let best = 0;
    habits.forEach(h => {
      const ft = h.frequencyType ?? h.frequency ?? 'daily';
      if (['daily','weekdays','custom'].includes(ft)) {
        const s = computeStreak(h.id, checkinMap);
        if (s > best) best = s;
      }
    });
    return best;
  }, [habits, checkinMap]);

  /* ── filter logic ── */
  const filteredHabits = useMemo(() => habits.filter(h => {
    const ft = h.frequencyType ?? h.frequency ?? 'daily';
    if (filter === 'all') return true;
    if (filter === 'today') {
      if (ft === 'daily') return true;
      if (ft === 'weekdays') { const d = new Date().getDay(); return d >= 1 && d <= 5; }
      if (ft === 'custom')   return h.customDays?.includes(new Date().getDay());
      if (ft === 'everyNDays') return daysUntilDue(h.id, checkinMap, h.frequencyValue ?? 2) <= 0;
      if (ft === 'xPerWeek')  return countThisWeek(h.id, checkinMap) < (h.frequencyValue ?? 3);
      if (ft === 'xPerMonth') return countThisMonth(h.id, checkinMap) < (h.frequencyValue ?? 4);
      return true;
    }
    if (filter === 'completed') return checkinMap[h.id]?.has(tk);
    return true;
  }), [habits, filter, checkinMap, tk]);

  /* ── form submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const snapshot = {
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      frequencyType:  form.frequencyType,
      frequencyValue: ['everyNDays','xPerWeek','xPerMonth'].includes(form.frequencyType)
        ? Number(form.frequencyValue)
        : null,
      // keep legacy field for backward compat with existing records
      frequency:   form.frequencyType,
      customDays:  form.frequencyType === 'custom' ? form.customDays : [],
      goalStreak:  Number(form.goalStreak),
    };
    setShowForm(false);
    setForm(DEFAULT_FORM);
    await addHabit(snapshot);
  };

  /* ── checkin (works for all types) ── */
  const handleCheckin = useCallback(async (habitId, dk) => {
    if (!user) return;
    const existing = checkins.find(c => c.habitId === habitId && c.dateKey === dk);
    if (existing) {
      await deleteDoc(doc(db, 'habitCheckins', existing.id));
    } else {
      await addDoc(collection(db, 'habitCheckins'), {
        habitId, dateKey: dk, userId: user.uid, createdAt: serverTimestamp(),
      });
    }
  }, [user, checkins]);

  const toggleDay = (day) => {
    setForm(f => ({
      ...f,
      customDays: f.customDays.includes(day)
        ? f.customDays.filter(d => d !== day)
        : [...f.customDays, day],
    }));
  };

  if (loading) return <div className="layout"><div className="spinner" /></div>;

  return (
    <div className="layout animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Habits</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Build consistency, one day at a time
          </p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancel' : '+ New Habit'}
        </button>
      </div>

      {/* Stats row */}
      <div className="habits-stats stagger animate-in">
        <div className="habit-stat-card">
          <span className="habit-stat-icon">📋</span>
          <span className="habit-stat-value">{totalHabits}</span>
          <span className="habit-stat-label">Total Habits</span>
        </div>
        <div className="habit-stat-card">
          <span className="habit-stat-icon">✅</span>
          <span className="habit-stat-value">{todayPct}%</span>
          <span className="habit-stat-label">Today Done</span>
        </div>
        <div className="habit-stat-card">
          <span className="habit-stat-icon">🔥</span>
          <span className="habit-stat-value">{longestStreak}</span>
          <span className="habit-stat-label">Best Streak</span>
        </div>
        <div className="habit-stat-card">
          <span className="habit-stat-icon">⚡</span>
          <span className="habit-stat-value">{totalCheckins}</span>
          <span className="habit-stat-label">Check-ins</span>
        </div>
      </div>

      {/* ── Add form ── */}
      {showForm && (
        <form className="habit-add-form" onSubmit={handleSubmit}>
          <div className="habit-form-title">New Habit</div>

          <div className="habit-form-row">
            <div>
              <label className="habit-field-label">Name</label>
              <input
                type="text"
                placeholder="e.g. Morning run..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="habit-field-label">Frequency type</label>
              <select
                value={form.frequencyType}
                onChange={e => setForm(f => ({ ...f, frequencyType: e.target.value }))}
              >
                {FREQ_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Extra input for flexible frequency types */}
          {form.frequencyType === 'everyNDays' && (
            <div className="habit-form-row">
              <div>
                <label className="habit-field-label">Repeat every (days)</label>
                <input type="number" min="2" max="365" value={form.frequencyValue}
                  onChange={e => setForm(f => ({ ...f, frequencyValue: e.target.value }))} />
              </div>
              <div />
            </div>
          )}
          {form.frequencyType === 'xPerWeek' && (
            <div className="habit-form-row">
              <div>
                <label className="habit-field-label">Times per week</label>
                <input type="number" min="1" max="7" value={form.frequencyValue}
                  onChange={e => setForm(f => ({ ...f, frequencyValue: e.target.value }))} />
              </div>
              <div />
            </div>
          )}
          {form.frequencyType === 'xPerMonth' && (
            <div className="habit-form-row">
              <div>
                <label className="habit-field-label">Times per month</label>
                <input type="number" min="1" max="31" value={form.frequencyValue}
                  onChange={e => setForm(f => ({ ...f, frequencyValue: e.target.value }))} />
              </div>
              <div />
            </div>
          )}
          {form.frequencyType === 'custom' && (
            <div>
              <div className="emoji-picker-label">Days</div>
              <div className="day-checkboxes">
                {DAYS_SHORT.map((d, i) => (
                  <button key={i} type="button"
                    className={`day-checkbox-btn${form.customDays.includes(i) ? ' active' : ''}`}
                    onClick={() => toggleDay(i)}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="emoji-picker-label">Choose Emoji</div>
            <div className="emoji-picker-row">
              {PRESET_EMOJIS.map(e => (
                <button key={e} type="button"
                  className={`emoji-option${form.emoji === e ? ' selected' : ''}`}
                  onClick={() => setForm(f => ({ ...f, emoji: e }))}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="emoji-picker-label" style={{ marginBottom:'0.4rem' }}>Color</div>
            <div className="color-picker-row">
              {PRESET_COLORS.map(c => (
                <div key={c} className={`color-swatch${form.color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  role="button" tabIndex={0}
                  onKeyDown={ev => ev.key === 'Enter' && setForm(f => ({ ...f, color: c }))}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Goal streak only relevant for daily-type habits */}
          {['daily','weekdays','custom'].includes(form.frequencyType) && (
            <div className="habit-form-row">
              <div>
                <label className="habit-field-label">Goal Streak (days)</label>
                <input type="number" min="1" max="365" value={form.goalStreak}
                  onChange={e => setForm(f => ({ ...f, goalStreak: e.target.value }))} />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end' }}>
                <button type="submit" className="btn-primary">Add Habit</button>
              </div>
            </div>
          )}
          {!['daily','weekdays','custom'].includes(form.frequencyType) && (
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button type="submit" className="btn-primary" style={{ width:'auto' }}>Add Habit</button>
            </div>
          )}
        </form>
      )}

      {/* Filter */}
      <div className="habits-filter">
        {['all','today','completed'].map(f => (
          <button key={f} className={`habits-filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'today' ? "Today's" : 'Completed Today'}
          </button>
        ))}
      </div>

      {/* Habits grid */}
      {filteredHabits.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize:'2.5rem', marginBottom:'0.5rem' }}>🌱</div>
          <strong>No habits yet</strong><br />
          Create your first habit to start building consistency
        </div>
      ) : (
        <div className="habits-grid stagger">
          {filteredHabits.map(habit => <HabitCard
            key={habit.id}
            habit={habit}
            checkinMap={checkinMap}
            checkins={checkins}
            weekDates={weekDates}
            tk={tk}
            handleCheckin={handleCheckin}
            deleteHabit={deleteHabit}
          />)}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   HabitCard — renders the right UI per type
───────────────────────────────────────────── */
function HabitCard({ habit, checkinMap, checkins, weekDates, tk, handleCheckin, deleteHabit }) {
  const ft           = habit.frequencyType ?? habit.frequency ?? 'daily';
  const checkedDays  = checkinMap[habit.id] ?? new Set();
  const todayChecked = checkedDays.has(tk);
  const color        = habit.color || 'var(--primary)';

  // Retroactive log state
  const [showPastLog, setShowPastLog] = useState(false);
  const [pastDate, setPastDate]       = useState('');

  const isFixed = ['daily','weekdays','custom'].includes(ft);

  // max date for past-log picker = today
  const maxDate = tk;

  const handlePastLog = async (e) => {
    e.preventDefault();
    if (!pastDate) return;
    await handleCheckin(habit.id, pastDate);
    setPastDate('');
    setShowPastLog(false);
  };

  /* ── daily/weekdays/custom ── */
  const streak   = isFixed ? computeStreak(habit.id, checkinMap) : 0;
  const rate     = isFixed ? weekDates.filter(d => checkedDays.has(dateKey(d))).length : 0;
  const ratePct  = isFixed ? Math.round((rate / 7) * 100) : 0;

  /* ── everyNDays ── */
  const interval   = habit.frequencyValue ?? 2;
  const daysLeft   = ft === 'everyNDays' ? daysUntilDue(habit.id, checkinMap, interval) : null;
  const isDueToday = daysLeft !== null && daysLeft <= 0;
  const isOverdue  = daysLeft !== null && daysLeft < 0;

  /* ── xPerWeek ── */
  const weekTarget = habit.frequencyValue ?? 3;
  const weekDone   = ft === 'xPerWeek' ? countThisWeek(habit.id, checkinMap) : 0;
  const weekPct    = ft === 'xPerWeek' ? Math.min(100, Math.round((weekDone / weekTarget) * 100)) : 0;
  const weekMet    = ft === 'xPerWeek' && weekDone >= weekTarget;

  /* ── xPerMonth ── */
  const monthTarget = habit.frequencyValue ?? 4;
  const monthDone   = ft === 'xPerMonth' ? countThisMonth(habit.id, checkinMap) : 0;
  const monthPct    = ft === 'xPerMonth' ? Math.min(100, Math.round((monthDone / monthTarget) * 100)) : 0;
  const monthMet    = ft === 'xPerMonth' && monthDone >= monthTarget;

  return (
    <div className="habit-card animate-in" style={{ '--habit-color': color }}>

      {/* Header — same for all types */}
      <div className="habit-card-header">
        <span className="habit-emoji">{habit.emoji}</span>
        <div className="habit-info">
          <div className="habit-name">{habit.name}</div>
          <div className="habit-frequency">{freqLabel(habit)}</div>
        </div>

        {/* Streak badge — only for fixed-day habits */}
        {isFixed && (
          <div className="habit-streak">
            {streak > 0 && <span className="habit-flame">🔥</span>}
            <div>
              <div className="habit-streak-count" style={{ color }}>{streak}</div>
              <div className="habit-streak-label">streak</div>
            </div>
          </div>
        )}

        {/* everyNDays — due status badge */}
        {ft === 'everyNDays' && (
          <div className={`habit-due-badge${isOverdue ? ' overdue' : isDueToday ? ' due' : ''}`}>
            {isOverdue
              ? `${Math.abs(daysLeft)}d overdue`
              : daysLeft === 0
                ? 'Due today'
                : `Due in ${daysLeft}d`}
          </div>
        )}

        {/* xPerWeek / xPerMonth — compact count */}
        {(ft === 'xPerWeek' || ft === 'xPerMonth') && (
          <div className={`habit-freq-badge${(ft === 'xPerWeek' ? weekMet : monthMet) ? ' met' : ''}`}>
            {ft === 'xPerWeek'
              ? `${weekDone}/${weekTarget} wk`
              : `${monthDone}/${monthTarget} mo`}
          </div>
        )}
      </div>

      {/* ── Fixed-day: 7-day grid ── */}
      {isFixed && (
        <div className="habit-days-grid">
          {weekDates.map((d, i) => {
            const dk      = dateKey(d);
            const checked = checkedDays.has(dk);
            const future  = isFuture(d) && !isToday(d);
            return (
              <div key={i} className="habit-day-cell">
                <span className="habit-day-name">{DAYS_SHORT[d.getDay()].slice(0,1)}</span>
                <div
                  className={`habit-day-check${checked ? ' checked' : ''}${future ? ' future' : ''}`}
                  style={checked ? { background: color } : {}}
                  onClick={() => !future && handleCheckin(habit.id, dk)}
                  role="checkbox"
                  aria-checked={checked}
                  tabIndex={future ? -1 : 0}
                  onKeyDown={ev => ev.key === 'Enter' && !future && handleCheckin(habit.id, dk)}
                >
                  {checked && '✓'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── everyNDays: last-done info ── */}
      {ft === 'everyNDays' && (
        <div className="habit-interval-info">
          {checkedDays.size === 0
            ? <span className="habit-interval-hint">Never completed — check in to start the cycle</span>
            : isOverdue
              ? <span className="habit-interval-hint overdue-text">
                  Overdue by {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? 's' : ''} — do it now!
                </span>
              : daysLeft === 0
                ? <span className="habit-interval-hint due-text">On track — due today</span>
                : <span className="habit-interval-hint">Next due in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</span>
          }
        </div>
      )}

      {/* ── xPerWeek: progress bar ── */}
      {ft === 'xPerWeek' && (
        <div className="habit-completion-bar">
          <div className="habit-completion-header">
            <span className="habit-completion-label">This week</span>
            <span className="habit-completion-pct" style={{ color: weekMet ? 'var(--success)' : color }}>
              {weekDone} / {weekTarget}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${weekPct}%`, background: weekMet ? 'var(--success)' : color }} />
          </div>
          {weekMet && <div className="habit-goal-met">✓ Weekly goal met!</div>}
        </div>
      )}

      {/* ── xPerMonth: progress bar ── */}
      {ft === 'xPerMonth' && (
        <div className="habit-completion-bar">
          <div className="habit-completion-header">
            <span className="habit-completion-label">This month</span>
            <span className="habit-completion-pct" style={{ color: monthMet ? 'var(--success)' : color }}>
              {monthDone} / {monthTarget}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${monthPct}%`, background: monthMet ? 'var(--success)' : color }} />
          </div>
          {monthMet && <div className="habit-goal-met">✓ Monthly goal met!</div>}
        </div>
      )}

      {/* ── Fixed-day: 7-day completion rate ── */}
      {isFixed && (
        <div className="habit-completion-bar">
          <div className="habit-completion-header">
            <span className="habit-completion-label">7-day completion</span>
            <span className="habit-completion-pct" style={{ color }}>{ratePct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${ratePct}%`, background: color }} />
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="habit-card-actions">
        <button
          className="habit-checkin-btn"
          disabled={
            (isFixed && todayChecked) ||
            (ft === 'everyNDays' && !isDueToday && checkedDays.size > 0 && daysLeft > 0) ||
            (ft === 'xPerWeek' && weekMet) ||
            (ft === 'xPerMonth' && monthMet)
          }
          onClick={() => handleCheckin(habit.id, tk)}
          style={
            !todayChecked && !(ft === 'everyNDays' && !isDueToday && checkedDays.size > 0 && daysLeft > 0) &&
            !(ft === 'xPerWeek' && weekMet) && !(ft === 'xPerMonth' && monthMet)
              ? { background: `linear-gradient(135deg, ${color}, ${color}cc)` }
              : {}
          }
          aria-label="Check in"
        >
          {(isFixed && todayChecked)
            ? '✓ Done today'
            : (ft === 'xPerWeek' && weekMet)
              ? '✓ Weekly goal met'
              : (ft === 'xPerMonth' && monthMet)
                ? '✓ Monthly goal met'
                : (ft === 'everyNDays' && !isDueToday && checkedDays.size > 0 && daysLeft > 0)
                  ? `Due in ${daysLeft}d`
                  : '✓ Check in'}
        </button>
        <button
          className="habit-log-past-btn"
          type="button"
          onClick={() => setShowPastLog(v => !v)}
          title="Log for a past date"
          aria-label="Log for a past date"
        >
          📅
        </button>
        <button className="btn-danger" onClick={() => deleteHabit(habit.id)} title="Delete habit">✕</button>
      </div>

      {/* ── Retroactive log ── */}
      {showPastLog && (
        <form className="habit-past-log" onSubmit={handlePastLog}>
          <span className="habit-past-log-label">Log for past date:</span>
          <input
            type="date"
            value={pastDate}
            max={maxDate}
            onChange={e => setPastDate(e.target.value)}
            required
            aria-label="Past date"
          />
          {pastDate && checkedDays.has(pastDate) && (
            <span className="habit-past-log-status checked">Already logged</span>
          )}
          <button type="submit" className="btn-secondary" style={{ width:'auto', padding:'0.3rem 0.75rem', fontSize:'0.8rem' }}>
            {pastDate && checkedDays.has(pastDate) ? 'Unlog' : 'Log'}
          </button>
          <button type="button" className="btn-ghost" style={{ width:'auto', padding:'0.3rem 0.6rem', fontSize:'0.8rem' }}
            onClick={() => { setShowPastLog(false); setPastDate(''); }}>
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
