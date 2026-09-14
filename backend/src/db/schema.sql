-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Church Profile Settings (Jesus My Rock Church)
CREATE TABLE IF NOT EXISTS church_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL DEFAULT 'Jesus My Rock Church',
    tagline VARCHAR(255) DEFAULT 'Standing Firm on Christ the Solid Rock',
    lead_pastor VARCHAR(255) DEFAULT 'Pastor David & Sarah',
    email VARCHAR(255) DEFAULT 'office@jesusmyrock.org',
    phone VARCHAR(50) DEFAULT '+1 (555) 762-5762',
    address TEXT DEFAULT '1200 Rock Boulevard, Sanctuary Suite 100',
    website VARCHAR(255) DEFAULT 'https://servesync.creativeclicks.art',
    primary_color VARCHAR(50) DEFAULT '#4f46e5',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campuses / Locations
CREATE TABLE IF NOT EXISTS campuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    is_main BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ministries / Teams (e.g. Worship, Production & Tech, Ushers & Greeters, Kids Rock, Prayer, Hospitality)
CREATE TABLE IF NOT EXISTS ministries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Users',
    color VARCHAR(50) DEFAULT 'indigo',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ministries_sort ON ministries(sort_order);

-- Users table (RBAC: Admin / Pastor / Leader / Volunteer)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'volunteer', -- 'admin', 'pastor', 'leader', 'volunteer'
    name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'invited', 'disabled'
    force_password_reset BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Refresh tokens for secure JWT rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Households / Families (Planning Center People)
CREATE TABLE IF NOT EXISTS households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    primary_phone VARCHAR(50),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- People / Musicians table (Planning Center People Directory & Volunteer Roster)
CREATE TABLE IF NOT EXISTS musicians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    roles TEXT[] NOT NULL DEFAULT '{}',
    ministry VARCHAR(100) DEFAULT 'Worship Team',
    status VARCHAR(50) NOT NULL DEFAULT 'member', -- 'member', 'regular', 'visitor', 'leader', 'staff'
    household_id UUID REFERENCES households(id) ON DELETE SET NULL,
    household_role VARCHAR(50) DEFAULT 'individual', -- 'head', 'spouse', 'child', 'individual'
    birthday DATE,
    gender VARCHAR(20),
    address TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_musicians_active ON musicians(active);
CREATE INDEX IF NOT EXISTS idx_musicians_status ON musicians(status);
CREATE INDEX IF NOT EXISTS idx_musicians_ministry ON musicians(ministry);
CREATE INDEX IF NOT EXISTS idx_musicians_household ON musicians(household_id);

-- Positions Template (Ministry role templates)
CREATE TABLE IF NOT EXISTS positions_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    ministry VARCHAR(100) DEFAULT 'Worship Team',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_sort ON positions_template(sort_order);
CREATE INDEX IF NOT EXISTS idx_positions_ministry ON positions_template(ministry);

-- Songs Library (Planning Center Services Songs)
CREATE TABLE IF NOT EXISTS songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    default_key VARCHAR(10) DEFAULT 'C',
    bpm INT DEFAULT 72,
    time_signature VARCHAR(10) DEFAULT '4/4',
    ccli_number VARCHAR(50),
    lyrics_preview TEXT,
    chart_url TEXT,
    youtube_url TEXT,
    spotify_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_key ON songs(default_key);

-- Services table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_date DATE NOT NULL,
    service_time VARCHAR(50) DEFAULT '10:00 AM',
    service_type VARCHAR(100) DEFAULT 'Sunday Morning Celebration',
    campus_id UUID REFERENCES campuses(id) ON DELETE SET NULL,
    theme VARCHAR(255),
    token VARCHAR(64) NOT NULL UNIQUE,
    worship_leader_id UUID REFERENCES musicians(id) ON DELETE SET NULL,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'availability_open', 'rostered', 'confirmed', 'completed'
    deadline_hours_before INT NOT NULL DEFAULT 48,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_date ON services(service_date);
CREATE INDEX IF NOT EXISTS idx_services_token ON services(token);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);

-- Service Plan / Order of Service (Run Sheet items)
CREATE TABLE IF NOT EXISTS service_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    item_order INT NOT NULL DEFAULT 0,
    item_type VARCHAR(50) NOT NULL DEFAULT 'item', -- 'header', 'song', 'item', 'media', 'sermon', 'prayer', 'offering', 'announcement'
    title VARCHAR(255) NOT NULL,
    duration_minutes INT DEFAULT 5,
    leader VARCHAR(255),
    song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
    song_key VARCHAR(10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_items_service ON service_plan_items(service_id);
CREATE INDEX IF NOT EXISTS idx_plan_items_order ON service_plan_items(service_id, item_order);

-- Availability table (musician/volunteer responses per service)
CREATE TABLE IF NOT EXISTS availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    musician_id UUID NOT NULL REFERENCES musicians(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- 'available', 'declined', 'no_response'
    responded_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_musician_service UNIQUE (musician_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_availability_service ON availability(service_id);
CREATE INDEX IF NOT EXISTS idx_availability_musician ON availability(musician_id);

-- Assignments table (Lineup per service: primary/backup per position)
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES positions_template(id) ON DELETE CASCADE,
    musician_id UUID REFERENCES musicians(id) ON DELETE SET NULL,
    role_slot VARCHAR(20) NOT NULL, -- 'primary', 'backup'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'declined', 'promoted'
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    CONSTRAINT uq_service_position_slot UNIQUE (service_id, position_id, role_slot)
);

CREATE INDEX IF NOT EXISTS idx_assignments_service ON assignments(service_id);
CREATE INDEX IF NOT EXISTS idx_assignments_musician ON assignments(musician_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

-- Small Groups / Life Groups (Planning Center Groups)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) DEFAULT 'Life Group',
    leader_name VARCHAR(255),
    leader_id UUID REFERENCES musicians(id) ON DELETE SET NULL,
    meeting_day VARCHAR(50) DEFAULT 'Wednesday',
    meeting_time VARCHAR(50) DEFAULT '7:00 PM',
    location VARCHAR(255) DEFAULT 'Fellowship Hall Room 201',
    description TEXT,
    member_count INT DEFAULT 8,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_category ON groups(category);

-- Notifications log (Audit trail for auto-shuffles, backup promotions, decline-reshuffles, admin actions)
CREATE TABLE IF NOT EXISTS notifications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_service ON notifications_log(service_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications_log(created_at DESC);

-- Device Tokens for FCM Push Notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    musician_id UUID REFERENCES musicians(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    platform VARCHAR(50) DEFAULT 'android', -- 'android', 'ios', 'web'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_musician ON device_tokens(musician_id);
