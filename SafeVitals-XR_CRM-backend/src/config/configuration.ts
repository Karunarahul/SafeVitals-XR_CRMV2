export default () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  host: process.env.HOST || '0.0.0.0',
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/safevitals_crm',
  },
  jwt: {
    secret:
      process.env.JWT_SECRET ||
      'safevitals-dev-super-secret-key-change-in-production-min32chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'safevitals-dev-refresh-secret-key-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  cors: {
    origins: (
      process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.SMTP_PORT, 10) || 2525,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from:
      process.env.SMTP_FROM || '"SafeVitals XR CRM" <noreply@safevitals.com>',
  },
  upload: {
    dest: process.env.UPLOAD_DEST || './uploads',
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@safevitals.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'AdminPassword123!',
    adminName: process.env.SEED_ADMIN_NAME || 'System Administrator',
  },
});
