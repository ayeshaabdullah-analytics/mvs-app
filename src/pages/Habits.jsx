import { useState, useCallback } from 'react';
import {
  collection, addDoc, deleteDoc, doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCollection, useAdd, useDelete } from '../hooks/useFirestore';
import '../styles/habits.css';

const PRESET_EMOJIS = ['🏃', '📚', '💧', '🧘', '💪', '🎨', '🍎', '😴'];const PRESET_COLORS = ['#c026d3', '#ff6b35', '#00d4ff', '#39ff14', '#f59e0b', '#f43f5e'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FREQUENCY_OPTIONS = [
  { value: 'daily',    label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
  { value: 'custom',   label: 'Custom days' },
];

function getWeekDates() {
  const today = new Date();
  const day   = today.getDay();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d);
  }
  return dates;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isToday(d) {
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

function isFuture(d) {
  const t = new Date(); t.setHours(23,59,59,999);
  return d > t;
}

export default function Habits() {
  const { user } = useAuth();
  const { docs: habits, loading } = useCollection('habits');
  const { docs: checkins }        = useCollection('habitCheckins');
  const addHabit                  = useAdd('habits');
  const deleteHabit               = useDelete('habits');

  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter]     = useState('all');
  const [form, setForm]         = useState({
    name: '', emoji: '🏃', color: PRESET_COLORS[0],
    frequency: 'daily', customDays: [], goalStreak: 7,
  });

  const weekDates = getWeekDates();

  // Map: habitId -> set of dateKeys checked
  const checkinMap = {};
  checkins.forEach(c => {
    if (!checkinMap[c.habitId]) checkinMap[c.habitId] = new Set();
    checkinMap[c.habitId].add(c.dateKey);
  });

  // Stats
  const totalHabits = habits.length;
  const todayKey    = dateKey(new Date());
  const todayDone   = habits.filter(h => checkinMap[h.id]?.has(todayKey)).length;
  const todayPct    = totalHabits > 0 ? Math.round((todayDone / totalHabits) * 100) : 0;

  let longestStreak = 0;
  habits.forEach(h => {
    const s = computeStreak(h.id, checkinMap);
    if (s > longestStreak) longestStreak = s;
  });
  const totalCheckins = checkins.length;

  function computeStreak(habitId, map) {
    const set   = map[habitId];
    if (!set || set.size === 0) return 0;
    let streak  = 0;
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const d  = new Date(today);
      d.setDate(today.getDate() - i);
      if (set.has(dateKey(d))) { streak++; } else { break; }
    }
    return streak;
  }

  // Filter habits
  const filteredHabits = habits.filter(h => {
    if (filter === 'all') return true;
    if (filter === 'today') {
      const now = new Date().getDay();
      if (h.frequency === 'daily') return true;
      if (h.frequency === 'weekdays') return now >= 1 && now <= 5;
      if (h.frequency === 'custom') return h.customDays?.includes(now);
      return true;
    }
    if (filter === 'completed') return checkinMap[h.id]?.has(todayKey);
    return true;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    // Capture snapshot and close form immediately (optimistic close)
    const snapshot = {
      name: form.name.trim(),
      emoji: form.emoji,
      color: form.color,
      frequency: form.frequency,
      customDays: form.customDays,
      goalStreak: Number(form.goalStreak),
    };
    setShowForm(false);
    setForm({ name: '', emoji: '🏃', color: PRESET_COLORS[0], frequency: 'daily', customDays: [], goalStreak: 7 });
    await addHabit(snapshot);
  };

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

      {/* Add form */}
      {showForm && (
        <form className="habit-add-form" onSubmit={handleSubmit}>
          <div className="habit-form-title">New Habit</div>

          <div className="habit-form-row">
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.4rem' }}>
                Name
              </label>
              <input
                type="text"
                placeholder="e.g. Morning run..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.4rem' }}>
                Frequency
              </label>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {form.frequency === 'custom' && (
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

          <div className="habit-form-row">
            <div>
              <label style={{ display:'block', fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.4rem' }}>
                Goal Streak (days)
              </label>
              <input type="number" min="1" max="365" value={form.goalStreak}
                onChange={e => setForm(f => ({ ...f, goalStreak: e.target.value }))} />
            </div>
            <div style={{ display:'flex', alignItems:'flex-end' }}>
              <button type="submit" className="btn-primary">Add Habit</button>
            </div>
          </div>
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
          {filteredHabits.map(habit => {
            const checkedDays = checkinMap[habit.id] ?? new Set();
            const streak      = computeStreak(habit.id, checkinMap);
            const todayChecked = checkedDays.has(todayKey);
            const rate        = weekDates.filter(d => checkedDays.has(dateKey(d))).length;
            const ratePct     = Math.round((rate / 7) * 100);

            return (
              <div key={habit.id} className="habit-card animate-in"
                style={{ '--habit-color': habit.color || 'var(--primary)' }}>

                {/* Header */}
                <div className="habit-card-header">
                  <span className="habit-emoji">{habit.emoji}</span>
                  <div className="habit-info">
                    <div className="habit-name">{habit.name}</div>
                    <div className="habit-frequency">
                      {FREQUENCY_OPTIONS.find(o => o.value === habit.frequency)?.label ?? habit.frequency}
                    </div>
                  </div>
                  <div className="habit-streak">
                    {streak > 0 && <span className="habit-flame">🔥</span>}
                    <div>
                      <div className="habit-streak-count" style={{ color: habit.color || 'var(--primary)' }}>{streak}</div>
                      <div className="habit-streak-label">streak</div>
                    </div>
                  </div>
                </div>

                {/* 7-day grid */}
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
                          style={checked ? { background: habit.color || undefined } : {}}
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

                {/* Completion rate */}
                <div className="habit-completion-bar">
                  <div className="habit-completion-header">
                    <span className="habit-completion-label">7-day completion</span>
                    <span className="habit-completion-pct" style={{ color: habit.color || 'var(--primary)' }}>{ratePct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${ratePct}%`, background: habit.color || undefined }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="habit-card-actions">
                  <button
                    className="habit-checkin-btn"
                    disabled={todayChecked}
                    onClick={() => handleCheckin(habit.id, todayKey)}
                    style={!todayChecked ? { background: habit.color ? `linear-gradient(135deg, ${habit.color}, ${habit.color}cc)` : undefined } : {}}
                  >
                    {todayChecked ? '✓ Done today' : '✓ Check in today'}
                  </button>
                  <button className="btn-danger" onClick={() => deleteHabit(habit.id)} title="Delete habit">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
