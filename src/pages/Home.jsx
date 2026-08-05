import { useState, useMemo } from 'react';
import { useCollection, useUpdate } from '../hooks/useFirestore';
import { getMondayOf, toISO, todayShort, DAYS_OF_WEEK, FULL_DAYS, fmtDuration } from '../utils/dates';
import Timer from '../components/Timer';
import { getCoachInsight } from '../services/groq';
import '../styles/home.css';

export default function Home() {
  const monday        = getMondayOf();
  const mondayISO     = toISO(monday);
  const todayShortStr = todayShort();
  const todayFull     = FULL_DAYS[DAYS_OF_WEEK.indexOf(todayShortStr)];

  const { docs: weeklyGoals, loading } = useCollection('weeklyGoals');
  const { docs: allTasks }             = useCollection('dailyTasks');
  const { docs: sessions }             = useCollection('sessions');
  const updateTask = useUpdate('dailyTasks');

  const [viewMode, setViewMode]       = useState('today');
  const [timerTarget, setTimerTarget] = useState(null);
  const [coachData, setCoachData]     = useState({});
  const [showDoneFor, setShowDoneFor] = useState({});

  const thisWeekGoals = useMemo(
    () => weeklyGoals.filter((g) => g.weekOf === mondayISO && g.status === 'active'),
    [weeklyGoals, mondayISO]
  );

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Today's sessions
  const todaySessions = useMemo(() => {
    const today = new Date().toDateString();
    return sessions
      .filter((s) => new Date(s.startTime).toDateString() === today)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 8);
  }, [sessions]);

  const totalTodayMin = todaySessions.reduce((a, s) => a + (s.durationMinutes || 0), 0);

  // Week streak
  const streak = useMemo(() => {
    const days = new Set(sessions.map((s) => new Date(s.startTime).toDateString()));
    let count  = 0;
    const check = new Date();
    while (days.has(check.toDateString())) { count++; check.setDate(check.getDate() - 1); }
    return count;
  }, [sessions]);

  // All tasks done today
  const totalDoneToday = useMemo(() => {
    return allTasks.filter((t) => t.done && t.weekOf === mondayISO).length;
  }, [allTasks, mondayISO]);

  // Total tasks this week
  const totalTasksWeek = useMemo(() => {
    const weekGoalIds = new Set(thisWeekGoals.map((g) => g.id));
    return allTasks.filter((t) => weekGoalIds.has(t.weeklyGoalId));
  }, [allTasks, thisWeekGoals]);

  const completedTasksWeek = totalTasksWeek.filter((t) => t.done).length;
  const weekPct = totalTasksWeek.length
    ? Math.round((completedTasksWeek / totalTasksWeek.length) * 100)
    : 0;

  const startTimer = (task, goal) => setTimerTarget({ task: task ?? null, weeklyGoal: goal });

  const handleTimerDone = (markDone) => {
    if (markDone && timerTarget?.task) {
      updateTask(timerTarget.task.id, { done: true });
    }
    setTimerTarget(null);
  };

  const fetchInsight = async (goal) => {
    setCoachData((p) => ({ ...p, [goal.id]: { loading: true, text: '' } }));
    const tasks = allTasks.filter((t) => t.weeklyGoalId === goal.id);
    try {
      const text = await getCoachInsight(goal.title, tasks);
      setCoachData((p) => ({ ...p, [goal.id]: { loading: false, text } }));
    } catch {
      setCoachData((p) => ({ ...p, [goal.id]: { loading: false, text: 'Could not load insight.' } }));
    }
  };

  const toggleShowDone = (goalId) =>
    setShowDoneFor((p) => ({ ...p, [goalId]: !p[goalId] }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning ☀️' : hour < 18 ? 'Good afternoon 👋' : 'Good evening 🌙';

  if (loading) return <div className="spinner" />;

  return (
    <div className="layout animate-in">

      {/* ── Header ── */}
      <div className="home-header">
        <div>
          <p className="home-greeting">{greeting}</p>
          <h1 className="home-title">{dateLabel}</h1>
          {thisWeekGoals.length > 0 && (
            <p className="home-subtitle">
              {thisWeekGoals.length} active {thisWeekGoals.length === 1 ? 'goal' : 'goals'} this week
              {totalTasksWeek.length > 0 && ` · ${weekPct}% complete`}
            </p>
          )}
        </div>
        <div className="view-toggle">
          <button className={`toggle-btn${viewMode === 'today' ? ' active' : ''}`} onClick={() => setViewMode('today')}>
            Today
          </button>
          <button className={`toggle-btn${viewMode === 'week' ? ' active' : ''}`} onClick={() => setViewMode('week')}>
            Week
          </button>
        </div>
      </div>

      {/* ── Quick stats ── */}
      <div className="quick-stats stagger animate-in">
        <div className="qs-card">
          <span className="qs-icon">⏱</span>
          <span className="qs-value">{totalTodayMin > 0 ? fmtDuration(totalTodayMin) : '—'}</span>
          <span className="qs-label">Studied today</span>
          <span className="qs-sub">{todaySessions.length} {todaySessions.length === 1 ? 'session' : 'sessions'}</span>
        </div>
        <div className="qs-card accent">
          <span className="qs-icon">✅</span>
          <span className="qs-value">{completedTasksWeek}</span>
          <span className="qs-label">Tasks done</span>
          <span className="qs-sub">{totalTasksWeek.length > 0 ? `of ${totalTasksWeek.length} this week` : 'this week'}</span>
        </div>
        <div className="qs-card accent2">
          <span className="qs-icon">🔥</span>
          <span className="qs-value">{streak}</span>
          <span className="qs-label">Day streak</span>
          <span className="qs-sub">{streak > 0 ? 'Keep it up!' : 'Start today'}</span>
        </div>
        <div className="qs-card accent3">
          <span className="qs-icon">🎯</span>
          <span className="qs-value">{thisWeekGoals.length}</span>
          <span className="qs-label">Active goals</span>
          <span className="qs-sub">{weeklyGoals.filter(g => g.status === 'done').length} completed ever</span>
        </div>
      </div>

      {/* ── Session pills ── */}
      {todaySessions.length > 0 && (
        <div className="sessions-row">
          {todaySessions.map((s) => (
            <span key={s.id} className="session-pill">
              <span className="session-pill-time">{fmtDuration(s.durationMinutes)}</span>
              {s.subject}
            </span>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {thisWeekGoals.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚀</div>
          No active goals this week yet.<br />
          Head to <strong>Weekly</strong> to add one and get started.
        </div>
      )}

      {/* ── Section header ── */}
      {thisWeekGoals.length > 0 && (
        <div className="section-row">
          <span className="section-title">This week's goals</span>
          <span className="section-badge">{weekPct}% complete</span>
        </div>
      )}

      {/* ── Goal blocks ── */}
      {thisWeekGoals.map((goal) => {
        const allGoalTasks = allTasks.filter((t) => t.weeklyGoalId === goal.id);
        const doneTasks    = allGoalTasks.filter((t) => t.done);
        const pendingTasks = allGoalTasks.filter((t) => !t.done);
        const todayTasks   = pendingTasks.filter((t) => t.dayOfWeek === todayFull);
        const floatTasks   = pendingTasks.filter((t) => !t.dayOfWeek);
        // Past-due: undone tasks assigned to a day earlier than today in this week
        const todayDowIndex  = FULL_DAYS.indexOf(todayFull);
        const pastDueTasks   = pendingTasks.filter((t) =>
          t.dayOfWeek && FULL_DAYS.indexOf(t.dayOfWeek) < todayDowIndex
        );
        const coach        = coachData[goal.id] ?? {};
        const allComplete  = allGoalTasks.length > 0 && doneTasks.length === allGoalTasks.length;
        const pct          = allGoalTasks.length ? Math.round((doneTasks.length / allGoalTasks.length) * 100) : 0;
        return (
          <div key={goal.id} className="home-goal-block">
            {/* Goal header */}
            <div className="home-goal-header">
              <span className="home-goal-title">{goal.title}</span>
              <div className="home-goal-meta">
                {allGoalTasks.length > 0 && (
                  <span className="home-goal-pct">{pct}%</span>
                )}
                <span className={`home-goal-badge${allComplete ? ' complete' : ''}`}>
                  {allComplete ? '✓ Done' : `${doneTasks.length}/${allGoalTasks.length}`}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {allGoalTasks.length > 0 && (
              <div className="home-goal-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {/* No tasks → just start button */}
            {allGoalTasks.length === 0 && (
              <div className="tasks-section">
                <button className="task-card floating" onClick={() => startTimer(null, goal)}>
                  <span className="task-card-day float">Now</span>
                  <span className="task-card-label">Start working on this goal</span>
                  <span className="task-card-play">▶</span>
                </button>
              </div>
            )}

            {/* ── Today view ── */}
            {viewMode === 'today' && allGoalTasks.length > 0 && (
              <>
                {todayTasks.length === 0 && floatTasks.length === 0 && (
                  <p className="no-tasks-msg">
                    Nothing scheduled for today —{' '}
                    <button onClick={() => startTimer(null, goal)}>start a free session ▶</button>
                  </p>
                )}

                {todayTasks.length > 0 && (
                  <div className="tasks-section">
                    {todayTasks.map((task) => (
                      <button key={task.id} className="task-card" onClick={() => startTimer(task, goal)}>
                        <span className="task-card-day">{todayFull.slice(0, 3)}</span>
                        <span className="task-card-label">{task.description}</span>
                        <span className="task-card-play">▶</span>
                      </button>
                    ))}
                  </div>
                )}

                {floatTasks.length > 0 && (
                  <>
                    <p className="home-section-label">Floating — anytime</p>
                    <div className="tasks-section" style={{ paddingTop: 0 }}>
                      {floatTasks.map((task) => (
                        <button key={task.id} className="task-card floating" onClick={() => startTimer(task, goal)}>
                          <span className="task-card-day float">Float</span>
                          <span className="task-card-label">{task.description}</span>
                          <span className="task-card-play">▶</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {pastDueTasks.length > 0 && (
                  <>
                    <p className="home-section-label past-due">⚠ Past due — mark done or start now</p>
                    <div className="tasks-section" style={{ paddingTop: 0 }}>
                      {pastDueTasks.map((task) => (
                        <div key={task.id} className="task-card past-due-card">
                          <span className="task-card-day past-due-day">{task.dayOfWeek.slice(0,3)}</span>
                          <span className="task-card-label">{task.description}</span>
                          <button
                            className="task-done-retroactive"
                            onClick={() => updateTask(task.id, { done: true })}
                            title="Mark as done"
                            aria-label="Mark done"
                          >
                            ✓ Done
                          </button>
                          <button
                            className="task-card-play-btn"
                            onClick={() => startTimer(task, goal)}
                            title="Start timer"
                            aria-label="Start timer"
                          >
                            ▶
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {doneTasks.length > 0 && (
                  <>
                    <button className="show-done-btn" onClick={() => toggleShowDone(goal.id)}>
                      {showDoneFor[goal.id] ? '▲ Hide completed' : `▼ ${doneTasks.length} completed`}
                    </button>
                    {showDoneFor[goal.id] && (
                      <div className="tasks-section" style={{ paddingTop: 0 }}>
                        {doneTasks.map((task) => (
                          <div key={task.id} className="task-card done">
                            <span className="done-badge">✓</span>
                            <span className="task-card-label">{task.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ── Week view ── */}
            {viewMode === 'week' && allGoalTasks.length > 0 && (
              <div className="week-grid">
                {FULL_DAYS.map((day) => {
                  const dayTasks = allGoalTasks.filter((t) => t.dayOfWeek === day);
                  if (!dayTasks.length) return null;
                  return (
                    <div key={day} className={`week-day-row${day === todayFull ? ' today-row' : ''}`}>
                      <span className="week-day-name">{day.slice(0, 3)}</span>
                      <div className="week-day-tasks">
                        {dayTasks.map((task) => (
                          <button
                            key={task.id}
                            className={`task-card compact${task.done ? ' done' : ''}`}
                            onClick={() => !task.done && startTimer(task, goal)}
                            disabled={task.done}
                          >
                            {task.done
                              ? <><span className="done-badge">✓</span><span className="task-card-label">{task.description}</span></>
                              : <><span className="task-card-label">{task.description}</span><span className="task-card-play">▶</span></>
                            }
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {allGoalTasks.filter((t) => !t.dayOfWeek).length > 0 && (
                  <div className="week-day-row">
                    <span className="week-day-name float-label">Float</span>
                    <div className="week-day-tasks">
                      {allGoalTasks.filter((t) => !t.dayOfWeek).map((task) => (
                        <button
                          key={task.id}
                          className={`task-card compact floating${task.done ? ' done' : ''}`}
                          onClick={() => !task.done && startTimer(task, goal)}
                          disabled={task.done}
                        >
                          {task.done
                            ? <><span className="done-badge">✓</span><span className="task-card-label">{task.description}</span></>
                            : <><span className="task-card-label">{task.description}</span><span className="task-card-play">▶</span></>
                          }
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── AI Coach ── */}
            <div className="coach-row">
              <button
                className="coach-btn"
                onClick={() => fetchInsight(goal)}
                disabled={coach.loading}
              >
                {coach.loading ? '✦ Generating insight…' : '✦ AI Coach insight'}
              </button>
              {coach.text && <p className="coach-text">{coach.text}</p>}
            </div>
          </div>
        );
      })}

      {/* Timer modal */}
      {timerTarget && (
        <Timer
          task={timerTarget.task}
          weeklyGoal={timerTarget.weeklyGoal}
          onClose={() => setTimerTarget(null)}
          onDone={handleTimerDone}
        />
      )}
    </div>
  );
}
