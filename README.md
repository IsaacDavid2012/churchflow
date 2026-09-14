# 🏛️ ServeSync — Planning Center Suite for Jesus My Rock Church

**ServeSync** is a self-hosted **Planning Center alternative** built for **Jesus My Rock Church** (*"Standing Firm on Christ the Solid Rock"*). It provides complete worship planning, run sheets, team scheduling, fairness auto-rostering, member directories, small groups, song libraries, web admin, and mobile app support with zero per-user fees and CPU-only deployment on Ubuntu via Docker Compose behind Cloudflare Tunnel.

---

## 🚀 Key Modules & Feature Set

```
                        ┌───────────────────────────────┐
                        │     Jesus My Rock Church      │
                        │    Church Settings & Profile  │
                        └───────────────┬───────────────┘
                                        │
     ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
     ▼                  ▼               ▼               ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌───────────┐ ┌───────────────┐ ┌──────────────┐
│   Services   │ │    People    │ │   Songs   │ │    Groups     │ │  Positions   │
│ (Run Sheets, │ │ (Directory,  │ │ (Keys,    │ │ (Life Groups, │ │ (Multi-Team  │
│  Auto-Roster)│ │  Families)   │ │  BPM, CCLI│ │  Discipleship)│ │  Templates) │
└──────────────┘ └──────────────┘ └───────────┘ └───────────────┘ └──────────────┘
```

### 1. 🏛️ Church & Campus Management
- **Organization Profile**: Church branding, lead pastor details, contact information, and primary theme colors.
- **Multi-Campus Support**: Manage multiple campuses (*Main Sanctuary Downtown*, *North Campus*, *Online Broadcast Campus*).
- **Ministry Departments**: *Worship Team*, *Production & Tech*, *Ushers & Greeters*, *Kids Rock Ministry*, *Prayer & Altar Team*, and *Hospitality*.

### 2. 👥 People & Directory (Planning Center People)
- **Comprehensive Profiles**: Contact info, membership status (*Staff, Leader, Member, Volunteer, Regular, Visitor*), and ministry tags.
- **Family & Household Units**: Link families together (*The Mitchell Family*, *The Doe Family*, *The Rivera Family*) with head, spouse, and child relationships.
- **Volunteer History Tracking**: Automatically computes total confirmed services and tracks calendar date since last served.

### 3. 📅 Services & Fairness Auto-Rostering (Planning Center Services)
- **Order of Service / Run Sheet**: Minute-by-minute timeline planner with item types (*Worship Song, Sermon, Media/Video, Pastoral Prayer, Offering, Announcements*).
- **Auto-Calculated Timings**: Computes starting times for every element from opening countdown to benediction.
- **Fairness Auto-Rostering Engine**: Auto-drafts primary and backup volunteers based on who has gone the longest without serving.
- **Zero-Login Group Availability**: Generates secure signed links to drop into WhatsApp / Telegram for 1-tap mobile confirmation without login.
- **Backup Auto-Promotion**: Automatically promotes the backup if the primary declines or misses the confirmation deadline.
- **Background Cron Monitor**: Scheduled job checking deadlines and promoting backups automatically.

### 4. 🎵 Song & Music Library (Planning Center Songs)
- **Song Catalog**: Title, Artist, Default Musical Key, BPM, Time Signature, CCLI Number, and Lyrics preview.
- **Resource Linking**: Direct links to PraiseCharts chord charts and YouTube / Spotify audio tracks.
- **Service Plan Integration**: Attach songs directly into Order of Service with custom arrangement keys.

### 5. 🤝 Small Groups & Discipleship (Planning Center Groups)
- **Life Groups Directory**: Meeting day, time, location, leader, group category (*Men's, Women's, Young Adults, Couples*), and active headcount.

### 6. 📱 React Native Mobile App (`/mobile`)
- **Full Admin & Volunteer Parity**: React Native / Expo app supporting service management, lineup review, run sheets, people directory, and song library.
- **Push Notifications**: Firebase Cloud Messaging (FCM) integration for roster assignments, deadline reminders, and promotions.
- **Deep Linking**: Handles `servesync://avail/<token>` and `https://servesync.creativeclicks.art/avail/<token>` links directly.

---

## 🏗️ Monorepo Architecture

```
servesync/
├── backend/
│   ├── src/
│   │   ├── config/db.js               # PostgreSQL connection pool
│   │   ├── db/schema.sql              # Planning Center schema
│   │   ├── db/migrate.js              # Automated migration runner
│   │   ├── db/seed.js                 # Jesus My Rock Church seed script
│   │   ├── middleware/auth.js         # JWT & RBAC role guards
│   │   ├── services/
│   │   │   ├── shuffleService.js      # Fairness & Auto-Promotion Engine
│   │   │   ├── cronService.js         # Deadline background monitor
│   │   │   └── fcmService.js          # Firebase Cloud Messaging push
│   │   ├── routes/
│   │   │   ├── auth.js                # Auth, registration, & user management
│   │   │   ├── church.js              # Church profile, campuses, & ministries
│   │   │   ├── musicians.js           # People directory & household families
│   │   │   ├── positions.js           # Ministry position templates
│   │   │   ├── services.js            # Service plans & Order of Service items
│   │   │   ├── songs.js               # Song library
│   │   │   ├── groups.js              # Small groups / Life groups
│   │   │   ├── notifications.js       # Audit trail & device token registration
│   │   │   └── public.js              # Zero-login mobile availability API
│   │   └── server.js                  # Express app & static server
│   ├── public/
│   │   └── avail.html                 # Mobile web view for zero-login responses
│   └── tests/
│       └── shuffleService.test.js     # Comprehensive unit & concurrency test suite
├── frontend/                          # React 18 + Tailwind CSS + Lucide
│   ├── src/
│   │   ├── components/                # ChurchProfile, PeopleManager, SongLibrary, OrderOfService, Groups
│   │   ├── api.js                     # Unified REST API client
│   │   └── App.jsx                    # Planning Center workspace layout
│   └── dist/                          # Production build
├── mobile/                            # React Native / Expo app with full admin parity
│   ├── src/
│   │   ├── api/client.js              # Mobile API client with auto-refresh
│   │   ├── services/fcm.js            # FCM / Expo push notifications
│   │   └── screens/                   # Login, Services, Lineup, PublicConfirm
│   ├── app.json                       # Deep link intent filters & package config
│   └── App.js                         # Root mobile entry
├── shared/                            # Shared types, role enums, & constants
├── Dockerfile                         # Multi-stage container build
├── docker-compose.yml                 # PostgreSQL + App container orchestration
└── README.md
```

---

## 🔒 RBAC Permission Matrix

| Role | Permissions |
| :--- | :--- |
| **Admin** | Full system access: manage users, church profile, campuses, ministries, all services, people, songs, groups |
| **Pastor** | Full ministry oversight: manage all services, lineups, run sheets, people directory, songs, groups |
| **Leader** | Department management: manage department lineup, people in assigned ministry, small groups |
| **Volunteer** | View services, check assigned slots, confirm/decline via 1-tap links |

---

## 📦 Quick Start & Deployment

### 1. Run Automated Test Suite
```bash
cd /jarvis/code/servesync
npm test
```

### 2. Build & Launch Containers
```bash
docker-compose up -d --build
```

### 3. Seed Jesus My Rock Church Dataset
```bash
docker-compose exec app node backend/src/db/seed.js
```

### 4. Access Points
- **Web Admin**: `http://localhost:3030` (or `https://servesync.creativeclicks.art`)
  - Admin: `admin` / `admin123`
  - Pastor: `pastor` / `pastor123`
- **Zero-Login Musician Link**: `http://localhost:3030/avail/<token>`
- **Health Check**: `http://localhost:3030/health`
