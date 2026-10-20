import React, { useState, useEffect } from 'react';
import { Sliders, Plus, Edit2, Trash2, X, HeartHandshake, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function PositionsManager() {
  const [positions, setPositions] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [name, setName] = useState('');
  const [ministryId, setMinistryId] = useState('');
  const [ministryName, setMinistryName] = useState('Media Team');
  const [sortOrder, setSortOrder] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [posData, minData] = await Promise.all([
        api.getPositions().catch(() => []),
        api.getMinistries().catch(() => []),
      ]);
      setPositions(Array.isArray(posData) ? posData : []);
      const minList = Array.isArray(minData) ? minData : [];
      setMinistries(minList);
    } catch (err) {
      console.error('Failed to load positions/ministries:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingPos(null);
    setName('');
    const defaultMin = ministries[0];
    setMinistryId(defaultMin ? defaultMin.id : '');
    setMinistryName(defaultMin ? defaultMin.name : 'Media Team');
    setSortOrder((positions.length + 1).toString());
    setError('');
    setIsModalOpen(true);
  }

  function openEditModal(pos) {
    setEditingPos(pos);
    setName(pos.name || '');
    const matchedMin = ministries.find(
      (m) => m.id === pos.ministry_id || m.name.toLowerCase() === (pos.ministry || '').toLowerCase()
    );
    setMinistryId(matchedMin ? matchedMin.id : (pos.ministry_id || ''));
    setMinistryName(matchedMin ? matchedMin.name : (pos.ministry || 'Media Team'));
    setSortOrder((pos.sort_order ?? 1).toString());
    setError('');
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Position name is required');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      name: name.trim(),
      ministry: ministryName,
      ministry_id: ministryId || null,
      sort_order: parseInt(sortOrder, 10) || 0,
    };

    try {
      if (editingPos) {
        await api.updatePosition(editingPos.id, payload);
      } else {
        await api.createPosition(payload);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to save position');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this position template?')) return;
    try {
      await api.deletePosition(id);
      loadData();
    } catch (err) {
      alert('Failed to delete position');
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-red-600" />
            <span>Positions & Roles</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure ministry positions. Volunteers who select these positions are automatically enrolled into the parent ministry.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Position</span>
        </button>
      </div>

      {/* Ministries Status Card */}
      {ministries.length === 0 && !loading && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <strong>No Ministries configured yet:</strong> Go to the <strong>Ministries</strong> tab to create departments (e.g. Media Team, Worship Team) first so positions can be grouped under them.
          </div>
        </div>
      )}

      {/* Positions list */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-colors">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading positions and ministries...</div>
        ) : positions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">No positions created yet. Click "+ Add Position" to create your first ministry position.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {positions.map((pos) => (
              <div
                key={pos.id}
                className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-center text-xs font-black">
                    #{pos.sort_order}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{pos.name}</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20 flex items-center gap-1">
                        <HeartHandshake className="w-3 h-3 text-red-600" />
                        <span>{pos.ministry || 'Media Team'}</span>
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Assigning this position auto-enrolls members into <strong>{pos.ministry || 'Media Team'}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditModal(pos)}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                    title="Edit Position"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pos.id)}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-500/20 text-slate-500 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500/30 transition-colors cursor-pointer"
                    title="Delete Position"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-red-600" />
                <span>{editingPos ? 'Edit Position' : 'Create New Position'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Position Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PP7, Lead Guitar, Sound Engineer, Camera 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Ministry (Dropdown) *
                </label>
                <select
                  value={ministryId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setMinistryId(selId);
                    const found = ministries.find((m) => m.id === selId);
                    if (found) setMinistryName(found.name);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500 cursor-pointer font-bold"
                >
                  {ministries.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  {ministries.length === 0 && (
                    <option value="">No ministries available — create in Ministries tab first</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  When people select this position, they will be automatically enrolled into <strong>{ministryName}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Display Sort Order
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingPos ? 'Update Position' : 'Create Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
