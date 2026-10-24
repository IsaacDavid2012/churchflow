import React, { useState } from 'react';
import { Music, FileText, Video, Eye, Download, CheckCircle, Image as ImageIcon, ExternalLink, X } from 'lucide-react';
import { api } from '../api';

export default function MediaAttachmentCard({ mediaUrl, mediaType, mediaName, mediaSize, isMe = false }) {
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [isFullImageOpen, setIsFullImageOpen] = useState(false);

  if (!mediaUrl) return null;

  const resolvedType = (mediaType || '').toLowerCase();
  const isYouTubeLive = resolvedType === 'youtube_live' || /youtube\.com|youtu\.be/i.test(mediaUrl || '') || /^[a-zA-Z0-9_-]{11}$/.test(mediaName || '');
  const isImage = !isYouTubeLive && (resolvedType === 'image' || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(mediaUrl || mediaName || ''));
  const isVideo = !isYouTubeLive && (resolvedType === 'video' || /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i.test(mediaUrl || mediaName || ''));
  const isSbp = resolvedType === 'sbp' || /\.(sbp|sbpbackup)$/i.test(mediaUrl || mediaName || '');
  const isPdf = resolvedType === 'pdf' || /\.(pdf|pdf\.html)$/i.test(mediaUrl || mediaName || '');

  const getYouTubeId = (url, name) => {
    if (name && /^[a-zA-Z0-9_-]{11}$/.test(name)) return name;
    const match = (url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : (name || null);
  };
  const ytid = isYouTubeLive ? getYouTubeId(mediaUrl, mediaName) : null;

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleImportSbp = async () => {
    if (importing || imported) return;
    setImporting(true);
    try {
      // Fetch file as base64
      const res = await fetch(mediaUrl);
      const blob = await res.blob();
      const reader = new FileReader();

      reader.onloadend = async () => {
        try {
          const base64data = reader.result;
          const parsed = await api.parseSongbookBackup({
            fileBase64: base64data,
            fileName: mediaName || 'Imported_Setlist.sbp',
          });

          const songs = Array.isArray(parsed.songs) ? parsed.songs : [];
          const setlists = Array.isArray(parsed.setlists) ? parsed.setlists : [];

          if (songs.length === 0 && setlists.length === 0) {
            alert('No songs or setlists found in this backup.');
            setImporting(false);
            return;
          }

          await api.importSongbookBackup({
            songs,
            setlists,
            scope: 'user',
          });

          setImported(true);
          alert(`🎉 Successfully imported ${songs.length} song(s) and ${setlists.length} setlist(s) into your SongBook library!`);
        } catch (e) {
          alert('Import error: ' + (e.message || 'Failed to import SBP'));
        } finally {
          setImporting(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      alert('Could not download SBP file: ' + err.message);
      setImporting(false);
    }
  };

  // 0. YouTube Live Stream
  if (isYouTubeLive && ytid) {
    return (
      <div className="mt-2.5 mb-2 w-full max-w-2xl rounded-2xl overflow-hidden border border-red-200 dark:border-red-900/50 bg-black/5 shadow-md">
        <div className="bg-red-600 px-3.5 py-1.5 flex items-center justify-between text-white text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <span>🔴 JESUS MY ROCK LIVE STREAM</span>
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${ytid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline text-[11px] opacity-90"
          >
            <span>Open in YouTube</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative w-full aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${ytid}?autoplay=1&rel=0`}
            title={mediaName || 'Jesus My Rock Live Stream'}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 1. Photo
  if (isImage) {
    return (
      <div className="mt-2.5 mb-1">
        <div
          onClick={() => setIsFullImageOpen(true)}
          className="relative group rounded-xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-700 max-w-sm max-h-60"
        >
          <img
            src={mediaUrl}
            alt={mediaName || 'Photo'}
            className="w-full h-auto object-cover max-h-60 group-hover:scale-102 transition-transform duration-200"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
              <Eye className="w-3.5 h-3.5" /> View Photo
            </span>
          </div>
        </div>

        {/* Modal */}
        {isFullImageOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
            onClick={() => setIsFullImageOpen(false)}
          >
            <div className="relative max-w-3xl max-h-[90vh]">
              <button
                onClick={() => setIsFullImageOpen(false)}
                className="absolute -top-10 right-0 p-1.5 text-white/80 hover:text-white bg-white/10 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={mediaUrl}
                alt={mediaName || 'Full Photo'}
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Video
  if (isVideo) {
    return (
      <div
        className={`mt-2.5 mb-1 p-3 rounded-xl border max-w-sm ${
          isMe
            ? 'bg-black/15 border-white/20 text-white'
            : 'bg-[#fbf8f3] dark:bg-slate-900 border-[#eadbc4] dark:border-slate-700 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-9 h-9 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs truncate">{mediaName || 'Video Attachment'}</div>
            <div className={`text-[10px] ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
              Video • {formatSize(mediaSize) || '< 10MB'}
            </div>
          </div>
        </div>
        <video
          src={mediaUrl}
          controls
          className="w-full max-h-48 rounded-lg bg-black"
          preload="metadata"
        />
      </div>
    );
  }

  // 3. SongBook Pro .sbp Archive
  if (isSbp) {
    return (
      <div
        className={`mt-2.5 mb-1 p-3 rounded-xl border border-l-4 border-l-[#c59c6c] max-w-sm ${
          isMe
            ? 'bg-black/15 border-white/20 text-white'
            : 'bg-[#fbf8f3] dark:bg-slate-900 border-[#eadbc4] dark:border-slate-700 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-[#c59c6c] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Music className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs truncate">{mediaName || 'SongBook Backup.sbp'}</div>
            <div className={`text-[10px] ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
              SongBook Pro Archive • {formatSize(mediaSize) || 'Ready to import'}
            </div>
          </div>
        </div>

        <button
          onClick={handleImportSbp}
          disabled={importing || imported}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer ${
            imported
              ? 'bg-emerald-600 text-white'
              : 'bg-[#c59c6c] hover:bg-[#b08756] text-white'
          }`}
        >
          {importing ? (
            <span className="flex items-center gap-1.5 text-xs">
              <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
              Importing into SongBook...
            </span>
          ) : imported ? (
            <span className="flex items-center gap-1.5 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              Imported to Your Library
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" />
              Import into SongBook
            </span>
          )}
        </button>
      </div>
    );
  }

  // 4. Lead Sheet PDF
  if (isPdf) {
    return (
      <div
        className={`mt-2.5 mb-1 p-3 rounded-xl border max-w-sm ${
          isMe
            ? 'bg-black/15 border-white/20 text-white'
            : 'bg-[#fbf8f3] dark:bg-slate-900 border-[#eadbc4] dark:border-slate-700 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs truncate">{mediaName || 'Lead Sheet.pdf'}</div>
            <div className={`text-[10px] ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
              Printable Chord Chart & Lyrics • {formatSize(mediaSize)}
            </div>
          </div>
        </div>

        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm"
        >
          <Eye className="w-3.5 h-3.5" />
          View Lead Sheet PDF
        </a>
      </div>
    );
  }

  // Fallback
  return (
    <div
      className={`mt-2.5 mb-1 p-3 rounded-xl border max-w-sm ${
        isMe
          ? 'bg-black/15 border-white/20 text-white'
          : 'bg-[#fbf8f3] dark:bg-slate-900 border-[#eadbc4] dark:border-slate-700 text-slate-800 dark:text-slate-200'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-slate-500 text-white flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-xs truncate">{mediaName || 'Attachment'}</div>
          <div className={`text-[10px] ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
            File • {formatSize(mediaSize)}
          </div>
        </div>
      </div>
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={mediaName || 'file'}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-[#c59c6c] hover:bg-[#b08756] text-white transition-all shadow-sm"
      >
        <Download className="w-3.5 h-3.5" /> Download File
      </a>
    </div>
  );
}
