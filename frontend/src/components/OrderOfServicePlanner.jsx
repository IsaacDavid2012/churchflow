import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Music, 
  Plus, 
  Edit2, 
  Trash2, 
  PlayCircle, 
  FileText, 
  Video, 
  BookOpen, 
  Flame, 
  DollarSign, 
  Layers, 
  X, 
  Sparkles,
  Check
} from 'lucide-react';
import { api } from '../api';

const ITEM_TYPE_STYLES = {
  song: { label: 'Worship Song', icon: Music, color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  sermon: { label: 'Sermon / Message', icon: BookOpen, color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  media: { label: 'Media / Video', icon: Video, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  prayer: { label: 'Prayer / Ministry', icon: Flame, color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  offering: { label: 'Offering / Giving', icon: DollarSign, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  header: { label: 'Section Header', icon: Layers, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  item: { label: 'Service Item', icon: Clock, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
};

export default function OrderOfServicePlanner({ serviceId, serviceTime = '10:00 AM' }) {
  const [items, setItems] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    item_type: 'song',
    title: '',
    duration_minutes: 5,
    leader: '',
    song_id: '',
    song_key: '',
    notes: '',
  });

  useEffect(() => {
    loadPlan();
  }, [serviceId]);

  async function loadPlan() {
    setLoading(true);
    try {
      const [planData, songData] = await Promise.all([
        api.getPlanItems(serviceId),
        api.getSongs(),
      ]);
      setItems(planData || []);
      setSongs(songData || []);
    } catch (err) {
      console.error('Failed to load service plan:', err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate cumulative run times starting from serviceTime (e.g. "10:00 AM")
  function calculateTimings() {
    let startMinutes = 10 * 60; // Default 10:00 AM = 600 mins
    const timeStr = String(serviceTime || '10:00 AM').trim();
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const ampm = (match[3] || 'AM').toUpperCase();
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      startMinutes = hours * 60 + mins;
    }

    let current = startMinutes;
    return (items || []).map((item) => {
      const h = Math.floor(current / 60) % 24;
      const m = current % 60;
      const displayHours = h % 12 === 0 ? 12 : h % 12;
      const displayMins = m.toString().padStart(2, '0');
      const displayAmPm = h >= 12 ? 'PM' : 'AM';
      const formattedTime = `${displayHours}:${displayMins} ${displayAmPm}`;
      
      const duration = item.duration_minutes || 0;
      current += duration;

      return {
        ...item,
        startTime: formattedTime,
      };
    });
  }

  const timedItems = calculateTimings();
  const totalDuration = items.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

  function handleOpenCreate(type = 'song') {
    setEditingItem(null);
    setItemForm({
      item_type: type,
      title: '',
      duration_minutes: type === 'song' ? 6 : type === 'sermon' ? 35 : 5,
      leader: '',
      song_id: '',
      song_key: '',
      notes: '',
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(item) {
    setEditingItem(item);
    setItemForm({
      item_type: item.item_type || 'item',
      title: item.title || '',
      duration_minutes: item.duration_minutes || 5,
      leader: item.leader || '',
      song_id: item.song_id || '',
      song_key: item.song_key || '',
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  }

  function handleSelectSong(e) {
    const sId = e.target.value;
    const found = songs.find((s) => s.id === sId);
    if (found) {
      setItemForm({
        ...itemForm,
        song_id: found.id,
        title: found.title,
        song_key: found.default_key || 'C',
        duration_minutes: itemForm.duration_minutes || 6,
      });
    } else {
      setItemForm({ ...itemForm, song_id: '', song_key: '' });
    }
  }

  async function handleSaveItem(e) {
    e.preventDefault();
    if (!itemForm.title.trim()) return;

    try {
      if (editingItem) {
        await api.updatePlanItem(serviceId, editingItem.id, itemForm);
      } else {
        await api.addPlanItem(serviceId, itemForm);
      }
      setIsModalOpen(false);
      loadPlan();
    } catch (err) {
      alert(err.message || 'Failed to save plan item');
    }
  }

  async function handleDeleteItem(item) {
    if (!window.confirm(`Delete "${item.title}" from the order of service?`)) return;
    try {
      await api.deletePlanItem(serviceId, item.id);
      loadPlan();
    } catch (err) {
      alert(err.message || 'Failed to delete item');
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-slate-500 dark:text-slate-400">
        <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3"></div>
        <span className="text-xs font-semibold">Loading Order of Service Run Sheet...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Duration summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-600 dark:text-red-400" />
            Order of Service & Run Sheet (Planning Center Plans)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Auto-calculated flow of worship, sermon, media, and transitions. Total service length: <strong className="text-red-600 dark:text-red-400 font-bold">{totalDuration} minutes</strong> ({Math.floor(totalDuration/60)}h {totalDuration%60}m).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenCreate('song')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 cursor-pointer"
          >
            <Music className="w-3.5 h-3.5" />
            <span>Add Song</span>
          </button>
          <button
            onClick={() => handleOpenCreate('item')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Plan Items List */}
      {timedItems.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 shadow-sm">
          <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <div className="font-bold text-sm text-slate-700 dark:text-slate-300">No items in this service plan yet</div>
          <div className="text-xs text-slate-500 mt-1">Add worship songs, announcements, and sermon run-times above.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {timedItems.map((item, index) => {
            const typeConfig = ITEM_TYPE_STYLES[item.item_type] || ITEM_TYPE_STYLES.item;
            const IconComp = typeConfig.icon;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl transition-all shadow-sm group"
              >
                {/* Left: Timing & Type Icon */}
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="text-center w-16 flex-shrink-0">
                    <span className="block text-xs font-black text-red-600 dark:text-red-400">{item.startTime}</span>
                    <span className="text-[10px] font-semibold text-slate-500">{item.duration_minutes} min</span>
                  </div>

                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 ${typeConfig.color}`}>
                    <IconComp className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">{item.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                      {item.song_key && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                          Key: {item.song_key}
                        </span>
                      )}
                      {item.song_bpm && (
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          {item.song_bpm} BPM
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.leader && (
                        <span>Leader: <strong className="text-slate-700 dark:text-slate-300">{item.leader}</strong></span>
                      )}
                      {item.notes && (
                        <span className="text-slate-400 italic truncate max-w-md">"{item.notes}"</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions & Links */}
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {item.song_youtube_url && (
                    <a
                      href={item.song_youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-red-500 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Preview on YouTube"
                    >
                      <PlayCircle className="w-4 h-4" />
                    </a>
                  )}
                  {item.song_chart_url && (
                    <a
                      href={item.song_chart_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Chord Chart"
                    >
                      <FileText className="w-4 h-4" />
                    </a>
                  )}

                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Item"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item)}
                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Delete Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Plan Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingItem ? 'Edit Order of Service Item' : 'Add Order of Service Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Item Category</label>
                <select
                  value={itemForm.item_type}
                  onChange={(e) => setItemForm({ ...itemForm, item_type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                >
                  <option value="song">Worship Song</option>
                  <option value="sermon">Sermon / Message</option>
                  <option value="media">Media / Video Countdown</option>
                  <option value="prayer">Prayer / Pastoral Welcome</option>
                  <option value="offering">Tithes & Offering</option>
                  <option value="header">Section Header</option>
                  <option value="item">Custom Service Item</option>
                </select>
              </div>

              {itemForm.item_type === 'song' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Select from Song Library</label>
                  <select
                    value={itemForm.song_id}
                    onChange={handleSelectSong}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="">-- Choose a Song or type custom title below --</option>
                    {songs.map((s) => (
                      <option key={s.id} value={s.id}>{s.title} ({s.artist || 'Unknown'} - Key: {s.default_key})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Item Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Firm Foundation (He Won't)"
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={itemForm.duration_minutes}
                    onChange={(e) => setItemForm({ ...itemForm, duration_minutes: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Arrangement Key</label>
                  <input
                    type="text"
                    placeholder="e.g. Bb or G"
                    value={itemForm.song_key}
                    onChange={(e) => setItemForm({ ...itemForm, song_key: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Leader / Speaker</label>
                <input
                  type="text"
                  placeholder="e.g. Pastor David Mitchell or James Wilson"
                  value={itemForm.leader}
                  onChange={(e) => setItemForm({ ...itemForm, leader: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Notes / Production Cues</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Dim sanctuary lights, switch camera 1 to altar..."
                  value={itemForm.notes}
                  onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/20"
                >
                  {editingItem ? 'Save Changes' : 'Add to Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
