# SafeVitals XR CRM — Backend Implementation Plan & Architecture

> **Stack**: NestJS 10.x | MongoDB 7.x (Mongoose 8.x) | TypeScript 5.x | Node.js 20+  
> **Architecture**: Clean Modular Domain Architecture with Dependency Injection, Repository/Service Pattern, and Declarative DTO Validation.

---

## 1. Directory Structure of the NestJS Backend

```
SafeVitals-XR_CRM-backend/
├── .env.example
├── .gitignore
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── Dockerfile
├── docker-compose.yml
├── docs/
│   ├── FRONTEND_API_CONTRACT.md
│   ├── DATABASE_SCHEMA.md
│   ├── AUTHENTICATION_FLOW.md
│   ├── ROLE_PERMISSION_MATRIX.md
│   └── IMPLEMENTATION_PLAN.md
└── src/
    ├── main.ts                        # Application bootstrap, CORS, Helmet, ValidationPipe, Global Interceptors
    ├── app.module.ts                  # Root module importing all feature modules & MongooseModule
    ├── common/                        # Shared cross-cutting concerns
    │   ├── decorators/                # @CurrentUser(), @Public(), @RequirePermission()
    │   ├── filters/                   # AllExceptionsFilter, MongoExceptionFilter
    │   ├── guards/                    # JwtAuthGuard, RolesGuard, PermissionsGuard
    │   ├── interceptors/              # TransformInterceptor (adds virtual id), LoggingInterceptor
    │   └── utils/                     # Password generator, ID generator (EMP-000001)
    ├── config/                        # Configuration & environment validation
    │   ├── configuration.ts
    │   └── env.validation.ts
    └── modules/                       # Domain Modules
        ├── auth/                      # Login, 2FA OTP, Register, Reset, Firebase Auth
        │   ├── auth.controller.ts
        │   ├── auth.service.ts
        │   ├── auth.module.ts
        │   ├── strategies/            # jwt.strategy.ts, firebase.strategy.ts
        │   └── dto/
        ├── users/                     # User entity, pending registration approvals
        │   ├── users.controller.ts
        │   ├── users.service.ts
        │   ├── users.module.ts
        │   └── schemas/user.schema.ts
        ├── employees/                 # Workforce profiles, sequential ID counter, suspensions
        │   ├── employees.controller.ts
        │   ├── employees.service.ts
        │   ├── employees.module.ts
        │   ├── schemas/employee.schema.ts
        │   └── schemas/counter.schema.ts
        ├── departments/               # Departments CRUD & archive
        │   ├── departments.controller.ts
        │   ├── departments.service.ts
        │   └── schemas/department.schema.ts
        ├── teams/                     # Teams CRUD & squad leads
        │   ├── teams.controller.ts
        │   ├── teams.service.ts
        │   └── schemas/team.schema.ts
        ├── positions/                 # Position levels & department linking
        │   ├── positions.controller.ts
        │   ├── positions.service.ts
        │   └── schemas/position.schema.ts
        ├── attendance/                # Biometric/terminal check-in, breaks, check-out
        │   ├── attendance.controller.ts
        │   ├── attendance.service.ts
        │   └── schemas/attendance.schema.ts
        ├── leave/                     # Leave requests, dynamic balances, manager reviews
        │   ├── leave.controller.ts
        │   ├── leave.service.ts
        │   └── schemas/leave.schema.ts
        ├── schedules/                 # Work shifts and hours
        │   ├── schedules.controller.ts
        │   ├── schedules.service.ts
        │   └── schemas/schedule.schema.ts
        ├── tasks/                     # Sprint Kanban, status transitions, priority
        │   ├── tasks.controller.ts
        │   ├── tasks.service.ts
        │   └── schemas/task.schema.ts
        ├── reports/                   # Shift reports with multipart file uploads
        │   ├── reports.controller.ts
        │   ├── reports.service.ts
        │   ├── storage.service.ts     # Supabase Storage / Local disk storage
        │   └── schemas/report.schema.ts
        ├── tickets/                   # Support helpdesk tickets & resolution
        │   ├── tickets.controller.ts
        │   ├── tickets.service.ts
        │   └── schemas/ticket.schema.ts
        ├── roles/                     # RBAC management & permission matrix
        │   ├── roles.controller.ts
        │   ├── roles.service.ts
        │   └── schemas/role.schema.ts
        ├── access-requests/           # Elevated credential access queue
        │   ├── access-requests.controller.ts
        │   ├── access-requests.service.ts
        │   └── schemas/access-request.schema.ts
        ├── audit/                     # Immutable tamper-evident audit ledger
        │   ├── audit.controller.ts
        │   ├── audit.service.ts
        │   └── schemas/audit.schema.ts
        ├── mailer/                    # Email dispatch for 2FA, invites, approvals
        │   ├── mailer.service.ts
        │   └── mailer.module.ts
        └── seeder/                    # Database initializer (creates Super Admin, System Roles, Departments)
            ├── seeder.service.ts
            └── seeder.module.ts
```

---

## 2. Phased Implementation Roadmap

### Phase 1: Foundation, NestJS Setup & Database Seeding
1. Initialize NestJS 10 project with standard build tooling:
   - `@nestjs/common`, `@nestjs/core`, `@nestjs/config`, `@nestjs/mongoose`, `mongoose`.
   - `class-validator`, `class-transformer`, `helmet`, `bcrypt`.
2. Configure Global `ValidationPipe` with `{ whitelist: true, transform: true }`.
3. Configure Global Exception Filter to return clean error envelopes matching frontend expectations.
4. Set up `DatabaseSeeder`:
   - Seeds System Roles: `Super Admin` (`*.*.*`), `Manager`, `Employee`.
   - Seeds Initial Super Admin User: `admin@safevitals.com` with secure password.
   - Seeds Core Departments: `XR Engineering & R&D`, `Spatial UI/UX`, `Quality Assurance`, `Operations`.

### Phase 2: Authentication, Two-Factor OTP & Firebase Integration
1. Implement `AuthModule` with JWT issuance & verification.
2. Implement 6-digit OTP generation, hashing, and email dispatch (`POST /auth/login`, `POST /auth/verify-otp`, `POST /auth/resend-otp`).
3. Implement Candidate Self-Registration (`POST /auth/register`, `POST /auth/register/verify-otp`).
4. Implement Firebase Admin SDK ID Token verification (`POST /auth/firebase-login`).
5. Implement Account Activation via Invitation Token (`POST /auth/setup-password`).
6. Implement Password Recovery & Reset (`POST /auth/forgot-password`, `POST /auth/reset-password`).
7. Implement Mandatory Password Change (`POST /auth/change-password`).

### Phase 3: Workforce, Sequential IDs & Organizational Hierarchy
1. Implement Atomic Sequential Employee ID Counter (`Counter` collection for `EMP-000001` generation).
2. Implement `EmployeesModule`:
   - `GET /employees` with query filtering (`search`, `departmentId`, `teamId`).
   - `GET /employees/:id`.
   - `POST /employees` (Standard onboarding + invite link).
   - `POST /employees/onboard-uid` (Firebase UID onboarding).
   - `PUT /employees/:id` (Profile and assignment updates).
   - `PATCH /employees/:id/suspend`, `/reactivate`, `/deactivate`.
3. Implement `DepartmentsModule`, `TeamsModule`, and `PositionsModule` with full CRUD, archiving, and relational integrity.
4. Implement Candidate Review Desk (`GET /users/pending`, `POST /users/:id/approve`).

### Phase 4: Time & Attendance Command Center
1. Implement `AttendanceModule`:
   - `POST /attendance/check-in/:employeeId` (with location capture).
   - `POST /attendance/break-start/:employeeId`.
   - `POST /attendance/break-end/:employeeId`.
   - `POST /attendance/check-out/:employeeId` (calculates total work hours).
   - `GET /attendance/me/today` (live status for dashboard stopwatch).
   - `GET /attendance` (historical timesheet records for CSV export).
2. Implement `SchedulesModule` for standard shift management.

### Phase 5: Operations, Kanban Sprints & File Uploads
1. Implement `LeaveModule`:
   - `POST /leave` (submission).
   - `GET /leave` (scoped listing).
   - `PATCH /leave/:id/review` (approval/rejection with notes).
2. Implement `TasksModule`:
   - Full Kanban CRUD (`POST /tasks`, `GET /tasks`, `PUT /tasks/:id`, `PATCH /tasks/:id/status`, `DELETE /tasks/:id`).
3. Implement `ReportsModule`:
   - File upload handler using Multer & Supabase Storage / S3 / Local Disk.
   - `POST /reports` (multipart/form-data with file attachments).
   - `GET /reports`.
   - `PATCH /reports/:id/review`.

### Phase 6: Governance, Security, Audit & Helpdesk
1. Implement `TicketsModule`:
   - `POST /tickets`, `GET /tickets`, `PATCH /tickets/:id/resolve`.
2. Implement `RolesModule`:
   - RBAC management (`GET /roles`, `POST /roles`, `PUT /roles/:id`, `DELETE /roles/:id`).
3. Implement `AccessRequestsModule`:
   - Privileged credential request queue (`POST /access-requests`, `GET /access-requests`, `PATCH /access-requests/:id/review`).
4. Implement `AuditModule`:
   - Immutable security ledger (`GET /audit`).
   - Automatic audit interceptor recording critical operations.

### Phase 7: Automated Testing, Containerization & Production Readiness
1. Unit tests for AuthService, EmployeeService, AttendanceService.
2. End-to-end (E2E) tests for complete auth cycle and check-in flow.
3. Multi-stage production `Dockerfile` (distroless/alpine, non-root user).
4. `docker-compose.yml` orchestrating NestJS backend and MongoDB.

---

## 3. Environment Variables Specification (`.env.example`)

```env
# Server Configuration
PORT=4000
NODE_ENV=production
API_PREFIX=api

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/safevitals_crm

# JWT Security
JWT_SECRET=super_secret_jwt_key_safevitals_xr_enterprise_2026
JWT_EXPIRES_IN=24h

# Firebase Admin Configuration (Optional for Firebase Auth)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Supabase Storage Configuration (for Weekly Report attachments)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=reports

# Email / SMTP Configuration (for OTPs and Invitations)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="SafeVitals XR Security" <noreply@safevitals.in>

# Frontend Origin for CORS
FRONTEND_URL=http://localhost:3000
```
