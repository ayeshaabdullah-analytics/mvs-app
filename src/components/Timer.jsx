import { useEffect, useRef, useState } from 'react';
import { useAdd } from '../hooks/useFirestore';
import '../styles/timer.css';

const CIRCUMFERENCE = 440; // 2π × 70
const CYCLE = 25 * 60;     // 25-min visual cycle

export default function Timer({ task, weeklyGoal, onClose, onDone }) {
  const [status, setStatus]     = useState('idle');   // idle | running | paused | completed
  const [elapsed, setElapsed]   = useState(0);
  const [subject, setSubject]   = useState(weeklyGoal?.title ?? '');
  const [minimised, setMinimised] = useState(false);

  const startRef    = useRef(null);
  const intervalRef = useRef(null);
  const addSession  = useAdd('sessions');

  // Cleanup on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  // Warn before tab close while running
  useEffect(() => {
    const handler = (e) => {
      if (status === 'running') { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  const tick = () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000));

  const start = () => {
    startRef.current = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(tick, 500);
    setStatus('running');
  };

  const pause = () => {
    clearInterval(intervalRef.current);
    setStatus('paused');
  };

  const resume = () => {
    startRef.current = Date.now() - elapsed * 1000;
    intervalRef.current = setInterval(tick, 500);
    setStatus('running');
  };

  const finish = async (markDone = false) => {
    clearInterval(intervalRef.current);
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));
    const now   = new Date();
    const start = new Date(now.getTime() - elapsed * 1000);
    await addSession({
      weeklyGoalId: weeklyGoal?.id ?? null,
      dailyTaskId:  task?.id ?? null,
      subject:      subject || weeklyGoal?.title || 'Study',
      startTime:    start.toISOString(),
      endTime:      now.toISOString(),
      durationMinutes,
    });
    setStatus('completed');
    if (onDone) onDone(markDone);
  };

  const fmt = (s) => {
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  const ringOffset = CIRCUMFERENCE - ((elapsed % CYCLE) / CYCLE) * CIRCUMFERENCE;

  // ── Minimised pill ──
  if (minimised) {
    return (
      <div className="timer-mini" onClick={() => setMinimised(false)} role="button" aria-label="Expand timer">
        <div className="timer-mini-dot" />
        <span className="timer-mini-time">{fmt(elapsed)}</span>
        <span className="timer-mini-label">{task?.description ?? weeklyGoal?.title ?? 'Session'}</span>
      </div>
    );
  }

  return (
    <div className="timer-overlay" role="dialog" aria-modal="true" aria-label="Study timer">
      <div className="timer-card">

        {/* Top controls */}
        <div className="timer-top-controls">
          {status === 'running' && (
            <button className="timer-ctrl-btn minimise" onClick={() => setMinimised(true)} aria-label="Minimise">
              —
            </button>
          )}
          {status !== 'running' && (
            <button className="timer-ctrl-btn" onClick={onClose} aria-label="Close timer">
              ✕
            </button>
          )}
        </div>

        {/* Context */}
        <div className="timer-context">
          {task ? (
            <>
              <span className="timer-task-label">{task.description}</span>
              <span className="timer-goal-label">↳ {weeklyGoal?.title}</span>
            </>
          ) : (
            <span className="timer-task-label">{weeklyGoal?.title ?? 'Free session'}</span>
          )}
        </div>

        {/* Subject label input (idle only) */}
        {status === 'idle' && (
          <div className="timer-subject-row animate-slide">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Session label (optional)"
              aria-label="Session label"
            />
          </div>
        )}

        {/* Ring + time display */}
        <div className="timer-ring-wrap">
          <svg className="timer-ring" viewBox="0 0 160 160" aria-hidden="true">
            <circle className="timer-ring-bg"   cx="80" cy="80" r="70" />
            <circle
              className={`timer-ring-fill ${status}`}
              cx="80" cy="80" r="70"
              style={{ strokeDashoffset: ringOffset }}
            />
          </svg>
          <div className="timer-time-block">
            <div
              className={`timer-display${status === 'running' ? ' running' : ''}`}
              aria-live="polite"
              aria-label={`Elapsed time: ${fmt(elapsed)}`}
            >
              {fmt(elapsed)}
            </div>
            <div className={`timer-status-label ${status}`}>
              {status === 'idle' ? 'ready' : status === 'running' ? 'recording' : status === 'paused' ? 'paused' : 'done'}
            </div>
          </div>
          {status === 'running' && <div className="timer-pulse" aria-hidden="true" />}
        </div>

        {/* Controls / done card */}
        {status === 'completed' ? (
          <div className="timer-done-card">
            <div className="timer-done-icon">🎉</div>
            <div className="timer-done-title">Session saved!</div>
            <div className="timer-done-detail">{fmt(elapsed)} logged for "{subject || weeklyGoal?.title}"</div>
            <button className="btn-secondary" style={{ marginTop: '0.5rem', width: 'auto' }} onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="timer-controls">
              {status === 'idle' && (
                <button className="btn-start" onClick={start}>▶ Start</button>
              )}
              {status === 'running' && (
                <>
                  <button className="btn-pause"  onClick={pause}>⏸ Pause</button>
                  <button className="btn-finish" onClick={() => finish(false)}>✓ Finish</button>
                </>
              )}
              {status === 'paused' && (
                <>
                  <button className="btn-start"  onClick={resume}>▶ Resume</button>
                  <button className="btn-finish" onClick={() => finish(false)}>✓ Finish</button>
                </>
              )}
            </div>

            {(status === 'running' || status === 'paused') && task && (
              <button className="mark-done-btn" onClick={() => finish(true)}>
                ✓ Finish &amp; mark task done
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
