# SafeVitals XR CRM Backend — Production Deployment Guide for Render

**Document:** `docs/DEPLOYMENT.md`  
**Target Platform:** [Render](https://render.com) (Web Service with Persistent Disk)  
**Database:** MongoDB Atlas (Mongoose)  
**Runtime:** Node.js v20+ / NestJS  

---

## 1. Overview & Architecture

The SafeVitals XR CRM backend is built as a production-grade, standalone NestJS service. It binds to `0.0.0.0`, reads Render's dynamic `PORT` environment variable (defaults to `10000`), exposes API endpoints prefixed with `/api`, and provides native liveness and database readiness probes.

### Deployment Parameters:
| Setting | Value |
| :--- | :--- |
| **Runtime Environment** | Node.js (Node 20+) |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start:prod` |
| **Global API Prefix** | `/api` |
| **Liveness Check Path** | `/api/health` |
| **Readiness Check Path** | `/api/health/ready` (Verifies MongoDB Atlas connectivity) |
| **Persistent Disk Mount** | `/var/data/uploads` (10 GB) |

---

## 2. Prerequisites & MongoDB Atlas Setup

Before creating the Render service, ensure your MongoDB Atlas cluster is provisioned and configured:

### Step 1: Create a MongoDB Atlas Database User
1. Log into your [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Under **Security** > **Database Access**, click **Add New Database User**.
3. Choose **Password** authentication.
4. Set a strong username (e.g. `safevitals_app`) and generate a secure password.
5. Under **Database User Privileges**, select **Read and write to any database** (or restrict to `safevitals_crm`).
6. Click **Add User**.

### Step 2: Configure Atlas Network Access (IP Whitelist)
Render services use dynamic egress IP addresses.
1. Under **Security** > **Network Access**, click **Add IP Address**.
2. Click **Allow Access from Anywhere** (`0.0.0.0/0`).
3. Add a description like `Render Web Services`.
4. Click **Confirm**.

### Step 3: Obtain your Connection String
1. Under **Deployment** > **Database**, click **Connect**.
2. Select **Drivers** (Node.js).
3. Copy the SRV connection URI:
   ```
   mongodb+srv://safevitals_app:<password>@cluster0.xxxxx.mongodb.net/safevitals_crm?retryWrites=true&w=majority
   ```
4. Replace `<password>` with the password created in Step 1.

---

## 3. Deployment Method A: Blueprint Deployment via `render.yaml` (Recommended)

The repository includes a verified [`render.yaml`](file:///f:/SafeVitalsXR_K/CRM/SafeVitals-XR_CRM-front-main%20(1)/render.yaml) blueprint specification that automatically configures build scripts, health checks, environment variables, and persistent disk.

### Step-by-Step Instructions:
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: prepare SafeVitals XR CRM backend for Render deployment"
   git push origin main
   ```
2. Log into the [Render Dashboard](https://dashboard.render.com/).
3. Click **Blueprints** in the top navigation bar.
4. Click **New Blueprint Instance**.
5. Connect your GitHub repository:
   - Select the repository containing SafeVitals XR CRM.
   - Branch: `main`.
6. Render will automatically read `render.yaml` and discover the `safevitals-xr-crm-backend` service.
7. Fill in the required **Sync: False** environment variables (prompted in the UI):
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `CORS_ORIGINS`: Comma-separated list of allowed frontend domains (e.g. `https://crm.safevitals.com`).
   - `SMTP_HOST`: (Optional) e.g. `smtp.sendgrid.net`.
   - `SMTP_USER`: (Optional) e.g. `apikey`.
   - `SMTP_PASS`: (Optional) Your SMTP API key or password.
8. Click **Apply**.
9. Render will provision the service, attach the persistent disk, run `npm install && npm run build`, and start `node dist/main`.

---

## 4. Deployment Method B: Manual Web Service Creation

If you prefer to configure the Web Service manually in the Render dashboard:

1. In Render Dashboard, click **New +** > **Web Service**.
2. Select **Build and deploy from a Git repository** and connect your GitHub repo.
3. Configure the service settings:
   - **Name**: `safevitals-xr-crm-backend`
   - **Region**: Select the region closest to your MongoDB Atlas cluster (e.g., `Oregon (US West)` or `Frankfurt (EU Central)`).
   - **Branch**: `main`
   - **Root Directory**: `SafeVitals-XR_CRM-backend` (if deploying from monorepo) or leave blank if deploying from standalone repo.
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Instance Type**: `Standard` (Recommended for production) or `Starter`
4. Expand **Advanced** settings:
   - **Health Check Path**: `/api/health/ready`
   - **Auto-Deploy**: `Yes`
5. Under **Disks**, click **Add Disk**:
   - **Name**: `uploads-data`
   - **Mount Path**: `/var/data/uploads`
   - **Size**: `10 GB`
6. Add the environment variables listed in Section 5.
7. Click **Create Web Service**.

---

## 5. Required Environment Variables Reference

The following environment variables must be configured on Render:

| Variable Name | Required | Example / Recommended Value | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` | Enables production security mode (suppresses stack traces, enforces secrets). |
| `PORT` | **Yes** | `10000` | Automatically supplied by Render; application binds to `0.0.0.0:${PORT}`. |
| `HOST` | **Yes** | `0.0.0.0` | Binds to all network interfaces so Render can forward traffic. |
| `MONGODB_URI` | **Yes** | `mongodb+srv://user:pass@cluster.mongodb.net/safevitals_crm?retryWrites=true&w=majority` | Connection string to MongoDB Atlas. |
| `JWT_SECRET` | **Yes** | `a8f9c1e2d4b5061738495a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d` | High-entropy signing secret (minimum 32 characters). Generated automatically if using `render.yaml`. |
| `JWT_EXPIRES_IN` | **Yes** | `1d` | Lifetime of access tokens. |
| `JWT_REFRESH_SECRET` | **Yes** | `b1c2d3e4f5a60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e` | Refresh token signing secret. |
| `JWT_REFRESH_EXPIRES_IN` | **Yes** | `7d` | Lifetime of refresh tokens. |
| `CORS_ORIGINS` | **Yes** | `https://crm.safevitals.com,https://safevitals-crm.onrender.com` | Comma-separated list of permitted frontend domain origins. |
| `UPLOAD_DEST` | **Yes** | `/var/data/uploads` | Path to persistent disk for report attachments. |
| `SMTP_HOST` | No | `smtp.sendgrid.net` | Outgoing email server host. |
| `SMTP_PORT` | No | `587` | Outgoing email server port. |
| `SMTP_USER` | No | `apikey` | SMTP username. |
| `SMTP_PASS` | No | `<your-sendgrid-or-ses-api-key>` | SMTP password. |
| `SMTP_FROM` | No | `"SafeVitals XR CRM" <noreply@safevitals.com>` | Default sender address. |
| `SMTP_STRICT` | No | `true` | When true, logs and throws if mail dispatch fails in production. |
| `SEED_ADMIN_EMAIL` | No | `admin@safevitals.com` | Email for initial bootstrap admin. |
| `SEED_ADMIN_PASSWORD` | No | `<strong-initial-password>` | Initial password for bootstrap admin (rotated on first login). |

---

## 6. Initial Administrator Bootstrap

Administrator accounts **cannot** be registered through public endpoints. To provision your initial Super Administrator:

### Option A: Using Render Shell
1. In the Render Dashboard, navigate to your `safevitals-xr-crm-backend` service.
2. In the left sidebar, click **Shell**.
3. Run the bootstrap runner:
   ```bash
   SEED_ADMIN_EMAIL="admin@safevitals.com" \
   SEED_ADMIN_PASSWORD="YourStrongAdminPassword123!" \
   SEED_ADMIN_NAME="System Administrator" \
   npm run seed:admin
   ```
4. The script creates the initial administrator and roles idempotently:
   ```
   [DatabaseSeeder] Successfully provisioned initial system administrator: admin@safevitals.com
   ```
5. Log into the CRM frontend using `admin@safevitals.com` and your chosen password.

---

## 7. Post-Deployment Health Verification

Once Render displays **Service is live**, run the following validation checks:

### 1. Check Liveness Endpoint
```bash
curl -I https://<your-render-service-url>.onrender.com/api/health
```
**Expected Response:**
```http
HTTP/2 200
content-type: application/json; charset=utf-8
x-correlation-id: req_xxxxxxxxxxxxxxxxxxxxxxxx
```
```json
{
  "status": "ok",
  "uptime": 45.2,
  "timestamp": "2026-10-12T14:45:00.000Z"
}
```

### 2. Check Database Readiness Endpoint
```bash
curl -i https://<your-render-service-url>.onrender.com/api/health/ready
```
**Expected Response:**
```http
HTTP/2 200
content-type: application/json; charset=utf-8
```
```json
{
  "status": "ok",
  "timestamp": "2026-10-12T14:45:00.000Z",
  "details": {
    "database": {
      "status": "up",
      "name": "safevitals_crm"
    }
  }
}
```

### 3. Check Interactive Swagger Documentation
Open in browser:
```
https://<your-render-service-url>.onrender.com/api/docs
```

---

## 8. Troubleshooting & Common Issues

| Symptom | Probable Cause | Remediation |
| :--- | :--- | :--- |
| **Render Build Fails** | Node.js version mismatch or missing dependencies | Verify Render is using Node 20+. The build command must be `npm install && npm run build`. |
| **Readiness returns HTTP 503** | MongoDB Atlas is disconnected or unreachable | Verify `MONGODB_URI` credentials. Verify MongoDB Atlas Network Access has `0.0.0.0/0` whitelisted. |
| **`[CONFIG_ERROR]` at startup** | `JWT_SECRET` is too short or missing | Ensure `JWT_SECRET` in Render Environment is at least 32 characters long. |
| **CORS error in frontend browser** | Frontend URL not in `CORS_ORIGINS` | Add your frontend's exact origin (e.g. `https://crm.safevitals.com`) to `CORS_ORIGINS` in Render settings. |
| **Uploads missing after restart** | Ephemeral file system overwritten | Ensure a Persistent Disk is mounted at `/var/data/uploads` and `UPLOAD_DEST=/var/data/uploads`. |
| **Email verification errors** | Missing SMTP credentials | In development/staging, SMTP failures log gracefully. In production, provide valid credentials for SendGrid or AWS SES. |
