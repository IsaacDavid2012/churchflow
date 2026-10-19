# Security Policy

## Supported Versions

ChurchFlow is continuously maintained. Security patches are deployed directly to the latest production release.

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :x:                |

---

## Reporting a Vulnerability

We take the security and privacy of church members and church administration seriously. If you discover a security vulnerability in ChurchFlow, please follow our responsible disclosure process:

1. **Do NOT report security issues via public GitHub issues, discussions, or social media.**
2. Send a detailed report directly to:
   - **Lead Developer**: `isaac@jesusmyrock.org`
   - **Church Administration**: `jesusmyrockchurch@gmail.com`
3. Please include in your report:
   - Detailed description of the potential vulnerability.
   - Exact steps or minimal proof-of-concept to reproduce the issue.
   - Affected components (backend API, web admin frontend, or mobile Android app).
   - Any potential impact on member data or administrative privileges.

We will acknowledge receipt within 48 hours and work with you to remediate and verify the fix before any public communication.

---

## Core Security Standards in ChurchFlow

- **Authentication**: Passwords are encrypted using salted `bcryptjs` hashing.
- **Session Tokens**: JWT access tokens have strict expiration policies accompanied by cryptographically secured refresh tokens.
- **SQL Injection Prevention**: All database interactions use parameterized PostgreSQL queries via `node-postgres` (`$1, $2, ...`) without raw SQL string concatenation.
- **Role-Based Access Control (RBAC)**: All protected endpoints enforce server-side role validation (`admin`, `pastor`, `leader`, `volunteer`).
- **Data Protection**: Zero-login availability confirmation links use cryptographically random UUID tokens that grant access solely to respond for that specific service slot.
- **Network Security**: Production deployment operates behind reverse proxies with TLS/SSL encryption and restrictive CORS policies.
