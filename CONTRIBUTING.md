# Contributing to ChurchFlow

> [!IMPORTANT]
> **PROPRIETARY & CONFIDENTIAL NOTICE**
> ChurchFlow is a proprietary software platform developed and maintained exclusively for **Jesus My Rock Church**. It is **not** an open-source project. Public pull requests or external contributions without explicit authorization from the church leadership and repository owner will be rejected.

---

## 👥 Internal Development Team Guidelines

These guidelines apply to authorized software engineers, administrators, and ministry technical volunteers working on ChurchFlow.

### 1. Confidentiality & Data Privacy
- **No Member PII in Code or Commits**: Never commit actual church member phone numbers, email addresses, personal identification, or financial details into git history.
- **Environment Secrets**: Never commit `.env` files, JWT secrets, Firebase credentials, or production database credentials. Use `.env.example` templates with sanitized placeholders.

### 2. Git Workflow & Branches
We follow a structured trunk-based workflow:
- `main`: Production-ready branch deployed to the live server.
- Feature branches should branch off `main` using standard naming conventions:
  - `feat/feature-name` (e.g., `feat/mobile-service-delete`)
  - `fix/bug-description` (e.g., `fix/campus-coalesce-update`)
  - `chore/task-name` (e.g., `chore/bump-gradle-dependencies`)

### 3. Commit Message Standards
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat(scope): brief summary`
- `fix(scope): brief summary`
- `docs(scope): documentation updates`
- `style(scope): formatting, styling, color palette changes`
- `refactor(scope): code improvements without behavior change`
- `test(scope): addition or modification of tests`

### 4. Code Standards & Quality Checks
Before submitting changes for merge:
- **Linting & Syntax**: Ensure JavaScript and React components pass syntax validation (`node -c` and Babel transpilation).
- **UI & Branding**: Maintain consistency with the official **JMR Warm Gold** (`#c59c6c`) and **White** color palette.
- **Confirmation Guards**: Destructive actions (such as deleting services, members, or small groups) must always require confirmation dialogs (`Alert.alert` on mobile, modal/dialog on web).
- **Database Migrations**: Database schema modifications must be recorded in idempotent migration scripts in `backend/src/db/` with appropriate foreign key cascade definitions.

### 5. Mobile App Verification
When modifying files in `/mobile`:
1. Test across light and dark modes to guarantee contrast accessibility.
2. Verify deep linking and navigation stacks (`onBack` handling).
3. Validate that release builds compile cleanly via:
   ```bash
   cd mobile/android
   ./gradlew assembleRelease --no-daemon
   ```

---

## 📩 Contact & Inquiries

For authorized access or development questions:
- **Lead Administrator**: Isaac David (`isaac@jesusmyrock.org`)
- **Church Organization**: Jesus My Rock Church (`jesusmyrockchurch@gmail.com`)
