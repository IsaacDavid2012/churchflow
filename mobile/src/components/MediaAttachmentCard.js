import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import { api, API_BASE_URL } from '../api/client';

export default function MediaAttachmentCard({
  mediaUrl,
  mediaType,
  mediaName,
  mediaSize,
  isMe = false,
  colors = {},
  onOpenLiveTheater,
}) {
  const [importing, setImporting] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isPlayingInApp, setIsPlayingInApp] = useState(false);

  if (!mediaUrl) return null;

  const baseOrigin = (api?.baseUrl || API_BASE_URL || 'https://serve.creativeclicks.art/api').replace(/\/api\/?$/, '');
  const fullUrl = mediaUrl.startsWith('http')
    ? mediaUrl
    : `${baseOrigin}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;

  const resolvedType = (mediaType || '').toLowerCase();
  const isYouTubeLive = resolvedType === 'youtube_live' || /youtube\.com|youtu\.be/i.test(mediaUrl || '') || /^[a-zA-Z0-9_-]{11}$/.test(mediaName || '');
  const isImage = !isYouTubeLive && (resolvedType === 'image' || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(mediaUrl || mediaName || ''));
  const isVideo = !isYouTubeLive && (resolvedType === 'video' || /\.(mp4|mov|m4v|3gp|avi|mkv|webm)$/i.test(mediaUrl || mediaName || ''));
  const isSbp = resolvedType === 'sbp' || /\.(sbp|sbpbackup)$/i.test(mediaUrl || mediaName || '');
  const isPdf = resolvedType === 'pdf' || /\.(pdf|pdf\.html)$/i.test(mediaUrl || mediaName || '');

  const parseYtId = (url, name) => {
    if (name && /^[a-zA-Z0-9_-]{11}$/.test(name)) return name;
    const match = (url || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*?v=|live\/|embed\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : (name || null);
  };
  const ytid = isYouTubeLive ? parseYtId(mediaUrl, mediaName) : null;

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 1-Click Import into SongBook
  const handleImportSbp = () => {
    Alert.alert(
      'Import into SongBook',
      `Import "${mediaName || 'Setlist'}" into your personal SongBook library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setImporting(true);
            try {
              const localUri = `${FileSystem.cacheDirectory}${Date.now()}_import.sbp`;
              await FileSystem.downloadAsync(fullUrl, localUri);
              const base64 = await FileSystem.readAsStringAsync(localUri, {
                encoding: FileSystem.EncodingType.Base64,
              });

              const parsed = await api.parseSongbookBackup({
                fileBase64: base64,
                fileName: mediaName || 'Imported_Setlist.sbp',
              });

              const songs = Array.isArray(parsed.songs) ? parsed.songs : [];
              const setlists = Array.isArray(parsed.setlists) ? parsed.setlists : [];

              if (songs.length === 0 && setlists.length === 0) {
                Alert.alert('Notice', 'No songs or setlists were found in this file.');
                return;
              }

              await api.importSongbookBackup({
                backupData: parsed,
                targetOwnerType: 'user',
                strategy: 'skip',
                createSetlist: true,
                setlistName: mediaName ? mediaName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') : 'Imported Setlist',
              });

              Alert.alert(
                'Import Successful! 🎉',
                `Successfully imported ${songs.length} song(s) and ${setlists.length} setlist(s) into your personal SongBook library.`
              );
            } catch (err) {
              Alert.alert('Import Failed', err.message || 'Could not import SongBook backup');
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenLink = () => {
    Linking.openURL(fullUrl).catch((err) => {
      Alert.alert('Error', 'Could not open file: ' + (err.message || 'Unknown error'));
    });
  };

  // 0. Render YouTube Live Stream (In-App Player with Full Native Embedding)
  if (isYouTubeLive && ytid) {
    return (
      <View style={styles.ytLiveCard}>
        {isPlayingInApp && !onOpenLiveTheater ? (
          <View style={{ width: '100%', height: 210, backgroundColor: '#000000' }}>
            <WebView
              source={{
                uri: `${baseOrigin}/live-player/${ytid}`,
                headers: {
                  Referer: 'https://serve.creativeclicks.art',
                },
              }}
              originWhitelist={['*']}
              style={{ flex: 1, backgroundColor: '#000000' }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo={true}
              mixedContentMode="always"
              userAgent="Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            />
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (onOpenLiveTheater) {
                onOpenLiveTheater();
              } else {
                setIsPlayingInApp(true);
              }
            }}
            style={styles.ytThumbnailWrapper}
          >
            <Image
              source={{ uri: `https://img.youtube.com/vi/${ytid}/hqdefault.jpg` }}
              style={styles.ytThumbnail}
              resizeMode="cover"
            />
            <View style={styles.ytLiveBadge}>
              <View style={styles.ytLiveDot} />
              <Text style={styles.ytLiveBadgeText}>LIVE STREAM</Text>
            </View>
            <View style={styles.ytPlayCenter}>
              <View style={styles.ytPlayCircle}>
                <Ionicons name="play" size={26} color="#ffffff" style={{ marginLeft: 3 }} />
              </View>
              <Text style={styles.ytPlayText}>▶ Watch & Chat In-App</Text>
            </View>
          </TouchableOpacity>
        )}
        <View style={styles.ytBottomBar}>
          <TouchableOpacity
            onPress={() => {
              if (onOpenLiveTheater) {
                onOpenLiveTheater();
              } else {
                setIsPlayingInApp(!isPlayingInApp);
              }
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="play-circle" size={16} color="#ef4444" />
            <Text style={styles.ytBottomBarText}>
              {isPlayingInApp && !onOpenLiveTheater
                ? 'Playing in App (Tap to Close)'
                : '🔴 Watch Live & In-App Chat'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${ytid}`).catch(() => {})}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>YouTube App</Text>
            <Ionicons name="open-outline" size={13} color="#94a3b8" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render Image
  if (isImage) {
    return (
      <View style={styles.imageContainer}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => setIsImageModalOpen(true)}>
          <Image
            source={{ uri: fullUrl }}
            style={styles.imageThumbnail}
            resizeMode="cover"
          />
          <View style={styles.imageOverlayTag}>
            <Ionicons name="expand" size={12} color="#ffffff" />
            <Text style={styles.imageOverlayText}>View Photo</Text>
          </View>
        </TouchableOpacity>

        {/* Full Image Modal */}
        <Modal
          visible={isImageModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsImageModalOpen(false)}
        >
          <View style={styles.fullImageModal}>
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setIsImageModalOpen(false)}
            >
              <Ionicons name="close" size={26} color="#ffffff" />
            </TouchableOpacity>
            <Image
              source={{ uri: fullUrl }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      </View>
    );
  }

  // Render Video
  if (isVideo) {
    return (
      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: isMe ? 'rgba(0,0,0,0.18)' : (colors.badgeBg || '#f5ede1'),
            borderColor: isMe ? 'rgba(255,255,255,0.2)' : (colors.border || '#eadbc4'),
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: '#e11d48' }]}>
            <Ionicons name="videocam" size={18} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.cardTitle, { color: isMe ? '#ffffff' : (colors.text || '#0f172a') }]}
              numberOfLines={1}
            >
              {mediaName || 'Video Attachment'}
            </Text>
            <Text
              style={[
                styles.cardSubtitle,
                { color: isMe ? 'rgba(255,255,255,0.7)' : (colors.subText || '#64748b') },
              ]}
            >
              Video • {formatSize(mediaSize) || '< 10MB'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary || '#c59c6c' }]}
          activeOpacity={0.85}
          onPress={handleOpenLink}
        >
          <Ionicons name="play" size={14} color="#ffffff" />
          <Text style={styles.actionBtnText}>Play Video</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render SongBook Pro .sbp Archive
  if (isSbp) {
    return (
      <View
        style={[
          styles.cardContainer,
          styles.sbpHighlightCard,
          {
            backgroundColor: isMe ? 'rgba(0,0,0,0.2)' : (colors.badgeBg || '#f5ede1'),
            borderColor: '#c59c6c',
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: '#c59c6c' }]}>
            <Ionicons name="musical-notes" size={18} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text
                style={[styles.cardTitle, { color: isMe ? '#ffffff' : (colors.text || '#0f172a') }]}
                numberOfLines={1}
              >
                {mediaName || 'SongBook Backup.sbp'}
              </Text>
            </View>
            <Text
              style={[
                styles.cardSubtitle,
                { color: isMe ? 'rgba(255,255,255,0.7)' : (colors.subText || '#64748b') },
              ]}
            >
              SongBook Pro Archive • {formatSize(mediaSize) || 'Ready to import'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#c59c6c' }]}
          activeOpacity={0.85}
          disabled={importing}
          onPress={handleImportSbp}
        >
          {importing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={15} color="#ffffff" />
              <Text style={styles.actionBtnText}>Import into SongBook</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // Render Lead Sheet PDF
  if (isPdf) {
    return (
      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: isMe ? 'rgba(0,0,0,0.18)' : (colors.badgeBg || '#f5ede1'),
            borderColor: isMe ? 'rgba(255,255,255,0.2)' : (colors.border || '#eadbc4'),
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconBadge, { backgroundColor: '#2563eb' }]}>
            <Ionicons name="document-text" size={18} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.cardTitle, { color: isMe ? '#ffffff' : (colors.text || '#0f172a') }]}
              numberOfLines={1}
            >
              {mediaName || 'Lead Sheet.pdf'}
            </Text>
            <Text
              style={[
                styles.cardSubtitle,
                { color: isMe ? 'rgba(255,255,255,0.7)' : (colors.subText || '#64748b') },
              ]}
            >
              Chord Chart & Lyrics • {formatSize(mediaSize)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#2563eb' }]}
          activeOpacity={0.85}
          onPress={handleOpenLink}
        >
          <Ionicons name="eye-outline" size={15} color="#ffffff" />
          <Text style={styles.actionBtnText}>View Lead Sheet PDF</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Fallback for generic file attachment
  return (
    <View
      style={[
        styles.cardContainer,
        {
          backgroundColor: isMe ? 'rgba(0,0,0,0.18)' : (colors.badgeBg || '#f5ede1'),
          borderColor: isMe ? 'rgba(255,255,255,0.2)' : (colors.border || '#eadbc4'),
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconBadge, { backgroundColor: '#64748b' }]}>
          <Ionicons name="attach" size={18} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.cardTitle, { color: isMe ? '#ffffff' : (colors.text || '#0f172a') }]}
            numberOfLines={1}
          >
            {mediaName || 'Attachment'}
          </Text>
          <Text
            style={[
              styles.cardSubtitle,
              { color: isMe ? 'rgba(255,255,255,0.7)' : (colors.subText || '#64748b') },
            ]}
          >
            File • {formatSize(mediaSize)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.primary || '#c59c6c' }]}
        activeOpacity={0.85}
        onPress={handleOpenLink}
      >
        <Ionicons name="cloud-download-outline" size={15} color="#ffffff" />
        <Text style={styles.actionBtnText}>Download File</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  imageThumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
  imageOverlayTag: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageOverlayText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  fullImageModal: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 99,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  fullImage: {
    width: '100%',
    height: '85%',
  },
  cardContainer: {
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  sbpHighlightCard: {
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 2,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  ytLiveCard: {
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  ytThumbnailWrapper: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#000000',
  },
  ytThumbnail: {
    width: '100%',
    height: '100%',
  },
  ytLiveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ytLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  ytLiveBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  ytPlayCenter: {
    position: 'absolute',
    inset: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  ytPlayCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  ytPlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  ytBottomBar: {
    backgroundColor: '#1e1e1e',
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ytBottomBarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
