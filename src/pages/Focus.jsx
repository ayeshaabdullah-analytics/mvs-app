import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useCollection, useAdd, useUpdate } from '../hooks/useFirestore';
import { getMondayOf, toISO, FULL_DAYS, fmtDuration } from '../utils/dates';
import '../styles/focus.css';

const MODES = [
  { key: 'pomodoro',   label: '🍅 Focus',       mins: 25, type: 'work',       desc: '25 min deep work' },
  { key: 'short',      label: '☕ Short break',  mins: 5,  type: 'break',      desc: '5 min breather'   },
  { key: 'long',       label: '🌴 Long break',   mins: 15, type: 'long-break', desc: '15 min recharge'  },
  { key: 'custom',     label: '⚙️ Custom',        mins: 45, type: 'work',       desc: 'Your duration'    },
];

const CIRCUMFERENCE = 565; // 2π × 90

export default function Focus() {
  const { docs: weeklyGoals }  = useCollection('weeklyGoals');
  const { docs: allTasks }     = useCollection('dailyTasks');
  const { docs: sessions }     = useCollection('sessions');
  const addSession             = useAdd('sessions');
  const updateTask             = useUpdate('dailyTasks');

  const monday    = getMondayOf();
  const mondayISO = toISO(monday);
  const todayFull = FULL_DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  const [mode,         setMode]         = useState('pomodoro');
  const [customMins,   setCustomMins]   = useState(45);
  const [status,       setStatus]       = useState('idle');   // idle | running | paused | done
  const [remaining,    setRemaining]    = useState(null);
  const [elapsed,      setElapsed]      = useState(0);
  const [cyclesDone,   setCyclesDone]   = useState(0);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [todaySessions,setTodaySessions]= useState([]);

  const intervalRef = useRef(null);
  const startRef    = useRef(null);

  const currentMode = MODES.find((m) => m.key === mode) ?? MODES[0];
  const totalSecs   = (mode === 'custom' ? customMins : currentMode.mins) * 60;

  // Tasks for today from this week
  const thisDayTasks = useMemo(() => {
    const weekGoalIds = new Set(weeklyGoals.filter((g) => g.weekOf === mondayISO).map((g) => g.id));
    return allTasks.filter((t) => weekGoalIds.has(t.weeklyGoalId) && !t.done && (t.dayOfWeek === todayFull || !t.dayOfWeek));
  }, [allTasks, weeklyGoals, mondayISO, todayFull]);

  // Load today sessions from store
  useMemo(() => {
    const today = new Date().toDateString();
    const ts = sessions.filter((s) => new Date(s.startTime).toDateString() === today)
      .sort((a,b) => new Date(b.startTime) - new Date(a.startTime)).slice(0,10);
    setTodaySessions(ts);
  }, [sessions]);

  // Cleanup
  useEffect(() => () => clearInterval(intervalRef.current), []);

  // Warn on close
  useEffect(() => {
    const h = (e) => { if (status === 'running') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [status]);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    setStatus('idle'); setRemaining(null); setElapsed(0);
  }, []);

  const start = useCallback(() => {
    const r = remaining ?? totalSecs;
    startRef.current = Date.now() - (totalSecs - r) * 1000;
    intervalRef.current = setInterval(() => {
      const el  = Math.floor((Date.now() - startRef.current) / 1000);
      const rem = Math.max(0, totalSecs - el);
      setElapsed(el); setRemaining(rem);
      if (rem === 0) {
        clearInterval(intervalRef.current);
        setStatus('done');
        if (currentMode.type === 'work') setCyclesDone((c) => c + 1);
        saveSession(el, false);
      }
    }, 500);
    setStatus('running');
  }, [remaining, totalSecs, currentMode]);

  const pause = useCallback(() => { clearInterval(intervalRef.current); setStatus('paused'); }, []);

  const saveSession = async (secs, markDone) => {
    const dur = Math.max(1, Math.round(secs / 60));
    const now = new Date();
    const startTime = new Date(now.getTime() - secs * 1000);
    const goal = selectedGoal ?? weeklyGoals.find((g) => g.id === selectedTask?.weeklyGoalId);
    await addSession({
      weeklyGoalId: goal?.id ?? null,
      dailyTaskId:  selectedTask?.id ?? null,
      subject:      selectedTask?.description ?? goal?.title ?? 'Focus session',
      startTime:    startTime.toISOString(),
      endTime:      now.toISOString(),
      durationMinutes: dur,
      pomodoroType: currentMode.type,
    });
    if (markDone && selectedTask) {
      await updateTask(selectedTask.id, { done: true });
      setSelectedTask(null);
    }
  };

  const finishEarly = async (markDone = false) => {
    clearInterval(intervalRef.current);
    await saveSession(elapsed, markDone);
    setStatus('done');
    if (currentMode.type === 'work') setCyclesDone((c) => c + 1);
  };

  const rem         = remaining ?? totalSecs;
  const progress    = 1 - rem / totalSecs;
  const ringOffset  = CIRCUMFERENCE - progress * CIRCUMFERENCE;
  const mins        = String(Math.floor(rem / 60)).padStart(2, '0');
  const secs        = String(rem % 60).padStart(2, '0');
  const maxCycles   = 4;

  return (
    <div className="focus-layout animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Focus Mode</h1>
          <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.2rem' }}>
            Pomodoro timer · {cyclesDone} cycles today
          </p>
        </div>
        <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
          {todaySessions.length > 0 && `${todaySessions.length} sessions · ${fmtDuration(todaySessions.reduce((a,s) => a+(s.durationMinutes||0), 0))}`}
        </div>
      </div>

      {/* Mode selector */}
      <div className="focus-modes">
        {MODES.map((m) => (
          <button key={m.key} className={`focus-mode-btn${mode === m.key ? ' active' : ''}`}
            onClick={() => { setMode(m.key); reset(); }}>
            {m.label}
            <span className="focus-mode-label">{m.key === 'custom' ? `${customMins} min` : m.desc}</span>
          </button>
        ))}
      </div>

      {/* Custom duration */}
      {mode === 'custom' && status === 'idle' && (
        <div style={{ marginBottom:'1.25rem', display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <span style={{ fontSize:'0.84rem', color:'var(--text-muted)', fontWeight:600, flexShrink:0 }}>Duration (minutes):</span>
          <input type="number" min="1" max="180" value={customMins}
            onChange={(e) => setCustomMins(Math.max(1, Math.min(180, Number(e.target.value))))}
            style={{ maxWidth:'90px' }} />
        </div>
      )}

      {/* Main timer card */}
      <div className="focus-card">
        {/* Cycle dots */}
        <div className="focus-cycles">
          {Array.from({ length: maxCycles }).map((_, i) => (
            <div key={i} className={`cycle-dot${i < cyclesDone ? ' done' : ''}${i === cyclesDone && status === 'running' && currentMode.type === 'work' ? ' active' : ''}`} />
          ))}
          {cyclesDone > 0 && <span style={{ fontSize:'0.7rem', color:'var(--primary)', fontWeight:700, marginLeft:'0.4rem' }}>{cyclesDone} done</span>}
        </div>

        {selectedTask && (
          <p className="focus-subject">🎯 {selectedTask.description}</p>
        )}

        {/* Ring */}
        <div className="focus-ring-wrap">
          <svg className="focus-ring" viewBox="0 0 200 200">
            <circle className="focus-ring-bg" cx="100" cy="100" r="90" />
            <circle
              className={`focus-ring-fill${currentMode.type === 'break' ? ' break' : currentMode.type === 'long-break' ? ' long-break' : ''}`}
              cx="100" cy="100" r="90"
              style={{ strokeDashoffset: ringOffset }}
            />
          </svg>
          <div className="focus-time-block">
            <div className={`focus-time${status === 'running' ? ` ${currentMode.type === 'work' ? 'running' : 'break'}` : ''}`}>
              {mins}:{secs}
            </div>
            <div className={`focus-status${status === 'running' ? ` ${currentMode.type === 'work' ? 'running' : 'break'}` : ''}`}>
              {status === 'idle'    ? currentMode.label
               : status === 'running' ? (currentMode.type === 'work' ? 'deep focus' : 'resting')
               : status === 'paused'  ? 'paused'
               : 'complete ✓'}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="focus-controls">
          {(status === 'idle' || status === 'paused') && (
            <button className="focus-start-btn" onClick={start}>
              {status === 'paused' ? '▶ Resume' : '▶ Start'}
            </button>
          )}
          {status === 'running' && (
            <>
              <button className="focus-skip-btn" onClick={pause}>⏸ Pause</button>
              <button className="focus-skip-btn" onClick={() => finishEarly(false)}>✓ Finish</button>
            </>
          )}
          {(status === 'running' || status === 'paused') && (
            <button className="focus-reset-btn" onClick={reset}>↺ Reset</button>
          )}
          {status === 'done' && (
            <button className="focus-start-btn" onClick={reset}>↺ New session</button>
          )}
        </div>

        {/* Mark task done */}
        {(status === 'running' || status === 'paused') && selectedTask && (
          <button style={{ background:'none', border:'none', color:'var(--success)', fontSize:'0.8rem', cursor:'pointer', fontFamily:'inherit', padding:'0.25rem', textDecoration:'underline', textUnderlineOffset:'3px' }}
            onClick={() => finishEarly(true)}>
            ✓ Finish &amp; mark task done
          </button>
        )}

        {status === 'done' && currentMode.type === 'work' && (
          <p style={{ fontSize:'0.85rem', color:'var(--success)', fontWeight:600, marginTop:'0.25rem' }}>
            🎉 Focus session saved! Take a break.
          </p>
        )}
      </div>

      {/* Task selector */}
      {thisDayTasks.length > 0 && (
        <div className="focus-task-select">
          <h3>Focus on a task</h3>
          <div className="focus-task-list">
            {thisDayTasks.map((task) => {
              const goal = weeklyGoals.find((g) => g.id === task.weeklyGoalId);
              return (
                <div key={task.id}
                  className={`focus-task-item${selectedTask?.id === task.id ? ' selected' : ''}`}
                  onClick={() => { setSelectedTask(selectedTask?.id === task.id ? null : task); setSelectedGoal(goal ?? null); }}>
                  <span className="focus-task-item-day">{task.dayOfWeek?.slice(0,3) ?? 'Float'}</span>
                  <span className="focus-task-item-label">{task.description}</span>
                  {goal && <span style={{ fontSize:'0.68rem', color:'var(--text-faint)' }}>{goal.title}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's sessions */}
      {todaySessions.length > 0 && (
        <div className="focus-sessions">
          <h3>Today's sessions</h3>
          {todaySessions.map((s) => {
            const goal = weeklyGoals.find((g) => g.id === s.weeklyGoalId);
            return (
              <div key={s.id} className="focus-session-row">
                <span className="focus-session-pill">{fmtDuration(s.durationMinutes)}</span>
                <span style={{ flex:1, fontSize:'0.84rem', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {s.subject || goal?.title || 'Session'}
                </span>
                {s.pomodoroType === 'work' && <span className="focus-completed-badge">🍅 focus</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
