import { useState, useCallback, useMemo } from 'react';
import { useCollection, useAdd, useUpdate, useDelete } from '../hooks/useFirestore';
import { getMondayOf, toISO, weekLabel, FULL_DAYS, fmtDuration } from '../utils/dates';
import { breakdownWeeklyGoal } from '../services/groq';
import '../styles/weekly.css';

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Weekly() {
  const { docs: weeklyGoals, loading } = useCollection('weeklyGoals');
  const { docs: horizonGoals }         = useCollection('horizonGoals');
  const { docs: allTasks }             = useCollection('dailyTasks');
  const { docs: sessions }             = useCollection('sessions');

  const addWeekly    = useAdd('weeklyGoals');
  const updateWeekly = useUpdate('weeklyGoals');
  const deleteWeekly = useDelete('weeklyGoals');
  const addTask      = useAdd('dailyTasks');
  const updateTask   = useUpdate('dailyTasks');
  const deleteTask   = useDelete('dailyTasks');

  const [weekOffset, setWeekOffset] = useState(0);
  const monday    = getMondayOf(new Date(Date.now() + weekOffset * 7 * 86_400_000));
  const mondayISO = toISO(monday);

  const thisWeekGoals = weeklyGoals.filter((g) => g.weekOf === mondayISO);
  const isCurrentWeek = weekOffset === 0;

  // Today info
  const todayFull = FULL_DAYS[
    new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  ];

  // Add-goal form
  const [showAdd, setShowAdd]   = useState(false);
  const [goalForm, setGoalForm] = useState({ title: '', parentHorizonGoalId: '' });

  // Expand state
  const [expanded, setExpanded] = useState(null);

  // AI state
  const [aiLoading, setAiLoading]       = useState(false);
  const [aiError, setAiError]           = useState('');
  const [aiDraft, setAiDraft]           = useState(null);
  const [aiGoalId, setAiGoalId]         = useState(null);
  const [selectedDays, setSelectedDays] = useState(FULL_DAYS.slice(0, 5));

  // Manual task add
  const [addingTaskFor, setAddingTaskFor] = useState(null);
  const [manualTask, setManualTask]       = useState({ description: '', dayOfWeek: null });

  // Summary stats for this week
  const weekTasks  = allTasks.filter((t) => thisWeekGoals.some((g) => g.id === t.weeklyGoalId));
  const doneTasks  = weekTasks.filter((t) => t.done);
  const weekPct    = weekTasks.length ? Math.round((doneTasks.length / weekTasks.length) * 100) : 0;

  // Sessions this week
  const weekSessions = useMemo(() => {
    const start = new Date(monday);
    const end   = new Date(monday); end.setDate(end.getDate() + 7);
    return sessions.filter((s) => {
      const d = new Date(s.startTime);
      return d >= start && d < end;
    });
  }, [sessions, monday]);

  const totalWeekMin = weekSessions.reduce((a, s) => a + (s.durationMinutes || 0), 0);

  // Day density (tasks per day)
  const dayDensity = useMemo(() => {
    return FULL_DAYS.map((day) => {
      const count = weekTasks.filter((t) => t.dayOfWeek === day).length;
      const done  = weekTasks.filter((t) => t.dayOfWeek === day && t.done).length;
      return { day, count, done };
    });
  }, [weekTasks]);

  const maxDayCount = Math.max(...dayDensity.map((d) => d.count), 1);

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!goalForm.title.trim()) return;
    const snapshot = {
      title: goalForm.title,
      weekOf: mondayISO,
      parentHorizonGoalId: goalForm.parentHorizonGoalId || null,
      status: 'active',
    };
    setShowAdd(false);
    setGoalForm({ title: '', parentHorizonGoalId: '' });
    await addWeekly(snapshot);
  };

  const handleAI = async (goal) => {
    if (!selectedDays.length) { setAiError('Select at least one day.'); return; }
    setAiError('');
    setAiLoading(true);
    setAiGoalId(goal.id);
    setAiDraft(null);
    try {
      const result = await breakdownWeeklyGoal(goal.title, selectedDays);
      setAiDraft(result.map((r, i) => ({ ...r, _key: i })));
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const saveAIDraft = async () => {
    for (const item of aiDraft) {
      if (!item.task?.trim()) continue;
      await addTask({
        weeklyGoalId: aiGoalId,
        dayOfWeek: item.day ?? null,
        description: item.task,
        done: false,
      });
    }
    setAiDraft(null);
    setAiGoalId(null);
  };

  const handleManualTask = async (e, goalId) => {
    e.preventDefault();
    if (!manualTask.description.trim()) return;
    await addTask({
      weeklyGoalId: goalId,
      dayOfWeek: manualTask.dayOfWeek ?? null,
      description: manualTask.description,
      done: false,
    });
    setManualTask({ description: '', dayOfWeek: null });
    setAddingTaskFor(null);
  };

  const toggleDay = useCallback((d) =>
    setSelectedDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]),
  []);

  const tasksFor = (goalId) => allTasks.filter((t) => t.weeklyGoalId === goalId);

  if (loading) return (
    <div className="skeleton-page animate-in">
      <div className="skeleton-header">
        <div className="skeleton skeleton-title" style={{ width:'10rem' }} />
        <div className="skeleton skeleton-text" style={{ width:'10rem', height:'2rem', borderRadius:'var(--radius-sm)' }} />
      </div>
      <div className="skeleton-grid-4">
        {[1,2,3,4].map(i => <div key={i} className="skeleton-card"><div className="skeleton skeleton-text" style={{ width:'40%' }} /><div className="skeleton skeleton-title" style={{ width:'55%' }} /></div>)}
      </div>
      {[1,2].map(i => <div key={i} className="skeleton-card" style={{ height:'5rem', marginBottom:'0.75rem' }} />)}
    </div>
  );

  return (
    <div className="layout animate-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Planner</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {isCurrentWeek ? 'Current week' : 'Viewing past week'}
          </p>
        </div>
        <div className="week-nav">
          <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w - 1)} aria-label="Previous week">‹</button>
          <span className="week-label">{weekLabel(monday)}</span>
          <button className="week-nav-btn" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week">›</button>
        </div>
      </div>

      {/* ── Weekly summary ── */}
      <div className="weekly-summary">
        <div className="ws-card">
          <div className="ws-value">{thisWeekGoals.length}</div>
          <div className="ws-label">Goals</div>
        </div>
        <div className="ws-card">
          <div className="ws-value" style={{ color: 'var(--success)' }}>{doneTasks.length}</div>
          <div className="ws-label">{doneTasks.length === 1 ? 'Task done' : 'Tasks done'}</div>
        </div>
        <div className="ws-card">
          <div className="ws-value" style={{ color: 'var(--warning)' }}>{weekPct}%</div>
          <div className="ws-label">Progress</div>
        </div>
        <div className="ws-card">
          <div className="ws-value" style={{ color: 'var(--accent3, #38bdf8)' }}>
            {totalWeekMin > 0 ? fmtDuration(totalWeekMin) : '—'}
          </div>
          <div className="ws-label">Focus time</div>
        </div>
      </div>

      {/* ── Day density strip ── */}
      {weekTasks.length > 0 && (
        <div className="day-density-strip">
          {dayDensity.map(({ day, count, done }, i) => {
            const isToday = isCurrentWeek && day === todayFull;
            const pct     = Math.round((count / maxDayCount) * 100);
            return (
              <div key={day} className={`density-day${isToday ? ' is-today' : ''}`} title={`${day}: ${count} tasks`}>
                <span className="density-day-name">{DAY_SHORT[i]}</span>
                <div className="density-bar-track">
                  <div className="density-bar-fill" style={{ height: `${pct}%` }} />
                </div>
                <span className="density-count">{count > 0 ? `${done}/${count}` : '—'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add goal ── */}
      {showAdd ? (
        <div className="weekly-add-form">
          <form className="card" onSubmit={handleAddGoal}>
            <p className="form-title">New goal — {weekLabel(monday)}</p>
            <input
              placeholder="What do you want to accomplish this week?"
              value={goalForm.title}
              onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
              required
              autoFocus
            />
            <select
              value={goalForm.parentHorizonGoalId}
              onChange={(e) => setGoalForm({ ...goalForm, parentHorizonGoalId: e.target.value })}
            >
              <option value="">Link to a horizon goal (optional)</option>
              {horizonGoals.filter((g) => g.status === 'active').map((g) => (
                <option key={g.id} value={g.id}>{g.title} · {g.periodLabel}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Add Goal</button>
              <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <button className="weekly-add-btn" onClick={() => setShowAdd(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Weekly Goal
        </button>
      )}

      {/* ── Empty state ── */}
      {thisWeekGoals.length === 0 && !showAdd && (
        <div className="empty-state">
          <span className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </span>
          <span className="empty-title">Nothing planned this week</span>
          <span className="empty-desc">Add a weekly goal and let AI break it into daily tasks for you.</span>
          <button className="empty-cta" onClick={() => setShowAdd(true)}>+ Add Weekly Goal</button>
        </div>
      )}

      {/* ── Goal cards ── */}
      <div className="weekly-goals-list">
        {thisWeekGoals.map((goal) => {
          const tasks   = tasksFor(goal.id);
          const done    = tasks.filter((t) => t.done).length;
          const pct     = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
          const isOpen  = expanded === goal.id;
          const horizon = horizonGoals.find((g) => g.id === goal.parentHorizonGoalId);

          return (
            <div key={goal.id} className={`wg-card${isOpen ? ' expanded' : ''}`}>
              {/* Card header */}
              <div className="wg-header" onClick={() => setExpanded(isOpen ? null : goal.id)}>
                <button
                  className={`done-check${goal.status === 'done' ? ' checked' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateWeekly(goal.id, { status: goal.status === 'done' ? 'active' : 'done' });
                  }}
                  aria-label="Toggle done"
                >
                  {goal.status === 'done' ? '✓' : ''}
                </button>

                <div className="wg-title-block">
                  <span className={`wg-title${goal.status === 'done' ? ' done' : ''}`}>{goal.title}</span>
                  <div className="wg-meta">
                    {horizon && <span className="wg-link-badge">↗ {horizon.title}</span>}
                    <span className="wg-task-count">
                      {tasks.length === 0 ? 'No tasks yet' : `${done}/${tasks.length} tasks done`}
                    </span>
                  </div>
                  {tasks.length > 0 && (
                    <div className="wg-progress-bar">
                      <div className="wg-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>

                {tasks.length > 0 && (
                  <span className="wg-pct-badge">{pct}%</span>
                )}

                <div className="wg-header-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="wg-delete-btn"
                    onClick={() => deleteWeekly(goal.id)}
                    aria-label="Delete goal"
                  >
                    ✕
                  </button>
                </div>

                <span className={`wg-chevron${isOpen ? ' open' : ''}`}>▼</span>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div className="wg-body">
                  {/* AI toolbar */}
                  <div className="ai-toolbar">
                    <div className="day-selector">
                      <span className="day-selector-label">Days:</span>
                      {FULL_DAYS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`day-chip${selectedDays.includes(d) ? ' active' : ''}`}
                          onClick={() => toggleDay(d)}
                        >
                          {d.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                    <button
                      className="ai-btn"
                      onClick={() => handleAI(goal)}
                      disabled={aiLoading && aiGoalId === goal.id}
                    >
                      {aiLoading && aiGoalId === goal.id ? '✦ Thinking…' : '✦ AI Breakdown'}
                    </button>
                  </div>

                  {aiError && aiGoalId === goal.id && (
                    <p className="error-text">{aiError}</p>
                  )}

                  {/* AI draft */}
                  {aiDraft && aiGoalId === goal.id && (
                    <div className="ai-draft">
                      <div className="ai-draft-header">
                        <h4>✦ Review before saving</h4>
                        <button className="btn-ghost" style={{ fontSize: '0.76rem' }} onClick={() => setAiDraft(null)}>
                          Discard
                        </button>
                      </div>

                      {aiDraft.map((item, i) => (
                        <div key={item._key} className="ai-draft-item">
                          <select
                            value={item.day ?? ''}
                            onChange={(e) =>
                              setAiDraft((d) => d.map((x, j) => j === i ? { ...x, day: e.target.value || null } : x))
                            }
                          >
                            <option value="">Float</option>
                            {FULL_DAYS.map((d) => <option key={d} value={d}>{d.slice(0, 3)}</option>)}
                          </select>
                          <input
                            value={item.task}
                            onChange={(e) =>
                              setAiDraft((d) => d.map((x, j) => j === i ? { ...x, task: e.target.value } : x))
                            }
                          />
                          <button
                            type="button"
                            className="ai-draft-del"
                            onClick={() => setAiDraft((d) => d.filter((_, j) => j !== i))}
                            aria-label="Remove task"
                          >
                            ✕
                          </button>
                        </div>
                      ))}

                      <div className="ai-draft-actions">
                        <button className="btn-primary" style={{ width: 'auto', padding: '0.48rem 1.2rem' }} onClick={saveAIDraft}>
                          Save {aiDraft.length} tasks
                        </button>
                        <button className="btn-secondary" onClick={() => handleAI(goal)}>Regenerate</button>
                      </div>
                    </div>
                  )}

                  {/* Task list */}
                  {tasks.length > 0 && (
                    <ul className="task-list">
                      {tasks.map((task) => (
                        <li key={task.id} className={`task-item${task.done ? ' done' : ''}`}>
                          <button
                            className={`done-check small${task.done ? ' checked' : ''}`}
                            onClick={() => updateTask(task.id, { done: !task.done })}
                            aria-label="Toggle task"
                          >
                            {task.done ? '✓' : ''}
                          </button>
                          <span className={`task-day-badge${!task.dayOfWeek ? ' float' : ''}`}>
                            {task.dayOfWeek ? task.dayOfWeek.slice(0, 3) : 'Float'}
                          </span>
                          <span className="task-desc">{task.description}</span>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.22rem 0.45rem', fontSize: '0.72rem' }}
                            onClick={() => deleteTask(task.id)}
                            aria-label="Delete task"
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Manual add */}
                  {addingTaskFor === goal.id ? (
                    <form className="manual-task-form" onSubmit={(e) => handleManualTask(e, goal.id)}>
                      <div className="form-row">
                        <select
                          value={manualTask.dayOfWeek ?? ''}
                          onChange={(e) => setManualTask({ ...manualTask, dayOfWeek: e.target.value || null })}
                          style={{ maxWidth: 135 }}
                        >
                          <option value="">Floating</option>
                          {FULL_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input
                          placeholder="Task description…"
                          value={manualTask.description}
                          onChange={(e) => setManualTask({ ...manualTask, description: e.target.value })}
                          required
                          autoFocus
                        />
                      </div>
                      <div className="edit-actions">
                        <button type="submit" className="btn-secondary">Add Task</button>
                        <button type="button" className="btn-ghost" onClick={() => setAddingTaskFor(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button className="add-task-btn" onClick={() => setAddingTaskFor(goal.id)}>
                      + Add task manually
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
