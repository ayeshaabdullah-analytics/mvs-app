import { useEffect, useState } from 'react';

// ── Global toast state (simple singleton) ────────────────
let _setToasts = null;

export function showToast(message, type = 'success') {
  if (_setToasts) {
    const id = Date.now() + Math.random();
    _setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      _setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }
}

// ── Toast container — mount once in App ──────────────────
export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;

  return (
    <div style={{
      position: 'fixed',
      bottom: '5rem',
      right: '1.25rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.type === 'success' ? 'var(--success)' : t.type === 'error' ? 'var(--danger)' : 'var(--primary)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 1.1rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'slideUp 0.22s cubic-bezier(0.16,1,0.3,1) both',
            minWidth: '180px',
            maxWidth: '320px',
          }}
        >
          <span>{t.type === 'success' ? '✓' : '!'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
