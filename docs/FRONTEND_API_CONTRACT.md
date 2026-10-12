# SafeVitals XR CRM — Frontend-to-Backend API Contract

> **Target Version**: NestJS 10.x / MongoDB 7.x (Mongoose 8.x)  
> **Base URL**: `http://localhost:4000/api` (Configured via `NEXT_PUBLIC_API_URL`)  
> **Global Content-Type**: `application/json` (except `/api/reports` which uses `multipart/form-data`)  
> **Global Header**: `Authorization: Bearer <JWT_TOKEN>` (omitted for public authentication routes)

---

## 1. Global Architectural Conventions

### 1.1 Authentication & Interceptor Behavior
- **JWT Storage**: Frontend stores the session in `localStorage` under key `safevitals-auth-storage` (`Zustand` persist store format: `state.token` and `state.user`).
- **Authorization Header**: Sent automatically on all requests as `Authorization: Bearer <token>`.
- **401 Unauthorized**:
  - For protected routes (`/app/*`): Axios response interceptor in `apiClient.ts` clears `safevitals-auth-storage` and redirects to `/login`.
  - For public routes (`/login`, `/verify-otp`, `/register`, `/forgot-password`, `/reset-password`, `/activate-account`, `/change-password`): 401 does **not** trigger a redirect; error message is surfaced to the form.
- **Error Response Shape**:
  Backend must return standard NestJS exception envelopes:
  ```json
  {
    "statusCode": 400,
    "message": "Validation failed" | ["email must be an email", "password is too short"],
    "error": "Bad Request"
  }
  ```
  `apiClient.ts` gracefully parses `error.response.data.message` (string or array) and falls back to `error.response.data.error.message` or `error.response.data.error`.

### 1.2 Entity ID Conventions (`_id` vs `id`)
- MongoDB documents have `_id` (ObjectId).
- The frontend uses `id = item._id ? item._id.toString() : item.id`.
- **Backend Mandate**: All Mongoose Schemas must enable `{ toJSON: { virtuals: true }, toObject: { virtuals: true } }` so both `id` (string) and `_id` are returned.

### 1.3 Envelope & Array Mapping
- The frontend `appStore.ts` `fetchAllData()` processes endpoints using:
  ```ts
  const mapList = (res) => {
    const data = res.value.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    const arrayVals = Object.values(data).filter(Array.isArray);
    return arrayVals.length > 0 ? arrayVals[0] : [];
  }
  ```
  Therefore, list endpoints may return either a direct JSON array `[...]` or a paginated envelope `{ data: [...], total: number, page: number }`.

---

## 2. API Contract Specification by Module

---

### Module 1: System Health & Core Authentication (`/api/auth`)

#### 1.1 Health Check
- **Endpoint**: `GET /api/health`
- **Auth**: None (Public)
- **Component**: `apiClient.ts` (`checkHealth()`)
- **Query Params**: None
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-12T16:05:00.000Z",
    "uptime": 12450.8,
    "database": "connected"
  }
  ```
- **Error States**: 503 Service Unavailable if MongoDB is disconnected.

---

#### 1.2 User Login (Password Authentication & 2FA Dispatch)
- **Endpoint**: `POST /api/auth/login`
- **Auth**: None (Public)
- **Component**: `LoginPage.tsx` via `authService.login(email, password)`
- **Request Body**:
  ```json
  {
    "email": "employee@safevitals.com",
    "password": "Password123!"
  }
  ```
- **Success Response — Scenario A (2FA Required / Default)**:
  ```json
  {
    "success": true,
    "userId": "660c1f2e4b8d9a0012f34567",
    "message": "OTP sent to your email!"
  }
  ```
  *(Frontend transitions to `/verify-otp`, storing `userId` and `email` in pending store)*
- **Success Response — Scenario B (Direct Session / 2FA Bypassed)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "660c1f2e4b8d9a0012f34567",
      "email": "employee@safevitals.com",
      "firstName": "Ravi",
      "lastName": "Kumar",
      "fullName": "Ravi Kumar",
      "status": "Active",
      "role": "Super Admin",
      "roleId": "role_1",
      "employeeDocId": "660c1f2e4b8d9a0012f34568",
      "departmentId": "660c1f2e4b8d9a0012f34569",
      "teamId": "660c1f2e4b8d9a0012f3456a",
      "position": "Senior XR Systems Architect",
      "permissions": ["*.*.*"],
      "mustChangePassword": false
    },
    "mustChangePassword": false
  }
  ```
- **Error States**:
  - `401 Unauthorized`: `{ "statusCode": 401, "message": "Invalid email or password." }`
  - `403 Forbidden`: `{ "statusCode": 403, "message": "Account suspended. Please contact your administrator." }`
  - `404 Not Found`: `{ "statusCode": 404, "message": "Account not found." }`

---

#### 1.3 Firebase ID Token Authentication
- **Endpoint**: `POST /api/auth/firebase-login`
- **Auth**: None (Firebase ID Token in body verified on server via Firebase Admin SDK)
- **Component**: `LoginPage.tsx` via `authService.firebaseLogin(idToken)`
- **Request Body**:
  ```json
  {
    "idToken": "eyJhbGciOiJSUzI1NiIs..."
  }
  ```
- **Success Response (200 OK — Active User)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "firebaseUid": "FIREBASE_UID_12345",
    "email": "lead@safevitals.com",
    "user": {
      "id": "660c1f2e4b8d9a0012f34567",
      "email": "lead@safevitals.com",
      "firstName": "Sarah",
      "lastName": "Connor",
      "fullName": "Sarah Connor",
      "status": "Active",
      "role": "Operations Manager",
      "roleId": "role_2",
      "employeeDocId": "660c1f2e4b8d9a0012f34568",
      "departmentId": "660c1f2e4b8d9a0012f34569",
      "teamId": "660c1f2e4b8d9a0012f3456a",
      "permissions": ["attendance.*", "leave.review", "tasks.*"]
    }
  }
  ```
- **Success Response (200 OK — Pending Admin Onboarding)**:
  ```json
  {
    "success": false,
    "pendingOnboarding": true,
    "firebaseUid": "FIREBASE_UID_12345",
    "email": "new.candidate@safevitals.com",
    "message": "Your account is awaiting administrative approval."
  }
  ```
- **Error States**:
  - `401 Unauthorized`: Invalid or expired Firebase ID token.
  - `403 Forbidden`: Account suspended.

---

#### 1.4 Verify 2FA OTP
- **Endpoint**: `POST /api/auth/verify-otp`
- **Auth**: None (Public, bound by `userId` and 6-digit code)
- **Component**: `VerifyOTPPage.tsx` via `authService.verifyOtp(userId, otp)`
- **Request Body**:
  ```json
  {
    "userId": "660c1f2e4b8d9a0012f34567",
    "otp": "481920"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "660c1f2e4b8d9a0012f34567",
      "email": "ravi@safevitals.com",
      "firstName": "Ravi",
      "lastName": "Kumar",
      "fullName": "Ravi Kumar",
      "status": "Active",
      "role": "Super Admin",
      "roleId": "role_1",
      "employeeDocId": "660c1f2e4b8d9a0012f34568",
      "departmentId": "660c1f2e4b8d9a0012f34569",
      "teamId": "660c1f2e4b8d9a0012f3456a",
      "position": "Spatial Lead",
      "permissions": ["*.*.*"],
      "mustChangePassword": false
    },
    "mustChangePassword": false
  }
  ```
- **Error States**:
  - `400 Bad Request`: `{ "message": "Invalid or expired verification code." }`
  - `429 Too Many Requests`: `{ "message": "Too many failed attempts. Please request a new code." }`

---

#### 1.5 Resend 2FA / Invitation OTP
- **Endpoint**: `POST /api/auth/resend-otp`
- **Auth**: None (Public)
- **Component**: `VerifyOTPPage.tsx`, `invitationService.ts` (`resendInvitation`)
- **Request Body**:
  ```json
  {
    "userId": "660c1f2e4b8d9a0012f34567"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "A new verification code has been dispatched to your email."
  }
  ```
- **Error States**:
  - `404 Not Found`: User not found.
  - `429 Too Many Requests`: Rate limited (cooldown 60s).

---

#### 1.6 Candidate Self-Registration
- **Endpoint**: `POST /api/auth/register`
- **Auth**: None (Public)
- **Component**: `RegisterPage.tsx` via `authService.register(fullName, email, phone)`
- **Request Body**:
  ```json
  {
    "fullName": "Priya Sharma",
    "email": "priya.sharma@gmail.com",
    "phone": "+919876543210"
  }
  ```
- **Success Response (200 OK / 201 Created)**:
  ```json
  {
    "success": true,
    "registrationToken": "reg_tok_9f8e7d6c5b4a3...",
    "message": "Verification code sent to your email."
  }
  ```
- **Error States**:
  - `409 Conflict`: `{ "message": "An account with this email address already exists." }`
  - `400 Bad Request`: Validation failure on phone or email.

---

#### 1.7 Verify Candidate Registration OTP & Set Initial Password
- **Endpoint**: `POST /api/auth/register/verify-otp`
- **Auth**: None (Public, bound by `registrationToken`)
- **Component**: `RegistrationVerifyOtpPage.tsx` via `authService.verifyRegistrationOtp(...)`
- **Request Body**:
  ```json
  {
    "registrationToken": "reg_tok_9f8e7d6c5b4a3...",
    "otp": "654321",
    "password": "StrongPassword123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "pendingOnboarding": true,
    "message": "Email verified! Registration complete. Your account is pending administrator approval."
  }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid or expired OTP, password complexity unsatisfied.
  - `404 Not Found`: Registration session expired.

---

#### 1.8 Current User Session (`/auth/me`)
- **Endpoint**: `GET /api/auth/me`
- **Auth**: Bearer JWT
- **Component**: `authService.getMe()`
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "660c1f2e4b8d9a0012f34567",
      "email": "employee@safevitals.com",
      "firstName": "Ravi",
      "lastName": "Kumar",
      "fullName": "Ravi Kumar",
      "status": "Active",
      "role": "Super Admin",
      "roleId": "role_1",
      "employeeDocId": "660c1f2e4b8d9a0012f34568",
      "departmentId": "660c1f2e4b8d9a0012f34569",
      "teamId": "660c1f2e4b8d9a0012f3456a",
      "permissions": ["*.*.*"],
      "mustChangePassword": false
    }
  }
  ```
- **Error States**: 401 Unauthorized.

---

#### 1.9 Logout Session
- **Endpoint**: `POST /api/auth/logout`
- **Auth**: Bearer JWT (Optional/Soft)
- **Component**: `authService.logout()`, `Header.tsx`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

---

#### 1.10 Forgot Password Request
- **Endpoint**: `POST /api/auth/forgot-password`
- **Auth**: None (Public)
- **Component**: `ForgotPasswordPage.tsx` via `authService.requestPasswordReset(email)`
- **Request Body**:
  ```json
  {
    "email": "employee@safevitals.com"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "If an account exists for this address, password reset instructions have been dispatched."
  }
  ```
  *(Anti-enumeration design: always returns 200 OK)*

---

#### 1.11 Reset Password with Token
- **Endpoint**: `POST /api/auth/reset-password`
- **Auth**: None (Public)
- **Component**: `ResetPasswordPage.tsx` via `authService.resetPassword(token, password)`
- **Request Body**:
  ```json
  {
    "token": "reset_token_hex_string_or_oobCode",
    "password": "NewPermanentPassword123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Your password has been successfully updated."
  }
  ```
- **Error States**:
  - `400 Bad Request`: Invalid or expired reset token.

---

#### 1.12 Setup Password for Invited Account (Activation)
- **Endpoint**: `POST /api/auth/setup-password`
- **Auth**: None (Public)
- **Component**: `ActivateAccountPage.tsx` via `authService.activateAccount(invitationToken, password)`
- **Request Body**:
  ```json
  {
    "invitationToken": "invite_token_hex_string",
    "password": "PermanentPassword123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Account activated successfully."
  }
  ```
- **Error States**:
  - `400 Bad Request`: Token expired or already claimed.

---

#### 1.13 Change Password (First Login or Security Policy)
- **Endpoint**: `POST /api/auth/change-password`
- **Auth**: Bearer JWT
- **Component**: `ChangePasswordPage.tsx` via `authService.changePassword(current, new)`
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "BrandNewSecurePassword123!"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Password updated successfully."
  }
  ```
- **Error States**:
  - `400 Bad Request`: Current password incorrect or new password identical to current.
  - `401 Unauthorized`: Session expired.

---

### Module 2: User Approval & Registration Management (`/api/users`)

#### 2.1 Fetch Pending Self-Registered Users
- **Endpoint**: `GET /api/users/pending`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`, `Admin`, or `employees.create`
- **Component**: `RegistrationRequestsPage.tsx`, `appStore.ts` (`fetchPendingUsers()`)
- **Query Params**: None
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f34570",
      "_id": "660c1f2e4b8d9a0012f34570",
      "email": "priya.sharma@gmail.com",
      "firstName": "Priya",
      "lastName": "Sharma",
      "fullName": "Priya Sharma",
      "phone": "+919876543210",
      "firebaseUid": null,
      "status": "Pending",
      "createdAt": "2026-10-12T10:30:00.000Z"
    }
  ]
  ```

---

#### 2.2 Approve Self-Registered User & Issue Employee Profile
- **Endpoint**: `POST /api/users/:userId/approve`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`, `Admin`, or `employees.create`
- **Component**: `ApproveRegistrationModal.tsx`, `appStore.ts` (`approveRegistration`)
- **Request Body**:
  ```json
  {
    "departmentId": "660c1f2e4b8d9a0012f34569",
    "teamId": "660c1f2e4b8d9a0012f3456a",
    "positionId": "660c1f2e4b8d9a0012f3456b",
    "roleId": "role_3"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "User approved successfully",
    "employee": {
      "id": "660c1f2e4b8d9a0012f34580",
      "_id": "660c1f2e4b8d9a0012f34580",
      "employeeId": "EMP-000105",
      "userId": "660c1f2e4b8d9a0012f34570",
      "firstName": "Priya",
      "lastName": "Sharma",
      "email": "priya.sharma@gmail.com",
      "departmentId": "660c1f2e4b8d9a0012f34569",
      "teamId": "660c1f2e4b8d9a0012f3456a",
      "positionId": "660c1f2e4b8d9a0012f3456b",
      "roleId": "role_3",
      "status": "Active",
      "joiningDate": "2026-10-12"
    }
  }
  ```
- **Business Rules**:
  - Automatically generates next sequential `employeeId` (`EMP-000001` format).
  - Updates `User.status` to `"Active"`.
  - Creates linked `Employee` document.
  - Logs audit event: `"Approved Candidate Registration"`.

---

### Module 3: Workforce & Employee Directory (`/api/employees`)

#### 3.1 List Workforce Directory
- **Endpoint**: `GET /api/employees`
- **Auth**: Bearer JWT
- **Permissions**: `employees.view`
- **Component**: `EmployeesPage.tsx`, `appStore.ts` (`fetchAllData`)
- **Query Params**:
  - `limit`: (e.g. `100`)
  - `page`: (optional)
  - `search`: (optional string)
  - `departmentId`: (optional string)
  - `teamId`: (optional string)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f34580",
      "_id": "660c1f2e4b8d9a0012f34580",
      "employeeId": "EMP-000001",
      "userId": "660c1f2e4b8d9a0012f34570",
      "firstName": "Ravi",
      "lastName": "Kumar",
      "fullName": "Ravi Kumar",
      "email": "ravi@safevitals.com",
      "secondaryEmail": "ravi.personal@gmail.com",
      "phone": "+919876543210",
      "address": "Bengaluru Innovation Hub",
      "departmentId": "660c1f2e4b8d9a0012f34569",
      "teamId": "660c1f2e4b8d9a0012f3456a",
      "position": "Spatial Systems Architect",
      "positionId": "660c1f2e4b8d9a0012f3456b",
      "roleId": "role_1",
      "role": "Super Admin",
      "managerId": null,
      "workScheduleId": "660c1f2e4b8d9a0012f34599",
      "status": "Active",
      "joiningDate": "2026-01-15",
      "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
    }
  ]
  ```

---

#### 3.2 Fetch Individual Employee Profile
- **Endpoint**: `GET /api/employees/:id`
- **Auth**: Bearer JWT
- **Permissions**: `employees.view`
- **Component**: `EmployeeProfilePage.tsx` (`/app/employees/[id]`)
- **Success Response (200 OK)**:
  ```json
  {
    "id": "660c1f2e4b8d9a0012f34580",
    "_id": "660c1f2e4b8d9a0012f34580",
    "employeeId": "EMP-000001",
    "firstName": "Ravi",
    "lastName": "Kumar",
    "email": "ravi@safevitals.com",
    "secondaryEmail": "ravi.personal@gmail.com",
    "phone": "+919876543210",
    "address": "Bengaluru Innovation Hub",
    "departmentId": "660c1f2e4b8d9a0012f34569",
    "teamId": "660c1f2e4b8d9a0012f3456a",
    "position": "Spatial Systems Architect",
    "positionId": "660c1f2e4b8d9a0012f3456b",
    "roleId": "role_1",
    "role": "Super Admin",
    "managerId": null,
    "workScheduleId": "660c1f2e4b8d9a0012f34599",
    "status": "Active",
    "joiningDate": "2026-01-15",
    "avatarUrl": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
  }
  ```
- **Error States**: `404 Not Found` if employee ID does not match any Employee or User entity.

---

#### 3.3 Create / Onboard Employee (Standard)
- **Endpoint**: `POST /api/employees`
- **Auth**: Bearer JWT
- **Permissions**: `employees.create`
- **Component**: `employeeService.ts` (`createEmployee`), `InviteEmployeeModal.tsx`, `invitationService.ts`
- **Request Body**:
  ```json
  {
    "firstName": "Amit",
    "lastName": "Patel",
    "email": "amit@safevitals.com",
    "departmentId": "660c1f2e4b8d9a0012f34569",
    "teamId": "660c1f2e4b8d9a0012f3456a",
    "positionId": "660c1f2e4b8d9a0012f3456b",
    "roleId": "role_3",
    "managerId": "660c1f2e4b8d9a0012f34580",
    "workScheduleId": "660c1f2e4b8d9a0012f34599",
    "temporaryPassword": "TemporaryPassword123!",
    "joiningDate": "2026-10-15"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "employee": {
      "id": "660c1f2e4b8d9a0012f34581",
      "_id": "660c1f2e4b8d9a0012f34581",
      "employeeId": "EMP-000002",
      "userId": "660c1f2e4b8d9a0012f34571",
      "firstName": "Amit",
      "lastName": "Patel",
      "email": "amit@safevitals.com",
      "departmentId": "660c1f2e4b8d9a0012f34569",
      "teamId": "660c1f2e4b8d9a0012f3456a",
      "positionId": "660c1f2e4b8d9a0012f3456b",
      "roleId": "role_3",
      "status": "Active",
      "joiningDate": "2026-10-15"
    }
  }
  ```
- **Business Rules**:
  - If `temporaryPassword` is provided, user is created with `mustChangePassword: true`.
  - If omitted, an `Invitation` record with a secure activation token is created and sent via email.

---

#### 3.4 Onboard Employee by Firebase UID
- **Endpoint**: `POST /api/employees/onboard-uid`
- **Auth**: Bearer JWT
- **Permissions**: `employees.create`
- **Component**: `employeeService.ts` (`onboardByFirebaseUid`), `InviteEmployeeModal.tsx`
- **Request Body**:
  ```json
  {
    "firebaseUid": "FIREBASE_UID_998877",
    "departmentId": "660c1f2e4b8d9a0012f34569",
    "teamId": "660c1f2e4b8d9a0012f3456a",
    "positionId": "660c1f2e4b8d9a0012f3456b",
    "roleId": "role_3",
    "managerId": "660c1f2e4b8d9a0012f34580",
    "joiningDate": "2026-10-15"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "employee": {
      "id": "660c1f2e4b8d9a0012f34582",
      "_id": "660c1f2e4b8d9a0012f34582",
      "employeeId": "EMP-000003",
      "firebaseUid": "FIREBASE_UID_998877",
      "status": "Active"
    }
  }
  ```

---

#### 3.5 Update Employee Profile
- **Endpoint**: `PUT /api/employees/:id`
- **Auth**: Bearer JWT
- **Permissions**: `employees.edit`
- **Component**: `EmployeeProfilePage.tsx`, `EditEmployeeModal.tsx`, `appStore.ts` (`updateEmployee`, `promoteEmployee`)
- **Request Body**:
  ```json
  {
    "firstName": "Ravi",
    "lastName": "Kumar",
    "position": "Principal XR Architect",
    "departmentId": "660c1f2e4b8d9a0012f34569",
    "teamId": "660c1f2e4b8d9a0012f3456a",
    "positionId": "660c1f2e4b8d9a0012f3456b",
    "roleId": "role_1",
    "secondaryEmail": "ravi.alternate@safevitals.com",
    "phone": "+919876543219",
    "address": "Indiranagar, Bengaluru"
  }
  ```
  *(Note: Nulls may be sent to unassign department/team/role)*
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "employee": { "id": "660c1f2e4b8d9a0012f34580", ... }
  }
  ```

---

#### 3.6 Account Status Transitions (Suspend, Reactivate, Deactivate)
- **Suspend Endpoint**: `PATCH /api/employees/:id/suspend`
  - Action: Sets `status = "Suspended"` on both `Employee` and `User`.
- **Reactivate Endpoint**: `PATCH /api/employees/:id/reactivate`
  - Action: Sets `status = "Active"` on both `Employee` and `User`.
- **Deactivate Endpoint**: `PATCH /api/employees/:id/deactivate`
  - Action: Soft-deletes record (`status = "Deactivated"`).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Employee status updated successfully."
  }
  ```

---

### Module 4: Departments, Teams & Positions (`/api/departments`, `/api/teams`, `/api/positions`)

#### 4.1 Departments Endpoints
- **`GET /api/departments`**: Returns all departments `[{ id, name, description?, managerId? }]`.
- **`POST /api/departments`**:
  - Request Body: `{ "name": "XR Hardware Systems", "description": "Optical tracking and haptics" }`
  - Response: `{ id, name, description }`
- **`PUT /api/departments/:id`**:
  - Request Body: `{ "name": "Spatial Labs", "description": "Updated description" }`
- **`PATCH /api/departments/:id/archive`**:
  - Action: Archives department and unlinks from active queries.

#### 4.2 Teams Endpoints
- **`GET /api/teams`**: Returns all teams `[{ id, name, departmentId, leadId? }]`.
- **`POST /api/teams`**:
  - Request Body: `{ "name": "Optical Calibration", "departmentId": "660c1f2e...", "leadId": "660c1f2e..." }`
- **`PUT /api/teams/:id`**:
  - Request Body: `{ "name": "Optical & Sensors", "leadId": "660c1f2e..." }`
- **`PATCH /api/teams/:id/archive`**:
  - Action: Archives team.

#### 4.3 Positions Endpoints
- **`GET /api/positions`**: Returns all positions `[{ id, name, departmentId, level, description? }]`.
  - `level` values: `"Intern" | "Junior" | "Mid-Level" | "Senior" | "Lead" | "Head" | "Custom"`
- **`POST /api/positions`**:
  - Request Body: `{ "name": "XR Firmware Specialist", "departmentId": "660c1f2e...", "level": "Senior", "description": "..." }`
- **`PUT /api/positions/:id`**:
  - Request Body: `{ "name": "Staff XR Specialist", "level": "Lead", "description": "..." }`
- **`PATCH /api/positions/:id/archive`**:
  - Action: Archives position.

---

### Module 5: Time & Attendance Command Center (`/api/attendance`)

#### 5.1 Fetch Attendance Timesheet Logs
- **Endpoint**: `GET /api/attendance`
- **Auth**: Bearer JWT
- **Permissions**: `attendance.view.own`, `attendance.view.team`, `attendance.view.department`
- **Query Params**: `limit=100`, `page?`, `employeeId?`, `date?`
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f34590",
      "_id": "660c1f2e4b8d9a0012f34590",
      "employeeId": "660c1f2e4b8d9a0012f34580",
      "date": "2026-10-12",
      "checkInAt": "2026-10-12T09:05:00.000Z",
      "checkOutAt": null,
      "breaks": [
        { "start": "2026-10-12T13:00:00.000Z", "end": "2026-10-12T13:45:00.000Z" }
      ],
      "status": "Working",
      "location": { "address": "Bengaluru Spatial Lab HQ" }
    }
  ]
  ```

---

#### 5.2 Fetch Current Employee's Today Shift Status
- **Endpoint**: `GET /api/attendance/me/today`
- **Auth**: Bearer JWT
- **Component**: `DashboardPage.tsx`, `AttendancePage.tsx`, `appStore.ts` (`fetchTodayAttendance`)
- **Success Response (200 OK — Active Session)**:
  ```json
  {
    "id": "660c1f2e4b8d9a0012f34590",
    "employeeId": "660c1f2e4b8d9a0012f34580",
    "date": "2026-10-12",
    "checkInAt": "2026-10-12T09:05:00.000Z",
    "checkOutAt": null,
    "status": "Working",
    "location": { "address": "Bengaluru Spatial Lab HQ" }
  }
  ```
- **Success Response (200 OK — Not Clocked In)**:
  ```json
  null
  ```
  *(Returns HTTP 200 with `null` or `{ "status": "Checked Out" }`)*

---

#### 5.3 Clock In (Check-In)
- **Endpoint**: `POST /api/attendance/check-in/:employeeId`
- **Auth**: Bearer JWT
- **Request Body**:
  ```json
  {
    "location": { "address": "Bengaluru Spatial Lab HQ", "lat": 12.9716, "lng": 77.5946 }
  }
  ```
- **Success Response (200 OK / 201 Created)**:
  ```json
  {
    "success": true,
    "attendance": {
      "id": "660c1f2e4b8d9a0012f34590",
      "employeeId": "660c1f2e4b8d9a0012f34580",
      "date": "2026-10-12",
      "checkInAt": "2026-10-12T09:05:00.000Z",
      "status": "Working"
    }
  }
  ```
- **Validation**: Rejects if already clocked in today.

---

#### 5.4 Clock Out (Check-Out)
- **Endpoint**: `POST /api/attendance/check-out/:employeeId`
- **Auth**: Bearer JWT
- **Request Body**:
  ```json
  {
    "location": { "address": "Bengaluru Spatial Lab HQ" }
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "attendance": {
      "id": "660c1f2e4b8d9a0012f34590",
      "checkOutAt": "2026-10-12T17:30:00.000Z",
      "status": "Checked Out"
    }
  }
  ```

---

#### 5.5 Break Management
- **Take Break**: `POST /api/attendance/break-start/:employeeId`
  - Transitions `status` to `"On Break"`. Appends new item to `breaks` array with `{ start: now }`.
- **End Break**: `POST /api/attendance/break-end/:employeeId`
  - Transitions `status` back to `"Working"`. Closes open break in `breaks` array with `{ end: now }`.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "status": "On Break" | "Working"
  }
  ```

---

### Module 6: Leave & Absence Management (`/api/leave`)

#### 6.1 List Leave Requests
- **Endpoint**: `GET /api/leave`
- **Auth**: Bearer JWT
- **Query Params**: `limit=100`, `page?`
- **Component**: `LeavePage.tsx`, `appStore.ts` (`fetchAllData`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f34595",
      "_id": "660c1f2e4b8d9a0012f34595",
      "employeeId": "660c1f2e4b8d9a0012f34580",
      "leaveType": "Sick",
      "startDate": "2026-10-20",
      "endDate": "2026-10-22",
      "reason": "Medical appointment and recovery",
      "status": "Pending",
      "createdAt": "2026-10-12T14:00:00.000Z"
    }
  ]
  ```

---

#### 6.2 Apply for Leave
- **Endpoint**: `POST /api/leave`
- **Auth**: Bearer JWT
- **Permissions**: `leave.apply`
- **Component**: `LeavePage.tsx`, `appStore.ts` (`addLeaveRequest`)
- **Request Body**:
  ```json
  {
    "employeeId": "660c1f2e4b8d9a0012f34580",
    "leaveType": "Casual",
    "startDate": "2026-10-25",
    "endDate": "2026-10-26",
    "reason": "Family engagement"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "leaveRequest": { "id": "660c1f2e4b8d9a0012f34596", "status": "Pending", ... }
  }
  ```

---

#### 6.3 Review Leave Request (Approve / Reject)
- **Endpoint**: `PATCH /api/leave/:id/review`
- **Auth**: Bearer JWT
- **Permissions**: `leave.review`
- **Component**: `LeavePage.tsx`, `appStore.ts` (`updateLeaveStatus`)
- **Request Body**:
  ```json
  {
    "status": "Approved",
    "note": "Approved by Operations Manager"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Leave request approved."
  }
  ```

---

### Module 7: Work Schedules (`/api/schedules`)

#### 7.1 List Schedules
- **Endpoint**: `GET /api/schedules`
- **Auth**: Bearer JWT
- **Component**: `SchedulesPage.tsx`, `appStore.ts` (`fetchAllData`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f34599",
      "_id": "660c1f2e4b8d9a0012f34599",
      "name": "Standard XR Operations",
      "startTime": "09:00",
      "endTime": "17:00",
      "workDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    }
  ]
  ```

#### 7.2 Create Schedule
- **Endpoint**: `POST /api/schedules`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`, `Admin`, `Manager`
- **Component**: `SchedulesPage.tsx`, `appStore.ts` (`addSchedule`)
- **Request Body**:
  ```json
  {
    "name": "Evening Haptics Shift",
    "startTime": "14:00",
    "endTime": "22:00",
    "workDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "schedule": { "id": "660c1f2e...", "name": "Evening Haptics Shift" }
  }
  ```

---

### Module 8: Sprint Tasks & Kanban Board (`/api/tasks`)

#### 8.1 List Tasks
- **Endpoint**: `GET /api/tasks`
- **Auth**: Bearer JWT
- **Query Params**: `limit=100`, `assignedTo?`, `status?`
- **Component**: `TasksPage.tsx`, `appStore.ts` (`fetchAllData`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f345a1",
      "_id": "660c1f2e4b8d9a0012f345a1",
      "title": "Calibrate optical sensor latency",
      "description": "Test sub-10ms frame capture over Wi-Fi 6E pipeline.",
      "assignedTo": "660c1f2e4b8d9a0012f34580",
      "status": "In Progress",
      "priority": "Urgent",
      "dueDate": "2026-10-18"
    }
  ]
  ```

#### 8.2 Create Task
- **Endpoint**: `POST /api/tasks`
- **Auth**: Bearer JWT
- **Permissions**: `tasks.manage`
- **Component**: `TasksPage.tsx`, `appStore.ts` (`addTask`)
- **Request Body**:
  ```json
  {
    "title": "Build WebXR shader fallback",
    "description": "Ensure Three.js pipeline degrades gracefully on Quest 2.",
    "assignedTo": "660c1f2e4b8d9a0012f34580",
    "priority": "High",
    "dueDate": "2026-10-22"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "task": { "id": "660c1f2e4b8d9a0012f345a2", "title": "Build WebXR shader fallback", "status": "To Do" }
  }
  ```

#### 8.3 Update Task
- **Endpoint**: `PUT /api/tasks/:id`
- **Auth**: Bearer JWT
- **Permissions**: `tasks.manage`
- **Component**: `EditTaskModal.tsx`, `appStore.ts` (`updateTask`)
- **Request Body**:
  ```json
  {
    "title": "Build WebXR shader fallback v2",
    "description": "Updated shader optimization notes",
    "assignedTo": "660c1f2e4b8d9a0012f34580",
    "priority": "Medium",
    "dueDate": "2026-10-25"
  }
  ```

#### 8.4 Transition Task Status
- **Endpoint**: `PATCH /api/tasks/:id/status`
- **Auth**: Bearer JWT
- **Permissions**: `tasks.status`
- **Component**: `TasksPage.tsx`, `appStore.ts` (`updateTaskStatus`)
- **Request Body**:
  ```json
  {
    "status": "Done"
  }
  ```
  *(Status enum: `"To Do" | "In Progress" | "Blocked" | "Done" | "Cancelled"`)*

#### 8.5 Delete Task
- **Endpoint**: `DELETE /api/tasks/:id`
- **Auth**: Bearer JWT
- **Permissions**: `tasks.manage`
- **Component**: `TasksPage.tsx`, `appStore.ts` (`deleteTask`)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

---

### Module 9: Weekly Shift Reports & File Uploads (`/api/reports`)

#### 9.1 List Weekly Reports
- **Endpoint**: `GET /api/reports`
- **Auth**: Bearer JWT
- **Query Params**: `page=1`, `limit=20`
- **Component**: `ReportsPage.tsx` (`fetchReports`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f345b1",
      "_id": "660c1f2e4b8d9a0012f345b1",
      "employeeId": {
        "_id": "660c1f2e4b8d9a0012f34580",
        "firstName": "Ravi",
        "lastName": "Kumar",
        "email": "ravi@safevitals.com"
      },
      "weekStartDate": "2026-10-05",
      "weekEndDate": "2026-10-11",
      "workedOn": "Finished spatial gesture recognition benchmarks.",
      "completed": "Integrated WebGL canvas overlays.",
      "blockers": "None",
      "nextWeekPlan": "Deploy WebSocket telemetry pipeline.",
      "status": "Approved",
      "reviewMessage": "Great sprint progress.",
      "attachments": [
        {
          "id": "att_1",
          "name": "benchmark_run_log.pdf",
          "url": "https://storage.safevitals.in/reports/benchmark_run_log.pdf",
          "size": 240582
        }
      ],
      "createdAt": "2026-10-11T18:00:00.000Z"
    }
  ]
  ```

#### 9.2 Submit Weekly Report with Multipart File Upload
- **Endpoint**: `POST /api/reports`
- **Auth**: Bearer JWT
- **Content-Type**: `multipart/form-data`
- **Component**: `ReportsPage.tsx` (`handleCreateReport`)
- **Form Fields**:
  - `weekStartDate`: `"2026-10-12"`
  - `weekEndDate`: `"2026-10-18"`
  - `workedOn`: `"Haptic feedback motor calibration"`
  - `completed`: `"Milestones 1 & 2 completed"`
  - `blockers`: `"None"`
  - `nextWeekPlan`: `"Prepare test suite for beta hardware"`
- **File Field**: `files` (Binary upload)
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "report": {
      "id": "660c1f2e4b8d9a0012f345b2",
      "status": "Submitted"
    }
  }
  ```

#### 9.3 Review Weekly Report
- **Endpoint**: `PATCH /api/reports/:id/review`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`, `Manager`
- **Component**: `ReportsPage.tsx` (`handleReview`)
- **Request Body**:
  ```json
  {
    "status": "Approved",
    "reviewMessage": "Approved by engineering lead"
  }
  ```
  *(Status enum: `"Approved" | "Needs Revision"`)*

---

### Module 10: Support & Helpdesk Tickets (`/api/tickets`)

#### 10.1 List Support Tickets
- **Endpoint**: `GET /api/tickets`
- **Auth**: Bearer JWT
- **Query Params**: `limit=100`
- **Component**: `TicketsPage.tsx`, `appStore.ts` (`fetchAllData`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f345c1",
      "_id": "660c1f2e4b8d9a0012f345c1",
      "title": "XR Headset Drift Issue",
      "description": "Right eye display flickers during 90fps rendering on DevKit 3.",
      "createdBy": "660c1f2e4b8d9a0012f34580",
      "category": "XR Hardware",
      "priority": "High",
      "status": "Open",
      "createdAt": "2026-10-12T11:00:00.000Z"
    }
  ]
  ```

#### 10.2 Raise Support Ticket
- **Endpoint**: `POST /api/tickets`
- **Auth**: Bearer JWT
- **Permissions**: `tickets.create`
- **Component**: `TicketsPage.tsx`, `appStore.ts` (`addTicket`)
- **Request Body**:
  ```json
  {
    "title": "Need second spatial tracker unit",
    "description": "Required for dual-hand haptic sync testing.",
    "category": "XR Hardware",
    "priority": "High",
    "createdBy": "660c1f2e4b8d9a0012f34580"
  }
  ```
  *(Category enum: `"IT Support" | "HR" | "Facilities" | "XR Hardware" | "Other"`)*  
  *(Priority enum: `"Low" | "Medium" | "High" | "Urgent"`)*
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "ticket": { "id": "660c1f2e...", "status": "Open" }
  }
  ```

#### 10.3 Resolve Support Ticket
- **Endpoint**: `PATCH /api/tickets/:id/resolve`
- **Auth**: Bearer JWT
- **Component**: `TicketsPage.tsx`, `appStore.ts` (`resolveTicket`)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "ticket": { "id": "660c1f2e...", "status": "Resolved" }
  }
  ```

---

### Module 11: Role-Based Access Control (`/api/roles`)

#### 11.1 List Roles
- **Endpoint**: `GET /api/roles`
- **Auth**: Bearer JWT
- **Component**: `RolesPage.tsx`, `appStore.ts` (`fetchAllData`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "role_1",
      "_id": "660c1f2e4b8d9a0012f345d1",
      "name": "Super Admin",
      "description": "Unrestricted administrative command over workforce and security settings.",
      "isSystem": true,
      "permissions": ["*.*.*"],
      "status": "Active",
      "userCount": 2,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "role_2",
      "_id": "660c1f2e4b8d9a0012f345d2",
      "name": "Manager",
      "description": "Departmental approvals, attendance review, and sprint tasks.",
      "isSystem": true,
      "permissions": [
        "employees.view",
        "attendance.view.team",
        "leave.review",
        "tasks.manage",
        "tasks.status"
      ],
      "status": "Active",
      "userCount": 8
    },
    {
      "id": "role_3",
      "_id": "660c1f2e4b8d9a0012f345d3",
      "name": "Employee",
      "description": "Standard workforce member terminal.",
      "isSystem": true,
      "permissions": [
        "attendance.view.own",
        "leave.apply",
        "tasks.view.own",
        "tasks.status",
        "tickets.create"
      ],
      "status": "Active",
      "userCount": 42
    }
  ]
  ```

#### 11.2 Create Role
- **Endpoint**: `POST /api/roles`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`
- **Component**: `RolesPage.tsx` (`handleSave`)
- **Request Body**:
  ```json
  {
    "name": "Spatial QA Lead",
    "description": "Hardware tester with ticket and task management powers",
    "permissions": ["tasks.manage", "tickets.create", "reports.view"]
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "role": { "id": "660c1f2e...", "name": "Spatial QA Lead" }
  }
  ```

#### 11.3 Update Role
- **Endpoint**: `PUT /api/roles/:id`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`
- **Component**: `RolesPage.tsx` (`handleSave`)
- **Request Body**:
  ```json
  {
    "name": "Spatial QA Lead",
    "description": "Updated description",
    "permissions": ["tasks.manage", "tickets.create", "attendance.view.team"]
  }
  ```

#### 11.4 Delete Role
- **Endpoint**: `DELETE /api/roles/:id`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`
- **Component**: `RolesPage.tsx` (`handleDelete`)
- **Business Rule**: System roles (`isSystem: true`) cannot be deleted.

---

### Module 12: Elevated Access Requests (`/api/access-requests`)

#### 12.1 List Access Requests
- **Endpoint**: `GET /api/access-requests`
- **Auth**: Bearer JWT
- **Query Params**: `limit=50`
- **Component**: `AccessRequestsPage.tsx`, `appStore.ts` (`fetchAccessRequests`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f345e1",
      "_id": "660c1f2e4b8d9a0012f345e1",
      "employeeId": "660c1f2e4b8d9a0012f34580",
      "requestedSystem": "Spatial Production Cluster A",
      "reason": "Need SSH root access for sensor daemon debugging.",
      "status": "Pending",
      "createdAt": "2026-10-12T15:00:00.000Z"
    }
  ]
  ```

#### 12.2 Create Access Request
- **Endpoint**: `POST /api/access-requests`
- **Auth**: Bearer JWT
- **Component**: `AccessRequestsPage.tsx` (`handleCreate`)
- **Request Body**:
  ```json
  {
    "requestedSystem": "Spatial Production Cluster A",
    "reason": "Need SSH root access for sensor daemon debugging."
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "accessRequest": { "id": "660c1f2e...", "status": "Pending" }
  }
  ```

#### 12.3 Review Access Request
- **Endpoint**: `PATCH /api/access-requests/:id/review`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`, `Admin`
- **Component**: `AccessRequestsPage.tsx`, `appStore.ts` (`reviewAccessRequest`)
- **Request Body**:
  ```json
  {
    "status": "Approved",
    "note": "Granted 48h ephemeral access token"
  }
  ```

---

### Module 13: Security Audit Trail (`/api/audit`)

#### 13.1 Fetch Audit Ledger
- **Endpoint**: `GET /api/audit`
- **Auth**: Bearer JWT
- **Permissions**: `Super Admin`, `Admin`, `audit.view`
- **Query Params**: `limit=50`
- **Component**: `AuditLogsPage.tsx`, `appStore.ts` (`fetchAuditLogs`)
- **Success Response (200 OK)**:
  ```json
  [
    {
      "id": "660c1f2e4b8d9a0012f345f1",
      "_id": "660c1f2e4b8d9a0012f345f1",
      "userId": "660c1f2e4b8d9a0012f34580",
      "action": "Updated Employee Record",
      "details": "Assigned employee EMP-000002 to Engineering department",
      "timestamp": "2026-10-12T15:30:00.000Z"
    }
  ]
  ```
- **Business Rule**: Audit records are immutable. No `PUT`, `PATCH`, or `DELETE` endpoints exist for this resource.
