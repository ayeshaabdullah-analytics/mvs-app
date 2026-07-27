import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_META } from '../context/ThemeContext';
import { useCollection } from '../hooks/useFirestore';
import { fmtDuration } from '../utils/dates';
import '../styles/profile.css';

export default function Profile() {
  const { user, logout }              = useAuth();
  const { theme, setTheme, themes }   = useTheme();
  const { docs: sessions }            = useCollection('sessions');
  const { docs: weeklyGoals }         = useCollection('weeklyGoals');
  const { docs: horizonGoals }        = useCollection('horizonGoals');
  const { docs: journalEntries }      = useCollection('journalEntries');

  const [soundEnabled,   setSoundEnabled]   = useState(true);
  const [notifEnabled,   setNotifEnabled]   = useState(false);

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const initials    = displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const totalMin     = sessions.reduce((a, s) => a + (s.durationMinutes || 0), 0);
  const totalHours   = (totalMin / 60).toFixed(1);

  const streak = useMemo(() => {
    const days  = new Set(sessions.map((s) => new Date(s.startTime).toDateString()));
    let count   = 0;
    const check = new Date();
    while (days.has(check.toDateString())) { count++; check.setDate(check.getDate() - 1); }
    return count;
  }, [sessions]);

  const joinedDate = useMemo(() => {
    if (!user?.metadata?.creationTime) return null;
    return new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [user]);

  // Achievements
  const achievements = useMemo(() => {
    const list = [];
    if (sessions.length >= 1)    list.push({ icon: '🚀', label: 'First session' });
    if (sessions.length >= 10)   list.push({ icon: '💪', label: '10 sessions' });
    if (sessions.length >= 50)   list.push({ icon: '🏆', label: '50 sessions' });
    if (totalMin >= 60)          list.push({ icon: '⏰', label: '1 hour studied' });
    if (totalMin >= 600)         list.push({ icon: '🌟', label: '10 hours studied' });
    if (streak >= 3)             list.push({ icon: '🔥', label: `${streak} day streak` });
    if (horizonGoals.filter(g=>g.status==='done').length >= 1) list.push({ icon: '🎯', label: 'Goal achieved' });
    if (journalEntries.length >= 1)  list.push({ icon: '📔', label: 'First journal entry' });
    if (journalEntries.length >= 7)  list.push({ icon: '✍️', label: '7 journal entries' });
    return list;
  }, [sessions, totalMin, streak, horizonGoals, journalEntries]);

  return (
    <div className="layout animate-in">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
        <button className="btn-secondary" onClick={logout} style={{ color:'var(--danger)', borderColor:'var(--danger-soft)' }}>
          Sign out
        </button>
      </div>

      {/* Hero */}
      <div className="profile-hero">
        <div className="profile-avatar">
          {user?.photoURL
            ? <img src={user.photoURL} alt={initials} referrerPolicy="no-referrer" />
            : initials}
        </div>
        <div className="profile-info">
          <div className="profile-name">{displayName}</div>
          <div className="profile-email">{user?.email}</div>
          {joinedDate && <div className="profile-joined">📅 Joined {joinedDate}</div>}
          {achievements.length > 0 && (
            <div className="profile-badges">
              {achievements.map((a) => (
                <span key={a.label} className="profile-badge">{a.icon} {a.label}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="profile-stat-card">
          <div className="profile-stat-value">{totalHours}h</div>
          <div className="profile-stat-label">Total studied</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-value" style={{ color:'var(--warning)' }}>{streak} 🔥</div>
          <div className="profile-stat-label">Day streak</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-value" style={{ color:'var(--success)' }}>{sessions.length}</div>
          <div className="profile-stat-label">Sessions</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-value">{weeklyGoals.filter(g=>g.status==='done').length}</div>
          <div className="profile-stat-label">Goals done</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-value" style={{ color:'var(--accent2)' }}>{journalEntries.length}</div>
          <div className="profile-stat-label">Journal entries</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-value">{horizonGoals.filter(g=>g.status==='done').length}</div>
          <div className="profile-stat-label">Milestones hit</div>
        </div>
      </div>

      {/* Theme picker */}
      <div className="theme-picker">
        <h2>🎨 Choose theme</h2>
        <div className="theme-grid">
          {Object.keys(themes).map((t) => (
            <div key={t} data-theme-key={t} className={`theme-card${theme === t ? ' active' : ''}`} onClick={() => setTheme(t)}>
              <div className="theme-card-icon">{THEME_META[t].icon}</div>
              <div className="theme-card-label">{THEME_META[t].label}</div>
              <div className="theme-card-desc">{THEME_META[t].desc}</div>
              <div className="theme-card-swatch" />
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="profile-section">
        <h2>⚙️ Preferences</h2>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Timer sounds</div>
            <div className="settings-row-sub">Play sound when session ends</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Browser notifications</div>
            <div className="settings-row-sub">Notify when timer completes</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={notifEnabled} onChange={(e) => setNotifEnabled(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* About */}
      <div className="profile-section">
        <h2>ℹ️ About MVS</h2>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Version</div>
          </div>
          <span style={{ fontSize:'0.82rem', color:'var(--text-muted)', fontWeight:600 }}>2.0.0</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Milestone · Vision · Steps</div>
            <div className="settings-row-sub">Your personal study & goal tracker</div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="profile-section danger-zone">
        <h2>⚠️ Danger zone</h2>
        <div className="settings-row">
          <div>
            <div className="settings-row-label" style={{ color:'var(--danger)' }}>Sign out of MVS</div>
            <div className="settings-row-sub">You'll need to log back in</div>
          </div>
          <button className="btn-danger" onClick={logout}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
