import { useState, useMemo } from 'react';
import { useCollection, useAdd, useDelete } from '../hooks/useFirestore';
import '../styles/journal.css';

const MOODS = [
  { emoji: '🔥', label: 'Fired up',  value: 5 },
  { emoji: '😊', label: 'Good',      value: 4 },
  { emoji: '😐', label: 'Okay',      value: 3 },
  { emoji: '😔', label: 'Low',       value: 2 },
  { emoji: '😩', label: 'Exhausted', value: 1 },
];

const PROMPTS = [
  'What did I accomplish today?',
  'What challenged me today?',
  'What am I grateful for right now?',
  'What will I focus on tomorrow?',
  'What did I discover or learn today?',
  'What drained my energy? What gave me energy?',
];

export default function Journal() {
  const { docs: entries, loading } = useCollection('journalEntries');
  const addEntry    = useAdd('journalEntries');
  const deleteEntry = useDelete('journalEntries');

  const [mood,       setMood]       = useState(null);
  const [title,      setTitle]      = useState('');
  const [body,       setBody]       = useState('');
  const [tagInput,   setTagInput]   = useState('');
  const [tags,       setTags]       = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [expanded,   setExpanded]   = useState({});
  const [filterMood, setFilterMood] = useState(null);
  const [filterDate, setFilterDate] = useState(null);
  const [prompt,     setPrompt]     = useState('');

  // Calendar: last 14 days
  const calDays = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
      days.push(d);
    }
    return days;
  }, []);

  const entryDates = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      const d = new Date(e.createdAt?.toDate?.() ?? e.createdAt ?? Date.now());
      set.add(d.toDateString());
    });
    return set;
  }, [entries]);

  const sorted = useMemo(() => {
    let list = [...entries].sort((a, b) => {
      const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt ?? 0);
      const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt ?? 0);
      return tb - ta;
    });
    if (filterMood !== null) list = list.filter((e) => e.mood === filterMood);
    if (filterDate) list = list.filter((e) => {
      const d = new Date(e.createdAt?.toDate?.() ?? e.createdAt ?? 0);
      return d.toDateString() === filterDate;
    });
    return list;
  }, [entries, filterMood, filterDate]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      await addEntry({ mood: mood ?? 3, title: title.trim(), body: body.trim(), tags });
      setMood(null); setTitle(''); setBody(''); setTags([]); setTagInput(''); setPrompt('');
    } finally { setSaving(false); }
  };

  const addTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/^#/, '');
      if (t && !tags.includes(t)) setTags([...tags, t]);
      setTagInput('');
    }
  };

  const randomPrompt = () => setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);

  const todayMood = useMemo(() => {
    const today = new Date().toDateString();
    const todayEntry = entries.find((e) => {
      const d = new Date(e.createdAt?.toDate?.() ?? e.createdAt ?? 0);
      return d.toDateString() === today;
    });
    return todayEntry ? MOODS.find((m) => m.value === todayEntry.mood) : null;
  }, [entries]);

  if (loading) return <div className="spinner" />;

  return (
    <div className="layout animate-in">
      <div className="journal-header-bar">
        <div>
          <h1 className="page-title">Journal</h1>
          <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', marginTop:'0.2rem' }}>
            Daily reflections &amp; mood tracking
            {todayMood && <span style={{ marginLeft:'0.5rem' }}>· Today: {todayMood.emoji} {todayMood.label}</span>}
          </p>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          {filterMood !== null && (
            <button className="btn-secondary" style={{ fontSize:'0.78rem' }} onClick={() => setFilterMood(null)}>
              Clear filter ✕
            </button>
          )}
          {filterDate && (
            <button className="btn-secondary" style={{ fontSize:'0.78rem' }} onClick={() => setFilterDate(null)}>
              Clear date ✕
            </button>
          )}
        </div>
      </div>

      {/* Mood filter row */}
      <div className="mood-row">
        <span className="mood-label">Filter mood:</span>
        {MOODS.map((m) => (
          <button key={m.value} className={`mood-btn${filterMood === m.value ? ' active' : ''}`}
            onClick={() => setFilterMood(filterMood === m.value ? null : m.value)} title={m.label}>
            {m.emoji}
          </button>
        ))}
        {filterMood !== null && <span className="mood-name">{MOODS.find(m => m.value === filterMood)?.label}</span>}
      </div>

      {/* 14-day calendar strip */}
      <div className="journal-calendar">
        {calDays.map((d) => {
          const isToday  = d.toDateString() === new Date().toDateString();
          const hasEntry = entryDates.has(d.toDateString());
          const isActive = filterDate === d.toDateString();
          return (
            <div key={d.toISOString()} className={`cal-day${isToday ? ' today' : ''}${hasEntry ? ' has-entry' : ''}${isActive ? ' active' : ''}`}
              onClick={() => setFilterDate(isActive ? null : d.toDateString())}>
              <span className="cal-day-name">{d.toLocaleDateString('en-US',{weekday:'short'}).slice(0,2)}</span>
              <span className="cal-day-num">{d.getDate()}</span>
              <span className="cal-day-dot" />
            </div>
          );
        })}
      </div>

      {/* New entry form */}
      <form className="journal-form" onSubmit={handleSave}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
          <p style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)' }}>New Entry</p>
          <button type="button" className="btn-ghost" style={{ fontSize:'0.78rem' }} onClick={randomPrompt}>✨ Get prompt</button>
        </div>
        {/* Mood pick */}
        <div style={{ display:'flex', gap:'0.45rem', alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.72rem', color:'var(--text-faint)', fontWeight:600 }}>How are you feeling?</span>
          {MOODS.map((m) => (
            <button key={m.value} type="button" className={`mood-btn${mood === m.value ? ' active' : ''}`}
              onClick={() => setMood(m.value)} title={m.label}>{m.emoji}</button>
          ))}
          {mood && <span style={{ fontSize:'0.75rem', color:'var(--primary)', fontWeight:700, marginLeft:'auto' }}>{MOODS.find(m2=>m2.value===mood)?.label}</span>}
        </div>
        {prompt && (
          <div style={{ fontSize:'0.84rem', color:'var(--primary)', background:'var(--primary-soft)', borderRadius:'var(--radius-sm)', padding:'0.6rem 0.9rem', borderLeft:'3px solid var(--primary)' }}>
            💭 {prompt}
          </div>
        )}
        <input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <textarea placeholder={prompt || 'Write your thoughts, reflections, or anything on your mind…'} value={body} onChange={(e) => setBody(e.target.value)} required />
          <p className="journal-char-count">{body.length} chars</p>
        </div>
        <div className="journal-form-tags">
          <span style={{ fontSize:'0.72rem', color:'var(--text-faint)', fontWeight:600 }}>#Tags:</span>
          {tags.map((t) => (
            <span key={t} className="tag-chip">#{t}
              <button type="button" className="tag-chip-remove" onClick={() => setTags(tags.filter(x => x !== t))}>✕</button>
            </span>
          ))}
          <input className="journal-tag-input" placeholder="Add tag, press Enter" value={tagInput}
            onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving || !body.trim()}>
          {saving ? 'Saving…' : '📝 Save Entry'}
        </button>
      </form>

      {/* Entry list */}
      {sorted.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>📔</div>
          No entries yet. Write your first reflection above!
        </div>
      )}

      <div className="journal-entries">
        {sorted.map((entry) => {
          const isExpanded = expanded[entry.id];
          const createdAt  = entry.createdAt?.toDate?.() ?? new Date(entry.createdAt ?? 0);
          const dateStr    = createdAt.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });
          const timeStr    = createdAt.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
          const moodObj    = MOODS.find((m) => m.value === entry.mood) ?? MOODS[2];
          return (
            <div key={entry.id} className="journal-entry">
              <div className="journal-entry-header">
                <span className="journal-entry-mood">{moodObj.emoji}</span>
                <div className="journal-entry-meta">
                  {entry.title && <div className="journal-entry-title">{entry.title}</div>}
                  <div className="journal-entry-date">{dateStr} · {timeStr} · {moodObj.label}</div>
                </div>
                <div className="journal-entry-actions">
                  <button className="btn-danger" style={{ padding:'0.2rem 0.45rem', fontSize:'0.72rem' }}
                    onClick={() => deleteEntry(entry.id)}>✕</button>
                </div>
              </div>
              <p className={`journal-entry-body${isExpanded ? '' : ' clamped'}`}>{entry.body}</p>
              {entry.body.length > 280 && (
                <button className="journal-read-more" onClick={() => setExpanded(p => ({ ...p, [entry.id]: !p[entry.id] }))}>
                  {isExpanded ? 'Show less ▲' : 'Read more ▼'}
                </button>
              )}
              {entry.tags?.length > 0 && (
                <div className="journal-entry-tags">
                  {entry.tags.map((t) => <span key={t} className="tag-chip">#{t}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
