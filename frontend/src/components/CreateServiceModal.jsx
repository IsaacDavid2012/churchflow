import React, { useState, useEffect } from 'react';
import { X, Calendar, Layers, Check } from 'lucide-react';
import { api } from '../api';

const DEFAULT_SERVICE_TYPES = [
  'Sunday Morning Celebration',
  'Sunday Evening Praise & Word',
  'Midweek Encounter & Prayer',
  'Youth Revolution (Friday)',
  'Night of Worship & Prophetic',
  'Special Holiday Gathering',
];

export default function CreateServiceModal({ isOpen, onClose, onServiceCreated }) {
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('10:00 AM');
  const [serviceType, setServiceType] = useState('Sunday Morning Celebration');
  const [campusId, setCampusId] = useState('');
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('Sunday Service at Jesus My Rock');
  const [deadlineHours, setDeadlineHours] = useState('48');
  const [campuses, setCampuses] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedPositionIds, setSelectedPositionIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dynamic Service Types
  const [serviceTypes, setServiceTypes] = useState(
    DEFAULT_SERVICE_TYPES.map((t, idx) => ({ id: `default-${idx}`, name: t, default_time: '10:00 AM' }))
  );
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeTime, setNewTypeTime] = useState('10:00 AM');
  const [creatingType, setCreatingType] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      api.getCampuses().then((c) => {
        setCampuses(c || []);
        if (c?.length > 0) {
          const main = c.find((camp) => camp.is_main) || c[0];
          setCampusId(main.id);
        }
      }).catch(console.error);

      api.getPositions().then((posList) => {
        const list = Array.isArray(posList) ? posList : [];
        setPositions(list);
        setSelectedPositionIds(list.map((p) => p.id));
      }).catch(console.error);

      api.getServiceTypes().then((types) => {
        if (Array.isArray(types) && types.length > 0) {
          setServiceTypes(types);
        }
      }).catch(console.error);
    }
  }, [isOpen]);

  async function handleAddType(e) {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    setCreatingType(true);
    try {
      const created = await api.createServiceType({
        name: newTypeName.trim(),
        default_time: newTypeTime.trim() || '10:00 AM',
      });
      const updated = [...serviceTypes.filter((t) => t.id !== created.id), created];
      setServiceTypes(updated);
      setServiceType(created.name);
      if (created.default_time) {
        setServiceTime(created.default_time);
      }
      setNewTypeName('');
      setShowAddType(false);
    } catch (err) {
      setError(err.message || 'Failed to create service type');
    } finally {
      setCreatingType(false);
    }
  }

  async function handleDeleteType(typeItem) {
    if (serviceTypes.length <= 1) {
      alert('Cannot delete the only remaining service type');
      return;
    }
    if (!confirm(`Delete service type "${typeItem.name}"? Historical services will keep their service records.`)) {
      return;
    }
    try {
      if (typeItem.id && !typeItem.id.toString().startsWith('default-')) {
        await api.deleteServiceType(typeItem.id);
      }
      const remaining = serviceTypes.filter((t) => t.id !== typeItem.id && t.name !== typeItem.name);
      setServiceTypes(remaining);
      if (serviceType === typeItem.name && remaining.length > 0) {
        setServiceType(remaining[0].name);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete service type');
    }
  }

  if (!isOpen) return null;

  function togglePosition(posId) {
    setSelectedPositionIds((prev) =>
      prev.includes(posId) ? prev.filter((id) => id !== posId) : [...prev, posId]
    );
  }

  function handleToggleAllPositions() {
    if (selectedPositionIds.length === positions.length) {
      setSelectedPositionIds([]);
    } else {
      setSelectedPositionIds(positions.map((p) => p.id));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!serviceDate) {
      setError('Service date is required');
      return;
    }
    if (positions.length > 0 && selectedPositionIds.length === 0) {
      setError('Please toggle ON at least one position for this service');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const newService = await api.createService({
        service_date: serviceDate,
        service_time: serviceTime,
        service_type: serviceType,
        campus_id: campusId || null,
        theme,
        notes,
        deadline_hours_before: parseInt(deadlineHours, 10),
        position_ids: selectedPositionIds,
      });
      onServiceCreated(newService);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create service');
    } finally {
      setLoading(false);
    }
  }

  const allSelected = positions.length > 0 && selectedPositionIds.length === positions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Church Service Plan</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Service Date *
              </label>
              <input
                type="date"
                required
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Service Time
              </label>
              <input
                type="text"
                value={serviceTime}
                onChange={(e) => setServiceTime(e.target.value)}
                placeholder="10:00 AM"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Service Type
              </label>
              <button
                type="button"
                onClick={() => setShowAddType(!showAddType)}
                className="text-[11px] font-bold text-[#c59c6c] hover:underline cursor-pointer"
              >
                {showAddType ? 'Cancel' : '+ Add New Type'}
              </button>
            </div>

            {showAddType && (
              <div className="p-3 mb-3 bg-[#f5ede1]/60 dark:bg-slate-800 border border-[#eadbc4] dark:border-slate-700 rounded-xl space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-white">Create New Service Type</div>
                <input
                  type="text"
                  placeholder="e.g. Easter Celebration Night"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#c59c6c]"
                />
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Default Time (e.g. 7:30 PM)"
                    value={newTypeTime}
                    onChange={(e) => setNewTypeTime(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#c59c6c]"
                  />
                  <button
                    type="button"
                    onClick={handleAddType}
                    disabled={creatingType}
                    className="px-3 py-1.5 bg-[#c59c6c] hover:bg-[#b08757] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    {creatingType ? 'Saving...' : 'Add Type'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <select
                value={serviceType}
                onChange={(e) => {
                  setServiceType(e.target.value);
                  const matched = serviceTypes.find((t) => (t.name || t) === e.target.value);
                  if (matched?.default_time) {
                    setServiceTime(matched.default_time);
                  }
                }}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-[#c59c6c]"
              >
                {serviceTypes.map((t) => {
                  const typeName = typeof t === 'string' ? t : t.name;
                  return (
                    <option key={t.id || typeName} value={typeName}>
                      {typeName} {t.default_time ? `(${t.default_time})` : ''}
                    </option>
                  );
                })}
              </select>

              {serviceTypes.length > 1 && (
                <button
                  type="button"
                  title="Delete this service type"
                  onClick={() => {
                    const matched = serviceTypes.find((t) => (t.name || t) === serviceType);
                    if (matched) handleDeleteType(matched);
                  }}
                  className="px-2.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold border border-red-200 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Positions Toggle Selector */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Positions to Set ({selectedPositionIds.length}/{positions.length})
                </span>
              </div>
              {positions.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllPositions}
                  className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              Toggle which Media / Ministry positions are needed for this service before creating it.
            </p>

            {positions.length === 0 ? (
              <div className="text-xs text-slate-400 py-2 text-center">Loading positions...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {positions.map((pos) => {
                  const isChecked = selectedPositionIds.includes(pos.id);
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => togglePosition(pos.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-red-50/80 dark:bg-red-950/40 border-red-300 dark:border-red-500/40 text-slate-900 dark:text-white'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className={`text-xs font-bold truncate ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                          {pos.name}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {pos.ministry || 'Media Team'}
                        </div>
                      </div>
                      <span
                        className={`w-8 h-4.5 rounded-full relative transition-colors shrink-0 inline-flex items-center ${
                          isChecked ? 'bg-red-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded-full bg-white shadow transform transition-transform ${
                            isChecked ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Service Theme / Title
            </label>
            <input
              type="text"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. Firm Foundation: Standing Unshaken"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Service Notes & Details
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Communion after service. Baptism following service."
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Auto-Promotion Deadline (Hours before service)
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={deadlineHours}
              onChange={(e) => setDeadlineHours(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg shadow-red-600/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Creating...' : `Create Service (${selectedPositionIds.length} Positions)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
