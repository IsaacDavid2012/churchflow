# Changelog

All notable changes to the **ChurchFlow** platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
