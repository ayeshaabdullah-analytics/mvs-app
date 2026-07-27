import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_META } from '../context/ThemeContext';
import '../styles/navbar.css';

const NAV_ITEMS = [
  { to: '/',             label: 'Today',        icon: 'home',         end: true  },
  { to: '/goals',        label: 'Goals',        icon: 'target'                   },
  { to: '/weekly',       label: 'Weekly',       icon: 'calendar'                 },
  { to: '/focus',        label: 'Focus',        icon: 'focus'                    },
  { to: '/journal',      label: 'Journal',      icon: 'journal'                  },
  { to: '/stats',        label: 'Stats',        icon: 'chart'                    },
  { to: '/habits',       label: 'Habits',       icon: 'habits'                   },
  { to: '/achievements', label: 'Achievements', icon: 'achievements'             },
];

const MOBILE_ITEMS = [
  { to: '/',        label: 'Today',   icon: 'home',    end: true },
  { to: '/goals',   label: 'Goals',   icon: 'target'            },
  { to: '/focus',   label: 'Focus',   icon: 'focus'             },
  { to: '/journal', label: 'Journal', icon: 'journal'           },
  { to: '/stats',   label: 'Stats',   icon: 'chart'             },
];

function Icon({ name, size = 18 }) {
  const s = { width: size, height: size };
  const icons = {
    home: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    target: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    calendar: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
    chart: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
    focus: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    journal: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    habits: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    ),
    achievements: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6"/>
        <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
      </svg>
    ),
    logout: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
    palette: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
        <circle cx="8" cy="10" r=".5" fill="currentColor"/>
        <circle cx="12" cy="7" r=".5" fill="currentColor"/>
        <circle cx="16" cy="10" r=".5" fill="currentColor"/>
      </svg>
    ),
    user: (
      <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  };
  return icons[name] ?? null;
}

export default function Navbar() {
  const { user, logout }            = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [themeOpen, setThemeOpen]   = useState(false);
  const themeRef                    = useRef(null);
  const navigate                    = useNavigate();

  useEffect(() => {
    const h = (e) => {
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const initials    = user?.displayName
    ? user.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?';
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <nav className="sidebar" role="navigation" aria-label="Main navigation">

        {/* Logo */}
        <NavLink to="/" className="sidebar-logo" aria-label="MVS Home">
          <span className="sidebar-logo-text">MVS</span>
          <span className="sidebar-logo-dot" aria-hidden="true" />
        </NavLink>

        {/* Nav items */}
        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-tooltip={label}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <Icon name={icon} />
              <span className="sidebar-link-label">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Bottom: user + theme switcher */}
        <div className="sidebar-bottom">
          {/* Theme panel (shows above when open) */}
          <div ref={themeRef} style={{ position: 'relative' }}>
            {themeOpen && (
              <div className="sidebar-theme-panel">
                {Object.keys(themes).map((t) => (
                  <button
                    key={t}
                    className={`sidebar-theme-item${theme === t ? ' active' : ''}`}
                    onClick={() => { setTheme(t); setThemeOpen(false); }}
                  >
                    <span style={{ fontSize: '1rem' }}>{THEME_META[t]?.icon}</span>
                    <span style={{ flex: 1 }}>{THEME_META[t]?.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{THEME_META[t]?.desc}</span>
                    {theme === t && <span className="sidebar-theme-item-check">✓</span>}
                  </button>
                ))}
              </div>
            )}

            <button
              className="sidebar-theme-btn"
              onClick={() => setThemeOpen(v => !v)}
              aria-label="Switch theme"
              aria-expanded={themeOpen}
            >
              <Icon name="palette" size={15} />
              <span>{THEME_META[theme]?.icon} {THEME_META[theme]?.label}</span>
            </button>
          </div>

          {/* User info */}
          <NavLink to="/profile" className="sidebar-user" onClick={() => setThemeOpen(false)}>
            <div className="sidebar-avatar">
              {user?.photoURL
                ? <img src={user.photoURL} alt={initials} referrerPolicy="no-referrer" />
                : <span>{initials}</span>
              }
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
          </NavLink>

          {/* Logout */}
          <button className="sidebar-logout-btn" onClick={handleLogout} aria-label="Sign out">
            <Icon name="logout" size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="mobile-tabs" role="navigation" aria-label="Mobile navigation">
        {MOBILE_ITEMS.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `mobile-tab${isActive ? ' active' : ''}`}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
