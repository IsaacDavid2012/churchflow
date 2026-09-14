import React, { useState, useEffect } from 'react';
import { 
  Music, 
  Search, 
  Plus, 
  ExternalLink, 
  PlayCircle, 
  Edit2, 
  Trash2, 
  X, 
  Clock, 
  FileText,
  Filter
} from 'lucide-react';
import { api } from '../api';

const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

export default function SongLibraryManager() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [songForm, setSongForm] = useState({
    title: '',
    artist: '',
    default_key: 'C',
    bpm: 72,
    time_signature: '4/4',
    ccli_number: '',
    lyrics_preview: '',
    chart_url: '',
    youtube_url: '',
  });

  useEffect(() => {
    loadSongs();
  }, [search, selectedKey]);

  async function loadSongs() {
    setLoading(true);
    try {
      const data = await api.getSongs({ search, key: selectedKey });
      setSongs(data || []);
    } catch (err) {
      console.error('Failed to load songs:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingSong(null);
    setSongForm({
      title: '',
      artist: '',
      default_key: 'C',
      bpm: 72,
      time_signature: '4/4',
      ccli_number: '',
      lyrics_preview: '',
      chart_url: '',
      youtube_url: '',
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(s) {
    setEditingSong(s);
    setSongForm({
      title: s.title || '',
      artist: s.artist || '',
      default_key: s.default_key || 'C',
      bpm: s.bpm || 72,
      time_signature: s.time_signature || '4/4',
      ccli_number: s.ccli_number || '',
      lyrics_preview: s.lyrics_preview || '',
      chart_url: s.chart_url || '',
      youtube_url: s.youtube_url || '',
    });
    setIsModalOpen(true);
  }

  async function handleSaveSong(e) {
    e.preventDefault();
    if (!songForm.title.trim()) return;

    try {
      if (editingSong) {
        await api.updateSong(editingSong.id, songForm);
      } else {
        await api.createSong(songForm);
      }
      setIsModalOpen(false);
      loadSongs();
    } catch (err) {
      alert(err.message || 'Failed to save song');
    }
  }

  async function handleDeleteSong(s) {
    if (!window.confirm(`Are you sure you want to delete "${s.title}" from the church song library?`)) return;
    try {
      await api.deleteSong(s.id);
      loadSongs();
    } catch (err) {
      alert(err.message || 'Failed to delete song');
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
              <Music className="w-6 h-6 text-red-600 dark:text-red-400" />
              Worship Song Library
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {songs.length} songs
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Planning Center Services song database with keys, BPM, lyrics, CCLI, and chart references.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Song</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="sm:col-span-8 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search songs by title, artist, or lyrics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
          />
        </div>

        <div className="sm:col-span-4">
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500 cursor-pointer"
          >
            <option value="">All Musical Keys</option>
            {KEYS.map((k) => (
              <option key={k} value={k}>Key of {k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Songs Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full mx-auto mb-3"></div>
          <span>Loading worship songs...</span>
        </div>
      ) : songs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 shadow-sm">
          <Music className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-600 mb-3" />
          <div className="font-bold text-slate-800 dark:text-slate-300">No songs found</div>
          <div className="text-xs text-slate-500 mt-1">Add your first worship song to get started!</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {songs.map((song) => (
            <div
              key={song.id}
              className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-red-500/40 dark:hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                      {song.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{song.artist || 'Unknown Artist'}</p>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(song)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Song"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSong(song)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Delete Song"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Key, BPM, Time signature tags */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/30">
                    Key: {song.default_key}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {song.bpm} BPM
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {song.time_signature}
                  </span>
                  {song.ccli_number && (
                    <span className="text-[10px] text-slate-400">CCLI #{song.ccli_number}</span>
                  )}
                </div>

                {/* Lyrics Preview */}
                {song.lyrics_preview && (
                  <p className="mt-3 text-xs text-slate-600 dark:text-slate-400/90 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 line-clamp-3">
                    "{song.lyrics_preview}"
                  </p>
                )}
              </div>

              {/* External Links */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  {song.youtube_url && (
                    <a
                      href={song.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline font-semibold"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> Preview
                    </a>
                  )}
                  {song.chart_url && (
                    <a
                      href={song.chart_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 font-medium"
                    >
                      <FileText className="w-3.5 h-3.5" /> Chord Chart
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Song Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl transition-colors">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingSong ? 'Edit Worship Song' : 'Add New Worship Song'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSong} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Song Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Goodness of God"
                  value={songForm.title}
                  onChange={(e) => setSongForm({ ...songForm, title: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Artist / Author</label>
                <input
                  type="text"
                  placeholder="e.g. Bethel Music / Jenn Johnson"
                  value={songForm.artist}
                  onChange={(e) => setSongForm({ ...songForm, artist: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Default Key</label>
                  <select
                    value={songForm.default_key}
                    onChange={(e) => setSongForm({ ...songForm, default_key: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  >
                    {KEYS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">BPM</label>
                  <input
                    type="number"
                    value={songForm.bpm}
                    onChange={(e) => setSongForm({ ...songForm, bpm: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Time Sig</label>
                  <input
                    type="text"
                    placeholder="4/4"
                    value={songForm.time_signature}
                    onChange={(e) => setSongForm({ ...songForm, time_signature: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">CCLI Song #</label>
                <input
                  type="text"
                  placeholder="e.g. 7117726"
                  value={songForm.ccli_number}
                  onChange={(e) => setSongForm({ ...songForm, ccli_number: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Lyrics / Chords Preview</label>
                <textarea
                  rows="3"
                  placeholder="I love You, Lord, for Your mercy never fails me..."
                  value={songForm.lyrics_preview}
                  onChange={(e) => setSongForm({ ...songForm, lyrics_preview: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Chart URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={songForm.chart_url}
                    onChange={(e) => setSongForm({ ...songForm, chart_url: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">YouTube / Audio URL</label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/..."
                    value={songForm.youtube_url}
                    onChange={(e) => setSongForm({ ...songForm, youtube_url: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  {editingSong ? 'Save Changes' : 'Add Song'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
