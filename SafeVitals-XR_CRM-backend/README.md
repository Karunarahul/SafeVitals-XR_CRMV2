# SafeVitals XR CRM Backend API

A production-ready, enterprise-grade backend service for the **SafeVitals XR CRM** platform built with **NestJS**, **TypeScript**, and **MongoDB Atlas** (Mongoose).

---

## 🏛️ System Architecture

The application is structured into fully decoupled, modular NestJS feature modules:

- **ConfigModule**: Environment variable validation with `class-validator` at startup.
- **DatabaseModule**: Resilient MongoDB connection with Mongoose, atomic `Counter` sequence generator for sequential IDs (`EMP-000001`, `TICK-0001`), and automatic seeding.
- **HealthModule**: Kubernetes/Cloud-native liveness (`GET /api/health`) and database readiness checks (`GET /api/health/ready`).
- **AuthModule**: JWT authentication, bcrypt hashing, 2FA OTP verification via email, Firebase OAuth token verification, password reset, account activation, and role-based access control (RBAC).
- **UsersModule**: User account lifecycle management, candidate registration approvals, and role/department assignments.
- **EmployeesModule**: Comprehensive employee management with automated ID generation, email invitations, status transitions (`Active`, `Suspended`, `Deactivated`), and dual identifier resolution (Mongo `_id` and sequential `employeeId`).
- **DepartmentsModule**: Department organization, budget/code management, manager assignment, and archiving.
- **TeamsModule**: Departmental sub-teams and leadership assignment.
- **PositionsModule**: Job position definitions and department mappings (including `PUT /api/positions/:id`).
- **RolesModule & PermissionsModule**: Granular system permissions and role assignment.
- **AttendanceModule**: Check-in, break tracking (start/end duration), check-out with automatic overtime computation, daily statistics summary, and manual logs.
- **LeaveModule**: Leave requests, allowance balance computation across leave categories, multi-level review/approval/rejection/cancellation workflow.
- **SchedulesModule**: Shift schedule planning, single and bulk employee shift assignment, personal schedule inspection.
- **TasksModule**: Kanban task management, priority setting, assignee dispatch, and status progression.
- **TicketsModule**: Internal helpdesk and support ticketing with threaded conversation history, agent assignment, and resolution tracking.
- **ReportsModule**: Weekly status report submissions with multipart file attachments (via Multer), manager review comments, and approval states.
- **AccessRequestsModule**: Privilege elevation and department transfer request workflow.
- **AuditModule**: Tamper-evident, indexed audit trails capturing administrative actions and security events.
- **NotificationsModule**: In-app notifications with read/unread tracking and real-time alerts.
- **OrgSettingsModule**: Global company configuration, working hours, and operational policies.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20+ (Node v22 / v25 compatible)
- **MongoDB**: Local MongoDB instance or MongoDB Atlas connection URI

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key environment variables:
| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `4000` |
| `HOST` | Binding address | `0.0.0.0` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/safevitals_crm` |
| `JWT_SECRET` | Secret key for JWT signing | *(random 32+ char string)* |
| `JWT_EXPIRES_IN` | JWT expiration duration | `1d` |
| `CORS_ORIGINS` | Permitted frontend origins | `http://localhost:3000` |
| `SMTP_HOST` | Nodemailer SMTP server host | `smtp.mailtrap.io` |
| `UPLOAD_DEST` | Upload destination folder | `./uploads` |

### 3. Installation
```bash
npm install
```

### 4. Running the Application
```bash
# Development mode with hot-reload
npm run start:dev

# Production build and run
npm run build
npm run start:prod
```

### 5. Running Tests
```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:cov
```

### 6. Protected Bootstrap Process (Initial Administrator Creation)
Initial administrator setup is performed strictly via a protected CLI bootstrap process. Administrator accounts **CANNOT** be created via any unauthenticated public endpoint.

To provision the initial administrator with a secure password:
```bash
# Set your environment credentials
export SEED_ADMIN_EMAIL="admin@safevitals.com"
export SEED_ADMIN_PASSWORD="YourStrongPassword123!"  # Min 8 chars, uppercase, lowercase, digit
export SEED_ADMIN_NAME="Enterprise Administrator"

# Run the idempotent seed command
npm run seed
```

> **Security Guarantees**:
> - In production (`NODE_ENV=production`), `SEED_ADMIN_PASSWORD` must be provided in the environment. Hardcoded passwords will throw an error and abort startup.
> - The bootstrap operation is **strictly idempotent**: If an administrator already exists with `SEED_ADMIN_EMAIL`, the command will **never** overwrite or reset their existing password.
> - Initial administrators seeded without explicit passwords receive a one-time high-entropy secret and have `mustChangePassword: true` enforced on first login.

---

## 🛡️ Authorization & Account Administration (RBAC)

All endpoints enforce server-side Role-Based Access Control (RBAC) and granular permission evaluation via `@UseGuards(JwtAuthGuard, RolesGuard)` and `@RequirePermissions(...)`. Frontend route protection is never relied upon alone.

### Account Administration Endpoints:

| Endpoint Path | Method | Minimum Required Role / Permission | Description |
|:---|:---:|:---|:---|
| `/api/users/pending` | `GET` | `employees.create` (`Super Admin`, `Manager`) | List registrations awaiting approval |
| `/api/users/:id/approve` | `POST` | `employees.create` (`Super Admin`, `Manager`) | Approve candidate & create employee profile |
| `/api/users/:id/reject` | `POST` | `employees.create` (`Super Admin`, `Manager`) | Reject candidate registration |
| `/api/employees` | `POST` | `employees.create` (`Super Admin`, `Manager`) | Create and invite staff |
| `/api/employees/onboard-uid` | `POST` | `employees.create` (`Super Admin`, `Manager`) | Onboard and link Firebase UID |
| `/api/employees/:id` | `PUT` | `employees.edit` (`Super Admin`, `Manager`) | Update employee profile & role |
| `/api/employees/:id/suspend` | `PATCH` | `employees.suspend` (`Super Admin`, `Manager`) | Suspend account & revoke login session |
| `/api/employees/:id/reactivate`| `PATCH` | `employees.suspend` (`Super Admin`, `Manager`) | Reactivate suspended account |
| `/api/employees/:id/deactivate`| `PATCH` | `employees.suspend` (`Super Admin`) | Permanently deactivate employee & user |
| `/api/access-requests` | `GET` | Authenticated User | List access elevation requests |
| `/api/access-requests` | `POST` | `access.request` | Submit access elevation request |
| `/api/access-requests/:id/review`| `PATCH` | `access.review` (`Super Admin`, `Manager`) | Approve or reject elevation request |
| `/api/audit` | `GET` | `audit.view` (`Super Admin`, `Manager`) | Query system compliance audit trail |

### Security Invariants & Protections:
1. **Self-Approval Prevention**: Administrators cannot approve their own candidate registration requests (`400 Bad Request`).
2. **Self-Suspension & Deactivation Prevention**: Users cannot suspend, reactivate, or deactivate their own user account (`400 Bad Request`).
3. **Privilege Escalation Prevention**:
   - Ordinary users cannot modify or elevate their own security role (`403 Forbidden`).
   - Non-super administrators cannot assign the `Super Admin` role to any candidate or employee (`403 Forbidden`).
4. **Zero-Trust Backend Enforcement**: Permissions (`*.*.*`, `employees.*`, etc.) are resolved from the database during JWT validation and evaluated on every request.
5. **Tamper-Evident Audit Logging**: Security-sensitive state transitions (approval, rejection, suspension, reactivation, deactivation, role change, and access review) are logged directly to the `audit_logs` collection.

---

## 📖 API Documentation & Swagger

When the backend is running, interactive Swagger/OpenAPI documentation is accessible at:
```
http://localhost:4000/api/docs
```

All 65+ endpoints are organized with schema definitions, authentication requirements, and payload examples.

---

## 🐳 Docker Deployment

A production-ready, multi-stage Dockerfile is included:

```bash
# Build Docker image
docker build -t safevitals-backend .

# Run Docker container
docker run -p 4000:4000 \
  -e MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/safevitals" \
  -e JWT_SECRET="your-production-jwt-secret-key" \
  safevitals-backend
```

---

## ☁️ Render Deployment

The backend is fully configured for deployment on Render via [`render.yaml`](./render.yaml) with disk persistence for uploads and automated database readiness health checks.

