import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Check, X, Phone, Mail, Calendar } from 'lucide-react';
import { api } from '../api';
import { formatLastServed } from '../utils/date';

const AVAILABLE_ROLES = [
  'Worship Leader',
  'Drums',
  'Bass',
  'Acoustic Guitar',
  'Electric Guitar',
  'Keys',
  'Vocals',
  'Lead Vocals',
  'Backing Vocals',
  'Sound',
  'AV/Media',
];

export default function MusiciansManager() {
  const [musicians, setMusicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMusician, setEditingMusician] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    roles: [],
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMusicians();
  }, []);

  async function loadMusicians() {
    setLoading(true);
    try {
      const data = await api.getMusicians();
      setMusicians(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingMusician(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      roles: ['Vocals'],
      active: true,
    });
    setError('');
    setIsModalOpen(true);
  }

  function openEditModal(m) {
    setEditingMusician(m);
    setFormData({
      name: m.name,
      email: m.email || '',
      phone: m.phone || '',
      roles: m.roles || [],
      active: m.active !== false,
    });
    setError('');
    setIsModalOpen(true);
  }

  function toggleRole(role) {
    setFormData((prev) => {
      const exists = prev.roles.includes(role);
      return {
        ...prev,
        roles: exists ? prev.roles.filter((r) => r !== role) : [...prev.roles, role],
      };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingMusician) {
        await api.updateMusician(editingMusician.id, formData);
      } else {
        await api.createMusician(formData);
      }
      setIsModalOpen(false);
      loadMusicians();
    } catch (err) {
      setError(err.message || 'Failed to save musician');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to deactivate this musician?')) return;
    try {
      await api.deleteMusician(id);
      loadMusicians();
    } catch (err) {
      alert('Failed to deactivate musician');
    }
  }



  const filteredMusicians = musicians.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.roles && m.roles.some((r) => r.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Musician Roster</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Add team members and tag them with their instruments and vocal capabilities.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Musician</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
        <input
          type="text"
          placeholder="Filter by name or instrument..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading roster...</div>
        ) : filteredMusicians.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">No musicians found.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredMusicians.map((m) => (
              <div
                key={m.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-850/50 transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-2.5">
                    <span className="font-bold text-white text-base">{m.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.active
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {m.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Role Tags */}
                  <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    {(m.roles || []).map((r) => (
                      <span
                        key={r}
                        className="text-xs bg-indigo-950/70 border border-indigo-800/40 text-indigo-300 px-2.5 py-0.5 rounded-md font-medium"
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  {/* Contact & Serving history */}
                  <div className="flex items-center space-x-4 text-xs text-slate-400 mt-2 flex-wrap gap-y-1">
                    {m.email && (
                      <span className="flex items-center space-x-1">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{m.email}</span>
                      </span>
                    )}
                    {m.phone && (
                      <span className="flex items-center space-x-1">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{m.phone}</span>
                      </span>
                    )}
                    <span className="text-slate-500">•</span>
                    <span>Last served: <strong className="text-slate-300">{formatLastServed(m.last_served_date)}</strong></span>
                    <span>({m.total_confirmed_serves || 0} total)</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => openEditModal(m)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    title="Edit Musician"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-colors"
                    title="Deactivate"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Musician Edit / Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingMusician ? 'Edit Musician' : 'Add New Musician'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="555-0199"
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Roles chips selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Instruments & Roles Tagged
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ROLES.map((r) => {
                    const isSelected = formData.roles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {isSelected ? `✓ ${r}` : `+ ${r}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active status */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="active-toggle"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="active-toggle" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Active team member (eligible for auto-rostering)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Musician'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
