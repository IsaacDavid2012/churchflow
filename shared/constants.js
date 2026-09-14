/**
 * ServeSync System Constants & Status Enums
 */

const SERVICE_STATUSES = {
  DRAFT: 'draft',
  AVAILABILITY_OPEN: 'availability_open',
  ROSTERED: 'rostered',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
};

const ASSIGNMENT_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  PROMOTED: 'promoted',
};

const ROLE_SLOTS = {
  PRIMARY: 'primary',
  BACKUP: 'backup',
};

const MEMBER_STATUSES = {
  MEMBER: 'member',
  REGULAR: 'regular',
  VISITOR: 'visitor',
  LEADER: 'leader',
  STAFF: 'staff',
};

const HOUSEHOLD_ROLES = {
  HEAD: 'head',
  SPOUSE: 'spouse',
  CHILD: 'child',
  INDIVIDUAL: 'individual',
};

const PLAN_ITEM_TYPES = {
  HEADER: 'header',
  SONG: 'song',
  ITEM: 'item',
  SERMON: 'sermon',
  PRAYER: 'prayer',
  OFFERING: 'offering',
  MEDIA: 'media',
  ANNOUNCEMENT: 'announcement',
};

const NOTIFICATION_TYPES = {
  SERVICE_CREATED: 'service_created',
  AVAILABILITY_CHANGE: 'availability_change',
  RESHUFFLE: 'reshuffle',
  PROMOTION: 'promotion',
  MANUAL_OVERRIDE: 'manual_override',
  LINEUP_CONFIRMED: 'lineup_confirmed',
  WORSHIP_LEADER_SELECTED: 'worship_leader_selected',
  DEADLINE_REMINDER: 'deadline_reminder',
};

const DEFAULT_MINISTRIES = [
  { name: 'Worship Team', description: 'Vocalists and instrument players for Sunday services', icon: 'Music', color: 'indigo', sort_order: 1 },
  { name: 'Production & Tech', description: 'Sound engineering, projection/slides, broadcast stream and lighting', icon: 'Tv', color: 'blue', sort_order: 2 },
  { name: 'Ushers & Greeters', description: 'Welcoming congregation, bulletin distribution and offering collection', icon: 'Users', color: 'emerald', sort_order: 3 },
  { name: 'Kids Rock Ministry', description: 'Sunday school teachers and child care coordinators', icon: 'Smile', color: 'amber', sort_order: 4 },
  { name: 'Prayer & Intercession', description: 'Pre-service prayer and post-service altar ministry', icon: 'Heart', color: 'rose', sort_order: 5 },
  { name: 'Hospitality', description: 'Coffee fellowship, refreshments and setup', icon: 'Coffee', color: 'cyan', sort_order: 6 },
];

const DEFAULT_POSITIONS = [
  // Worship Team
  { name: 'Acoustic Guitar', ministry: 'Worship Team', sort_order: 1 },
  { name: 'Electric Guitar', ministry: 'Worship Team', sort_order: 2 },
  { name: 'Bass Guitar', ministry: 'Worship Team', sort_order: 3 },
  { name: 'Drums', ministry: 'Worship Team', sort_order: 4 },
  { name: 'Keyboard / Piano', ministry: 'Worship Team', sort_order: 5 },
  { name: 'Lead Vocalist', ministry: 'Worship Team', sort_order: 6 },
  { name: 'Backing Vocalist 1', ministry: 'Worship Team', sort_order: 7 },
  { name: 'Backing Vocalist 2', ministry: 'Worship Team', sort_order: 8 },

  // Production & Tech
  { name: 'FOH Sound Engineer', ministry: 'Production & Tech', sort_order: 9 },
  { name: 'ProPresenter / Slides', ministry: 'Production & Tech', sort_order: 10 },
  { name: 'Livestream Camera', ministry: 'Production & Tech', sort_order: 11 },
  { name: 'Lighting Operator', ministry: 'Production & Tech', sort_order: 12 },

  // Ushers & Greeters
  { name: 'Head Usher', ministry: 'Ushers & Greeters', sort_order: 13 },
  { name: 'Door Greeter 1', ministry: 'Ushers & Greeters', sort_order: 14 },
  { name: 'Door Greeter 2', ministry: 'Ushers & Greeters', sort_order: 15 },
  { name: 'Offering Collector', ministry: 'Ushers & Greeters', sort_order: 16 },

  // Kids Rock
  { name: 'Lead Teacher (Preschool)', ministry: 'Kids Rock Ministry', sort_order: 17 },
  { name: 'Lead Teacher (Elementary)', ministry: 'Kids Rock Ministry', sort_order: 18 },
  { name: 'Classroom Assistant', ministry: 'Kids Rock Ministry', sort_order: 19 },
];

module.exports = {
  SERVICE_STATUSES,
  ASSIGNMENT_STATUSES,
  ROLE_SLOTS,
  MEMBER_STATUSES,
  HOUSEHOLD_ROLES,
  PLAN_ITEM_TYPES,
  NOTIFICATION_TYPES,
  DEFAULT_MINISTRIES,
  DEFAULT_POSITIONS,
};
