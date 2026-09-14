import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Edit2, 
  Trash2, 
  X,
  Sparkles,
  Music
} from 'lucide-react';
import { api } from '../api';

const STATUS_COLORS = {
  staff: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  leader: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  member: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  volunteer: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  regular: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  visitor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export default function PeopleManager() {
  const [people, setPeople] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ministryFilter, setMinistryFilter] = useState('');

  // Modals
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [personForm, setPersonForm] = useState({
    name: '',
    email: '',
    phone: '',
    status: 'member',
    ministry: 'Worship Team',
    roles: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [search, statusFilter, ministryFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [peopleRes, minRes] = await Promise.all([
        api.getPeople({ search, status: statusFilter, ministry: ministryFilter, active: true }),
        api.getMinistries(),
      ]);
      setPeople(peopleRes || []);
      setMinistries(minRes || []);
    } catch (err) {
      console.error('Failed to load people directory:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreatePerson() {
    setEditingPerson(null);
    setPersonForm({
      name: '',
      email: '',
      phone: '',
      status: 'member',
      ministry: ministries[0]?.name || 'Worship Team',
      roles: '',
      notes: '',
    });
    setIsPersonModalOpen(true);
  }

  function handleOpenEditPerson(p) {
    setEditingPerson(p);
    setPersonForm({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      status: p.status || 'member',
      ministry: p.ministry || 'Worship Team',
      roles: Array.isArray(p.roles) ? p.roles.join(', ') : '',
      notes: p.notes || '',
    });
    setIsPersonModalOpen(true);
  }

  async function handleSavePerson(e) {
    e.preventDefault();
    const rolesArray = personForm.roles
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    const payload = {
      ...personForm,
      roles: rolesArray,
    };

    try {
      if (editingPerson) {
        await api.updatePerson(editingPerson.id, payload);
      } else {
        await api.createPerson(payload);
      }
      setIsPersonModalOpen(false);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to save member');
    }
  }

  async function handleDeletePerson(p) {
    if (!window.confirm(`Are you sure you want to deactivate ${p.name}?`)) return;
    try {
      await api.deletePerson(p.id);
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to deactivate member');
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Users className="w-6 h-6 text-red-600 dark:text-red-400" />
              People & Volunteers Directory
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {people.length} active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Jesus My Rock Church worship team members, leaders, and production crew.
          </p>
        </div>

        <button
          onClick={handleOpenCreatePerson}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Member</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="sm:col-span-6 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">All Membership Statuses</option>
            <option value="leader">Ministry Leaders</option>
            <option value="member">Members</option>
            <option value="staff">Staff & Pastors</option>
            <option value="volunteer">Volunteers</option>
          </select>
        </div>

        <div className="sm:col-span-3">
          <select
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">All Ministries / Teams</option>
            {ministries.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* People Directory Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <span>Loading people directory...</span>
        </div>
      ) : people.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 shadow-sm">
          <Users className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <div className="font-bold text-slate-800 dark:text-slate-300">No people found</div>
          <div className="text-xs text-slate-500 mt-1">Try adjusting your search query or filters.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person) => {
            const statusStyle = STATUS_COLORS[person.status] || STATUS_COLORS.member;
            return (
              <div
                key={person.id}
                className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-red-500/40 dark:hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-300 flex items-center justify-center font-black text-sm border border-red-200 dark:border-red-800/40 shadow-sm">
                        {person.name?.[0] || 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{person.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${statusStyle}`}>
                            {person.status || 'Member'}
                          </span>
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/60">
                            {person.ministry || 'Worship Team'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditPerson(person)}
                        className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePerson(person)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Deactivate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {person.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{person.email}</span>
                      </div>
                    )}
                    {person.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{person.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Roles / Instruments Badges */}
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1.5">
                    {Array.isArray(person.roles) && person.roles.map((r, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Serving History Tag */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Serves: <strong className="text-slate-800 dark:text-slate-300">{person.total_confirmed_serves || 0}</strong></span>
                  <span>{person.last_served_date ? `Last: ${person.last_served_date}` : 'Never served'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Person Modal */}
      {isPersonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-colors">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingPerson ? 'Edit Member Profile' : 'Add New Member'}
              </h3>
              <button
                onClick={() => setIsPersonModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePerson} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text"
                  value={personForm.name}
                  onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })}
                  required
                  placeholder="e.g. Isaac"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={personForm.email}
                    onChange={(e) => setPersonForm({ ...personForm, email: e.target.value })}
                    placeholder="isaac@jesusmyrock.org"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Phone</label>
                  <input
                    type="text"
                    value={personForm.phone}
                    onChange={(e) => setPersonForm({ ...personForm, phone: e.target.value })}
                    placeholder="+1 (555) 762-0101"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={personForm.status}
                    onChange={(e) => setPersonForm({ ...personForm, status: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="leader">Ministry Leader</option>
                    <option value="member">Member</option>
                    <option value="staff">Staff / Pastor</option>
                    <option value="volunteer">Volunteer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Ministry</label>
                  <select
                    value={personForm.ministry}
                    onChange={(e) => setPersonForm({ ...personForm, ministry: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  >
                    {ministries.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Positions & Roles (comma separated)
                </label>
                <input
                  type="text"
                  value={personForm.roles}
                  onChange={(e) => setPersonForm({ ...personForm, roles: e.target.value })}
                  placeholder="e.g. Drums, Bass, Keyboard, Sound, Worship Leader"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPersonModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  {editingPerson ? 'Update Member' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
