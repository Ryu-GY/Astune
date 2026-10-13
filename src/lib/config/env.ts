export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Astune",
  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
  adminBootstrapEmail: process.env.ADMIN_BOOTSTRAP_EMAIL || "admin@astune.local",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db"
};
