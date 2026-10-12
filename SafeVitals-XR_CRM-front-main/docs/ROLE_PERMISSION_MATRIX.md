# SafeVitals XR CRM — Role & Permission Matrix (RBAC)

> **Format**: `MODULE.ACTION.SCOPE`  
> **Scopes**: `own` | `team` | `department` | `organization`

---

## 1. Permission Catalog (Granular System Permissions)

| Permission ID | Module | Label | Description |
| :--- | :--- | :--- | :--- |
| `*.*.*` | Global | Super Administrator Wildcard | Unrestricted access across all workspace endpoints and security settings |
| `employees.view` | Employees | View Directory | Access workforce member directory and profiles |
| `employees.create` | Employees | Create / Invite | Send onboarding invitations, create staff, onboard via Firebase UID |
| `employees.edit` | Employees | Edit Profile | Modify employee department, team, position, and contact info |
| `employees.suspend` | Employees | Suspend / Deactivate | Toggle account suspensions, reactivations, and permanent deactivation |
| `employees.export` | Employees | Export CSV | Download organizational employee roster as CSV |
| `attendance.view.own` | Attendance | View Own Attendance | View personal daily punch history and active session |
| `attendance.view.team` | Attendance | View Team Attendance | Access attendance logs across team direct reports |
| `attendance.view.department` | Attendance | View Department Logs | Access full departmental presence reports and timesheets |
| `attendance.edit` | Attendance | Manual Override | Adjust or override clock times on timesheets |
| `leave.apply` | Leave | Apply for Leave | Submit personal time-off requests |
| `leave.review` | Leave | Review Leave Requests | Approve or reject team leave applications |
| `leave.manage` | Leave | Manage Allowances | Configure company-wide leave balances and rules |
| `tasks.view.own` | Tasks | View Assigned Tasks | View personal sprint items on Kanban board |
| `tasks.manage` | Tasks | Manage Tasks | Create, edit, and assign tasks to staff |
| `tasks.status` | Tasks | Update Task Status | Transition tasks across Kanban columns (To Do -> In Progress -> Done) |
| `reports.submit` | Reports | Submit Weekly Report | Submit weekly shift report deliverables and attachments |
| `reports.review` | Reports | Review Weekly Reports | Mark reports as Approved or Needs Revision |
| `tickets.create` | Tickets | Raise Support Ticket | Raise technical, hardware, or facilities support tickets |
| `tickets.resolve` | Tickets | Resolve Support Ticket | Mark helpdesk tickets as Resolved or Closed |
| `access.request` | Access | Request Privileged Access| Submit requests for elevated server or hardware credentials |
| `access.review` | Access | Review Access Requests | Grant or reject elevated access requests |
| `security.manage` | Security | Security Governance | Manage MFA policies, password rules, and session timeout |
| `audit.view` | Audit | View Audit Ledger | Inspect tamper-evident system audit trail |

---

## 2. Default System Roles & Permission Allocation

SafeVitals XR CRM ships with 3 seeded System Roles that cannot be deleted (`isSystem: true`):

```json
[
  {
    "id": "role_1",
    "name": "Super Admin",
    "isSystem": true,
    "permissions": ["*.*.*"]
  },
  {
    "id": "role_2",
    "name": "Manager",
    "isSystem": true,
    "permissions": [
      "employees.view",
      "attendance.view.own",
      "attendance.view.team",
      "attendance.view.department",
      "leave.apply",
      "leave.review",
      "tasks.view.own",
      "tasks.manage",
      "tasks.status",
      "reports.submit",
      "reports.review",
      "tickets.create",
      "tickets.resolve",
      "access.request"
    ]
  },
  {
    "id": "role_3",
    "name": "Employee",
    "isSystem": true,
    "permissions": [
      "employees.view",
      "attendance.view.own",
      "leave.apply",
      "tasks.view.own",
      "tasks.status",
      "reports.submit",
      "tickets.create",
      "access.request"
    ]
  }
]
```

---

## 3. Route & Endpoint Access Matrix

| Endpoint Path | HTTP Method | Minimum Required Role / Permission | Public / Protected |
| :--- | :--- | :--- | :--- |
| `/api/health` | GET | None | Public |
| `/api/auth/login` | POST | None | Public |
| `/api/auth/firebase-login` | POST | None | Public |
| `/api/auth/verify-otp` | POST | None | Public |
| `/api/auth/resend-otp` | POST | None | Public |
| `/api/auth/register` | POST | None | Public |
| `/api/auth/register/verify-otp` | POST | None | Public |
| `/api/auth/forgot-password` | POST | None | Public |
| `/api/auth/reset-password` | POST | None | Public |
| `/api/auth/setup-password` | POST | None | Public |
| `/api/auth/me` | GET | Authenticated User | Protected (Bearer) |
| `/api/auth/change-password` | POST | Authenticated User | Protected (Bearer) |
| `/api/auth/logout` | POST | Authenticated User | Protected (Bearer) |
| `/api/users/pending` | GET | `Super Admin`, `Admin`, `employees.create` | Protected (Bearer) |
| `/api/users/:id/approve` | POST | `Super Admin`, `Admin`, `employees.create` | Protected (Bearer) |
| `/api/employees` | GET | `employees.view` | Protected (Bearer) |
| `/api/employees/:id` | GET | `employees.view` (or own ID) | Protected (Bearer) |
| `/api/employees` | POST | `employees.create` | Protected (Bearer) |
| `/api/employees/onboard-uid`| POST | `employees.create` | Protected (Bearer) |
| `/api/employees/:id` | PUT | `employees.edit` | Protected (Bearer) |
| `/api/employees/:id/suspend` | PATCH | `employees.suspend` | Protected (Bearer) |
| `/api/employees/:id/reactivate` | PATCH | `employees.suspend` | Protected (Bearer) |
| `/api/employees/:id/deactivate` | PATCH | `employees.suspend` | Protected (Bearer) |
| `/api/departments` | GET | Authenticated User | Protected (Bearer) |
| `/api/departments` | POST | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/departments/:id` | PUT | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/departments/:id/archive` | PATCH | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/teams` | GET | Authenticated User | Protected (Bearer) |
| `/api/teams` | POST | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/teams/:id` | PUT | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/teams/:id/archive` | PATCH | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/positions` | GET | Authenticated User | Protected (Bearer) |
| `/api/positions` | POST | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/positions/:id` | PUT | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/positions/:id/archive` | PATCH | `Super Admin`, `Admin` | Protected (Bearer) |
| `/api/attendance` | GET | `attendance.view.own` (scoped to user) / `attendance.view.team` / `Super Admin` | Protected (Bearer) |
| `/api/attendance/me/today` | GET | Authenticated User | Protected (Bearer) |
| `/api/attendance/check-in/:id` | POST | Own ID or `attendance.edit` | Protected (Bearer) |
| `/api/attendance/check-out/:id`| POST | Own ID or `attendance.edit` | Protected (Bearer) |
| `/api/attendance/break-start/:id` | POST | Own ID or `attendance.edit` | Protected (Bearer) |
| `/api/attendance/break-end/:id` | POST | Own ID or `attendance.edit` | Protected (Bearer) |
| `/api/leave` | GET | Authenticated User (filtered by scope) | Protected (Bearer) |
| `/api/leave` | POST | `leave.apply` | Protected (Bearer) |
| `/api/leave/:id/review` | PATCH | `leave.review` (`Manager`, `Super Admin`) | Protected (Bearer) |
| `/api/schedules` | GET | Authenticated User | Protected (Bearer) |
| `/api/schedules` | POST | `Super Admin`, `Admin`, `Manager` | Protected (Bearer) |
| `/api/tasks` | GET | Authenticated User | Protected (Bearer) |
| `/api/tasks` | POST | `tasks.manage` | Protected (Bearer) |
| `/api/tasks/:id` | PUT | `tasks.manage` | Protected (Bearer) |
| `/api/tasks/:id/status` | PATCH | `tasks.status` (Assignee or Manager) | Protected (Bearer) |
| `/api/tasks/:id` | DELETE | `tasks.manage` (`Manager`, `Super Admin`) | Protected (Bearer) |
| `/api/reports` | GET | Authenticated User | Protected (Bearer) |
| `/api/reports` | POST | `reports.submit` | Protected (Bearer) |
| `/api/reports/:id/review` | PATCH | `reports.review` (`Manager`, `Super Admin`) | Protected (Bearer) |
| `/api/tickets` | GET | Authenticated User | Protected (Bearer) |
| `/api/tickets` | POST | `tickets.create` | Protected (Bearer) |
| `/api/tickets/:id/resolve` | PATCH | Creator, Assigned Staff, or `Manager` | Protected (Bearer) |
| `/api/roles` | GET | Authenticated User | Protected (Bearer) |
| `/api/roles` | POST | `Super Admin` | Protected (Bearer) |
| `/api/roles/:id` | PUT | `Super Admin` | Protected (Bearer) |
| `/api/roles/:id` | DELETE | `Super Admin` (Non-system roles only) | Protected (Bearer) |
| `/api/access-requests` | GET | Authenticated User | Protected (Bearer) |
| `/api/access-requests` | POST | `access.request` | Protected (Bearer) |
| `/api/access-requests/:id/review` | PATCH | `access.review` (`Super Admin`, `Admin`) | Protected (Bearer) |
| `/api/audit` | GET | `audit.view` (`Super Admin`, `Admin`) | Protected (Bearer) |
