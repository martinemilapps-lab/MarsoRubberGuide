import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

export interface ServerConfig {
  isProduction: boolean;
  isVercel: boolean;
  port: number;
  sessionSecret: string;
  adminPassword: string;
  accessCodeSecret: string;
  allowedOrigins: string[];
  tursoUrl: string;
  tursoAuthToken: string;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  geminiApiKey: string;
}

let validatedConfig: ServerConfig | null = null;

export function resetConfigCache(): void {
  validatedConfig = null;
}

export function getServerConfig(): ServerConfig {
  if (validatedConfig) {
    return validatedConfig;
  }

  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const isVercel = Boolean(process.env.VERCEL);

  const rawSessionSecret = process.env.SESSION_SECRET;
  const rawAdminPassword = process.env.ADMIN_PASSWORD;
  const rawAccessCodeSecret = process.env.ACCESS_CODE_SECRET;
  const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const rawTursoUrl = process.env.TURSO_DATABASE_URL;
  const rawTursoAuthToken = process.env.TURSO_AUTH_TOKEN;
  const rawR2AccountId = process.env.R2_ACCOUNT_ID;
  const rawR2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const rawR2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const rawGeminiKey = process.env.GEMINI_API_KEY;

  if (isProduction) {
    if (!rawSessionSecret || rawSessionSecret.length < 32 || rawSessionSecret.includes("your_") || rawSessionSecret.includes("GENERATE_")) {
      throw new Error("[FATAL SECURITY CONFIG ERROR] SESSION_SECRET must be configured and at least 32 characters in production.");
    }
    if (!rawAdminPassword || rawAdminPassword.length < 8 || rawAdminPassword.includes("your_") || rawAdminPassword.includes("SET_")) {
      throw new Error("[FATAL SECURITY CONFIG ERROR] ADMIN_PASSWORD must be configured and at least 8 characters in production.");
    }
    if (!rawAccessCodeSecret || rawAccessCodeSecret.length < 32 || rawAccessCodeSecret.includes("your_") || rawAccessCodeSecret.includes("GENERATE_")) {
      throw new Error("[FATAL SECURITY CONFIG ERROR] ACCESS_CODE_SECRET must be configured and at least 32 characters in production.");
    }
  }

  const sessionSecret = rawSessionSecret || crypto.randomBytes(32).toString("hex");
  const adminPassword = rawAdminPassword || crypto.randomBytes(16).toString("hex");
  const accessCodeSecret = rawAccessCodeSecret || crypto.randomBytes(32).toString("hex");

  const allowedOrigins = (rawAllowedOrigins || "")
    .split(",")
    .map(o => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

  validatedConfig = {
    isProduction,
    isVercel,
    port: parseInt(process.env.PORT || "3000", 10),
    sessionSecret,
    adminPassword,
    accessCodeSecret,
    allowedOrigins,
    tursoUrl: (rawTursoUrl || "").trim(),
    tursoAuthToken: (rawTursoAuthToken || "").trim(),
    r2AccountId: (rawR2AccountId || "").trim(),
    r2AccessKeyId: (rawR2AccessKeyId || "").trim(),
    r2SecretAccessKey: (rawR2SecretAccessKey || "").trim(),
    r2BucketName: (process.env.R2_BUCKET_NAME || "marso-photos").trim(),
    r2PublicUrl: (process.env.R2_PUBLIC_URL || "").trim().replace(/\/$/, ""),
    geminiApiKey: (rawGeminiKey || "").trim()
  };

  return validatedConfig;
}
