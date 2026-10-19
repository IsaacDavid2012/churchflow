<p align="center">
  <img src="jmrlogo.png" alt="Jesus My Rock ChurchFlow Logo" width="140" />
</p>

<h1 align="center">ChurchFlow</h1>

<p align="center">
  <strong>Comprehensive Worship & Ministry Operations Platform</strong><br>
  <em>Built exclusively for Jesus My Rock Church — "Standing Firm on Christ the Solid Rock"</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-Proprietary-c59c6c.svg" alt="Proprietary License" />
  <img src="https://img.shields.io/badge/Node.js-22%20LTS-22c55e.svg" alt="Node Version" />
  <img src="https://img.shields.io/badge/React-18%20Vite-3b82f6.svg" alt="React 18" />
  <img src="https://img.shields.io/badge/React%20Native-Expo%2052-0f172a.svg" alt="React Native Expo" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791.svg" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/Theme-JMR%20Gold%20%23c59c6c-c59c6c.svg" alt="JMR Gold Theme" />
</p>

---

> [!CAUTION]
> **PROPRIETARY SOFTWARE — NOT OPEN SOURCE**
> This repository and all accompanying code, documentation, and assets are private and proprietary property of **Isaac David** and **Jesus My Rock Church**. Unauthorized copying, distribution, decompilation, modification, or public hosting is strictly prohibited. See [LICENSE](LICENSE) for full legal terms.

---

## 🌟 Executive Overview

**ChurchFlow** is an enterprise-grade, self-hosted ministry scheduling and worship management suite engineered as a full Planning Center alternative for Jesus My Rock Church. It orchestrates:

- **Order of Service Run Sheets**: Minute-by-minute order of service timeline planner with dynamic time calculations.
- **Fairness Auto-Rostering Engine**: Proprietary auto-scheduling algorithm that balances volunteer serving frequencies and prevents burnout.
- **1-Tap WhatsApp Availability Confirmation**: Zero-login secure token links for mobile volunteers to accept or decline with a single tap.
- **Cascading Service Management**: Full create, edit, and cascade deletion of services with automated cleanup across web and mobile.
- **People & Family Directory**: Member profiles, household grouping, attendance tracking, and serving history.
- **Music & Song Library**: Worship song catalog with keys, BPM, time signature, CCLI numbers, and chord chart integrations.
- **Small Groups & Discipleship**: Life group tracking, leadership assignments, and meeting schedules.
- **Native Android Mobile App**: Production React Native / Expo app compiled into an installable Android APK with push notifications and WhatsApp integration.

---

## 🏛️ System Architecture

```
                                  ┌───────────────────────────────┐
                                  │     Jesus My Rock Church      │
                                  │     ChurchFlow Organization   │
                                  └───────────────┬───────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
       ┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
       │   Services &     │             │     People &     │             │   Music Library  │
       │   Run Sheets     │             │    Households    │             │   & Song Sheets  │
       │ (Auto-Roster)    │             │   (Directory)    │             │ (CCLI, Keys, BPM)│
       └─────────┬────────┘             └─────────┬────────┘             └─────────┬────────┘
                 │                                │                                │
                 └────────────────────────────────┼────────────────────────────────┘
                                                  │
                                                  ▼
                                 ┌─────────────────────────────────┐
                                 │       PostgreSQL 16 Engine      │
                                 │  (ACID, Cascades, Transactions) │
                                 └────────────────┬────────────────┘
                                                  │
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
    ┌───────────────────────────┐                                     ┌───────────────────────────┐
    │   Web Administration      │                                     │   Android Native App      │
    │   React 18 + Tailwind CSS │                                     │   React Native Expo 52    │
    │   (White & JMR Gold Theme)│                                     │   (ChurchFlow Release APK)│
    └───────────────────────────┘                                     └───────────────────────────┘
```

---

## 📱 Mobile App (ChurchFlow Android)

The ChurchFlow mobile application provides complete admin and volunteer parity on smartphones:

- **Full Service Management**: Schedule new services, edit date, time, service type, theme, notes, and campus.
- **Safe Cascade Deletion**: Delete services directly from the list or detail view with confirmation dialogs and automated cascading of assignments.
- **Team Lineups**: View roster status (confirmed, pending, declined) with custom position icons.
- **Auto-Roster & Team Lead**: Run fair rotations directly from your phone.
- **Run Sheet Viewer**: Minute-by-minute timeline flow for musicians and AV production.
- **Direct WhatsApp Roster Sharing**: One-tap formatted WhatsApp message generation for confirmed lineups.
- **Installable APK**: Ready-to-install production APK available at `https://serve.creativeclicks.art/churchflow.apk`.

---

## 🎨 Branding & Palette

ChurchFlow adopts the official Jesus My Rock Church warm gold branding:

| Color Token | Hex Code | Purpose |
| :--- | :--- | :--- |
| **JMR Gold (Primary)** | `#c59c6c` | Headers, primary buttons, accents, highlights |
| **JMR Gold Light** | `#f5ede1` | Badge backgrounds, active tab pills, calendar badges |
| **JMR Gold Border** | `#eadbc4` | Card outlines, input borders, dividers |
| **Warm Canvas** | `#fbf8f3` | Subtle input surfaces, modal backings |
| **Pure White** | `#ffffff` | Screen background, elevated cards |
| **Slate Dark** | `#0f172a` | Primary typography, high contrast titles |
| **Subtext Slate** | `#64748b` | Timestamps, subtitles, secondary metadata |
| **Destructive Red** | `#ef4444` | Delete service, decline warnings |
| **Success Emerald** | `#15803d` | Confirmed assignments, completed rosters |

---

## 📂 Repository Structure

```
churchflow/
├── backend/
│   ├── src/
│   │   ├── config/db.js               # PostgreSQL connection pool with SSL/retries
│   │   ├── db/
│   │   │   ├── schema.sql             # Relational schema (services, assignments, people)
│   │   │   ├── migrate.js             # Idempotent migration runner
│   │   │   └── seed.js                # Jesus My Rock initial dataset seeder
│   │   ├── middleware/auth.js         # JWT token generator, verification & RBAC guards
│   │   ├── routes/
│   │   │   ├── auth.js                # Admin/volunteer authentication & tokens
│   │   │   ├── church.js              # Church profile, campuses, & ministries
│   │   │   ├── musicians.js           # Directory of volunteers & household relations
│   │   │   ├── positions.js           # Position templates (Lead Vocals, Keys, Audio, etc.)
│   │   │   ├── services.js            # Service CRUD, PUT updates, DELETE cascade, lineup
│   │   │   ├── songs.js               # Song library catalog with CCLI & chord links
│   │   │   ├── groups.js              # Small group discipleship tracking
│   │   │   ├── notifications.js       # Audit logs & device FCM tokens
│   │   │   └── public.js              # Zero-login token availability responder
│   │   ├── services/
│   │   │   ├── shuffleService.js      # Fairness algorithm & backup auto-promotions
│   │   │   ├── cronService.js         # Scheduled deadline monitoring background daemon
│   │   │   └── fcmService.js          # Firebase Cloud Messaging push service
│   │   └── server.js                  # Main Express application & static file server
│   ├── public/                        # Static landing, about, and APK download files
│   └── tests/                         # Backend test suite
├── frontend/                          # Web Admin Single Page App (React 18 + Vite)
│   ├── src/
│   │   ├── components/                # ServiceList, ServiceDetail, People, Songs, Groups
│   │   ├── api.js                     # Unified web API client
│   │   └── App.jsx                    # Root tabbed workspace
│   └── tailwind.config.js             # Tailwind CSS configured with JMR Gold colors
├── mobile/                            # React Native / Expo Native Mobile Project
│   ├── src/
│   │   ├── api/client.js              # Mobile API client (updateService, deleteService)
│   │   ├── screens/                   # ServicesScreen, ServiceDetailScreen, People, Songs
│   │   └── services/fcm.js            # FCM push notification handler
│   ├── android/                       # Gradle project for native Android compilation
│   ├── assets/                        # JMR icons, adaptive launcher, splash screens
│   └── app.json                       # Deep link schemes, package name, icon configuration
├── shared/                            # Shared role definitions & constants
├── Dockerfile                         # Production multi-stage Docker build
├── docker-compose.yml                 # PostgreSQL + Web/API container stack
├── LICENSE                            # Proprietary Software License Agreement
├── CONTRIBUTING.md                    # Internal contributor guidelines
├── SECURITY.md                        # Security & vulnerability reporting policy
├── CHANGELOG.md                       # Release notes and version history
└── ARCHITECTURE.md                    # Deep-dive architecture and database design
```

---

## 🛠️ Quick Start & Setup

### Prerequisites

- **Node.js**: v20 or v22 LTS
- **Docker & Docker Compose**: v2.20+
- **PostgreSQL**: v15 or v16 (if running locally without Docker)
- **Java**: OpenJDK 17 or 21 (for building Android APK)
- **Android SDK**: Build-tools 35.0.0+ (for native compilation)

### 1. Environment Configuration

Copy the example environment file:

```bash
cp backend/.env.example backend/.env
```

Ensure the following variables are configured:

```env
PORT=3030
NODE_ENV=production
DB_HOST=db
DB_PORT=5432
DB_USER=servesync
DB_PASSWORD=your_secure_password
DB_NAME=servesync
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
ADMIN_USERNAME=Isaac
ADMIN_PASSWORD=your_admin_password
ADMIN_EMAIL=isaac@jesusmyrock.org
```

### 2. Docker Deployment

Launch the PostgreSQL database and application container:

```bash
docker compose up -d --build
```

Run database migrations:

```bash
docker compose exec app node backend/src/db/migrate.js
```

Seed the initial Jesus My Rock Church dataset:

```bash
docker compose exec app node backend/src/db/seed.js
```

### 3. Local Development

**Backend API:**
```bash
cd backend
npm install
npm run dev
```

**Frontend Web App:**
```bash
cd frontend
npm install
npm run dev
```

**Mobile Android App:**
```bash
cd mobile
npm install
npx expo start
```

To compile the release APK:
```bash
cd mobile/android
./gradlew assembleRelease --no-daemon
```
The compiled binary will be generated at:
`mobile/android/app/build/outputs/apk/release/app-release.apk`

---

## 🔐 Role-Based Access Control (RBAC)

| Role | Permissions |
| :--- | :--- |
| **Admin** | Full system administration, user provisioning, church settings, campus editing, full service lifecycle, people directory, and song libraries. |
| **Pastor** | Pastoral oversight, all services, run sheets, sermons, people profiles, discipleship groups. |
| **Leader** | Team management, roster assignment, candidate swapping, department members. |
| **Volunteer** | View assigned services, accept/decline invites via 1-tap WhatsApp token link. |

---

## 🛡️ Proprietary Notice

Copyright &copy; 2026 **Isaac David** & **Jesus My Rock Church**. All Rights Reserved.  
This software is strictly private and proprietary. No part of this software may be reproduced, distributed, transmitted, or displayed in any form without express prior written permission.
