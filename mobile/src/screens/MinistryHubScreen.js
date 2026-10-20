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

export default function MinistryHubScreen({ ministry, user, isDark = false, onBack }) {
  const [activeTab, setActiveTab] = useState('stream'); // 'stream' | 'people' | 'chat'

  // Roles
  const userRole = normalizeRole(user?.role);
  const isAdmin = userRole === ROLES.ADMIN;
  const isPastor = userRole === ROLES.PASTOR;
  const isGlobalManager = userRole === ROLES.MANAGER;
  const canAdminOrPastor = isAdmin || isPastor;

  // Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [annMedia, setAnnMedia] = useState(null);
  const [posting, setPosting] = useState(false);

  // Members
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allPeople, setAllPeople] = useState([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  const [assignRole, setAssignRole] = useState('member');
  const [assigning, setAssigning] = useState(false);

  // Chatbot
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMedia, setChatMedia] = useState(null);
  const [sendingChat, setSendingChat] = useState(false);
  const chatListRef = useRef(null);

  // Check if user is manager in this ministry
  const isMinistryLeader = members.some(
    (m) =>
      (m.user_id === user?.id || (m.email && m.email.toLowerCase() === user?.email?.toLowerCase())) &&
      m.ministry_role === 'manager'
  );
  const canPostAnnouncements = isAdmin || isPastor || isGlobalManager || isMinistryLeader;
  const canManageMembers = isAdmin || isPastor || isGlobalManager || isMinistryLeader;

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
    dangerLight: isDark ? '#4c0519' : '#ffe4e6',
  };

  useEffect(() => {
    loadAnnouncements();
    loadMembers();
    loadChat();
  }, [ministry.id]);

  useEffect(() => {
    if (activeTab === 'chat') {
      const interval = setInterval(() => {
        loadChat();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const loadAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const data = await api.getMinistryAnnouncements(ministry.id);
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load announcements error:', err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await api.getMinistryMembers(ministry.id);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load members error:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadChat = async () => {
    try {
      const data = await api.getMinistryChat(ministry.id);
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Load chat error:', err);
    }
  };

  // Handle Android Hardware / Swipe Back Button
  useEffect(() => {
    const handleBack = () => {
      if (isPostModalOpen) {
        setIsPostModalOpen(false);
        return true;
      }
      if (isAssignModalOpen) {
        setIsAssignModalOpen(false);
        return true;
      }
      if (activeTab !== 'stream') {
        setActiveTab('stream');
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => backSub.remove();
  }, [isPostModalOpen, isAssignModalOpen, activeTab, onBack]);

  const handlePickAnnMedia = async () => {
    const picked = await pickMediaAttachment();
    if (picked) {
      setAnnMedia(picked);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!postContent.trim() && !annMedia) {
      Alert.alert('Required Field', 'Please enter announcement message or attach a photo/video under 10MB.');
      return;
    }
    setPosting(true);
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

      await api.createMinistryAnnouncement(ministry.id, {
        title: postTitle.trim() || undefined,
        content: postContent.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        media_size: mediaSize,
      });
      setPostTitle('');
      setPostContent('');
      setAnnMedia(null);
      setIsPostModalOpen(false);
      loadAnnouncements();
      Alert.alert('Success', 'Announcement posted to ' + ministry.name);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not post announcement');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteAnnouncement = (annId) => {
    Alert.alert('Delete Announcement', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMinistryAnnouncement(ministry.id, annId);
            loadAnnouncements();
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not delete announcement');
          }
        },
      },
    ]);
  };

  const handleOpenAssignModal = async () => {
    try {
      const people = await api.getMusicians({ active: 'true' });
      const assignedIds = new Set(members.map((m) => m.musician_id));
      const unassigned = (people || []).filter((p) => !assignedIds.has(p.id));
      setAllPeople(unassigned);
      if (unassigned.length > 0) {
        setSelectedPersonId(unassigned[0].id);
      }
      setAssignRole('member');
      setIsAssignModalOpen(true);
    } catch (err) {
      Alert.alert('Error', 'Failed to load people directory');
    }
  };

  const handleAssignMember = async () => {
    if (!selectedPersonId) {
      Alert.alert('Required Field', 'Please select a person to assign.');
      return;
    }
    setAssigning(true);
    try {
      await api.assignMinistryMember(ministry.id, {
        musician_id: selectedPersonId,
        role: assignRole,
      });
      setIsAssignModalOpen(false);
      loadMembers();
      Alert.alert('Success', 'Team member assigned successfully.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Could not assign member');
    } finally {
      setAssigning(false);
    }
  };

  const handleToggleMemberRole = (musicianId, newRole) => {
    if (!canAdminOrPastor) {
      Alert.alert('Access Denied', 'Only Admins and Pastors can promote or demote managers.');
      return;
    }
    const actionText = newRole === 'manager' ? 'Promote to Manager' : 'Demote to Member';
    Alert.alert(actionText, `Are you sure you want to change this person's role to ${newRole}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await api.updateMinistryMemberRole(ministry.id, musicianId, newRole);
            loadMembers();
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not update role');
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (musicianId, name) => {
    if (!canManageMembers) return;
    Alert.alert('Remove Member', `Remove ${name} from ${ministry.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.removeMinistryMember(ministry.id, musicianId);
            loadMembers();
          } catch (err) {
            Alert.alert('Error', err.message || 'Could not remove member');
          }
        },
      },
    ]);
  };

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

      await api.sendMinistryChat(ministry.id, {
        message: text,
        media_url: mediaUrl,
        media_type: mediaType,
        media_name: mediaName,
        media_size: mediaSize,
      });
      await loadChat();
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
            await api.deleteMinistryChat(ministry.id, msgId);
            loadChat();
          } catch (err) {
            Alert.alert('Error', err.response?.data?.error || err.message || 'Could not delete message');
          }
        },
      },
    ]);
  };

  // Group members into Managers vs Volunteers
  const managerList = members.filter(
    (m) => m.ministry_role === 'manager' || m.role === 'pastor' || m.role === 'admin'
  );
  const volunteerList = members.filter(
    (m) => m.ministry_role !== 'manager' && m.role !== 'pastor' && m.role !== 'admin'
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Top Header */}
      <View style={[styles.topHeader, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={[styles.backBtnText, { color: colors.text }]}>Ministries</Text>
        </TouchableOpacity>

        <View style={styles.topBadgeRow}>
          <View style={[styles.catBadge, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
            <Text style={[styles.catBadgeText, { color: colors.primaryDark }]}>
              {ministry.category || 'Ministry'}
            </Text>
          </View>
        </View>
      </View>

      {/* Hero Banner */}
      <View style={[styles.heroCard, { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroSubBadge}>
            <Text style={styles.heroSubBadgeText}>{ministry.name} Hub</Text>
          </View>
          <Text style={styles.heroChurchText}>Jesus My Rock Church</Text>
        </View>

        <Text style={styles.heroTitle}>{ministry.name} Hub</Text>
        {ministry.description ? (
          <Text style={styles.heroDesc} numberOfLines={2}>
            {ministry.description}
          </Text>
        ) : null}

        <View style={styles.heroMetaRow}>
          {ministry.leader_name ? (
            <View style={styles.heroMetaItem}>
              <Ionicons name="person-outline" size={13} color="#ffffff" />
              <Text style={styles.heroMetaText}>Leader: {ministry.leader_name}</Text>
            </View>
          ) : null}

          {ministry.leader_phone ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 4 }}
                onPress={() => Linking.openURL(`https://wa.me/${ministry.leader_phone.replace(/[^0-9]/g, '')}`)}
              >
                <Ionicons name="logo-whatsapp" size={12} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, gap: 4 }}
                onPress={() => Linking.openURL(`tel:${ministry.leader_phone}`)}
              >
                <Ionicons name="call-outline" size={12} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>Call</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'stream' && [styles.activeTabItem, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('stream')}
        >
          <Ionicons
            name="megaphone-outline"
            size={16}
            color={activeTab === 'stream' ? '#ffffff' : colors.subText}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'stream' ? '#ffffff' : colors.subText },
            ]}
          >
            Stream
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'people' && [styles.activeTabItem, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('people')}
        >
          <Ionicons
            name="people-outline"
            size={16}
            color={activeTab === 'people' ? '#ffffff' : colors.subText}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'people' ? '#ffffff' : colors.subText },
            ]}
          >
            People ({members.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'chat' && [styles.activeTabItem, { backgroundColor: colors.primary }],
          ]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color={activeTab === 'chat' ? '#ffffff' : colors.subText}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'chat' ? '#ffffff' : colors.subText },
            ]}
          >
            Team Chat
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: STREAM */}
      {activeTab === 'stream' && (
        <View style={{ flex: 1 }}>
          {/* Post composer trigger button (visible to managers/pastors/admin) */}
          {canPostAnnouncements ? (
            <View style={styles.composerTriggerBox}>
              <TouchableOpacity
                style={[styles.postButton, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={() => setIsPostModalOpen(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.postButtonText}>Post Announcement to {ministry.name}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.readOnlyNotice, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primaryDark} />
              <Text style={[styles.readOnlyNoticeText, { color: colors.primaryDark }]}>
                Only Managers, Pastors, and Admins can post announcements. Volunteers have read-only view.
              </Text>
            </View>
          )}

          {loadingAnnouncements ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={announcements}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              refreshing={loadingAnnouncements}
              onRefresh={loadAnnouncements}
              ListEmptyComponent={
                <View style={styles.emptyBox}>
                  <Ionicons name="megaphone-outline" size={40} color={colors.subText} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Announcements Yet</Text>
                  <Text style={[styles.emptySub, { color: colors.subText }]}>
                    Ministry leaders will post rehearsal schedules, setlists, and updates here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const canDeleteThis =
                  canAdminOrPastor ||
                  item.created_by_user_id === user?.id ||
                  item.created_by_name === user?.name;

                return (
                  <View style={[styles.annCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.annHeader}>
                      <View style={styles.annAuthorRow}>
                        <View style={[styles.authorAvatar, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.authorInitials, { color: colors.primaryDark }]}>
                            {(item.created_by_name || 'L')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.annAuthorName, { color: colors.text }]}>
                              {item.created_by_name || 'Ministry Leader'}
                            </Text>
                            <View style={[styles.roleMiniBadge, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
                              <Text style={[styles.roleMiniBadgeText, { color: colors.primaryDark }]}>
                                {item.created_by_role || 'Manager'}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.annDate, { color: colors.subText }]}>
                            {new Date(item.created_at).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>

                      {canDeleteThis && (
                        <TouchableOpacity
                          style={styles.deleteAnnBtn}
                          onPress={() => handleDeleteAnnouncement(item.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {item.title ? (
                      <Text style={[styles.annTitle, { color: colors.text }]}>{item.title}</Text>
                    ) : null}

                    {item.content ? (
                      <Text style={[styles.annContent, { color: colors.text }]}>{item.content}</Text>
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
                );
              }}
            />
          )}
        </View>
      )}

      {/* TAB 2: PEOPLE & LEADERS */}
      {activeTab === 'people' && (
        <View style={{ flex: 1 }}>
          <View style={styles.peopleTopBar}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Team Roster</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.subText }]}>
                Leaders manage team; Volunteers serve during services.
              </Text>
            </View>

            {canManageMembers && (
              <TouchableOpacity
                style={[styles.assignBtn, { backgroundColor: colors.primary }]}
                onPress={handleOpenAssignModal}
              >
                <Ionicons name="person-add" size={14} color="#ffffff" />
                <Text style={styles.assignBtnText}>Assign Person</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingMembers ? (
            <View style={styles.center}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Leaders & Managers Section */}
              <View style={[styles.groupSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.groupSectionHeader, { borderBottomColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
                    <Text style={[styles.groupSectionTitle, { color: colors.text }]}>
                      Ministry Leaders & Managers
                    </Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.countBadgeText, { color: colors.primaryDark }]}>
                      {managerList.length}
                    </Text>
                  </View>
                </View>

                {managerList.length === 0 ? (
                  <Text style={[styles.noMembersText, { color: colors.subText }]}>
                    No managers assigned yet. Pastors and Admins can promote members to Manager.
                  </Text>
                ) : (
                  managerList.map((m) => (
                    <View
                      key={m.musician_id}
                      style={[styles.memberRow, { borderBottomColor: colors.border }]}
                    >
                      <View style={styles.memberLeft}>
                        <View style={[styles.memberAvatar, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.memberAvatarText, { color: colors.primaryDark }]}>
                            {(m.name || 'M')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.memberName, { color: colors.text }]}>{m.name}</Text>
                            <View style={[styles.managerTag, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                              <Text style={[styles.managerTagText, { color: colors.primaryDark }]}>
                                {m.role === 'admin' ? 'Admin' : m.role === 'pastor' ? 'Pastor' : 'Manager'}
                              </Text>
                            </View>
                          </View>
                          {m.phone ? (
                            <Text style={[styles.memberPhone, { color: colors.subText }]}>{m.phone}</Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Demote to Member: Admin/Pastor Only */}
                      {canAdminOrPastor && m.role !== 'admin' && m.role !== 'pastor' && (
                        <TouchableOpacity
                          style={[styles.demoteBtn, { borderColor: colors.border }]}
                          onPress={() => handleToggleMemberRole(m.musician_id, 'member')}
                        >
                          <Ionicons name="arrow-down" size={12} color={colors.subText} />
                          <Text style={[styles.demoteBtnText, { color: colors.subText }]}>Demote</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}
              </View>

              {/* Volunteers Section */}
              <View style={[styles.groupSection, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 14 }]}>
                <View style={[styles.groupSectionHeader, { borderBottomColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="people" size={16} color={colors.primary} />
                    <Text style={[styles.groupSectionTitle, { color: colors.text }]}>
                      Volunteers & Team Members
                    </Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: colors.badgeBg }]}>
                    <Text style={[styles.countBadgeText, { color: colors.subText }]}>
                      {volunteerList.length}
                    </Text>
                  </View>
                </View>

                {volunteerList.length === 0 ? (
                  <Text style={[styles.noMembersText, { color: colors.subText }]}>
                    No volunteers assigned yet. Tap "Assign Person" above to add team members.
                  </Text>
                ) : (
                  volunteerList.map((m) => (
                    <View
                      key={m.musician_id}
                      style={[styles.memberRow, { borderBottomColor: colors.border }]}
                    >
                      <View style={styles.memberLeft}>
                        <View style={[styles.memberAvatar, { backgroundColor: colors.badgeBg }]}>
                          <Text style={[styles.memberAvatarText, { color: colors.subText }]}>
                            {(m.name || 'V')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.memberName, { color: colors.text }]}>{m.name}</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                            {Array.isArray(m.roles) &&
                              m.roles.map((r, i) => (
                                <View key={i} style={[styles.roleMiniTag, { backgroundColor: colors.primaryLight }]}>
                                  <Text style={[styles.roleMiniTagText, { color: colors.primaryDark }]}>{r}</Text>
                                </View>
                              ))}
                          </View>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {/* Make Manager Button (Admin & Pastor Only) */}
                        {canAdminOrPastor && (
                          <TouchableOpacity
                            style={[styles.promoteBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                            onPress={() => handleToggleMemberRole(m.musician_id, 'manager')}
                          >
                            <Ionicons name="shield" size={12} color={colors.primaryDark} />
                            <Text style={[styles.promoteBtnText, { color: colors.primaryDark }]}>Make Manager</Text>
                          </TouchableOpacity>
                        )}

                        {/* Remove Button */}
                        {canManageMembers && (
                          <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => handleRemoveMember(m.musician_id, m.name)}
                          >
                            <Ionicons name="trash-outline" size={15} color={colors.danger} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* TAB 3: TEAM CHAT SPACE (Real Team Chat) */}
      {activeTab === 'chat' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Messages list */}
          <FlatList
            ref={chatListRef}
            data={chatMessages}
            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
            contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyChatBox}>
                <Ionicons name="chatbubble-ellipses" size={36} color={colors.primary} />
                <Text style={[styles.emptyChatTitle, { color: colors.text }]}>
                  {ministry.name} Team Chat Space
                </Text>
                <Text style={[styles.emptyChatSub, { color: colors.subText }]}>
                  Live team conversation for {ministry.name}. Leaders post meeting times, rehearsal schedules, and team notices here.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = (item.user_id && user?.id && item.user_id === user.id) || 
                           (item.sender_name && item.sender_name === user?.name);
              const role = (item.sender_role || '').toLowerCase();
              const canDeleteThis = canAdminOrPastor || isMe;

              return (
                <View
                  style={[
                    styles.chatRow,
                    isMe ? styles.chatRowRight : styles.chatRowLeft,
                  ]}
                >
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
                        <Text
                          style={[
                            styles.chatSender,
                            { color: isMe ? '#ffffff' : colors.text },
                          ]}
                        >
                          {isMe ? 'You' : item.sender_name || 'Team Member'}
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
                        <Text
                          style={[
                            styles.chatTime,
                            { color: isMe ? 'rgba(255,255,255,0.7)' : colors.subText },
                          ]}
                        >
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
                      <Text
                        style={[
                          styles.chatMessageText,
                          { color: isMe ? '#ffffff' : colors.text },
                        ]}
                      >
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
              placeholder={`Message ${ministry.name} team...`}
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

      {/* Post Announcement Modal */}
      <Modal visible={isPostModalOpen} animationType="slide" transparent onRequestClose={() => setIsPostModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="megaphone" size={18} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Post Announcement</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPostModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>Title (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={postTitle}
                onChangeText={setPostTitle}
                placeholder="e.g. Thursday Rehearsal Setlist & Call Time"
                placeholderTextColor={colors.subText}
              />

              <Text style={[styles.inputLabel, { color: colors.subText }]}>Announcement Message</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
                ]}
                value={postContent}
                onChangeText={setPostContent}
                multiline
                numberOfLines={4}
                placeholder="Share details, worship songs, audio setup instructions, or prayer points..."
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

              <Text style={[styles.noticeSubText, { color: colors.subText }]}>
                * This announcement will appear on the {ministry.name} Hub stream for all volunteers.
              </Text>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsPostModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.subText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }, ((!postContent.trim() && !annMedia) || posting) && { opacity: 0.5 }]}
                disabled={(!postContent.trim() && !annMedia) || posting}
                onPress={handlePostAnnouncement}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Post Announcement</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign Member Modal */}
      <Modal visible={isAssignModalOpen} animationType="slide" transparent onRequestClose={() => setIsAssignModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Assign Person to {ministry.name}
              </Text>
              <TouchableOpacity onPress={() => setIsAssignModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.subText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              <Text style={[styles.inputLabel, { color: colors.subText }]}>
                Select Person from Church Directory *
              </Text>

              {allPeople.length === 0 ? (
                <Text style={[styles.emptyPeopleText, { color: colors.subText }]}>
                  All active church members are already assigned to this ministry.
                </Text>
              ) : (
                <View style={{ gap: 8, marginTop: 4 }}>
                  {allPeople.slice(0, 10).map((p) => {
                    const isSelected = selectedPersonId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setSelectedPersonId(p.id)}
                        style={[
                          styles.personPickerItem,
                          {
                            backgroundColor: isSelected ? colors.primaryLight : colors.inputBg,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                          size={18}
                          color={isSelected ? colors.primary : colors.subText}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.pickerName,
                              { color: isSelected ? colors.primaryDark : colors.text },
                            ]}
                          >
                            {p.name}
                          </Text>
                          <Text style={[styles.pickerDetails, { color: colors.subText }]}>
                            {p.primary_instrument || 'Volunteer'} • {p.phone || p.email || 'Active'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Ministry Role Selector */}
              <Text style={[styles.inputLabel, { color: colors.subText, marginTop: 14 }]}>
                Ministry Role
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={[
                    styles.roleChoiceBtn,
                    {
                      backgroundColor: assignRole === 'member' ? colors.primaryLight : colors.inputBg,
                      borderColor: assignRole === 'member' ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setAssignRole('member')}
                >
                  <Text
                    style={[
                      styles.roleChoiceText,
                      { color: assignRole === 'member' ? colors.primaryDark : colors.text },
                    ]}
                  >
                    Volunteer Member
                  </Text>
                </TouchableOpacity>

                {canAdminOrPastor && (
                  <TouchableOpacity
                    style={[
                      styles.roleChoiceBtn,
                      {
                        backgroundColor: assignRole === 'manager' ? colors.primaryLight : colors.inputBg,
                        borderColor: assignRole === 'manager' ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setAssignRole('manager')}
                  >
                    <Text
                      style={[
                        styles.roleChoiceText,
                        { color: assignRole === 'manager' ? colors.primaryDark : colors.text },
                      ]}
                    >
                      Ministry Manager
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {!canAdminOrPastor && (
                <Text style={[styles.noticeSubText, { color: colors.subText }]}>
                  * Only Admins and Pastors can designate a member as Ministry Manager.
                </Text>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsAssignModalOpen(false)}
              >
                <Text style={[styles.cancelBtnText, { color: colors.subText }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: colors.primary },
                  (!selectedPersonId || assigning) && { opacity: 0.5 },
                ]}
                disabled={!selectedPersonId || assigning}
                onPress={handleAssignMember}
              >
                {assigning ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Confirm Assignment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  topBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroSubBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroSubBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroChurchText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  heroDesc: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.25)',
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
  },
  activeTabItem: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  aiPill: {
    backgroundColor: 'rgba(254, 243, 199, 0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  aiPillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#b45309',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  composerTriggerBox: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  postButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    elevation: 2,
  },
  postButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  readOnlyNotice: {
    margin: 16,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readOnlyNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  annCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  annHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  annAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorInitials: {
    fontSize: 14,
    fontWeight: '900',
  },
  annAuthorName: {
    fontSize: 13,
    fontWeight: '800',
  },
  roleMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  annDate: {
    fontSize: 10,
    marginTop: 1,
  },
  deleteAnnBtn: {
    padding: 6,
  },
  annTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },
  annContent: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  peopleTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  assignBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  groupSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  groupSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  groupSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  noMembersText: {
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 10,
    textAlign: 'center',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '900',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '800',
  },
  managerTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  managerTagText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  memberPhone: {
    fontSize: 10,
    marginTop: 1,
  },
  roleMiniTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleMiniTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  demoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  demoteBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  promoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  promoteBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  removeBtn: {
    padding: 6,
  },
  chipsContainer: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 30,
  },
  emptyChatTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
  },
  emptyChatSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  botAvatarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  chatBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
  },
  chatBubbleBot: {
    borderWidth: 1,
    borderTopLeftRadius: 4,
  },
  chatBubbleUser: {
    borderTopRightRadius: 4,
  },
  chatMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  chatSender: {
    fontSize: 10,
    fontWeight: '800',
  },
  chatTime: {
    fontSize: 9,
  },
  chatMessageText: {
    fontSize: 12,
    lineHeight: 18,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  chatTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    fontSize: 12,
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 13,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  noticeSubText: {
    fontSize: 10,
    marginTop: 6,
    lineHeight: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
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
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyPeopleText: {
    fontSize: 12,
    paddingVertical: 8,
  },
  personPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pickerName: {
    fontSize: 12,
    fontWeight: '700',
  },
  pickerDetails: {
    fontSize: 10,
    marginTop: 1,
  },
  roleChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  roleChoiceText: {
    fontSize: 11,
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
