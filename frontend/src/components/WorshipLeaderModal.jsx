import React, { useState, useEffect } from 'react';
import { X, Mic, UserCheck, Shield } from 'lucide-react';
import { api } from '../api';

export default function WorshipLeaderModal({ isOpen, onClose, service, onLeaderUpdated }) {
  const [musicians, setMusicians] = useState([]);
  const [selectedLeaderId, setSelectedLeaderId] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedLeaderId(service?.worship_leader_id || '');
      setShowAll(false);
      loadMusicians();
    }
  }, [isOpen, service]);

  async function loadMusicians() {
    setLoading(true);
    try {
      const data = await api.getMusicians({ active: 'true' });
      setMusicians(data);
    } catch (err) {
      setError('Failed to load musicians list');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const result = await api.setWorshipLeader(service.id, selectedLeaderId || null);
      onLeaderUpdated(result.service);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update worship leader');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  // Filter only musicians tagged with Worship Leader, Lead Vocals, or Vocals
  const isWorshipLeaderRole = (m) => {
    if (!Array.isArray(m.roles)) return false;
    return m.roles.some((r) => {
      const rLower = r.toLowerCase().trim();
      return (
        rLower === 'worship leader' ||
        rLower.includes('worship leader') ||
        rLower === 'lead vocals' ||
        rLower.includes('vocals')
      );
    });
  };

  const eligibleMusicians = musicians.filter(isWorshipLeaderRole);
  const displayedMusicians = showAll
    ? musicians
    : (eligibleMusicians.length > 0 ? eligibleMusicians : musicians);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <Mic className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Pastor: Select Worship Leader</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          The Worship Leader is selected independently before auto-shuffling instrument slots.
          Selecting a leader automatically excludes them from instrument slot assignments.
        </p>

        {error && (
          <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Worship Leader
              </label>
              {!loading && eligibleMusicians.length > 0 && (
                <span className="text-[11px] text-red-600 dark:text-red-400 font-bold">
                  {showAll ? `All (${musicians.length})` : `Worship Leaders (${eligibleMusicians.length})`}
                </span>
              )}
            </div>

            {loading ? (
              <div className="text-xs text-slate-400 py-3 text-center">Loading roster...</div>
            ) : (
              <select
                value={selectedLeaderId}
                onChange={(e) => setSelectedLeaderId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
              >
                <option value="">-- No Worship Leader Assigned --</option>
                {displayedMusicians.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.roles?.length ? `(${m.roles.join(', ')})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!loading && (
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="show-all-wl"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="w-4 h-4 rounded text-red-600 focus:ring-red-500 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
              />
              <label htmlFor="show-all-wl" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                Show all team members ({musicians.length})
              </label>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Set Worship Leader'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
