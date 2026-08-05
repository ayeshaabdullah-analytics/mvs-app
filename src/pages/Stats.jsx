import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { useCollection } from '../hooks/useFirestore';
import { fmtDuration, DAYS_OF_WEEK } from '../utils/dates';
import '../styles/stats.css';

const FILTERS = ['week', 'month', 'year', 'all'];

const todayDayKey = (() => {
  const d = new Date().getDay();
  return DAYS_OF_WEEK[d === 0 ? 6 : d - 1];
})();

/* Build 17-week heatmap (119 days) ending today */
function buildHeatmap(sessions) {
  const counts = {};
  sessions.forEach((s) => {
    const key = new Date(s.startTime).toDateString();
    counts[key] = (counts[key] || 0) + (s.durationMinutes || 0);
  });

  const cells = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const start = new Date(today);
  start.setDate(today.getDate() - 118);
  const startDay = start.getDay();
  start.setDate(start.getDate() - (startDay === 0 ? 6 : startDay - 1));

  const cur   = new Date(start);
  const weeks = [];
  let week    = [];

  while (cur <= today) {
    const key   = cur.toDateString();
    const mins  = counts[key] || 0;
    const level = mins === 0 ? 0 : mins < 30 ? 1 : mins < 60 ? 2 : mins < 120 ? 3 : 4;
    const label = mins > 0
      ? `${cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${fmtDuration(mins)}`
      : cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    week.push({ key, level, label, future: cur > today });
    if (week.length === 7) { weeks.push(week); week = []; }
    cur.setDate(cur.getDate() + 1);
  }
  if (week.length) weeks.push(week);
  return weeks;
}

/* Build last-30-days line chart */
function buildTrend(sessions) {
  const map = {};
  sessions.forEach((s) => {
    const d = new Date(s.startTime);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    map[key] = (map[key] || 0) + (s.durationMinutes || 0);
  });

  const result = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    result.push({ date: key, minutes: map[key] || 0 });
  }
  return result;
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <strong>{label}</strong>
        <span>{fmtDuration(payload[0].value)}</span>
      </div>
    );
  }
  return null;
};

const TrendTooltip = ({ active, payload, label }) => {
  if (active && payload?.length && payload[0].value > 0) {
    return (
      <div className="chart-tooltip">
        <strong>{label}</strong>
        <span>{fmtDuration(payload[0].value)}</span>
      </div>
    );
  }
  return null;
};

export default function Stats() {
  const { docs: sessions, loading } = useCollection('sessions');
  const { docs: weeklyGoals }       = useCollection('weeklyGoals');
  const [filter, setFilter]         = useState('week');

  const now = new Date();

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const d = new Date(s.startTime);
      if (filter === 'week') {
        const ago = new Date(now); ago.setDate(now.getDate() - 7); return d >= ago;
      }
      if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (filter === 'year')  return d.getFullYear() === now.getFullYear();
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, filter]);

  const totalMin   = filtered.reduce((a, s) => a + (s.durationMinutes || 0), 0);
  const avgSession = filtered.length ? Math.round(totalMin / filtered.length) : 0;
  const totalHours = (totalMin / 60).toFixed(1);

  const streak = useMemo(() => {
    const days = new Set(sessions.map((s) => new Date(s.startTime).toDateString()));
    let count  = 0;
    const check = new Date();
    while (days.has(check.toDateString())) { count++; check.setDate(check.getDate() - 1); }
    return count;
  }, [sessions]);

  const longestSession = useMemo(() => {
    if (!filtered.length) return 0;
    return Math.max(...filtered.map((s) => s.durationMinutes || 0));
  }, [filtered]);

  const byDay = useMemo(() => {
    const map = Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, 0]));
    filtered.forEach((s) => {
      const d   = new Date(s.startTime);
      const key = DAYS_OF_WEEK[d.getDay() === 0 ? 6 : d.getDay() - 1];
      map[key]  = (map[key] || 0) + (s.durationMinutes || 0);
    });
    return DAYS_OF_WEEK.map((d) => ({ day: d, minutes: map[d] }));
  }, [filtered]);

  const bestDay = useMemo(() => {
    const best = byDay.reduce((a, b) => b.minutes > a.minutes ? b : a, byDay[0]);
    return best?.minutes > 0 ? best : null;
  }, [byDay]);

  const byGoal = useMemo(() => {
    const map = {};
    filtered.forEach((s) => {
      const id = s.weeklyGoalId || '_unknown';
      map[id]  = (map[id] || 0) + (s.durationMinutes || 0);
    });
    return Object.entries(map)
      .map(([id, mins]) => ({
        name:    weeklyGoals.find((g) => g.id === id)?.title || 'General',
        minutes: mins,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8);
  }, [filtered, weeklyGoals]);

  const recentSessions = useMemo(() =>
    [...sessions]
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 20),
  [sessions]);

  const heatmapWeeks = useMemo(() => buildHeatmap(sessions), [sessions]);
  const trendData    = useMemo(() => buildTrend(sessions.filter((s) => {
    const ago = new Date(); ago.setDate(ago.getDate() - 30);
    return new Date(s.startTime) >= ago;
  })), [sessions]);

  const trendHasData = trendData.some((d) => d.minutes > 0);

  if (loading) return (
    <div className="skeleton-page animate-in">
      <div className="skeleton-header">
        <div className="skeleton skeleton-title" style={{ width:'8rem' }} />
        <div className="skeleton skeleton-text" style={{ width:'10rem', height:'2rem', borderRadius:'var(--radius-sm)' }} />
      </div>
      <div className="skeleton-grid-2" style={{ gridTemplateColumns:'repeat(3,1fr)' }}>
        {[1,2,3].map(i => <div key={i} className="skeleton-card" style={{ height:'7rem' }} />)}
      </div>
      <div className="skeleton-card" style={{ height:'10rem' }} />
      <div className="skeleton-card" style={{ height:'12rem' }} />
      <div className="skeleton-card" style={{ height:'8rem' }} />
    </div>
  );

  return (
    <div className="layout animate-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Statistics</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Your activity &amp; progress
          </p>
        </div>
        <div className="stats-filter">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero cards ── */}
      <div className="stats-hero">
        <div className="stats-hero-card">
          <span className="stats-hero-icon">⏱</span>
          <span className="stats-hero-value">{totalHours}h</span>
          <span className="stats-hero-label">Total focus time</span>
          <span className="stats-hero-sub">{filtered.length} sessions recorded</span>
        </div>
        <div className="stats-hero-card">
          <span className="stats-hero-icon">🔥</span>
          <span className="stats-hero-value" style={{ color: 'var(--warning)' }}>{streak}</span>
          <span className="stats-hero-label">Day streak</span>
          <span className="stats-hero-sub">{streak > 0 ? 'Currently active' : 'Start today!'}</span>
        </div>
        <div className="stats-hero-card">
          <span className="stats-hero-icon">📈</span>
          <span className="stats-hero-value" style={{ color: 'var(--success)' }}>{fmtDuration(avgSession)}</span>
          <span className="stats-hero-label">Avg session</span>
          <span className="stats-hero-sub">Best: {fmtDuration(longestSession)}</span>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="stats-summary">
        <div className="stat-card">
          <span className="stat-value">{fmtDuration(totalMin)}</span>
          <span className="stat-label">Total time</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{filtered.length}</span>
          <span className="stat-label">Sessions</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{streak}{streak > 0 ? ' 🔥' : ''}</span>
          <span className="stat-label">Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{fmtDuration(avgSession)}</span>
          <span className="stat-label">Avg session</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{byGoal.length}</span>
          <span className="stat-label">Goals worked</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{sessions.length}</span>
          <span className="stat-label">All-time sessions</span>
        </div>
      </div>

      {/* ── 30-day trend ── */}
      {trendHasData && (
        <div className="chart-section">
          <div className="chart-section-header">
            <h2 className="chart-title">30-day activity trend</h2>
            <span className="chart-badge">{fmtDuration(trendData.reduce((a, d) => a + d.minutes, 0))} total</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-faint)', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Line
                type="monotone"
                dataKey="minutes"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--surface)', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Activity heatmap ── */}
      <div className="chart-section">
        <div className="chart-section-header">
          <h2 className="chart-title">Activity heatmap</h2>
          <span className="chart-badge">Last 17 weeks</span>
        </div>
        <div className="heatmap-grid">
          {heatmapWeeks.map((week, wi) => (
            <div key={wi} className="heatmap-week">
              {week.map((cell, di) => (
                <div
                  key={di}
                  className={`heatmap-cell${cell.level > 0 ? ` l${cell.level}` : ''}`}
                  title={cell.label}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="heatmap-legend">
          <span>Less</span>
          <div className="heatmap-legend-cells">
            {[0,1,2,3,4].map((l) => (
              <div key={l} className={`heatmap-cell${l > 0 ? ` l${l}` : ''}`} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>

      {/* ── Time by day ── */}
      <div className="chart-section">
        <div className="chart-section-header">
          <h2 className="chart-title">Time by day of week</h2>
          {bestDay && <span className="chart-badge">Best: {bestDay.day} ({fmtDuration(bestDay.minutes)})</span>}
        </div>
        {byDay.every((d) => d.minutes === 0) ? (
          <p style={{ color: 'var(--text-faint)', fontSize: '0.84rem' }}>No sessions in this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={byDay} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="day"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--hover)' }} />
              <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {byDay.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.day === todayDayKey ? 'var(--primary)' : 'var(--surface3)'}
                    opacity={entry.day === todayDayKey ? 1 : 0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Time per goal ── */}
      {byGoal.length > 0 && (
        <div className="chart-section">
          <div className="chart-section-header">
            <h2 className="chart-title">Time per goal</h2>
            <span className="chart-badge">{byGoal.length} goals</span>
          </div>
          <div className="goal-bars">
            {byGoal.map((g) => (
              <div key={g.name} className="goal-bar-row">
                <span className="goal-bar-name" title={g.name}>{g.name}</span>
                <div className="goal-bar-track">
                  <div
                    className="goal-bar-fill"
                    style={{ width: `${(g.minutes / byGoal[0].minutes) * 100}%` }}
                  />
                </div>
                <span className="goal-bar-time">{fmtDuration(g.minutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top subjects ── */}
      {byGoal.length > 0 && (
        <div className="chart-section">
          <div className="chart-section-header">
            <h2 className="chart-title">Top goals by time</h2>
          </div>
          <div className="top-subjects">
            {byGoal.slice(0, 6).map((g, i) => (
              <div key={g.name} className="subject-pill">
                <span className="subject-rank">#{i + 1}</span>
                <span className="subject-name" title={g.name}>{g.name}</span>
                <span className="subject-time">{fmtDuration(g.minutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Session log ── */}
      {recentSessions.length > 0 && (
        <div className="chart-section">
          <div className="chart-section-header">
            <h2 className="chart-title">Recent sessions</h2>
            <span className="chart-badge">{recentSessions.length} shown</span>
          </div>
          <div className="session-log">
            {recentSessions.map((s) => {
              const d       = new Date(s.startTime);
              const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const goal    = weeklyGoals.find((g) => g.id === s.weeklyGoalId);
              return (
                <div key={s.id} className="session-row">
                  <span className="session-row-time">{fmtDuration(s.durationMinutes)}</span>
                  <span className="session-row-subject">{s.subject || goal?.title || '—'}</span>
                  <span className="session-row-date">{dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <span className="empty-title">No sessions recorded yet</span>
          <span className="empty-desc">Start a focus timer on the Today page — your activity will appear here as charts and streaks.</span>
          <a href="/"><button className="empty-cta">▶ Start a Session</button></a>
        </div>
      )}
    </div>
  );
}
