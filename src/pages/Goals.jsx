import { useState, useCallback } from 'react';
import { useCollection, useAdd, useUpdate, useDelete } from '../hooks/useFirestore';
import { getPeriodOptions } from '../utils/dates';
import '../styles/goals.css';

const LEVELS      = ['year', 'quarter', 'month'];
const LEVEL_ICONS = { year: '🗓', quarter: '📆', month: '🗒' };
const LEVEL_LABELS = { year: 'Yearly', quarter: 'Quarterly', month: 'Monthly' };
const EMPTY_FORM  = { title: '', level: 'year', periodLabel: '' };

export default function Goals() {
  const { docs: goals, loading } = useCollection('horizonGoals');
  const addGoal    = useAdd('horizonGoals');
  const updateGoal = useUpdate('horizonGoals');
  const deleteGoal = useDelete('horizonGoals');

  const [addingFor, setAddingFor] = useState(null); // which level column is open
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [filter,    setFilter]    = useState('all');
  const [saving,    setSaving]    = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.periodLabel || saving) return;
    const snapshot = { ...form, status: 'active' };
    setSaving(true);
    setAddingFor(null);
    setForm(EMPTY_FORM);
    try { await addGoal(snapshot); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const id = editId;
    setEditId(null);
    await updateGoal(id, editForm);
  };

  const toggleStatus = useCallback(
    (goal) => updateGoal(goal.id, { status: goal.status === 'done' ? 'active' : 'done' }),
    [updateGoal]
  );

  const openAdd = (lvl) => {
    setForm({ ...EMPTY_FORM, level: lvl });
    setAddingFor(lvl);
    setTimeout(() => document.getElementById(`goal-input-${lvl}`)?.focus(), 50);
  };

  const filteredGoals = (lvl) => {
    const list = goals.filter((g) => g.level === lvl);
    if (filter === 'active') return list.filter((g) => g.status === 'active');
    if (filter === 'done')   return list.filter((g) => g.status === 'done');
    return list;
  };

  if (loading) return <div className="spinner" />;

  const totalActive = goals.filter((g) => g.status === 'active').length;
  const totalDone   = goals.filter((g) => g.status === 'done').length;
  const totalAll    = goals.length;

  return (
    <div className="layout animate-in">

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Horizon Goals</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Long-term milestones across year, quarter &amp; month
          </p>
        </div>
        <div className="goals-filter">
          {['all', 'active', 'done'].map((f) => (
            <button
              key={f}
              className={`goals-filter-btn${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `All (${totalAll})` : f === 'active' ? `Active (${totalActive})` : `Done (${totalDone})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="goals-summary">
        <div className="goals-sum-card">
          <span className="goals-sum-icon">🎯</span>
          <div className="goals-sum-info">
            <div className="goals-sum-value">{totalActive}</div>
            <div className="goals-sum-label">Active goals</div>
          </div>
        </div>
        <div className="goals-sum-card">
          <span className="goals-sum-icon">✅</span>
          <div className="goals-sum-info">
            <div className="goals-sum-value" style={{ color: 'var(--success)' }}>{totalDone}</div>
            <div className="goals-sum-label">Achieved</div>
          </div>
        </div>
        <div className="goals-sum-card">
          <span className="goals-sum-icon">📊</span>
          <div className="goals-sum-info">
            <div className="goals-sum-value" style={{ color: 'var(--warning)' }}>
              {totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0}%
            </div>
            <div className="goals-sum-label">Completion rate</div>
          </div>
        </div>
      </div>

      {/* ── Three-column layout ── */}
      <div className="goals-columns">
        {LEVELS.map((lvl) => {
          const list        = filteredGoals(lvl);
          const allForLevel = goals.filter((g) => g.level === lvl);
          const doneCount   = allForLevel.filter((g) => g.status === 'done').length;
          const pct         = allForLevel.length ? Math.round((doneCount / allForLevel.length) * 100) : 0;
          const isAddingHere = addingFor === lvl;

          return (
            <div key={lvl} className="goal-section">
              {/* Column header */}
              <div className="goal-section-header">
                <div className="goal-section-top">
                  <div className="goal-section-title">
                    <span className={`badge tag-${lvl}`}>{LEVEL_ICONS[lvl]} {LEVEL_LABELS[lvl]}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="goal-section-count">{allForLevel.length}</span>
                    {allForLevel.length > 0 && (
                      <span className="goal-section-pct">{pct}%</span>
                    )}
                  </div>
                </div>
                {allForLevel.length > 0 && (
                  <div className="section-progress-bar">
                    <div className="section-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>

              {/* Column body */}
              <div className="goal-section-body">

                {/* Inline add form */}
                {isAddingHere && (
                  <form className="inline-add-form" onSubmit={handleAdd}>
                    <input
                      id={`goal-input-${lvl}`}
                      placeholder="What's the big goal?"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                      autoFocus
                    />
                    <select
                      value={form.periodLabel}
                      onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
                      required
                    >
                      <option value="">Select period…</option>
                      {getPeriodOptions(lvl).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <div className="edit-actions">
                      <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => { setAddingFor(null); setForm(EMPTY_FORM); }}>
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {/* Empty placeholder */}
                {list.length === 0 && filter === 'all' && !isAddingHere && (
                  <button className="level-empty" onClick={() => openAdd(lvl)}>
                    <span className="level-empty-icon">{LEVEL_ICONS[lvl]}</span>
                    <span>Add a {lvl} goal</span>
                  </button>
                )}

                {list.length === 0 && filter !== 'all' && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)', padding: '0.5rem 0', textAlign: 'center' }}>
                    Nothing to show.
                  </p>
                )}

                {/* Goal items */}
                {list.map((goal) =>
                  editId === goal.id ? (
                    <div key={goal.id} className="goal-item">
                      <form onSubmit={handleEdit} className="edit-form">
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          required
                          autoFocus
                        />
                        <select
                          value={editForm.periodLabel}
                          onChange={(e) => setEditForm({ ...editForm, periodLabel: e.target.value })}
                        >
                          {getPeriodOptions(goal.level).map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <div className="edit-actions">
                          <button type="submit" className="btn-secondary">Save</button>
                          <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      </form>
                    </div>
                  ) : (
                    <div key={goal.id} className={`goal-item${goal.status === 'done' ? ' done' : ''}`}>
                      <div className="goal-item-row">
                        <button
                          className={`done-check${goal.status === 'done' ? ' checked' : ''}`}
                          onClick={() => toggleStatus(goal)}
                          aria-label={goal.status === 'done' ? 'Mark active' : 'Mark done'}
                        >
                          {goal.status === 'done' ? '✓' : ''}
                        </button>
                        <div className="goal-text">
                          <span className="goal-title">{goal.title}</span>
                          <span className="goal-period">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5, flexShrink: 0 }}>
                              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            {goal.periodLabel}
                          </span>
                        </div>
                        <div className="goal-actions">
                          <button
                            className="btn-ghost"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            onClick={() => { setEditId(goal.id); setEditForm({ title: goal.title, periodLabel: goal.periodLabel }); }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}
                            onClick={() => deleteGoal(goal.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Add button at bottom of column */}
                {!isAddingHere && (
                  <button className="col-add-btn" onClick={() => openAdd(lvl)}>
                    + Add {lvl} goal
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
