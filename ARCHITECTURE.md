# ChurchFlow Architecture & Technical Specification

This document provides a comprehensive technical breakdown of the **ChurchFlow** software architecture.

---

## 1. High-Level System Architecture

ChurchFlow is structured as a monorepo containing three core tiers:
1. **Backend Service (`/backend`)**: Node.js 22 LTS / Express REST API, PostgreSQL 16 connection pool, Cron scheduler, and WebSocket/FCM services.
2. **Web Frontend (`/frontend`)**: React 18 SPA bundled with Vite and styled with Tailwind CSS, utilizing Lucide icons and clean responsive design.
3. **Mobile Application (`/mobile`)**: React Native 0.76+ with Expo 52, compiled for Android via native Gradle 8.8, supporting deep linking and push notifications.

```
                              ┌─────────────────────────────────────────┐
                              │            Client Layer                 │
                              │  - Web Admin (React 18 + Tailwind)      │
                              │  - Mobile App (React Native Expo 52)    │
                              │  - Public Volunteers (Mobile HTML Web)  │
                              └────────────────────┬────────────────────┘
                                                   │ HTTPS / REST / JSON
                                                   ▼
                              ┌─────────────────────────────────────────┐
                              │          Express REST API Gateway       │
                              │  - Auth Middleware (JWT & RBAC Guards)  │
                              │  - Rate Limiter & Helmet Security       │
                              │  - CORS & Static APK Distribution       │
                              └────────────────────┬────────────────────┘
                                                   │
                  ┌────────────────────────────────┼────────────────────────────────┐
                  ▼                                ▼                                ▼
       ┌─────────────────────┐          ┌─────────────────────┐          ┌─────────────────────┐
       │   Services Engine   │          │   Directory & Groups│          │ Background Monitors │
       │ - Order of Service  │          │ - People & Families │          │ - Fairness Cron     │
       │ - Auto-Scheduler    │          │ - Song Catalog      │          │ - Auto-Promotions   │
       │ - Roster Balancer   │          │ - Ministries/Campus │          │ - Push Notifications│
       └──────────┬──────────┘          └──────────┬──────────┘          └──────────┬──────────┘
                  │                                │                                │
                  └────────────────────────────────┼────────────────────────────────┘
                                                   │ Parameterized SQL Queries
                                                   ▼
                              ┌─────────────────────────────────────────┐
                              │          PostgreSQL 16 Database         │
                              │  - ACID Transactions & Cascading FKs    │
                              │  - GIN/B-Tree Indices on Tokens & Dates │
                              └─────────────────────────────────────────┘
```

---

## 2. Database Entity-Relationship Model

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
       │                                  musicians                                   │
       ├──────────────────────────────────────────────────────────────────────────────┤
       │ id (UUID, PK)                                                                │
       │ name                                                                         │
       │ email                                                                        │
       │ phone                                                                        │
       │ roles (VARCHAR[])                                                            │
       │ household_id (UUID, FK -> households)                                        │
       │ membership_status                                                            │
       └──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Fairness Auto-Rostering Algorithm

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

## 4. Mobile Zero-Login Flow

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
