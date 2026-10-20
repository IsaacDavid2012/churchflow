# ChurchFlow Architecture & Technical Specification

This document provides a comprehensive technical breakdown of the **ChurchFlow** software architecture, data models, edge routing, and WhatsApp Community subsystems.

---

## 1. High-Level System Architecture

ChurchFlow is structured as an enterprise monorepo containing three core tiers with dedicated edge routing:
1. **Backend Service (`/backend`)**: Node.js 22 LTS / Express REST API, PostgreSQL 16 connection pool, Cron scheduler, and WebSocket/FCM services.
2. **Web Frontend (`/frontend`)**: React 18 SPA bundled with Vite and styled with Tailwind CSS, utilizing Lucide icons and clean responsive design.
3. **Mobile Application (`/mobile`)**: React Native 0.76+ with Expo 52, compiled for Android via native Gradle 8.8, supporting deep linking and push notifications.

### HTTP Routing & Ingress Map

```
                        ┌────────────────────────────────────────────────────────┐
                        │             HTTPS Ingress (Port 443 / 80)              │
                        │           serve.creativeclicks.art                     │
                        └──────────────────────────┬─────────────────────────────┘
                                                   │
                ┌──────────────────────────────────┼──────────────────────────────────┐
                ▼                                  ▼                                  ▼
     ┌──────────────────────┐           ┌──────────────────────┐           ┌──────────────────────┐
     │  Marketing Portal    │           │ React Admin SPA App  │           │ Volunteer Onboarding │
     │  GET / & /landing    │           │ GET /app & /services │           │ GET /join            │
     │  (Pure HTML/JS/CSS)  │           │ (React 18 Dashboard) │           │ (Self-Service Portal)│
     └──────────────────────┘           └──────────────────────┘           └──────────────────────┘
                │                                  │                                  │
                └──────────────────────────────────┼──────────────────────────────────┘
                                                   │
                ┌──────────────────────────────────┴──────────────────────────────────┐
                ▼                                                                     ▼
     ┌──────────────────────┐                                              ┌──────────────────────┐
     │ Zero-Login RSVP      │                                              │ Native Android APK   │
     │ GET /avail/:token    │                                              │ GET /churchflow.apk  │
     │ (1-Tap WhatsApp Conf)│                                              │ (Release Binary)     │
     └──────────────────────┘                                              └──────────────────────┘
                                                   │
                                                   ▼
                        ┌────────────────────────────────────────────────────────┐
                        │                Express REST API Gateway                │
                        │        /api/auth, /api/community, /api/services        │
                        │  - 4-Tier RBAC Guards (Admin, Pastor, Manager, Member) │
                        │  - Rate Limiter, Helmet Security & GZIP Compression    │
                        └──────────────────────────┬─────────────────────────────┘
                                                   │
                ┌──────────────────────────────────┼──────────────────────────────────┐
                ▼                                  ▼                                  ▼
     ┌──────────────────────┐           ┌──────────────────────┐           ┌──────────────────────┐
     │  WhatsApp Community  │           │   Services Engine    │           │ Background Monitors  │
     │ - General Broadcast  │           │ - Order of Service   │           │ - Fairness Cron      │
     │ - Fellowship Chat    │           │ - Auto-Scheduler     │           │ - Auto-Promotions    │
     │ - Ministry Hubs      │           │ - Roster Balancer    │           │ - Push Notifications │
     └──────────┬───────────┘           └──────────┬───────────┘           └──────────┬───────────┘
                │                                  │                                  │
                └──────────────────────────────────┼──────────────────────────────────┘
                                                   │ Parameterized SQL Queries
                                                   ▼
                        ┌────────────────────────────────────────────────────────┐
                        │                 PostgreSQL 16 Engine                   │
                        │  - Unified Users & People Directory (1:1 Relation)     │
                        │  - ACID Transactions, Cascades & Unique Constraints    │
                        │  - GIN/B-Tree Indices on Tokens, Campuses & Dates      │
                        └────────────────────────────────────────────────────────┘
```

---

## 2. WhatsApp Community & Ministry Hub Architecture

ChurchFlow organizes church communication using a 3-tier hierarchy that mirrors WhatsApp Communities:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Jesus My Rock Community                           │
├────────────────────────────────────────────────────────────────────────┤
│ 📢 General Announcements (Broadcast Channel)                           │
│    - Role: Pastors & Admins broadcast only                             │
│    - Pinned announcements, priority alerts, banner notices             │
├────────────────────────────────────────────────────────────────────────┤
│ 💬 Church-Wide Fellowship Chat                                         │
│    - Role: All verified members can participate                        │
│    - General discussion, testimonies, praise reports, prayer requests  │
├────────────────────────────────────────────────────────────────────────┤
│ 👥 Dedicated Ministry Hubs (Sub-Groups)                                │
│    ├── 🎸 Worship Team Hub        (Announcements + Private Team Chat)  │
│    ├── 🎛️ Tech & AV Production Hub (Announcements + Private Team Chat)  │
│    ├── 🤝 Ushers & Greeters Hub   (Announcements + Private Team Chat)  │
│    ├── 🧒 Kids Rock Ministry Hub   (Announcements + Private Team Chat)  │
│    └── 🙏 Intercession & Altar    (Announcements + Private Team Chat)  │
└────────────────────────────────────────────────────────────────────────┘
```

### Relational Schema for Community Channels:
- **`general_announcements`**: Broadcast messages posted by Admins or Pastors with category badges (`urgent`, `general`, `worship`, `event`).
- **`general_chat_messages`**: Open conversation messages with foreign key to `users(id)` and timestamp indexing.
- **`groups`**: Ministry hubs / small groups extended with `leader_id (UUID -> users)` and `category`.
- **`ministry_members`**: Join table binding `group_id` and `user_id` with department-level role (`leader`, `member`).
- **`ministry_announcements`**: Ministry-specific broadcast updates posted by Ministry Managers or Admins.
- **`ministry_chat_messages`**: Private, isolated team chat space for ministry members.

---

## 3. Unified User Account & People Directory

To prevent dual-profile fragmentation, ChurchFlow merges system authentication and volunteer rostering into a unified architecture:

```
        ┌────────────────────────────────┐
        │             users              │
        ├────────────────────────────────┤
        │ id (UUID, PK)                  │
        │ username (VARCHAR, UNIQUE)     │
        │ password_hash (BCRYPT)         │
        │ email (VARCHAR, UNIQUE)        │
        │ role ('admin'|'pastor'|'manag- │
        │        er'|'member')           │
        └───────────────┬────────────────┘
                        │
                        │ 1:1 Consolidated Link
                        │ (musicians.user_id = users.id)
                        ▼
        ┌────────────────────────────────┐
        │           musicians            │
        ├────────────────────────────────┤
        │ id (UUID, PK)                  │
        │ user_id (UUID, FK -> users)    │
        │ name (VARCHAR)                 │
        │ email (VARCHAR)                │
        │ phone (VARCHAR)                │
        │ positions (VARCHAR[])          │
        │ household_id (UUID -> househo- │
        │                lds)            │
        │ status ('active'|'pending'|    │
        │         'inactive')            │
        └────────────────────────────────┘
```

- When an administrator creates or edits a person in the People directory, both the `users` credentials and `musicians` roster profile are updated transactionally.
- When a volunteer onboards via `/join`, their account is automatically provisioned with a secure password and marked as `pending` for leadership approval.

---

## 4. Database Entity-Relationship Model

```
       ┌────────────────────────┐                    ┌────────────────────────┐
       │     church_profile     │                    │        campuses        │
       ├────────────────────────┤                    ├────────────────────────┤
       │ id (UUID, PK)          │                    │ id (UUID, PK)          │
       │ name                   │◄───────┐           │ name                   │
       │ primary_color          │        │           │ address                │
       └────────────────────────┘        │           │ is_main (BOOLEAN)      │
                                         │           └───────────┬────────────┘
       ┌────────────────────────┐        │                       │
       │       ministries       │        │                       │ 1:N
       ├────────────────────────┤        │                       │
       │ id (UUID, PK)          │        │                       ▼
       │ name                   │        │           ┌────────────────────────┐
       │ description            │        │           │        services        │
       │ color                  │        │           ├────────────────────────┤
       └───────────┬────────────┘        │           │ id (UUID, PK)          │
                   │                     │           │ service_date (DATE)    │
                   │ 1:N                 │           │ service_time           │
                   ▼                     │           │ service_type           │
       ┌────────────────────────┐        │           │ campus_id (FK, SETNULL)│
       │   positions_template   │        │           │ theme                  │
       ├────────────────────────┤        │           │ token (UUID, UNIQUE)   │
       │ id (UUID, PK)          │        │           │ notes                  │
       │ ministry_id (FK)       │        │           │ status                 │
       │ name                   │        │           │ position_ids (UUID[])  │
       │ default_quantity       │        │           └───────────┬────────────┘
       └───────────┬────────────┘        │                       │
                   │                     │           ┌───────────┴───────────┐
                   │                     │           │ 1:N CASCADE           │ 1:N CASCADE
                   │                     │           ▼                       ▼
                   │                     │ ┌──────────────────┐    ┌──────────────────┐
                   │                     │ │service_plan_items│    │   assignments    │
                   │                     │ ├──────────────────┤    ├──────────────────┤
                   │                     │ │ id (PK)          │    │ id (PK)          │
                   │                     │ │ service_id (FK)  │    │ service_id (FK)  │
                   │                     │ │ item_order       │    │ position_id (FK) │
                   │                     │ │ item_type        │    │ musician_id (FK) │
                   │                     │ │ title            │    │ role_slot        │
                   │                     │ │ duration_minutes │    │ status           │
                   │                     │ └──────────────────┘    └─────────┬────────┘
                   │                                                         │
                   │                                                         │
                   ▼                                                         ▼
       ┌──────────────────────────────────────────────────────────────────────────────┐
       │                             musicians / unified users                        │
       ├──────────────────────────────────────────────────────────────────────────────┤
       │ id (UUID, PK)                                                                │
       │ user_id (UUID, FK -> users)                                                  │
       │ name                                                                         │
       │ email                                                                        │
       │ phone                                                                        │
       │ positions (VARCHAR[])                                                        │
       │ household_id (UUID, FK -> households)                                        │
       │ membership_status                                                            │
       └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Dynamic Position Management

ChurchFlow provides customizable position tagging across all church departments:
- **Default Position Templates**: Lead Vocals, Acoustic Guitar, Electric Guitar, Bass, Drums, Keys / Piano, Audio Engineer, Lighting Designer, ProPresenter, Camera Operator, Head Usher, Greeter, Kids Leader.
- **Custom Additions**: Administrators can dynamically register new position titles and assign multi-position capabilities to volunteers.
- **Roster Alignment**: Service lineup pickers dynamically populate candidates whose skill tags match the service position slot.

---

## 6. Self-Service Volunteer Onboarding (`/join`)

The `/join` portal provides frictionless volunteer onboarding:

```
[New Volunteer Opens /join]
           │
           ▼
[Fills Form: Name, Phone, Email, Password, Ministry & Skill Interests]
           │
           ▼
[POST /api/public/join]
           │
           ├───────────────────────────────┐
           ▼                               ▼
[Creates record in `users`]      [Creates record in `musicians`]
(role: 'member', hashed pwd)     (status: 'pending', user_id linked)
           │                               │
           └───────────────┬───────────────┘
                           ▼
             [Admin Notified in People Hub]
                           │
                           ▼
          [Admin Approves & Assigns Positions]
```

---

## 7. Role-Based Access Control (4-Tier RBAC)

Access permissions are enforced strictly at the Express route middleware layer (`middleware/auth.js`) and reflected in the React navigation model:

| Role | Access Scope & Capabilities |
| :--- | :--- |
| **`admin`** | Full system control. Manages campuses, ministries, positions, services, users, fairness rules, backups, and database seed/migration operations. |
| **`pastor`** | Pastoral leadership. Church-wide general announcements broadcasting, full service run sheet viewing, sermon notes, member care, and discipleship tracking. |
| **`manager`** | Ministry leadership (e.g. Worship Leader). Department hub administration, ministry team announcements and chat, volunteer roster assignments, and backup candidate swaps. |
| **`member`** | Congregation member & serving volunteer. Servicing calendar, 1-tap WhatsApp RSVP confirmations, church-wide fellowship chat, and department team chats. |

---

## 8. Fairness Auto-Rostering Algorithm

The core scheduling engine (`/backend/src/services/shuffleService.js`) calculates a dynamic fairness ranking for each eligible volunteer:

1. **Eligibility Filter**: Matches volunteer skill tags and ministry qualifications with position requirements (`matchesRole`).
2. **Frequency Weighting**: Computes the days elapsed since the volunteer last served. Volunteers who have not served recently receive higher priority.
3. **Consecutive Service Suppression**: Volunteers scheduled for the immediate preceding service receive a score penalty to prevent back-to-back burnout.
4. **Availability Filtering**: Incorporates explicit responses submitted via zero-login tokens (filtering out `declined` responses).
5. **Two-Tier Assignment**:
   - Primary Slot: Assigned to the highest-ranking candidate.
   - Backup Slot: Assigned to the second highest-ranking candidate.
6. **Auto-Promotion Daemon**: If the primary candidate declines or fails to respond before the configurable deadline (e.g., 48 hours prior to service), the background daemon automatically promotes the backup and dispatches notification alerts.

---

## 9. Mobile Zero-Login Flow

```
[Service Scheduled]
        │
        ▼
[Unique Crypto Token Generated] (e.g., /avail/d48e7b...)
        │
        ├─────────────────────────────┐
        ▼                             ▼
[WhatsApp Broadcast Link]      [Push Notification (FCM)]
        │                             │
        └──────────────┬──────────────┘
                       ▼
            [Mobile Volunteer Opens]
        (No password/account required)
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
      [Tap "Accept"]      [Tap "Decline"]
             │                   │
             ▼                   ▼
    [Status: Confirmed]   [Status: Declined]
                                 │
                                 ▼
                     [Backup Auto-Promoted]
```
