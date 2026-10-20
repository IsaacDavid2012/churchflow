# Changelog

All notable changes to the **ChurchFlow** platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-10-20

### Added
- **WhatsApp Community Architecture**:
  - **General Announcements Broadcast**: Church-wide broadcast channel where Pastors and Admins post urgent notices, category-tagged updates (`urgent`, `general`, `worship`, `event`), and pinned announcements with author badges.
  - **Church-Wide Fellowship Chat**: Real-time open chat space for all verified church members for fellowship, prayer requests, and testimonies.
  - **Dedicated Ministry Hubs (Sub-Groups)**: Isolated department channels for Worship Team, Tech & AV Production, Ushers & Greeters, Kids Rock, and Intercession. Each hub includes department announcements and private team chat so leaders can coordinate rehearsals and run-sheets without cluttering the main congregation.
- **Unified User & People Directory**:
  - Seamless 1:1 integration between `users` authentication accounts and `musicians` serving profiles (`musicians.user_id = users.id`).
  - Consolidates credentials and ministry serving capabilities into a single source of truth.
  - Single consolidated Isaac super-admin account (`Isaac` / `IDC-201Two`).
- **Strict 4-Tier Role-Based Access Control (RBAC)**:
  - Standardized roles: **Admin** (master operations & organization settings), **Pastor** (announcements broadcast, run sheets, sermons & discipleship), **Manager** (department leadership, team chat, roster management), and **Member** (self-schedule, WhatsApp RSVP, fellowship chat).
  - Enforced route-level guards across all REST endpoints in `backend/src/middleware/auth.js`.
- **Dynamic Custom Position System**:
  - Dynamic registration, editing, and assignment of custom ministry positions with multi-skill tagging.
  - Dynamic position selection dropdowns in volunteer management and roster builders.
- **Self-Service Volunteer Onboarding (`/join`)**:
  - Public mobile-optimized `/join` portal allowing prospective volunteers to register, set passwords, and declare ministry interests.
  - Automated dual provisioning of `users` credentials and `musicians` directory entry with `pending` status for leadership approval.
- **Marketing Landing Page Modernization (`landing.html`)**:
  - Root `GET /` cleanly serves the marketing page while `GET /app` launches the React admin dashboard.
  - Integrated WhatsApp Community showcase, 4 metric counters, expanded 9-feature capability grid, and direct Android APK download section.
  - Maintained JMR warm gold (`#c59c6c`) branding and interactive live service lineup preview.

### Changed
- **Express Route Handling**: Configured `express.static` with `{ index: false }` to prevent static index files from preempting root route handlers.
- **Database Schema Upgrades**: Migrated schema with `general_announcements`, `general_chat_messages`, `groups` (`leader_id`), `ministry_members`, `ministry_announcements`, and `ministry_chat_messages`.

---

## [1.1.0] - 2026-10-19

### Added
- **Mobile Service Management**:
  - Direct quick-action Edit button (✏️) on all service cards in `ServicesScreen`.
  - Direct quick-action Delete button (🗑️) on all service cards with confirmation guard dialogs (`Alert.alert`).
  - Interactive "Edit Service Details" modal in both `ServicesScreen` and `ServiceDetailScreen` supporting date, time, service type, campus, status (*Draft*, *Published*, *Confirmed*), sermon theme, and notes.
  - Cascade service deletion from within `ServiceDetailScreen` with automatic return navigation.
  - `updateService(id, payload)` method in mobile `ApiClient` (`PUT /services/:id`).
- **Jesus My Rock Branding & Color Theme**:
  - Official JMR Warm Gold (`#c59c6c`) and Clean White theme applied across Web UI, Mobile UI, Tailwind CSS configuration, and database defaults.
  - Integrated high-resolution `jmrlogo.png` logo into web navbar, login modals, PWA manifest, and favicons.
  - Generated native Android launcher icons (`mipmap-*` hdpi, mdpi, xhdpi, xxhdpi, xxxhdpi) and splash screens.
- **Production Android Release Compilation**:
  - Compiled release APK (`churchflow.apk`, ~65MB) using Gradle 8.8 and OpenJDK 21.
  - Exposed direct download endpoint at `https://serve.creativeclicks.art/churchflow.apk` with caching headers.
- **Documentation & Legal**:
  - Added proprietary closed-source `LICENSE` agreement.
  - Added comprehensive `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, and `SECURITY.md`.

### Fixed
- **Campus ID Preservation**: Added `COALESCE` for `campus_id` in `PUT /api/services/:id` so editing theme or notes without explicitly resending campus ID preserves the existing campus assignment.
- **Cascading Foreign Keys**: Ensured clean database cascade deletion across `service_plan_items`, `assignments`, and `availability` upon service removal.

---

## [1.0.0] - 2026-10-01

### Added
- **Core Platform Initial Release**:
  - Planning Center alternative tailored for Jesus My Rock Church (*"Standing Firm on Christ the Solid Rock"*).
  - Multi-campus management (*Main Sanctuary*, *North Campus*, *Online Broadcast*).
  - Ministry departments (*Worship Team*, *Production & Tech*, *Ushers & Greeters*, *Kids Rock*, *Prayer & Altar*).
  - Order of Service run sheet planner with dynamic minute-by-minute auto-timing calculations.
  - Fairness auto-scheduling algorithm prioritizing volunteers who have gone longest without serving.
  - 1-tap WhatsApp availability confirmation token links (`/avail/:token`) requiring zero volunteer login.
  - Automatic backup promotion background cron job.
  - Member directory with household family linking and past service history tracking.
  - Music & Song library with musical keys, BPM, time signature, CCLI number, and chord chart links.
  - Small groups & discipleship tracking.
  - Multi-stage Docker build with automated PostgreSQL migrations and seed scripts.
