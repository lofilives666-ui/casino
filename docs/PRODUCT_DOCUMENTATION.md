# Casino Web Product Documentation

## 1. Product Summary

`casino-web` is a Next.js App Router application for an online casino-style experience with:

- account creation and login
- signed session management
- wallet transactions (deposit/withdraw workflow)
- email verification
- KYC submission and review flow
- admin review panels for KYC and payments
- game backend integration with a provably fair Thunder Plinko game

This document is the operational and architectural reference for future maintenance.

## 2. Core User Roles

- Guest user
- Registered player
- Verified player
- Admin reviewer (API key protected admin endpoints)

Role intent:

- `Agent`: first-line support operations role; handles player tickets, initial triage, and escalations.
- `Sub-admin`: supervisory role; handles sensitive approvals/escalations across payments, KYC, and support.

## 2.1 Quick Links (App Routes)

Assume local base URL: `http://localhost:3000`

User-facing pages:

- Home/Lobby: `http://localhost:3000/`
- Signup: `http://localhost:3000/signup`
- Login: `http://localhost:3000/login`
- Account: `http://localhost:3000/account`
- Wallet: `http://localhost:3000/wallet`
- KYC: `http://localhost:3000/kyc`
- Thunder Plinko: `http://localhost:3000/games/thunder-plinko`

Admin pages:

- Admin Dashboard: `http://localhost:3000/admin`
- Admin KYC Review: `http://localhost:3000/admin/kyc`
- Admin Payments Review: `http://localhost:3000/admin/payments`
- Admin Tickets: `http://localhost:3000/admin/tickets`
- Admin Users: `http://localhost:3000/admin/users`
- Admin Agents: `http://localhost:3000/admin/agents`
- Admin Sub-admin: `http://localhost:3000/admin/sub-admin`
- Admin Settings: `http://localhost:3000/admin/settings`
- Admin Reports: `http://localhost:3000/admin/reports`
- Admin CMS Pages: `http://localhost:3000/admin/cms-pages`

Admin URL quick copy:

- `http://localhost:3000/admin`
- `http://localhost:3000/admin/kyc`
- `http://localhost:3000/admin/payments`
- `http://localhost:3000/admin/tickets`
- `http://localhost:3000/admin/users`
- `http://localhost:3000/admin/agents`
- `http://localhost:3000/admin/sub-admin`
- `http://localhost:3000/admin/settings`
- `http://localhost:3000/admin/reports`
- `http://localhost:3000/admin/cms-pages`

Important note:

- There is currently no separate `/admin/login` page.
- Admin API actions are protected via `x-admin-key` (`ADMIN_API_KEY`), not a dedicated admin session login route.

## 2.2 Quick Links (API Routes)

Auth:

- `GET /api/auth/csrf`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/send-verification`
- `POST /api/auth/verify-email`

Wallet and payments:

- `GET /api/wallet`
- `GET /api/wallet/ledger`
- `GET /api/payments/limits`
- `GET /api/payments/history`
- `POST /api/payments/deposit/request`
- `POST /api/payments/withdraw/request`
- `POST /api/payments/provider/webhook`
- `POST /api/payments/provider/mock/emit`

KYC:

- `POST /api/kyc/start`
- `POST /api/kyc/submit`
- `GET /api/kyc/status`
- `POST /api/kyc/upload`
- `POST /api/kyc/file-upload`
- `POST /api/kyc/review`
- `POST /api/kyc/provider/webhook`
- `POST /api/kyc/provider/mock/emit`

Support:

- `GET /api/support/tickets`
- `POST /api/support/tickets`
- `POST /api/support/tickets/[ticketId]/reply`

Games:

- `GET /api/games/[gameId]/config`
- `GET /api/games/[gameId]/state`
- `GET /api/games/[gameId]/history`
- `POST /api/games/[gameId]/play`
- `GET /api/plinko/config`
- `GET /api/plinko/state`
- `GET /api/plinko/history`
- `POST /api/plinko/drop`

Admin APIs:

- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/payments`
- `POST /api/admin/payments/approve`
- `POST /api/admin/payments/reject`
- `GET /api/admin/kyc/file`
- `GET /api/admin/tickets`
- `GET /api/admin/tickets/[ticketId]`
- `POST /api/admin/tickets/[ticketId]/reply`
- `POST /api/admin/tickets/[ticketId]/status`

## 3. End-to-End User Flows

### 3.1 Guest to Registered User

1. User opens `/signup`.
2. UI requests CSRF token from `GET /api/auth/csrf`.
3. UI submits signup to `POST /api/auth/signup` with:
   - `x-csrf-token`
   - `x-idempotency-key`
4. API validates rate limits and creates:
   - `User`
   - initial welcome `WalletLedger` entry
5. UI redirects user to `/login`.

### 3.2 Login and Session

1. User opens `/login`.
2. UI requests CSRF token and sends `POST /api/auth/login`.
3. API validates credentials and sets `casino_session` cookie.
4. UI redirects to `/` (lobby/home).

### 3.3 Logout

1. Logged-in user clicks logout button on home sidebar.
2. Client sends `POST /api/auth/logout` with CSRF and idempotency headers.
3. API clears session cookie.
4. UI refreshes and returns to guest state.

### 3.4 Email Verification

1. Logged-in user opens `/account`.
2. Click `Send Code` -> `POST /api/auth/send-verification`.
3. User enters OTP -> `POST /api/auth/verify-email`.
4. On success, account panel shows verified state.

### 3.5 Wallet Actions

1. User opens `/wallet`.
2. Deposit request -> `POST /api/payments/deposit/request`.
3. Withdraw request -> `POST /api/payments/withdraw/request`.
4. User can view history via `GET /api/payments/history`.
5. Provider callback/mocks update transaction status.

### 3.6 KYC Lifecycle

1. User opens `/kyc`.
2. Starts and submits KYC data/files.
3. Provider webhook or mock emit updates submission status.
4. Admin reviews pending KYC records.

### 3.7 Game Play (Thunder Plinko)

1. User opens `/games/thunder-plinko`.
2. Game reads config and player state via game/plinko APIs.
3. Player sends drop request.
4. Backend computes deterministic result with seed + nonce and writes:
   - `PlinkoRound`
   - `WalletLedger`
   - `WalletTransaction`
   - updates user balance and fairness nonce

## 4. High-Level Architecture

### 4.1 Runtime Topology

- Next.js 16 App Router (`src/app`)
- Route handlers under `src/app/api/*`
- Prisma ORM for PostgreSQL
- optional Redis for idempotency cache/locks
- stateless signed session cookie auth
- CSRF + idempotency protections for mutating endpoints

### 4.2 Layered Structure

- UI pages/components:
  - `src/app/*`, `src/components/*`
- API orchestration:
  - `src/app/api/*/route.ts`
- domain logic and utilities:
  - `src/lib/*`
- data model:
  - `prisma/schema.prisma`
- tests:
  - unit in `src/lib/*.test.ts`
  - e2e in `tests/e2e/*.spec.ts`

### 4.3 Request Security Pipeline

For most state-changing routes:

1. verify session (if endpoint requires auth)
2. verify CSRF token (`x-csrf-token` + csrf cookie)
3. enforce idempotency (`x-idempotency-key`)
4. enforce rate limit
5. perform business action
6. cache response for replay (idempotency)

## 5. Frontend Surface

### 5.1 Main Pages

- `/` lobby/home
- `/signup`
- `/login`
- `/account`
- `/wallet`
- `/kyc`
- `/games/thunder-plinko`
- `/admin/kyc`
- `/admin/payments`
- `/admin/tickets`
- `/admin/users`
- `/support`

### 5.2 Key Components

- `HeaderAdSlider`
- `EmailVerificationPanel`
- `KycFlow`
- `PaymentActions`
- `KycReviewPanel`
- `PaymentsReviewPanel`
- `LogoutButton`
- `ThunderPlinko` game component

## 6. API Surface

### 6.1 Auth

- `GET /api/auth/csrf`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/send-verification`
- `POST /api/auth/verify-email`

### 6.2 Wallet and Payments

- `GET /api/wallet`
- `GET /api/wallet/ledger`
- `GET /api/payments/limits`
- `GET /api/payments/history`
- `POST /api/payments/deposit/request`
- `POST /api/payments/withdraw/request`
- `POST /api/payments/provider/webhook`
- `POST /api/payments/provider/mock/emit`

### 6.3 KYC

- `POST /api/kyc/start`
- `POST /api/kyc/submit`
- `GET /api/kyc/status`
- `POST /api/kyc/upload`
- `POST /api/kyc/file-upload`
- `POST /api/kyc/review`
- `POST /api/kyc/provider/webhook`
- `POST /api/kyc/provider/mock/emit`

### 6.4 Games

- generic:
  - `GET /api/games/[gameId]/config`
  - `GET /api/games/[gameId]/state`
  - `GET /api/games/[gameId]/history`
  - `POST /api/games/[gameId]/play`
- plinko-specific:
  - `GET /api/plinko/config`
  - `GET /api/plinko/state`
  - `GET /api/plinko/history`
  - `POST /api/plinko/drop`

### 6.5 Admin

- `GET /api/admin/payments`
- `POST /api/admin/payments/approve`
- `POST /api/admin/payments/reject`
- `GET /api/admin/kyc/file`

## 7. Data Model (Prisma)

Primary tables and purpose:

- `User`: identity, auth, balance, verification, KYC status
- `EmailVerificationCode`: OTP records for email verification
- `WalletLedger`: accounting ledger entries (credit/debit events)
- `WalletTransaction`: user-facing transaction lifecycle records
- `PaymentWebhookEvent`: payment provider webhook event idempotency/audit
- `KycSubmission`: user KYC application data and status
- `KycProviderEvent`: external KYC event audit trail
- `PlinkoProvablyFair`: per-user fairness seed state
- `PlinkoRound`: persisted game rounds with fairness metadata
- `SupportTicket`: support case lifecycle and assignment state
- `SupportTicketMessage`: player/admin conversation timeline

## 8. Security Essentials

### 8.1 Session

- Cookie: `casino_session`
- Signed HMAC payload with expiry
- TTL: 7 days
- `SESSION_SECRET` required outside development/test

### 8.2 CSRF

- CSRF cookie: `casino_csrf`
- token served by `GET /api/auth/csrf`
- validated by comparing header `x-csrf-token` to cookie using timing-safe equality

### 8.3 Idempotency

- Header: `x-idempotency-key` (length 8-128)
- protects against duplicate mutation submissions
- supports replay response (`x-idempotent-replayed: 1`)
- backend:
  - Redis mode if `REDIS_URL` is configured
  - in-memory fallback mode otherwise

### 8.4 Rate Limiting

- in-memory buckets keyed by IP/user-context route keys
- protects auth, payments, and verification endpoints

### 8.5 Admin API Access

- header `x-admin-key` must match `ADMIN_API_KEY`

### 8.6 Provider Webhooks

- payment and KYC webhook signatures verified via shared secrets:
  - `PAYMENT_WEBHOOK_SECRET`
  - `KYC_WEBHOOK_SECRET`

## 9. Configuration and Environment Variables

Required for normal local operation:

- `DATABASE_URL` (PostgreSQL)
- `SESSION_SECRET`

Feature/config variables:

- `REDIS_URL` (optional)
- `APP_BASE_URL`
- `ADMIN_API_KEY`
- `PAYMENT_WEBHOOK_SECRET`
- `KYC_WEBHOOK_SECRET`

Recommended local `.env.local` template:

```env
DATABASE_URL="postgresql://<user>:<password>@127.0.0.1:5432/casino_web?schema=public"
SESSION_SECRET="<long-random-secret>"
APP_BASE_URL="http://localhost:3000"
REDIS_URL=""
ADMIN_API_KEY=""
PAYMENT_WEBHOOK_SECRET=""
KYC_WEBHOOK_SECRET=""
```

## 10. Local Setup and Operations

### 10.1 Install and Run

```bash
npm install
npm run dev
```

### 10.2 Database Setup

1. Create DB `casino_web`.
2. Set `DATABASE_URL`.
3. Apply schema:
   - preferred for this project state: `npx prisma db push --skip-generate`
4. Baseline migration history if DB was created via push and migrate shows `P3005`:
   - `npx prisma migrate resolve --applied <migration_name>` for each migration

### 10.3 Quality Gates

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run test:unit
npm run test:e2e
```

## 11. Testing Strategy

### 11.1 Unit Tests

- session token behavior
- kyc provider signature behavior

### 11.2 E2E Coverage (current)

- login page render
- logout UI flow
- logout API idempotency replay
- full auth flow: signup -> login -> email verification

## 12. Observability and Logs

Current model:

- route-level `console.error` for server exceptions
- Playwright reports in `test-results/` and `playwright-report/`

Recommended improvements:

- structured logger abstraction
- request correlation IDs
- error reporting backend integration

## 13. Known Constraints and Technical Debt

- some controls are in-memory only when Redis not configured:
  - idempotency fallback
  - rate limiting
- Prisma migration workflow can diverge if using `db push` without migration baseline
- no formal API versioning yet
- mock provider implementations are present; production provider adapters need hardening

## 14. Production Readiness Checklist

- set strong `SESSION_SECRET`
- set strong webhook secrets
- set real `ADMIN_API_KEY`
- provision PostgreSQL with backups
- provision Redis for robust idempotency/rate-limit behavior
- implement centralized logging/monitoring
- verify HTTPS and secure cookie behavior
- run full unit + e2e in CI

## 15. File/Folder Quick Map

- `src/app/` pages and API routes
- `src/components/` UI modules
- `src/lib/` domain/security/providers/utilities
- `prisma/` schema and migrations
- `tests/e2e/` Playwright tests
- `README.md` quick start
- `docs/PRODUCT_DOCUMENTATION.md` full reference

## 16. Change Management Notes

When adding new mutation endpoints, always include:

1. CSRF validation
2. idempotency key handling
3. rate limiting
4. explicit auth/role checks
5. e2e coverage for happy path and at least one failure mode

## 17. Admin Product Scope (Planned)

Note: this section defines target admin capabilities. Some items are already implemented in basic form (KYC/payments review), and others are roadmap items.

### 17.1 Revenue and Finance

Goals:

- daily/monthly gross gaming revenue (GGR), net gaming revenue (NGR), hold %, RTP by game
- deposits vs withdrawals trend, payment success/failure breakdown
- bonus cost and campaign impact
- reconciliation views and exportable finance reports

Recommended dashboards:

- Revenue Overview
- Payment Funnel
- Bonus Cost vs Revenue
- Settlement/Reconciliation

### 17.2 Game Management

Goals:

- enable/disable games globally
- per-game config controls (min/max bet, risk profile, maintenance mode)
- game/provider health monitoring (error rate, latency)
- featured game ordering/content controls
- fairness controls (seed rotation policy, audit checks)

### 17.3 User Management

Goals:

- user search and deep profile (balance, verification, KYC, risk flags)
- account actions: freeze/unfreeze, suspend/reactivate, force logout
- manual wallet adjustments with mandatory reason and audit log
- segmentation tags (VIP, promo-eligible, high-risk, self-excluded)
- responsible-gaming controls (limits, cooldown, self-exclusion)

### 17.4 Payment Management

Goals:

- unified transaction queue with advanced filters
- approve/reject workflow for manual reviews
- dispute/chargeback handling
- withdrawal risk checks and hold/release flows
- provider reconciliation against internal ledger

### 17.5 KYC and AML Management

Goals:

- KYC queue with reviewer assignment and SLA timers
- document viewer + case timeline
- approve/reject/request-more-info workflow
- AML signal visibility and risk score tracking
- compliance export and audit trail

### 17.6 Risk, Fraud, and Compliance

Goals:

- rule-based fraud flags (velocity, geo mismatch, multi-account indicators)
- alert center with severity and triage workflow
- immutable audit logs of all admin actions
- sanctions/PEP integration points

### 17.7 Promotions and CRM

Goals:

- bonus/campaign creation and eligibility rules
- promo code management
- campaign performance analytics
- player communication center (email/in-app templates)

### 17.8 Admin Access and RBAC

Current state:

- admin APIs are protected by `x-admin-key`.
- no dedicated admin login/session page yet.

Target state:

- dedicated `/admin/login`
- role-based access control (finance, support, compliance, super-admin)
- admin 2FA
- approval gates for sensitive actions

### 17.9 Support Ticket Management (Planned)

This is the recommended support model so player issues can be resolved from admin.

Player-side flow:

1. Player submits ticket from Help/Support form.
2. Ticket includes category, subject, description, optional attachment.
3. Player receives ticket ID and status tracking.

Admin-side flow:

1. Ticket enters support queue.
2. Agent/admin assigns ticket and responds.
3. Ticket progresses through lifecycle statuses.
4. Ticket can be escalated to finance/compliance/tech.
5. Ticket closes only after resolution criteria is met.

Suggested ticket statuses:

- `open`
- `in_progress`
- `waiting_on_player`
- `escalated`
- `resolved`
- `closed`
- `reopened`

Suggested ticket fields:

- ticket id/reference
- user id
- category (`payment`, `withdrawal`, `kyc`, `account`, `bonus`, `technical`, `other`)
- priority (`low`, `medium`, `high`, `urgent`)
- status
- assignee
- SLA timestamps (first-response due, resolution due)
- linked entity references (transaction id, kyc submission id)

Suggested ticket APIs:

- `POST /api/support/tickets` (player creates ticket)
- `GET /api/support/tickets` (player lists own tickets)
- `GET /api/support/tickets/[ticketId]` (player/admin view)
- `POST /api/support/tickets/[ticketId]/reply`
- `POST /api/admin/support/tickets/[ticketId]/assign`
- `POST /api/admin/support/tickets/[ticketId]/status`
- `POST /api/admin/support/tickets/[ticketId]/escalate`

Suggested database tables:

- `SupportTicket`
- `SupportTicketMessage`
- `SupportTicketAttachment`
- `SupportTicketAudit`
- `SupportTicketSlaEvent`

SLA and reporting metrics:

- first response time
- average resolution time
- reopen rate
- category-wise volume trend
- SLA breach counts

### 17.10 Admin MVP Delivery Plan

Phase 1 (must-have):

- unified `/admin` dashboard page
- ticket management basic queue + replies + assignment
- improved payment and KYC queue filters
- basic analytics cards (pending KYC, pending payments, open tickets)

Phase 2:

- revenue dashboard and export
- user management actions and audit logs
- fraud/risk alerts
- RBAC foundation

Phase 3:

- promo/CRM center
- advanced reconciliation and compliance tooling
- admin 2FA and approval workflows
