import { useState, useMemo } from 'react';
import { useCollection } from '../hooks/useFirestore';
import '../styles/achievements.css';

// ── Achievement definitions ──
const ACHIEVEMENTS = [
  // Focus time
  { id:'st_1h',   cat:'focus',   icon:'⏱️',  name:'First Hour',      desc:'Logged your first hour of focus time.',        how:'Log 1 hour total focus time.',         xp:10, threshold:60,    field:'totalMins' },
  { id:'st_5h',   cat:'focus',   icon:'📖',  name:'Scholar',          desc:'5 hours of focused work.',                     how:'Log 5 hours total focus time.',        xp:10, threshold:300,   field:'totalMins' },
  { id:'st_10h',  cat:'focus',   icon:'🎓',  name:'Dedicated',        desc:'10 hours invested in yourself.',               how:'Log 10 hours total focus time.',       xp:10, threshold:600,   field:'totalMins' },
  { id:'st_25h',  cat:'focus',   icon:'🔬',  name:'Researcher',       desc:'25 hours of deep focused work.',               how:'Log 25 hours total focus time.',       xp:10, threshold:1500,  field:'totalMins' },
  { id:'st_50h',  cat:'focus',   icon:'🏆',  name:'Achiever',         desc:'50 hours — you\'re unstoppable.',              how:'Log 50 hours total focus time.',       xp:10, threshold:3000,  field:'totalMins' },
  { id:'st_100h', cat:'focus',   icon:'💎',  name:'Century Club',     desc:'100 hours of dedicated focused work.',         how:'Log 100 hours total focus time.',      xp:10, threshold:6000,  field:'totalMins' },

  // Sessions
  { id:'ss_1',    cat:'session', icon:'🚀',  name:'Lift Off',         desc:'Completed your very first focus session.',     how:'Complete 1 focus session.',           xp:10, threshold:1,     field:'sessions' },
  { id:'ss_10',   cat:'session', icon:'🎯',  name:'On Target',        desc:'10 sessions in the books.',                   how:'Complete 10 focus sessions.',         xp:10, threshold:10,    field:'sessions' },
  { id:'ss_25',   cat:'session', icon:'⚡',  name:'Momentum',         desc:'25 sessions — a real rhythm.',                how:'Complete 25 focus sessions.',         xp:10, threshold:25,    field:'sessions' },
  { id:'ss_50',   cat:'session', icon:'🌟',  name:'Superstar',        desc:'50 sessions of pure focus.',                  how:'Complete 50 focus sessions.',         xp:10, threshold:50,    field:'sessions' },
  { id:'ss_100',  cat:'session', icon:'👑',  name:'Focus Master',     desc:'100 sessions. Truly elite.',                  how:'Complete 100 focus sessions.',        xp:10, threshold:100,   field:'sessions' },

  // Streaks
  { id:'sk_3',    cat:'streak',  icon:'🔥',  name:'On Fire',          desc:'3 days in a row — momentum is building.',     how:'Log activity 3 days in a row.',       xp:10, threshold:3,     field:'streak' },
  { id:'sk_7',    cat:'streak',  icon:'🗓️',  name:'Week Warrior',     desc:'A full week of showing up.',                  how:'Log activity 7 days in a row.',       xp:10, threshold:7,     field:'streak' },
  { id:'sk_14',   cat:'streak',  icon:'💪',  name:'Fortnight Force',  desc:'Two weeks of daily dedication.',              how:'Log activity 14 days in a row.',      xp:10, threshold:14,    field:'streak' },
  { id:'sk_30',   cat:'streak',  icon:'🏅',  name:'Monthly Grind',    desc:'30 days straight — legendary.',               how:'Log activity 30 days in a row.',      xp:10, threshold:30,    field:'streak' },

  // Goals
  { id:'gl_1',    cat:'goals',   icon:'🎪',  name:'Goal Setter',      desc:'Completed your first goal.',                  how:'Mark 1 goal as complete.',            xp:10, threshold:1,     field:'goalsCompleted' },
  { id:'gl_5',    cat:'goals',   icon:'🎠',  name:'Goal Getter',      desc:'5 goals crushed.',                            how:'Mark 5 goals as complete.',           xp:10, threshold:5,     field:'goalsCompleted' },
  { id:'gl_10',   cat:'goals',   icon:'🎡',  name:'Visionary',        desc:'10 goals achieved — remarkable.',             how:'Mark 10 goals as complete.',          xp:10, threshold:10,    field:'goalsCompleted' },

  // Journal
  { id:'jn_1',    cat:'journal', icon:'📝',  name:'First Entry',      desc:'Wrote your first journal entry.',             how:'Write 1 journal entry.',              xp:10, threshold:1,     field:'journalEntries' },
  { id:'jn_7',    cat:'journal', icon:'✍️',  name:'Regular Writer',   desc:'7 journal entries — a real habit.',           how:'Write 7 journal entries.',            xp:10, threshold:7,     field:'journalEntries' },
  { id:'jn_30',   cat:'journal', icon:'📚',  name:'Chronicler',       desc:'30 entries — your story continues.',          how:'Write 30 journal entries.',           xp:10, threshold:30,    field:'journalEntries' },

  // Special
  { id:'sp_owl',  cat:'special', icon:'🦉',  name:'Night Owl',        desc:'Started a focus session after 10 PM.',        how:'Begin a focus session after 10:00 PM.',xp:10, threshold:1,    field:'nightSessions' },
  { id:'sp_bird', cat:'special', icon:'🐦',  name:'Early Bird',       desc:'Started a focus session before 7 AM.',        how:'Begin a focus session before 7:00 AM.',xp:10, threshold:1,    field:'morningSessions' },
  { id:'sp_hab3', cat:'special', icon:'🌿',  name:'Habit Sprout',     desc:'Maintained a habit for 3 days.',              how:'Keep any habit streak for 3 days.',   xp:10, threshold:3,     field:'habitStreak' },
  { id:'sp_hab7', cat:'special', icon:'🌳',  name:'Habit Tree',       desc:'Maintained a habit for 7 days straight.',     how:'Keep any habit streak for 7 days.',   xp:10, threshold:7,     field:'habitStreak' },
];

const CATEGORIES = [
  { key: 'all',     label: 'All'         },
  { key: 'focus',   label: 'Focus Time'  },
  { key: 'session', label: 'Sessions'    },
  { key: 'streak',  label: 'Streaks'     },
  { key: 'goals',   label: 'Goals'       },
  { key: 'journal', label: 'Journal'     },
  { key: 'special', label: 'Special'     },
];

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Achievements() {
  const { docs: sessions }  = useCollection('studySessions');
  const { docs: goals }     = useCollection('goals');
  const { docs: entries }   = useCollection('journalEntries');
  const { docs: habits }    = useCollection('habits');
  const { docs: checkins }  = useCollection('habitCheckins');

  const [catFilter, setCatFilter] = useState('all');
  const [selected,  setSelected]  = useState(null);

  // Compute stats from Firestore data
  const stats = useMemo(() => {
    const totalMins = sessions.reduce((sum, s) => sum + (s.duration ?? 0), 0);
    const sessCount = sessions.length;

    // Streak — consecutive days with sessions
    const daySet = new Set(sessions.map(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date();
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) streak++;
      else break;
    }

    const goalsCompleted = goals.filter(g => g.done).length;
    const journalEntries = entries.length;

    // Night/Morning sessions
    const nightSessions = sessions.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(0);
      return d.getHours() >= 22;
    }).length;
    const morningSessions = sessions.filter(s => {
      const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(0);
      return d.getHours() < 7;
    }).length;

    // Habit streak (best among all habits)
    const checkinMap = {};
    checkins.forEach(c => {
      if (!checkinMap[c.habitId]) checkinMap[c.habitId] = new Set();
      checkinMap[c.habitId].add(c.dateKey);
    });
    let habitStreak = 0;
    habits.forEach(h => {
      let s = 0;
      const t = new Date();
      for (let i = 0; i <= 365; i++) {
        const d = new Date(t);
        d.setDate(t.getDate() - i);
        const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (checkinMap[h.id]?.has(dk)) s++;
        else break;
      }
      if (s > habitStreak) habitStreak = s;
    });

    return { totalMins, sessions: sessCount, streak, goalsCompleted, journalEntries, nightSessions, morningSessions, habitStreak };
  }, [sessions, goals, entries, habits, checkins]);

  // Determine unlocked achievements + when
  const unlockedIds = useMemo(() => {
    const result = {};
    ACHIEVEMENTS.forEach(a => {
      const val = stats[a.field] ?? 0;
      if (val >= a.threshold) {
        // Try to find earliest date from relevant collection
        result[a.id] = true;
      }
    });
    return result;
  }, [stats]);

  const unlockedCount = Object.keys(unlockedIds).length;
  const totalXP       = unlockedCount * 10;
  const rarestAch     = ACHIEVEMENTS.filter(a => unlockedIds[a.id]).pop() ?? ACHIEVEMENTS[0];

  const filtered = catFilter === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter(a => a.cat === catFilter);

  return (
    <div className="layout animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Achievements</h1>
          <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'0.25rem' }}>
            {unlockedCount}/{ACHIEVEMENTS.length} unlocked · {totalXP} XP earned
          </p>
        </div>
      </div>

      {/* Hero */}
      <div className="achievements-hero animate-in">
        <div className="achievements-hero-stats">
          <div className="ach-hero-stat">
            <span className="ach-hero-value">{unlockedCount}</span>
            <span className="ach-hero-label">Unlocked</span>
          </div>
          <div className="ach-hero-stat">
            <span className="ach-hero-value">{ACHIEVEMENTS.length - unlockedCount}</span>
            <span className="ach-hero-label">Remaining</span>
          </div>
          <div className="ach-hero-stat">
            <span className="ach-hero-value">{totalXP}</span>
            <span className="ach-hero-label">Total XP</span>
          </div>
          <div className="ach-hero-stat">
            <span className="ach-hero-value">{Math.round((unlockedCount/ACHIEVEMENTS.length)*100)}%</span>
            <span className="ach-hero-label">Completion</span>
          </div>
        </div>
        {unlockedCount > 0 && (
          <div className="ach-hero-rarest">
            <span className="ach-hero-rarest-icon">{rarestAch.icon}</span>
            <span className="ach-hero-rarest-label">Latest Earned</span>
            <span className="ach-hero-rarest-name">{rarestAch.name}</span>
          </div>
        )}
      </div>

      {/* Category filter */}
      <div className="ach-filters">
        {CATEGORIES.map(c => (
          <button key={c.key}
            className={`ach-filter-btn${catFilter === c.key ? ' active' : ''}`}
            onClick={() => setCatFilter(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="achievements-grid stagger">
        {filtered.map(a => {
          const unlocked = !!unlockedIds[a.id];
          return (
            <div key={a.id}
              className={`ach-card${unlocked ? ' unlocked' : ' locked'}`}
              onClick={() => setSelected(a)}
              role="button"
              tabIndex={0}
              onKeyDown={ev => ev.key === 'Enter' && setSelected(a)}
            >
              {unlocked && <span className="ach-unlocked-badge">✓</span>}

              <div className="ach-icon-wrap">
                {unlocked
                  ? <span style={{ fontSize:'1.8rem' }}>{a.icon}</span>
                  : <>
                      <span style={{ fontSize:'1.8rem' }}>{a.icon}</span>
                      <div className="ach-locked-overlay">🔒</div>
                    </>
                }
              </div>

              <div className="ach-name">{unlocked ? a.name : '???'}</div>
              <div className="ach-desc">{unlocked ? a.desc : 'Keep going to unlock this achievement'}</div>
              <span className="ach-xp">{a.xp} XP</span>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="ach-modal-overlay" onClick={() => setSelected(null)}>
          <div className="ach-modal" onClick={e => e.stopPropagation()}>
            <span className="ach-modal-icon">{selected.icon}</span>
            <div className="ach-modal-title">{selected.name}</div>
            <div className="ach-modal-desc">{selected.desc}</div>
            <div className="ach-modal-how">
              <strong>How to earn: </strong>{selected.how}
            </div>
            <span className="ach-xp" style={{ fontSize:'0.78rem' }}>{selected.xp} XP</span>
            {unlockedIds[selected.id] && (
              <div className="ach-earned-date" style={{ color:'var(--success)', fontWeight:700 }}>
                ✓ Earned!
              </div>
            )}
            <button className="ach-modal-close" onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
