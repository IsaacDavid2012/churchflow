import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Calendar, 
  MapPin, 
  Clock, 
  Edit2, 
  Trash2, 
  X, 
  Sparkles,
  HeartHandshake,
  Phone,
  MessageCircle,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { api } from '../api';
import { ROLES, normalizeRole, hasRole } from '../utils/roles';
import MinistryHub from './MinistryHub';

const CATEGORIES = [
  'Worship & Music',
  'Production & Tech',
  'Media & Tech',
  'Hospitality & Welcome',
  'Prayer & Pastoral Care',
  'NextGen & Children',
  'Youth & Young Adults',
  'Outreach & Missions'
];

export default function MinistriesManager({ currentUser }) {
  const [ministries, setMinistries] = useState([]);
  const [selectedMinistry, setSelectedMinistry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Role permissions
  const userRole = normalizeRole(currentUser?.role);
  const isMember = userRole === ROLES.MEMBER;
  const canManage = !isMember; // Admin, Pastor, Manager
  const canDelete = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]); // Admin, Pastor

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMinistry, setEditingMinistry] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Worship & Music',
    leader_name: '',
    leader_phone: '',
    meeting_day: 'Sunday',
    meeting_time: '10:00 AM',
    location: 'Main Sanctuary',
    description: '',
    member_count: 8,
  });

  useEffect(() => {
    loadMinistries();
  }, [search, categoryFilter]);

  async function loadMinistries() {
    setLoading(true);
    try {
      const data = await api.getMinistries({ search, category: categoryFilter });
      setMinistries(data || []);
    } catch (err) {
      console.error('Failed to load ministries:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    if (isMember) return;
    setEditingMinistry(null);
    setFormData({
      name: '',
      category: 'Worship & Music',
      leader_name: '',
      leader_phone: '',
      meeting_day: 'Thursday',
      meeting_time: '8:00 PM',
      location: 'Main Sanctuary',
      description: '',
      member_count: 8,
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(m) {
    if (!canManage) return;
    setEditingMinistry(m);
    setFormData({
      name: m.name || '',
      category: m.category || 'Worship & Music',
      leader_name: m.leader_name || '',
      leader_phone: m.leader_phone || '',
      meeting_day: m.meeting_day || 'Sunday',
      meeting_time: m.meeting_time || '10:00 AM',
      location: m.location || 'Main Sanctuary',
      description: m.description || '',
      member_count: m.member_count || 0,
    });
    setIsModalOpen(true);
  }

  async function handleSaveMinistry(e) {
    e.preventDefault();
    if (isMember) {
      alert('Members have read-only access. You cannot create or modify ministries.');
      return;
    }
    if (!formData.name.trim()) return;

    try {
      if (editingMinistry) {
        await api.updateMinistry(editingMinistry.id, formData);
      } else {
        await api.createMinistry(formData);
      }
      setIsModalOpen(false);
      loadMinistries();
    } catch (err) {
      alert(err.message || 'Failed to save ministry');
    }
  }

  async function handleDeleteMinistry(m) {
    if (!canDelete) {
      alert('Only Admins and Pastors have permission to delete ministries.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the ministry "${m.name}"?`)) return;
    try {
      await api.deleteMinistry(m.id);
      loadMinistries();
    } catch (err) {
      alert(err.message || 'Failed to delete ministry');
    }
  }

  if (selectedMinistry) {
    return (
      <MinistryHub
        ministry={selectedMinistry}
        currentUser={currentUser}
        onBack={() => {
          setSelectedMinistry(null);
          loadMinistries();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              <HeartHandshake className="w-7 h-7 text-[#c59c6c]" />
              Church Ministries
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#f5ede1] text-[#8c6738] border border-[#eadbc4]">
              {ministries.length} active ministries
            </span>
            {isMember && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                <Eye className="w-3 h-3 text-slate-500" />
                Member View (Read-Only)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Jesus My Rock Church ministry departments, serving teams, leadership contacts, and schedules.
          </p>
        </div>

        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#c59c6c] hover:bg-[#b08756] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all self-start sm:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Ministry</span>
          </button>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search ministries by name, leader, location, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#c59c6c]"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c] cursor-pointer"
          >
            <option value="">All Ministry Departments</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ministries Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500">
          <div className="animate-spin w-8 h-8 border-2 border-[#c59c6c] border-t-transparent rounded-full mx-auto mb-3"></div>
          <span className="text-xs">Loading church ministries...</span>
        </div>
      ) : ministries.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-500 shadow-sm">
          <Users className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <div className="font-bold text-slate-800">No ministries found</div>
          <div className="text-xs text-slate-500 mt-1">
            {canManage ? 'Click "Create Ministry" above to set up a new church team.' : 'Check back later for active ministry schedules.'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {ministries.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#c59c6c]/60 transition-all shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{m.name}</h3>
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#f5ede1] text-[#8c6738] border border-[#eadbc4] mt-1">
                      {m.category || 'General Ministry'}
                    </span>
                  </div>

                  {/* Edit / Delete Buttons - HIDDEN for members */}
                  {canManage && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEdit(m)}
                        className="p-1.5 text-slate-400 hover:text-[#c59c6c] hover:bg-[#f5ede1] rounded-lg transition-colors cursor-pointer"
                        title="Edit Ministry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteMinistry(m)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Ministry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {m.description && (
                  <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                    {m.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#c59c6c] flex-shrink-0" />
                    <span>Leader: <strong className="text-slate-900">{m.leader_name || 'TBD'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#c59c6c] flex-shrink-0" />
                    <span>{m.meeting_day}s @ {m.meeting_time}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#c59c6c] flex-shrink-0" />
                    <span className="truncate">{m.location || 'Church Campus'}</span>
                  </div>
                </div>

                {/* Leader Contact Buttons */}
                {m.leader_phone && (
                  <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-slate-100">
                    <a
                      href={`https://wa.me/${m.leader_phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                    >
                      <MessageCircle className="w-3 h-3 text-emerald-600" />
                      WhatsApp Leader
                    </a>
                    <a
                      href={`tel:${m.leader_phone}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors"
                    >
                      <Phone className="w-3 h-3 text-slate-500" />
                      Call
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Serving Volunteers</span>
                <span className="font-bold text-[#8c6738] bg-[#f5ede1] px-2 py-0.5 rounded-md border border-[#eadbc4]">
                  {m.member_count} members serving
                </span>
              </div>

              {/* Enter Ministry Hub Button */}
              <button
                onClick={() => setSelectedMinistry(m)}
                className="flex items-center justify-center space-x-1.5 w-full py-2.5 px-3 mt-3 rounded-xl bg-gradient-to-r from-[#c59c6c] to-[#b08756] hover:from-[#b08756] hover:to-[#9b7242] text-white font-bold text-xs shadow-md shadow-[#c59c6c]/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Open {m.name} Hub</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Ministry Modal - Strictly for Admin, Pastor, Manager */}
      {isModalOpen && canManage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-colors">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">
                {editingMinistry ? 'Edit Church Ministry' : 'Create New Ministry'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMinistry} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Ministry Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Worship Ministry or Media & Production"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Department</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Ministry Leader</label>
                  <input
                    type="text"
                    placeholder="e.g. Isaac David"
                    value={formData.leader_name}
                    onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                    className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Leader Phone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="e.g. +60 17-600 1484"
                    value={formData.leader_phone}
                    onChange={(e) => setFormData({ ...formData, leader_phone: e.target.value })}
                    className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Serving Members Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="8"
                    value={formData.member_count}
                    onChange={(e) => setFormData({ ...formData, member_count: e.target.value })}
                    className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Schedule / Rehearsal Day</label>
                  <select
                    value={formData.meeting_day}
                    onChange={(e) => setFormData({ ...formData, meeting_day: e.target.value })}
                    className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Meeting Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 8:00 PM Rehearsal"
                    value={formData.meeting_time}
                    onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                    className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Meeting Location</label>
                <input
                  type="text"
                  placeholder="e.g. Main Sanctuary / Sound Booth"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Ministry Description</label>
                <textarea
                  rows="3"
                  placeholder="Describe ministry mission, volunteer duties, and equipment used..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#fbf8f3] border border-[#eadbc4] rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#c59c6c]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#c59c6c] hover:bg-[#b08756] text-white rounded-xl text-xs font-bold shadow-md shadow-[#c59c6c]/20 cursor-pointer"
                >
                  {editingMinistry ? 'Save Changes' : 'Create Ministry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
