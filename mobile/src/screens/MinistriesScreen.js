import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  Linking,
  Platform,
  KeyboardAvoidingView,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { ROLES, normalizeRole, hasRole } from '../utils/roles';
import { pickMediaAttachment } from '../utils/mediaPicker';
import MediaAttachmentCard from '../components/MediaAttachmentCard';
import MinistryHubScreen from './MinistryHubScreen';

export default function MinistriesScreen({ user, isDark = false }) {
  // Navigation: WhatsApp Community layout
  const [activeSection, setActiveSection] = useState('ministries'); // 'ministries' | 'announcements' | 'chat'

  // Ministries State
  const [ministries, setMinistries] = useState([]);
  const [selectedMinistry, setSelectedMinistry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [allPeople, setAllPeople] = useState([]);

  // Role permissions
  const userRole = normalizeRole(user?.role);
  const isMember = userRole === ROLES.MEMBER;
  const isAdmin = userRole === ROLES.ADMIN;
  const isPastor = userRole === ROLES.PASTOR;
  const canManage = !isMember; // Admin, Pastor, Manager
  const canDelete = hasRole(userRole, [ROLES.ADMIN, ROLES.PASTOR]); // Admin, Pastor only
  const canPostGeneral = isAdmin || isPastor;

  // Add / Edit Ministry Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMinistry, setEditingMinistry] = useState(null);
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // General Announcements State
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [isAnnModalOpen, setIsAnnModalOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annMedia, setAnnMedia] = useState(null);
  const [postingAnn, setPostingAnn] = useState(false);

  // General Church Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMedia, setChatMedia] = useState(null);
  const [sendingChat, setSendingChat] = useState(false);
  const chatListRef = useRef(null);

  const colors = {
    bg: isDark ? '#020617' : '#ffffff',
    card: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '#1e293b' : '#eadbc4',
    text: isDark ? '#ffffff' : '#0f172a',
    subText: isDark ? '#94a3b8' : '#64748b',
    primary: '#c59c6c',
    primaryLight: isDark ? '#3a2815' : '#f5ede1',
    primaryDark: '#8c6738',
    inputBg: isDark ? '#1e293b' : '#fbf8f3',
    badgeBg: isDark ? '#1e293b' : '#f5ede1',
    danger: '#e11d48',
  };

  useEffect(() => {
    fetchMinistries();
    fetchPeople();
  }, []);

  useEffect(() => {
    if (activeSection === 'announcements') {
      fetchAnnouncements();
    } else if (activeSection === 'chat') {
      fetchChat();
      const interval = setInterval(() => {
        fetchChat();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeSection]);

  const fetchMinistries = async () => {
    try {
      setLoading(true);
      const data = await api.getMinistries();
      setMinistries(data || []);
    } catch (err) {
      console.error('Fetch ministries error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeople = async () => {
    try {
      const data = await api.getMusicians({ active: 'true' });
      setAllPeople(data || []);
    } catch (err) {
      console.error('Fetch people error:', err);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      setLoadingAnnouncements(true);
      const data = await api.getCommunityAnnouncements();
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch community announcements error:', err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const fetchChat = async () => {
    try {
      const data = await api.getCommunityChat();
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch community chat error:', err);
    }
  };

  // Handle Android Hardware / Swipe Back Button
  useEffect(() => {
    const handleBack = () => {
      if (isModalOpen) {
        setIsModalOpen(false);
        return true;
      }
      if (isAnnModalOpen) {
        setIsAnnModalOpen(false);
        return true;
      }
      if (selectedMinistry) {
        setSelectedMinistry(null);
        return true;
      }
      if (activeSection !== 'ministries') {
        setActiveSection('ministries');
        return true;
      }
      return false; // Propagate to App.js tab navigation
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backSub.remove();
  }, [isModalOpen, isAnnModalOpen, selectedMinistry, activeSection]);

  // --- Ministry Modal Handlers ---
  const handleOpenCreate = () => {
    if (isMember) return;
    setEditingMinistry(null);
    setName('');
    setLeaderId('');
    setLeaderName('');
    setLeaderPhone('');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m) => {
    if (!canManage) return;
    setEditingMinistry(m);
    setName(m.name || '');
    setLeaderId(m.leader_id || '');
    setLeaderName(m.leader_name || '');
    setLeaderPhone(m.leader_phone || '');
    setDescription(m.description || '');
    setIsModalOpen(true);
  };

  const handleSelectLeader = (person) => {
    if (!person) {
      setLeaderId('');
      setLeaderName('');
      setLeaderPhone('');
      return;
    }
    setLeaderId(person.id);
    setLeaderName(person.name);
    setLeaderPhone(person.phone || '');
  };

  const handleSaveMinistry = async () => {
    if (isMember) {
      Alert.alert('Read-Only', 'Members have read-only access. You cannot create or modify ministries.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a Ministry Name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        leader_id: leaderId || undefined,
        leader_name: leaderName.trim() || undefined,
        leader_phone: leaderPhone.trim() || undefined,
        description: description.trim() || undefined,
      };

      if (editingMinistry) {
        await api.updateMinistry(editingMinistry.id, payload);
        Alert.alert('Ministry Updated', `"${name}" has been updated.`);
      } else {
        await api.createMinistry(payload);
        Alert.alert('Ministry Created', `"${name}" has been registered.`);
      }

      setIsModalOpen(false);
      fetchMinistries();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not save ministry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMinistry = (m) => {
    if (!canDelete) {
      Alert.alert('Permission Denied', 'Only Admins and Pastors can delete ministries.');
      return;
    }

    Alert.alert(
      'Delete Ministry',
      `Are you sure you want to delete "${m.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMinistry(m.id);
              fetchMinistries();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to delete ministry');
            }
          },
        },
      ]
    );
  };

  // --- General Announcements Handlers ---
  const handlePickAnnMedia = async () => {
    const picked = await pickMediaAttachment();
    if (picked) {
      setAnnMedia(picked);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!annContent.trim() && !annMedia) {
      Alert.alert('Required Field', 'Please write announcement content or attach a photo/video under 10MB.');
      return;
    }
    setPostingAnn(true);
    try {
      let mediaUrl = null;
      let mediaType = null;
      let mediaName = null;
      let mediaSize = null;

      if (annMedia) {
        const uploadRes = await api.uploadMedia({
          fileBase64: annMedia.base64,
          fileName: annMedia.fileName,
          fileType: annMedia.fileType,
        });
        mediaUrl = uploadRes.url;
        mediaType = uploadRes.type;
        mediaName = uploadRes.name;
        mediaSize = uploadRes.size;
      }

      await api.createCommunityAnnouncement({
        title: annTitle.trim() || undefined,
        content: annContent.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        media_size: mediaSize,
      });
      setAnnTitle('');
      setAnnContent('');
      setAnnMedia(null);
      setIsAnnModalOpen(false);
      fetchAnnouncements();
      Alert.alert('Broadcast Published', 'General announcement has been broadcasted.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not broadcast announcement');
    } finally {
      setPostingAnn(false);
    }
  };

  const handleDeleteAnnouncement = (id) => {
    if (!canDelete) {
      Alert.alert('Permission Denied', 'Only Admins and Pastors can delete announcements.');
      return;
    }

    Alert.alert('Delete Announcement', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCommunityAnnouncement(id);
            fetchAnnouncements();
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not delete announcement');
          }
        },
      },
    ]);
  };

  // --- General Church Chat Handlers ---
  const handlePickChatMedia = async () => {
    const picked = await pickMediaAttachment();
    if (picked) {
      setChatMedia(picked);
    }
  };

  const handleSendChat = async () => {
    if ((!chatInput.trim() && !chatMedia) || sendingChat) return;
    const text = chatInput.trim();
    const mediaToUpload = chatMedia;
    setChatInput('');
    setChatMedia(null);
    setSendingChat(true);

    try {
      let mediaUrl = null;
      let mediaType = null;
      let mediaName = null;
      let mediaSize = null;

      if (mediaToUpload) {
        const uploadRes = await api.uploadMedia({
          fileBase64: mediaToUpload.base64,
          fileName: mediaToUpload.fileName,
          fileType: mediaToUpload.fileType,
        });
        mediaUrl = uploadRes.url;
        mediaType = uploadRes.type;
        mediaName = uploadRes.name;
        mediaSize = uploadRes.size;
      }

      await api.sendCommunityChat({
        message: text,
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        media_size: mediaSize,
      });
      await fetchChat();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not send message');
    } finally {
      setSendingChat(false);
    }
  };

  const handleDeleteChatMessage = (msgId) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCommunityChat(msgId);
            fetchChat();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || err.message || 'Could not delete message');
          }
        },
      },
    ]);
  };

  const filteredMinistries = ministries.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.leader_name || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  });

  const renderMinistryCard = ({ item }) => {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.ministryIconBox, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="people" size={22} color={colors.primary} />
          </View>
          <View style={styles.ministryInfo}>
            <Text style={[styles.ministryTitle, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.ministryLeader, { color: colors.subText }]}>
              Leader: {item.leader_name || 'TBD'}
            </Text>
          </View>

          {/* Edit / Delete Buttons - STRICTLY HIDDEN FOR MEMBERS */}
          {canManage && (
            <View style={styles.headerActionBtns}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => handleOpenEdit(item)}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              {canDelete && (
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleDeleteMinistry(item)}
                >
                  <Ionicons name="trash-outline" size={18} color="#e11d48" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {item.description ? (
          <Text style={[styles.descText, { color: colors.subText, backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            {item.description}
          </Text>
        ) : null}

        {/* Contact Leader Actions */}
        {item.leader_phone ? (
          <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`tel:${item.leader_phone}`)}
            >
              <Ionicons name="call-outline" size={15} color={colors.primary} />
              <Text style={[styles.contactBtnText, { color: colors.primary }]}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() =>
                Linking.openURL(`https://wa.me/${item.leader_phone.replace(/[^0-9]/g, '')}`)
              }
            >
              <Ionicons name="logo-whatsapp" size={15} color="#16a34a" />
              <Text style={[styles.contactBtnText, { color: '#16a34a' }]}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerLabel, { color: colors.subText }]}>Active Volunteers</Text>
          <View style={[styles.memberCountBadge, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
            <Text style={[styles.memberCountText, { color: colors.primaryDark }]}>
              {item.member_count === 1 ? '1 member serving' : `${item.member_count || 0} members serving`}
            </Text>
          </View>
        </View>

        {/* Open Ministry Hub Button */}
        <TouchableOpacity
          style={[styles.openHubBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => setSelectedMinistry(item)}
        >
          <Ionicons name="sparkles" size={14} color="#ffffff" />
          <Text style={styles.openHubBtnText}>Open {item.name} Hub</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (selectedMinistry) {
    return (
      <MinistryHubScreen
        ministry={selectedMinistry}
        user={user}
        isDark={isDark}
        onBack={() => {
          setSelectedMinistry(null);
          fetchMinistries();
        }}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Title & Header */}
      <View style={styles.headerTop}>
        <View>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Church Community</Text>
          <Text style={[styles.pageSub, { color: colors.subText }]}>
            Broadcasts, whole-church chat, and ministry teams
          </Text>
        </View>
        {activeSection === 'ministries' && canManage && (
          <TouchableOpacity
            style={[styles.createTopBtn, { backgroundColor: colors.primary }]}
            onPress={handleOpenCreate}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.createTopBtnText}>Create</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* WhatsApp Community Tabs */}
      <View style={[styles.communityTabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.commTab,
            activeSection === 'ministries' && [styles.commTabActive, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveSection('ministries')}
        >
          <Ionicons
            name="people"
            size={14}
            color={activeSection === 'ministries' ? '#ffffff' : colors.subText}
          />
          <Text
            style={[
              styles.commTabText,
              { color: activeSection === 'ministries' ? '#ffffff' : colors.subText },
            ]}
          >
            Ministries ({ministries.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.commTab,
            activeSection === 'announcements' && [styles.commTabActive, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveSection('announcements')}
        >
          <Ionicons
            name="megaphone"
            size={14}
            color={activeSection === 'announcements' ? '#ffffff' : colors.subText}
          />
          <Text
            style={[
              styles.commTabText,
              { color: activeSection === 'announcements' ? '#ffffff' : colors.subText },
            ]}
          >
            Announcements
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.commTab,
            activeSection === 'chat' && [styles.commTabActive, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveSection('chat')}
        >
          <Ionicons
            name="chatbubbles"
            size={14}
            color={activeSection === 'chat' ? '#ffffff' : colors.subText}
          />
          <Text
            style={[
              styles.commTabText,
              { color: activeSection === 'chat' ? '#ffffff' : colors.subText },
            ]}
          >
            Church Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* ======================================================== */}
      {/* SECTION 1: MINISTRIES                                    */}
      {/* ======================================================== */}
      {activeSection === 'ministries' && (
        <View style={{ flex: 1 }}>
          {/* Search Input */}
          <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.subText} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search ministries by name, leader..."
              placeholderTextColor={colors.subText}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.subText} />
              </TouchableOpacity>
            )}
          </View>

          {/* Ministries List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredMinistries}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMinistryCard}
              contentContainerStyle={styles.listContent}
              refreshing={loading}
              onRefresh={fetchMinistries}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={44} color={colors.subText} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Ministries Found</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                    {canManage ? 'Tap "Create" above to set up a new church team.' : 'Check back later for active ministry teams.'}
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: GENERAL ANNOUNCEMENTS                         */}
      {/* ======================================================== */}
      {activeSection === 'announcements' && (
        <View style={{ flex: 1 }}>
          {canPostGeneral ? (
            <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.openHubBtn, { backgroundColor: colors.primary, marginTop: 0 }]}
                onPress={() => setIsAnnModalOpen(true)}
              >
                <Ionicons name="megaphone" size={16} color="#ffffff" />
                <Text style={styles.openHubBtnText}>Broadcast General Announcement</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.memberNotice, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
              <Text style={[styles.memberNoticeText, { color: colors.primaryDark }]}>
                General Broadcasts • Only Pastors & Admins can post
              </Text>
            </View>
          )}

          {loadingAnnouncements ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={announcements}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              refreshing={loadingAnnouncements}
              onRefresh={fetchAnnouncements}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="megaphone-outline" size={44} color={colors.subText} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No General Announcements</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                    Official church updates from pastors and leadership will appear here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 10,
                          backgroundColor: colors.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 13 }}>
                          {(item.author_name || 'P')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>
                            {item.author_name || 'Pastor / Church Leadership'}
                          </Text>
                          <View style={{ backgroundColor: '#ffe4e6', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#e11d48', textTransform: 'uppercase' }}>
                              {item.author_role || 'Pastor'}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 10, color: colors.subText }}>
                          {new Date(item.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    </View>

                    {canDelete && (
                      <TouchableOpacity onPress={() => handleDeleteAnnouncement(item.id)}>
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {item.title ? (
                    <Text style={{ fontWeight: '800', fontSize: 14, color: colors.text, marginTop: 10 }}>
                      {item.title}
                    </Text>
                  ) : null}

                  {item.content ? (
                    <Text style={{ fontSize: 12, color: colors.text, marginTop: 6, lineHeight: 18 }}>
                      {item.content}
                    </Text>
                  ) : null}

                  {item.media_url ? (
                    <MediaAttachmentCard
                      mediaUrl={item.media_url}
                      mediaType={item.media_type}
                      mediaName={item.media_name}
                      mediaSize={item.media_size}
                      colors={colors}
                    />
                  ) : null}
                </View>
              )}
            />
          )}
        </View>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: GENERAL CHURCH CHAT                           */}
      {/* ======================================================== */}
      {activeSection === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={chatListRef}
            data={chatMessages}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={44} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Church Family Chat</Text>
                <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                  Open discussion room for the entire church family. Greet, encourage, and pray for one another.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = (item.user_id && user?.id && item.user_id === user.id) ||
                           (item.sender_name && item.sender_name === user?.name);
              const role = (item.sender_role || '').toLowerCase();
              const canDeleteThis = canDelete || isMe;

              return (
                <View style={[styles.chatRow, isMe ? styles.chatRowRight : styles.chatRowLeft]}>
                  {!isMe && (
                    <View style={[styles.botAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.botAvatarText}>
                        {(item.sender_name || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.chatBubble,
                      isMe
                        ? [styles.chatBubbleUser, { backgroundColor: colors.primary }]
                        : [styles.chatBubbleBot, { backgroundColor: colors.card, borderColor: colors.border }],
                    ]}
                  >
                    <View style={styles.chatMetaRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={[styles.chatSender, { color: isMe ? '#ffffff' : colors.text }]}>
                          {isMe ? 'You' : item.sender_name || 'Church Member'}
                        </Text>
                        {role && role !== 'member' && (
                          <View
                            style={{
                              backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.badgeBg,
                              paddingHorizontal: 4,
                              paddingVertical: 1,
                              borderRadius: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 9,
                                fontWeight: '800',
                                color: isMe ? '#ffffff' : colors.primaryDark,
                                textTransform: 'uppercase',
                              }}
                            >
                              {role}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.chatTime, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.subText }]}>
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        {canDeleteThis && (
                          <TouchableOpacity
                            onPress={() => handleDeleteChatMessage(item.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={12}
                              color={isMe ? 'rgba(255,255,255,0.7)' : colors.danger}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {item.message ? (
                      <Text style={[styles.chatMessageText, { color: isMe ? '#ffffff' : colors.text }]}>
                        {item.message}
                      </Text>
                    ) : null}

                    {item.media_url ? (
                      <MediaAttachmentCard
                        mediaUrl={item.media_url}
                        mediaType={item.media_type}
                        mediaName={item.media_name}
                        mediaSize={item.media_size}
                        isMe={isMe}
                        colors={colors}
                      />
                    ) : null}
                  </View>
                </View>
              );
            }}
          />

          {chatMedia && (
            <View style={[styles.chatMediaPreviewChip, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
              <Ionicons
                name={chatMedia.type === 'video' ? 'videocam' : 'image'}
                size={16}
                color={colors.primaryDark}
              />
              <Text style={[styles.chatMediaPreviewText, { color: colors.text }]} numberOfLines={1}>
                {chatMedia.fileName} ({chatMedia.fileSize ? (chatMedia.fileSize / 1024).toFixed(0) + 'KB' : '<10MB'})
              </Text>
              <TouchableOpacity onPress={() => setChatMedia(null)}>
                <Ionicons name="close-circle" size={18} color={colors.subText} />
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Chat Input */}
          <View style={[styles.chatInputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={styles.chatAttachBtn}
              onPress={handlePickChatMedia}
              activeOpacity={0.7}
            >
              <Ionicons
                name={chatMedia ? 'checkmark-circle' : 'attach'}
                size={22}
                color={chatMedia ? colors.primary : colors.subText}
              />
            </TouchableOpacity>

            <TextInput
              style={[styles.chatTextInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Message church family..."
              placeholderTextColor={colors.subText}
            />
            <TouchableOpacity
              style={[
                styles.chatSendBtn,
                { backgroundColor: colors.primary },
                ((!chatInput.trim() && !chatMedia) || sendingChat) && { opacity: 0.5 },
              ]}
              disabled={(!chatInput.trim() && !chatMedia) || sendingChat}
              onPress={handleSendChat}
            >
              <Ionicons name="send" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ======================================================== */}
      {/* MODAL: BROADCAST GENERAL ANNOUNCEMENT                    */}
      {/* ======================================================== */}
      <Modal visible={isAnnModalOpen} animationType="slide" transparent onRequestClose={() => setIsAnnModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="megaphone" size={18} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>General Announcement</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAnnModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Title (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={annTitle}
                onChangeText={setAnnTitle}
                placeholder="e.g. Sunday Service & Call Times"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Announcement Message</Text>
              <TextInput
                style={[styles.input, { minHeight: 90, textAlignVertical: 'top', backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={annContent}
                onChangeText={setAnnContent}
                multiline
                placeholder="Write official church announcement for the entire congregation..."
                placeholderTextColor={colors.subText}
              />

              {/* Media Attachment for Announcement */}
              <View style={{ marginTop: 12, marginBottom: 8 }}>
                <Text style={[styles.inputLabel, { color: colors.subText }]}>Media Attachment (Photo or Video &lt; 10MB)</Text>
                {annMedia ? (
                  <View style={[styles.chatMediaPreviewChip, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
                    <Ionicons
                      name={annMedia.type === 'video' ? 'videocam' : 'image'}
                      size={18}
                      color={colors.primaryDark}
                    />
                    <Text style={[styles.chatMediaPreviewText, { color: colors.text }]} numberOfLines={1}>
                      {annMedia.fileName} ({annMedia.fileSize ? (annMedia.fileSize / 1024).toFixed(0) + 'KB' : '<10MB'})
                    </Text>
                    <TouchableOpacity onPress={() => setAnnMedia(null)}>
                      <Ionicons name="close-circle" size={20} color={colors.subText} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.annMediaPickerBtn, { borderColor: colors.border, backgroundColor: colors.inputBg }]}
                    onPress={handlePickAnnMedia}
                  >
                    <Ionicons name="image-outline" size={18} color={colors.primary} />
                    <Text style={[styles.annMediaPickerText, { color: colors.primary }]}>
                      Attach Photo or Video (&lt; 10MB)
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => setIsAnnModalOpen(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                  onPress={handlePostAnnouncement}
                  disabled={postingAnn || (!annContent.trim() && !annMedia)}
                >
                  {postingAnn ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Broadcast</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: CREATE / EDIT MINISTRY                            */}
      {/* ======================================================== */}
      {isModalOpen && canManage && (
        <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: '85%' }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingMinistry ? 'Edit Church Ministry' : 'Create New Ministry'}
                </Text>
                <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                  <Ionicons name="close" size={22} color={colors.subText} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: colors.subText }]}>Ministry Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Media Team, Worship Ministry, Production"
                  placeholderTextColor={colors.subText}
                />

                <Text style={[styles.inputLabel, { color: colors.subText }]}>
                  Ministry Leader (Selected from People Directory)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                >
                  {allPeople.map((p) => {
                    const isSelected = leaderId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.personPill,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.inputBg,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => handleSelectLeader(isSelected ? null : p)}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'person-outline'}
                          size={14}
                          color={isSelected ? '#ffffff' : colors.primary}
                        />
                        <Text style={[styles.personPillText, { color: isSelected ? '#ffffff' : colors.text }]}>
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {leaderName ? (
                  <View style={[styles.selectedLeaderBox, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.primaryDark} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedLeaderName, { color: colors.primaryDark }]}>
                        Leader: {leaderName}
                      </Text>
                      {leaderPhone ? (
                        <Text style={{ fontSize: 11, color: colors.primaryDark }}>
                          {leaderPhone}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                <Text style={[styles.inputLabel, { color: colors.subText }]}>Ministry Description (Optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70, textAlignVertical: 'top', backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholder="Describe ministry mission, volunteer duties, and equipment..."
                  placeholderTextColor={colors.subText}
                />
              </ScrollView>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => setIsModalOpen(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSaveMinistry}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>{editingMinistry ? 'Save Changes' : 'Create Ministry'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 11,
    marginTop: 2,
  },
  createTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  createTopBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  communityTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 8,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  commTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 10,
  },
  commTabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  commTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  memberNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberNoticeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  card: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ministryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ministryInfo: {
    flex: 1,
  },
  ministryTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  ministryLeader: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  descText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  contactBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  footerLabel: {
    fontSize: 12,
  },
  memberCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  memberCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  openHubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 10,
  },
  openHubBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  chatRow: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  chatRowLeft: {
    justifyContent: 'flex-start',
  },
  chatRowRight: {
    justifyContent: 'flex-end',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  botAvatarText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  chatBubble: {
    maxWidth: '78%',
    padding: 10,
    borderRadius: 14,
  },
  chatBubbleUser: {
    borderBottomRightRadius: 2,
  },
  chatBubbleBot: {
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  chatMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  chatSender: {
    fontSize: 11,
    fontWeight: '800',
  },
  chatTime: {
    fontSize: 9,
  },
  chatMessageText: {
    fontSize: 12,
    lineHeight: 17,
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 12,
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 13,
  },
  personPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  personPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectedLeaderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },
  selectedLeaderName: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  chatAttachBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatMediaPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  chatMediaPreviewText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  annMediaPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  annMediaPickerText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
