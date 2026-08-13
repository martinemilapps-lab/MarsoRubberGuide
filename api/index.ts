import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createClient as createTursoClient } from "@libsql/client";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import productsData from "../products.json" with { type: "json" };

dotenv.config();

const currentFilename = typeof __filename !== "undefined" ? __filename : process.cwd();
const currentDirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(currentFilename);

const app = express();
const PORT = 3000;

// Production Environment Variables & Secrets
const SESSION_SECRET = process.env.SESSION_SECRET || "marso_secure_session_secret_key_2026_xyz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "marso_admin_2026";
const ACCESS_CODE_SECRET = process.env.ACCESS_CODE_SECRET || "marso_access_code_secret_key_2026_xyz";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "";

if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  if (!process.env.SESSION_SECRET) {
    console.warn("[SECURITY WARNING] SESSION_SECRET environment variable is missing in production!");
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.warn("[SECURITY WARNING] ADMIN_PASSWORD environment variable is missing in production!");
  }
  if (!process.env.ACCESS_CODE_SECRET) {
    console.warn("[SECURITY WARNING] ACCESS_CODE_SECRET environment variable is missing in production!");
  }
  if (!process.env.ALLOWED_ORIGINS) {
    console.warn("[SECURITY WARNING] ALLOWED_ORIGINS environment variable is missing in production!");
  }
}

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

// Strict CORS Middleware with Allowlist
const allowedOriginsList = ALLOWED_ORIGINS
  .split(",")
  .map(o => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

function isOriginAllowed(origin: string): boolean {
  if (!origin) return true; // Same-origin or non-browser requests
  const cleanOrigin = origin.trim().replace(/\/$/, "");

  // Non-production local development fallback
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
      return true;
    }
  }

  // Exact allowlist check in production / Vercel
  if (allowedOriginsList.length > 0) {
    return allowedOriginsList.includes(cleanOrigin);
  }

  return false;
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (isOriginAllowed(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Access-Code");
    } else {
      if (req.method === "OPTIONS") {
        return res.status(403).json({ error: "Forbidden: Origin not in CORS allowlist." });
      }
    }
  }
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// Restricted payload limits (Default 64 KB for standard requests)
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ limit: "64kb", extended: true }));

// Structured Audit Logging Architecture
interface AuditLogEvent {
  action: string;
  identity: string;
  role?: string;
  ip: string;
  resource?: string;
  result: "SUCCESS" | "FAILURE" | "DENIED";
  details?: string;
}

function logAuditEvent(event: AuditLogEvent) {
  const timestamp = new Date().toISOString();
  console.log(
    `[AUDIT LOG] [${timestamp}] Action: ${event.action} | Identity: ${event.identity} | Role: ${event.role || "anonymous"} | IP: ${event.ip} | Resource: ${event.resource || "N/A"} | Result: ${event.result}${event.details ? ` | Details: ${event.details}` : ""}`
  );
}

const PRODUCTS_FILE_PATH = process.env.VERCEL 
  ? path.join("/tmp", "products.json") 
  : path.join(process.cwd(), "products.json");

const CATEGORIES_FILE_PATH = process.env.VERCEL 
  ? path.join("/tmp", "categories.json") 
  : path.join(process.cwd(), "categories.json");

const DEFAULT_CATEGORIES = [
  "Reclaimed and Crumb Rubber",
  "Rubber Tile Flooring",
  "Rubber Mat Flooring",
  "Industrial Rubber Flooring",
  "Rubber Automotive Spare Parts",
  "Rubber Car Mats",
  "Constructive Rubber Industries",
  "Reverse Engineering"
];

// Turso SQLite Database setup
const tursoUrl = process.env.TURSO_DATABASE_URL || "";
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN || "";

const tursoDb = (tursoUrl && tursoAuthToken) ? createTursoClient({
  url: tursoUrl,
  authToken: tursoAuthToken,
}) : null;

let isTablesInitialized = false;

async function initTursoTables() {
  if (isTablesInitialized || !tursoDb) return;
  try {
    await tursoDb.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_ar TEXT,
        category TEXT NOT NULL,
        photo TEXT,
        extra_photos TEXT,
        specs TEXT,
        datasheet_file TEXT,
        datasheet_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await tursoDb.execute(`
      CREATE TABLE IF NOT EXISTS categories_meta (
        id TEXT PRIMARY KEY,
        categories_list TEXT NOT NULL
      );
    `);

    await tursoDb.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    isTablesInitialized = true;
  } catch (err) {
    console.error("[Turso DB Init Error]", err);
  }
}

// Cloudflare R2 Object Storage setup
const r2AccountId = process.env.R2_ACCOUNT_ID || "";
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID || "";
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
const r2BucketName = process.env.R2_BUCKET_NAME || "marso-photos";
const r2PublicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

const s3Client = (r2AccountId && r2AccessKeyId && r2SecretAccessKey) ? new S3Client({
  region: "auto",
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
}) : null;

// Refactored Trusted Remote Asset URL Validation Helper
function isTrustedRemoteAssetUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string" || !r2PublicUrl) return false;
  try {
    const targetUrl = new URL(urlStr);
    const publicUrl = new URL(r2PublicUrl);

    if (targetUrl.protocol !== "https:") return false;

    const host = targetUrl.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "169.254.169.254" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.")
    ) {
      return false;
    }

    if (targetUrl.origin.toLowerCase() !== publicUrl.origin.toLowerCase()) {
      return false;
    }

    const publicPath = publicUrl.pathname.replace(/\/$/, "");
    if (publicPath && !targetUrl.pathname.startsWith(publicPath)) {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Unified Asset & Payload Validation Helpers
const MAX_ASSET_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB limit

function parseDataUrl(value: string): { mimeType: string; buffer: Buffer } | null {
  if (!value || typeof value !== "string" || !value.startsWith("data:")) return null;
  const match = value.match(/^data:([a-zA-Z0-9-]+\/[a-zA-Z0-9-+.]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const mimeType = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], "base64");
    return { mimeType, buffer };
  } catch (e) {
    return null;
  }
}

function isSafeKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (key.includes("..") || key.startsWith("/") || key.startsWith("\\")) return false;
  return /^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/.test(key);
}

function validateAndCleanImageReference(value: any): string | null {
  if (!value) return null;
  if (typeof value !== "string") throw new Error("Image reference must be a string.");
  const str = value.trim();
  if (!str) return null;

  if (str.startsWith("data:")) {
    const parsed = parseDataUrl(str);
    if (!parsed) throw new Error("Invalid image data URL format.");
    const allowedMimes = ["image/webp", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimes.includes(parsed.mimeType)) {
      throw new Error(`Unsupported image MIME type: ${parsed.mimeType}. Allowed: webp, png, jpeg.`);
    }
    if (parsed.buffer.length > MAX_ASSET_SIZE_BYTES) {
      throw new Error("Image size exceeds maximum allowed limit of 8 MB.");
    }
    return str;
  }

  if (str.startsWith("http://") || str.startsWith("https://")) {
    if (isTrustedRemoteAssetUrl(str)) return str;
    try {
      const parsedUrl = new URL(str);
      if (parsedUrl.protocol === "https:" && parsedUrl.hostname.toLowerCase() === "images.unsplash.com") {
        return str;
      }
    } catch (e) {}
    throw new Error("Untrusted remote image URL origin.");
  }

  if (isSafeKey(str)) {
    return str;
  }

  throw new Error("Invalid image file path or storage key.");
}

function validateAndCleanPdfReference(value: any): string | null {
  if (!value) return null;
  if (typeof value !== "string") throw new Error("PDF datasheet reference must be a string.");
  const str = value.trim();
  if (!str) return null;

  if (str.startsWith("data:")) {
    const parsed = parseDataUrl(str);
    if (!parsed) throw new Error("Invalid PDF data URL format.");
    if (parsed.mimeType !== "application/pdf") {
      throw new Error(`Invalid datasheet MIME type: ${parsed.mimeType}. Only application/pdf is allowed.`);
    }
    if (parsed.buffer.length > MAX_ASSET_SIZE_BYTES) {
      throw new Error("PDF datasheet size exceeds maximum allowed limit of 8 MB.");
    }
    return str;
  }

  if (str.startsWith("http://") || str.startsWith("https://")) {
    if (isTrustedRemoteAssetUrl(str)) return str;
    throw new Error("Untrusted remote PDF URL origin.");
  }

  if (isSafeKey(str)) {
    return str;
  }

  throw new Error("Invalid PDF datasheet file path or storage key.");
}

async function uploadToR2(filename: string, buffer: Buffer, contentType: string): Promise<string> {
  const sanitized = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  const key = `uploads/${sanitized}`;

  if (!s3Client) {
    console.warn("[R2 Storage Warning] R2 credentials not provided. Using data URL fallback.");
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  await s3Client.send(new PutObjectCommand({
    Bucket: r2BucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  if (r2PublicUrl) {
    return `${r2PublicUrl}/${key}`;
  }
  return key;
}

async function deleteFromR2(keyOrUrl: string) {
  if (!s3Client || !keyOrUrl) return;
  try {
    let key = keyOrUrl;
    if (r2PublicUrl && keyOrUrl.startsWith(r2PublicUrl)) {
      key = keyOrUrl.replace(`${r2PublicUrl}/`, "");
    }
    await s3Client.send(new DeleteObjectCommand({
      Bucket: r2BucketName,
      Key: key,
    }));
  } catch (err) {
    console.error("[R2 Delete Error]", err);
  }
}

let cachedCategories: string[] | null = null;
let lastCategoriesFetchTime = 0;

async function getStoredCategories(): Promise<string[]> {
  const now = Date.now();
  if (cachedCategories && (now - lastCategoriesFetchTime < 15000)) {
    return cachedCategories;
  }

  try {
    await initTursoTables();
    const metaRes = await tursoDb.execute("SELECT categories_list FROM categories_meta WHERE id = 'main'");
    const prodRes = await tursoDb.execute("SELECT DISTINCT category FROM products");

    let metaList: string[] = [];
    if (metaRes.rows.length > 0 && metaRes.rows[0].categories_list) {
      try {
        metaList = JSON.parse(String(metaRes.rows[0].categories_list));
      } catch (e) {}
    }

    const activeProdCats = prodRes.rows.map((r: any) => String(r.category)).filter(Boolean);

    const mergedSet = new Set<string>();
    if (metaList.length > 0) {
      metaList.forEach(c => mergedSet.add(c));
    } else {
      DEFAULT_CATEGORIES.forEach(c => mergedSet.add(c));
    }
    activeProdCats.forEach(c => mergedSet.add(c));

    const finalCategories = Array.from(mergedSet);
    cachedCategories = finalCategories;
    lastCategoriesFetchTime = now;
    return finalCategories;
  } catch (err) {
    console.error("[Turso Categories] Failed to retrieve categories:", err);
  }

  return cachedCategories || [...DEFAULT_CATEGORIES];
}

async function saveStoredCategories(categories: string[]): Promise<string[]> {
  cachedCategories = categories;
  lastCategoriesFetchTime = Date.now();

  try {
    await initTursoTables();
    await tursoDb.execute({
      sql: "INSERT OR REPLACE INTO categories_meta (id, categories_list) VALUES ('main', ?)",
      args: [JSON.stringify(categories)]
    });
  } catch (err) {
    console.error("[Turso Categories] Error saving categories:", err);
  }

  try {
    fs.writeFileSync(CATEGORIES_FILE_PATH, JSON.stringify(categories, null, 2), "utf-8");
  } catch (e) {}

  return categories;
}

if (process.env.VERCEL && !fs.existsSync(PRODUCTS_FILE_PATH)) {
  try {
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(productsData, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write initial seeds to /tmp/products.json:", err);
  }
}

if (!fs.existsSync(CATEGORIES_FILE_PATH)) {
  saveStoredCategories(DEFAULT_CATEGORIES);
}

let cachedProducts: any[] = Array.isArray(productsData) ? productsData : [];
let lastFetchTime = Date.now();
const CACHE_TTL_MS = 15000;
let isSeeded = false;
let isRevalidatingProducts = false;

let cachedMarsoText: string | null = null;
let cachedFormattedKnowledge: string | null = null;
let cachedFormattedProductsRef: any[] | null = null;

function getMarsoGuideDatabaseText(): string {
  try {
    const filePath = path.join(process.cwd(), "marsoGuide Database.txt");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (e) {}
  return "";
}

function getProductsKnowledgeFormatted(productsList: any[]): string {
  if (cachedFormattedKnowledge && cachedFormattedProductsRef === productsList) {
    return cachedFormattedKnowledge;
  }

  const cleanProducts = productsList.filter((p: any) => {
    if (!p || !p.id) return false;
    const idStr = String(p.id);
    if (idStr.startsWith("__") || idStr.includes("meta") || idStr.includes("access_codes") || idStr.includes("system")) {
      return false;
    }
    return true;
  });

  const formatted = cleanProducts.map((p: any, idx: number) => {
    let info = `[Product #${idx + 1}] ${p.name} (${p.nameAr || ''})\nCategory: ${p.category}`;
    if (p.specs) {
      info += `\nModel Code: ${p.specs.code || 'N/A'}\nDimensions: ${p.specs.sizeDims || 'N/A'}\nWeight/Density: ${p.specs.weight || 'N/A'}\nMaterial: ${p.specs.material || 'N/A'}\nPhysical Specs: ${p.specs.physicalSpecs || 'N/A'}\nColor: ${p.specs.color || 'N/A'}\nApplication: ${p.specs.application || 'N/A'}\nFeatures: ${p.specs.features || 'N/A'}`;
    }
    if (p.datasheetKnowledge) {
      info += `\nExtracted Technical Datasheet Details:\n${p.datasheetKnowledge}`;
    }
    return info;
  }).join("\n\n---\n\n");

  cachedFormattedKnowledge = formatted;
  cachedFormattedProductsRef = productsList;
  return formatted;
}

async function revalidateProductsInBackground() {
  if (isRevalidatingProducts) return;
  isRevalidatingProducts = true;
  try {
    if (!tursoDb) {
      if (fs.existsSync(PRODUCTS_FILE_PATH)) {
        const raw = fs.readFileSync(PRODUCTS_FILE_PATH, "utf-8");
        cachedProducts = JSON.parse(raw);
        lastFetchTime = Date.now();
      }
      return;
    }

    await initTursoTables();
    if (!isSeeded) {
      const countRes = await tursoDb.execute("SELECT count(*) as cnt FROM products");
      const cnt = Number(countRes.rows[0]?.cnt || 0);
      if (cnt === 0 && Array.isArray(productsData) && productsData.length > 0) {
        for (const p of productsData) {
          const specsJson = JSON.stringify(p.specs || {});
          await tursoDb.execute({
            sql: `INSERT OR REPLACE INTO products (id, name, name_ar, category, photo, extra_photos, specs, datasheet_file, datasheet_name)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              String(p.id),
              String(p.name),
              String(p.nameAr || ""),
              String(p.category),
              String(p.photo || ""),
              JSON.stringify(p.extraPhotos || []),
              specsJson,
              p.datasheetFile || null,
              p.datasheetName || null
            ]
          });
        }
      }
      isSeeded = true;
    }

    const res = await tursoDb.execute("SELECT * FROM products ORDER BY created_at DESC");
    cachedProducts = res.rows.map((row: any) => {
      let specs = {};
      let extraPhotos = [];
      try { specs = row.specs ? JSON.parse(String(row.specs)) : {}; } catch (e) {}
      try { extraPhotos = row.extra_photos ? JSON.parse(String(row.extra_photos)) : []; } catch (e) {}

      return {
        id: String(row.id),
        name: String(row.name),
        nameAr: String(row.name_ar || ""),
        category: String(row.category),
        photo: String(row.photo || ""),
        extraPhotos,
        specs,
        datasheetFile: row.datasheet_file ? String(row.datasheet_file) : null,
        datasheetName: row.datasheet_name ? String(row.datasheet_name) : null,
        datasheetKnowledge: specs ? (specs as any).datasheetKnowledge : null
      };
    });
    lastFetchTime = Date.now();
  } catch (err) {
    console.error("[Turso DB] Error reading products:", err);
  } finally {
    isRevalidatingProducts = false;
  }
}

async function getStoredProducts(forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  if (cachedProducts && cachedProducts.length > 0 && !forceRefresh) {
    if (now - lastFetchTime > CACHE_TTL_MS) {
      revalidateProductsInBackground();
    }
    return cachedProducts;
  }

  await revalidateProductsInBackground();
  return cachedProducts || productsData;
}

// Authentication & Rate Limiting System
interface RateLimitEntry {
  attempts: number;
  blockedUntil: number;
}
const loginAttempts = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() < entry.blockedUntil) return true;
  loginAttempts.delete(ip);
  return false;
}

function recordLoginAttempt(ip: string, success: boolean) {
  if (success) {
    loginAttempts.delete(ip);
    return;
  }
  const entry = loginAttempts.get(ip) || { attempts: 0, blockedUntil: 0 };
  entry.attempts += 1;
  if (entry.attempts >= 5) {
    entry.blockedUntil = Date.now() + 15 * 60 * 1000;
  }
  loginAttempts.set(ip, entry);
}

function generateUserRoleToken(role: string = "admin"): { token: string; expiresAt: number; role: string } {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const payload = `${role}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  const token = `${payload}:${hmac}`;
  return { token, expiresAt, role };
}

function verifyUserTokenRole(token: string | null): { valid: boolean; role: string | null } {
  if (!token) return { valid: false, role: null };
  const parts = token.split(":");
  if (parts.length !== 3) return { valid: false, role: null };
  const [role, expiresAtStr, hmac] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return { valid: false, role: null };

  const payload = `${role}:${expiresAtStr}`;
  const expectedHmac = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");

  try {
    const isValid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
    return { valid: isValid, role: isValid ? role : null };
  } catch (e) {
    return { valid: false, role: null };
  }
}

function checkRoleAuth(allowedRoles: string[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      logAuditEvent({
        action: "AUTH_CHECK",
        identity: "anonymous",
        ip: clientIp,
        resource: req.originalUrl,
        result: "DENIED",
        details: "Missing authentication token"
      });
      return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    }

    const { valid, role } = verifyUserTokenRole(token);
    if (!valid || !role) {
      logAuditEvent({
        action: "AUTH_CHECK",
        identity: "unauthenticated",
        ip: clientIp,
        resource: req.originalUrl,
        result: "DENIED",
        details: "Invalid or expired token"
      });
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token." });
    }

    if (!allowedRoles.includes(role)) {
      logAuditEvent({
        action: "AUTH_CHECK",
        identity: role,
        role: role,
        ip: clientIp,
        resource: req.originalUrl,
        result: "DENIED",
        details: `Role '${role}' lacks permission`
      });
      return res.status(403).json({ error: `Forbidden: Role '${role}' lacks permission for this resource.` });
    }

    (req as any).userRole = role;
    return next();
  };
}

const checkAdminAuth = checkRoleAuth(["admin"]);
const checkEditorOrAdminAuth = checkRoleAuth(["admin", "editor"]);

// Server-Side Datasheet Access Codes System
interface ServerAccessCode {
  code: string;
  createdAt: number;
  expiresAt: number;
}
let activeServerAccessCodes: ServerAccessCode[] = [];

function cleanExpiredAccessCodes() {
  const now = Date.now();
  activeServerAccessCodes = activeServerAccessCodes.filter(c => c.expiresAt > now);
}

// Access Code Verification Rate Limiter (10 failed attempts per 10 mins per IP)
interface AccessCodeRateLimitEntry {
  failedAttempts: number;
  blockedUntil: number;
}
const accessCodeRateLimits = new Map<string, AccessCodeRateLimitEntry>();

function isAccessCodeVerificationRateLimited(ip: string): boolean {
  const entry = accessCodeRateLimits.get(ip);
  if (!entry) return false;
  if (Date.now() < entry.blockedUntil) return true;
  accessCodeRateLimits.delete(ip);
  return false;
}

function recordAccessCodeVerificationAttempt(ip: string, success: boolean) {
  if (success) {
    accessCodeRateLimits.delete(ip);
    return;
  }
  const entry = accessCodeRateLimits.get(ip) || { failedAttempts: 0, blockedUntil: 0 };
  entry.failedAttempts += 1;
  if (entry.failedAttempts >= 10) {
    entry.blockedUntil = Date.now() + 10 * 60 * 1000;
  }
  accessCodeRateLimits.set(ip, entry);
}

// Access Code Generation & Verification Endpoints
app.post(["/api/access-code/generate", "/access-code/generate"], checkEditorOrAdminAuth, (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
  cleanExpiredAccessCodes();

  const codeInt = crypto.randomInt(1000, 10000);
  const code = codeInt.toString();
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 Minutes validity

  const newCodeObj: ServerAccessCode = { code, createdAt: now, expiresAt };
  activeServerAccessCodes.unshift(newCodeObj);

  logAuditEvent({
    action: "ACCESS_CODE_GENERATE",
    identity: (req as any).userRole || "admin",
    role: (req as any).userRole || "admin",
    ip: clientIp,
    result: "SUCCESS"
  });

  res.json(newCodeObj);
});

app.post(["/api/access-code/verify", "/access-code/verify"], (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();

  if (isAccessCodeVerificationRateLimited(clientIp)) {
    logAuditEvent({
      action: "ACCESS_CODE_VERIFY",
      identity: "anonymous",
      ip: clientIp,
      result: "DENIED",
      details: "Rate limited for access code verification"
    });
    return res.status(429).json({ error: "Too many failed attempts. Please wait 10 minutes before trying again." });
  }

  const { code } = req.body;
  if (!code || typeof code !== "string" || !/^\d{4}$/.test(code.trim())) {
    recordAccessCodeVerificationAttempt(clientIp, false);
    return res.status(400).json({ valid: false, error: "Access code must be a 4-digit numeric string." });
  }

  cleanExpiredAccessCodes();
  const cleanCode = code.trim();
  const now = Date.now();

  let isValid = false;
  for (const item of activeServerAccessCodes) {
    if (item.expiresAt > now) {
      try {
        if (crypto.timingSafeEqual(Buffer.from(item.code), Buffer.from(cleanCode))) {
          isValid = true;
          break;
        }
      } catch (e) {}
    }
  }

  if (isValid) {
    recordAccessCodeVerificationAttempt(clientIp, true);
    logAuditEvent({
      action: "ACCESS_CODE_VERIFY",
      identity: "customer",
      ip: clientIp,
      result: "SUCCESS"
    });
    return res.json({ valid: true });
  } else {
    recordAccessCodeVerificationAttempt(clientIp, false);
    logAuditEvent({
      action: "ACCESS_CODE_VERIFY",
      identity: "customer",
      ip: clientIp,
      result: "FAILURE",
      details: "Invalid or expired access code"
    });
    return res.json({ valid: false, error: "Invalid or expired access code (codes expire after 5 minutes)." });
  }
});

let aiInstance: any = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "YOUR_GEMINI_API_KEY_HERE") {
      throw new Error("GEMINI_API_KEY environment variable is required and must be properly set.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

async function sendChatMessageWithFallback(ai: any, message: string, history: any[], systemInstruction: string) {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Attempting chat (model: ${model}, attempt: ${attempt})`);
        const chat = ai.chats.create({
          model,
          config: {
            systemInstruction,
            temperature: 0.2,
          },
          history: history ? history.map((h: any) => ({
            role: h.role,
            parts: [{ text: h.content }]
          })) : []
        });
        const response = await chat.sendMessage({ message });
        console.log(`[Gemini API] Chat success using model: ${model}`);
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] Chat model ${model} (attempt ${attempt}) failed:`, err.message || err);
        if (attempt < 2 && (err.status === 503 || err.status === 429 || (err.message && (err.message.includes("503") || err.message.includes("high demand"))))) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
  }
  throw lastError || new Error("All chat fallback models failed.");
}

async function generateContentWithFallback(ai: any, contents: any[], config: any) {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Attempting generateContent (model: ${model}, attempt: ${attempt})`);
        const response = await ai.models.generateContent({
          model,
          contents,
          config
        });
        console.log(`[Gemini API] Success using model: ${model}`);
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] Model ${model} (attempt ${attempt}) failed:`, err.message || err);
        if (attempt < 2 && (err.status === 503 || err.status === 429 || (err.message && (err.message.includes("503") || err.message.includes("high demand"))))) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
  }
  throw lastError || new Error("All fallback models failed.");
}

const DATASHEETS_DIR = process.env.VERCEL 
  ? path.join("/tmp", "datasheets") 
  : path.join(process.cwd(), "datasheets");

if (!fs.existsSync(DATASHEETS_DIR)) {
  try {
    fs.mkdirSync(DATASHEETS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create datasheets directory:", err);
  }
}

// Upload Endpoint (RBAC: Admin or Editor with Unified Asset Validation)
app.post(["/api/upload", "/upload"], checkEditorOrAdminAuth, async (req, res) => {
  try {
    const { fileData, filename, contentType } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "fileData is required." });
    }

    const isPdf = (contentType && contentType.includes("pdf")) || (filename && filename.endsWith(".pdf"));
    let validatedAsset: string | null = null;
    try {
      if (isPdf) {
        validatedAsset = validateAndCleanPdfReference(fileData);
      } else {
        validatedAsset = validateAndCleanImageReference(fileData);
      }
    } catch (valErr: any) {
      return res.status(400).json({ error: valErr.message || "Invalid asset payload." });
    }

    if (!validatedAsset) {
      return res.status(400).json({ error: "Invalid asset reference provided." });
    }

    const cleanFilename = filename ? String(filename).replace(/[^a-zA-Z0-9.-]/g, "_") : `file_${Date.now()}`;
    const type = contentType || (isPdf ? "application/pdf" : "image/webp");

    if (s3Client) {
      try {
        let buffer: Buffer;
        if (validatedAsset.startsWith("data:")) {
          const parsed = parseDataUrl(validatedAsset);
          if (!parsed) return res.status(400).json({ error: "Malformed data URL payload." });
          buffer = parsed.buffer;
        } else {
          buffer = Buffer.from(validatedAsset, "base64");
        }
        const publicUrl = await uploadToR2(cleanFilename, buffer, type);
        return res.json({ url: publicUrl, key: publicUrl });
      } catch (uploadErr) {
        console.warn("[R2 Upload Warning] R2 upload failed, using validated fallback:", uploadErr);
      }
    }

    return res.json({ url: validatedAsset, key: validatedAsset });
  } catch (err: any) {
    console.error("[Upload Endpoint Error]", err);
    return res.status(500).json({ error: "Failed to upload asset." });
  }
});

// Admin Authentication Endpoints

app.post(["/api/admin/login", "/admin/login"], (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();

  if (isRateLimited(clientIp)) {
    logAuditEvent({
      action: "ADMIN_LOGIN",
      identity: req.body?.email || "unknown",
      ip: clientIp,
      result: "DENIED",
      details: "Rate limited / account locked"
    });
    return res.status(429).json({ error: "Too many failed attempts. Account locked for 15 minutes." });
  }

  const { password, email } = req.body;
  if (!password || typeof password !== "string") {
    recordLoginAttempt(clientIp, false);
    logAuditEvent({
      action: "ADMIN_LOGIN",
      identity: email || "unknown",
      ip: clientIp,
      result: "FAILURE",
      details: "Missing password"
    });
    return res.status(400).json({ error: "Password is required." });
  }

  if (password === ADMIN_PASSWORD) {
    recordLoginAttempt(clientIp, true);
    const { token, expiresAt, role } = generateUserRoleToken("admin");
    logAuditEvent({
      action: "ADMIN_LOGIN",
      identity: email || "admin@marso-egy.com",
      role: role,
      ip: clientIp,
      result: "SUCCESS"
    });
    return res.json({ success: true, token, expiresAt, role });
  } else {
    recordLoginAttempt(clientIp, false);
    const entry = loginAttempts.get(clientIp);
    const remaining = entry ? Math.max(0, 5 - entry.attempts) : 4;
    logAuditEvent({
      action: "ADMIN_LOGIN",
      identity: email || "unknown",
      ip: clientIp,
      result: "FAILURE",
      details: `Incorrect password. ${remaining} attempts remaining.`
    });
    return res.status(401).json({
      error: `Incorrect admin password. ${remaining} attempts remaining before lockout.`,
      remainingAttempts: remaining
    });
  }
});

app.post(["/api/admin/logout", "/admin/logout"], (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const { role } = verifyUserTokenRole(token);

  logAuditEvent({
    action: "ADMIN_LOGOUT",
    identity: role || "admin",
    role: role || undefined,
    ip: clientIp,
    result: "SUCCESS"
  });

  return res.json({ success: true, message: "Logged out successfully." });
});

app.get(["/api/admin/verify", "/admin/verify"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  if (!token) return res.json({ authenticated: false, role: null });

  const { valid, role } = verifyUserTokenRole(token);
  return res.json({ authenticated: valid, role: valid ? role : null });
});

// Combined Bootstrap API (Products + Categories in 1 single HTTP call)
app.get(["/api/bootstrap", "/bootstrap"], async (req, res) => {
  try {
    const [products, categories] = await Promise.all([
      getStoredProducts(),
      getStoredCategories()
    ]);

    const etagPayload = `${products.length}-${products[0]?.id || ''}-${categories.length}`;
    const etag = crypto.createHash("md5").update(etagPayload).digest("hex");

    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=59");
    res.setHeader("ETag", `"${etag}"`);

    if (req.headers["if-none-match"] === `"${etag}"`) {
      return res.status(304).end();
    }

    res.json({ products, categories });
  } catch (err: any) {
    console.error("Error generating bootstrap data:", err);
    res.status(500).json({ error: "Failed to retrieve bootstrap data: " + (err.message || "Unknown error") });
  }
});

// Categories Management API

app.get(["/api/categories", "/categories"], async (req, res) => {
  try {
    const categories = await getStoredCategories();
    const etag = crypto.createHash("md5").update(JSON.stringify(categories)).digest("hex");

    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=59");
    res.setHeader("ETag", `"${etag}"`);

    if (req.headers["if-none-match"] === `"${etag}"`) {
      return res.status(304).end();
    }

    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to retrieve categories: " + (err.message || "Unknown error") });
  }
});

app.post(["/api/categories", "/categories"], checkAdminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Category name is required." });
    }
    const cleanName = name.trim();
    if (cleanName.length > 100) {
      return res.status(400).json({ error: "Category name exceeds 100 characters." });
    }
    let categories = await getStoredCategories();
    if (!categories.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
      categories.push(cleanName);
      await saveStoredCategories(categories);
    }
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to add category." });
  }
});

app.put(["/api/categories", "/categories"], checkAdminAuth, async (req, res) => {
  try {
    await initTursoTables();
    const { oldName, newName } = req.body;
    if (!oldName || !newName || !newName.trim()) {
      return res.status(400).json({ error: "oldName and newName are required." });
    }
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (cleanNew.length > 100) {
      return res.status(400).json({ error: "New category name exceeds 100 characters." });
    }

    let categories = await getStoredCategories();
    categories = categories.map(c => (c === cleanOld ? cleanNew : c));
    await saveStoredCategories(categories);

    await tursoDb.execute({
      sql: "UPDATE products SET category = ? WHERE category = ?",
      args: [cleanNew, cleanOld]
    });

    cachedProducts = null;
    res.json({ categories, message: "Category updated successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update category." });
  }
});

app.delete(["/api/categories", "/categories"], checkAdminAuth, async (req, res) => {
  try {
    const name = (req.query.name || req.body.name) as string;
    if (!name) {
      return res.status(400).json({ error: "Category name is required." });
    }
    let categories = await getStoredCategories();
    categories = categories.filter(c => c !== name);
    await saveStoredCategories(categories);
    res.json({ categories, message: "Category deleted successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete category." });
  }
});

app.post(["/api/categories/clear-unused", "/categories/clear-unused"], checkAdminAuth, async (req, res) => {
  try {
    const products = await getStoredProducts();
    const activeCategories = new Set(products.map((p: any) => p.category));
    let categories = await getStoredCategories();
    categories = categories.filter(c => activeCategories.has(c));
    await saveStoredCategories(categories);
    res.json({ categories, message: "Cleared all unused categories successfully." });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear unused categories." });
  }
});

// Products CRUD Endpoints

function sanitizeProductPayload(body: any): any {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid product payload.");
  }

  const name = String(body.name || "Unnamed Product").trim();
  if (name.length > 150) throw new Error("Product name exceeds 150 characters.");

  const nameAr = String(body.nameAr || "").trim();
  if (nameAr.length > 150) throw new Error("Product Arabic name exceeds 150 characters.");

  const category = String(body.category || "Reverse Engineering").trim();
  if (category.length > 100) throw new Error("Product category exceeds 100 characters.");

  const rawPhoto = body.photo || "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400";
  const photo = validateAndCleanImageReference(rawPhoto) || "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400";

  const rawDatasheet = body.datasheetFile || null;
  const datasheetFile = validateAndCleanPdfReference(rawDatasheet);

  let datasheetName = body.datasheetName ? String(body.datasheetName).trim() : null;
  if (datasheetName && datasheetName.length > 255) {
    datasheetName = datasheetName.substring(0, 255);
  }

  const rawKnowledge = body.datasheetKnowledge || body.specs?.datasheetKnowledge || null;
  let datasheetKnowledge = rawKnowledge ? String(rawKnowledge).trim() : null;
  if (datasheetKnowledge && datasheetKnowledge.length > 10000) {
    datasheetKnowledge = datasheetKnowledge.substring(0, 10000);
  }

  const specs = body.specs || {};
  const specsObj = {
    code: String(specs.code || "").trim().substring(0, 100),
    sizeDims: String(specs.sizeDims || "").trim().substring(0, 500),
    weight: String(specs.weight || "").trim().substring(0, 300),
    features: String(specs.features || "").trim().substring(0, 1500),
    physicalSpecs: String(specs.physicalSpecs || "").trim().substring(0, 1500),
    material: String(specs.material || "").trim().substring(0, 500),
    color: String(specs.color || "").trim().substring(0, 200),
    application: String(specs.application || "").trim().substring(0, 1000),
    price: String(specs.price || body.price || "").trim().substring(0, 100),
    priceCurrency: String(specs.priceCurrency || body.priceCurrency || "EGP").trim().substring(0, 10),
    datasheetKnowledge
  };

  return {
    name,
    nameAr,
    category,
    photo,
    datasheetFile,
    datasheetName,
    datasheetKnowledge,
    specs: specsObj
  };
}

// 1. Get all products
app.get(["/api/products", "/products"], async (req, res) => {
  try {
    const products = await getStoredProducts();
    const etagPayload = `${products.length}-${products[0]?.id || ''}`;
    const etag = crypto.createHash("md5").update(etagPayload).digest("hex");

    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=59");
    res.setHeader("ETag", `"${etag}"`);

    if (req.headers["if-none-match"] === `"${etag}"`) {
      return res.status(304).end();
    }

    res.json(products);
  } catch (err: any) {
    console.error("Error reading stored products file:", err);
    res.status(500).json({ error: "Failed to retrieve products catalog: " + (err.message || "Unknown error") });
  }
});

// 2. Create a new product (RBAC: Admin or Editor)
app.post(["/api/products", "/products"], checkEditorOrAdminAuth, async (req, res) => {
  try {
    await initTursoTables();
    const sanitized = sanitizeProductPayload(req.body);
    const newId = req.body.id ? String(req.body.id) : String(Date.now());

    const currentCats = await getStoredCategories();
    if (!currentCats.some(c => c.toLowerCase() === sanitized.category.toLowerCase())) {
      currentCats.push(sanitized.category);
      await saveStoredCategories(currentCats);
    }

    await tursoDb.execute({
      sql: `INSERT OR REPLACE INTO products (id, name, name_ar, category, photo, extra_photos, specs, datasheet_file, datasheet_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newId,
        sanitized.name,
        sanitized.nameAr,
        sanitized.category,
        sanitized.photo,
        JSON.stringify([]),
        JSON.stringify(sanitized.specs),
        sanitized.datasheetFile,
        sanitized.datasheetName
      ]
    });

    const mapped = {
      id: newId,
      name: sanitized.name,
      nameAr: sanitized.nameAr,
      category: sanitized.category,
      photo: sanitized.photo,
      extraPhotos: [],
      specs: sanitized.specs,
      datasheetFile: sanitized.datasheetFile,
      datasheetName: sanitized.datasheetName,
      datasheetKnowledge: sanitized.datasheetKnowledge
    };

    if (cachedProducts) {
      cachedProducts = [mapped, ...cachedProducts.filter(p => String(p.id) !== String(mapped.id))];
    } else {
      cachedProducts = [mapped];
    }
    lastFetchTime = Date.now();

    res.status(201).json(mapped);
  } catch (err: any) {
    console.error("Failed to create product:", err);
    res.status(400).json({ error: err.message || "Failed to create product." });
  }
});

// 3. Update a product (RBAC: Admin or Editor)
app.put(["/api/products/:id", "/products/:id"], checkEditorOrAdminAuth, async (req, res) => {
  try {
    await initTursoTables();
    const { id } = req.params;

    const existingRes = await tursoDb.execute({
      sql: "SELECT * FROM products WHERE id = ?",
      args: [id]
    });

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existingRow = existingRes.rows[0];
    let existingSpecs: any = {};
    try { existingSpecs = existingRow.specs ? JSON.parse(String(existingRow.specs)) : {}; } catch(e){}

    const mergedPayload = {
      name: req.body.name !== undefined ? req.body.name : String(existingRow.name),
      nameAr: req.body.nameAr !== undefined ? req.body.nameAr : String(existingRow.name_ar || ""),
      category: req.body.category !== undefined ? req.body.category : String(existingRow.category),
      photo: req.body.photo !== undefined ? req.body.photo : String(existingRow.photo || ""),
      datasheetFile: req.body.datasheetFile !== undefined ? req.body.datasheetFile : existingRow.datasheet_file,
      datasheetName: req.body.datasheetName !== undefined ? req.body.datasheetName : existingRow.datasheet_name,
      datasheetKnowledge: req.body.datasheetKnowledge !== undefined ? req.body.datasheetKnowledge : (existingSpecs.datasheetKnowledge ?? null),
      specs: {
        code: req.body.specs?.code ?? existingSpecs.code ?? "",
        sizeDims: req.body.specs?.sizeDims ?? existingSpecs.sizeDims ?? "",
        weight: req.body.specs?.weight ?? existingSpecs.weight ?? "",
        features: req.body.specs?.features ?? existingSpecs.features ?? "",
        physicalSpecs: req.body.specs?.physicalSpecs ?? existingSpecs.physicalSpecs ?? "",
        material: req.body.specs?.material ?? existingSpecs.material ?? "",
        color: req.body.specs?.color ?? existingSpecs.color ?? "",
        application: req.body.specs?.application ?? existingSpecs.application ?? "",
        price: req.body.specs?.price ?? req.body.price ?? existingSpecs.price ?? "",
        priceCurrency: req.body.specs?.priceCurrency ?? req.body.priceCurrency ?? existingSpecs.priceCurrency ?? "EGP",
      }
    };

    const sanitized = sanitizeProductPayload(mergedPayload);
    const updatedExtraPhotos: string[] = [];

    await tursoDb.execute({
      sql: `UPDATE products SET name = ?, name_ar = ?, category = ?, photo = ?, extra_photos = ?, specs = ?, datasheet_file = ?, datasheet_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [
        sanitized.name,
        sanitized.nameAr,
        sanitized.category,
        sanitized.photo,
        JSON.stringify(updatedExtraPhotos),
        JSON.stringify(sanitized.specs),
        sanitized.datasheetFile,
        sanitized.datasheetName,
        id
      ]
    });

    const mappedUpdated = {
      id: id,
      name: sanitized.name,
      nameAr: sanitized.nameAr,
      category: sanitized.category,
      photo: sanitized.photo,
      extraPhotos: updatedExtraPhotos,
      specs: sanitized.specs,
      datasheetFile: sanitized.datasheetFile,
      datasheetName: sanitized.datasheetName,
      datasheetKnowledge: sanitized.datasheetKnowledge
    };

    if (cachedProducts) {
      cachedProducts = cachedProducts.map((p: any) => String(p.id) === String(mappedUpdated.id) ? mappedUpdated : p);
    } else {
      cachedProducts = [mappedUpdated];
    }
    lastFetchTime = Date.now();

    res.json(mappedUpdated);
  } catch (err: any) {
    console.error("Failed to update product:", err);
    res.status(400).json({ error: err.message || "Failed to update product." });
  }
});

// 4. Delete a product (RBAC: Admin Only)
app.delete(["/api/products/:id", "/products/:id"], checkAdminAuth, async (req, res) => {
  try {
    await initTursoTables();
    const { id } = req.params;

    const existingRes = await tursoDb.execute({
      sql: "SELECT * FROM products WHERE id = ?",
      args: [id]
    });

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const row = existingRes.rows[0];

    await tursoDb.execute({
      sql: "DELETE FROM products WHERE id = ?",
      args: [id]
    });

    if (row.datasheet_file) {
      await deleteFromR2(String(row.datasheet_file));
    }

    if (cachedProducts) {
      cachedProducts = cachedProducts.filter((p: any) => String(p.id) !== String(id));
    }
    lastFetchTime = Date.now();

    res.json({
      id: String(row.id),
      name: String(row.name),
      nameAr: String(row.name_ar || ""),
      category: String(row.category),
      photo: String(row.photo || "")
    });
  } catch (err: any) {
    console.error("Failed to delete product:", err);
    res.status(500).json({ error: err.message || "Failed to delete product." });
  }
});

// 5. Download Product Datasheet (Protected by Admin Auth OR Server Access Code)
app.get(["/api/products/:id/datasheet", "/products/:id/datasheet"], async (req, res) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();

    // Authorization check: either valid admin/editor Bearer token OR valid server-generated access code
    let isAuthorized = false;

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const { valid: tokenValid } = verifyUserTokenRole(token);
    if (tokenValid) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      const codeParam = (req.headers["x-access-code"] as string) || (req.query.accessCode as string);
      if (codeParam && typeof codeParam === "string" && /^\d{4}$/.test(codeParam.trim())) {
        if (isAccessCodeVerificationRateLimited(clientIp)) {
          return res.status(429).json({ error: "Too many failed verification attempts. Please wait 10 minutes." });
        }
        cleanExpiredAccessCodes();
        const cleanCode = codeParam.trim();
        const now = Date.now();
        for (const item of activeServerAccessCodes) {
          if (item.expiresAt > now) {
            try {
              if (crypto.timingSafeEqual(Buffer.from(item.code), Buffer.from(cleanCode))) {
                isAuthorized = true;
                break;
              }
            } catch (e) {}
          }
        }
        if (!isAuthorized) {
          recordAccessCodeVerificationAttempt(clientIp, false);
        }
      }
    }

    if (!isAuthorized) {
      logAuditEvent({
        action: "DATASHEET_DOWNLOAD",
        identity: "anonymous",
        ip: clientIp,
        resource: req.originalUrl,
        result: "DENIED",
        details: "Unauthorized datasheet download attempt"
      });
      return res.status(401).json({ error: "Unauthorized: Valid access code or admin authorization required to download technical datasheets." });
    }

    await initTursoTables();
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Product ID is required and must be a string." });
    }

    const prodRes = await tursoDb.execute({
      sql: "SELECT * FROM products WHERE id = ?",
      args: [id]
    });

    if (prodRes.rows.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    const product = prodRes.rows[0];
    const datasheetPath = product.datasheet_file ? String(product.datasheet_file) : null;

    if (!datasheetPath) {
      return res.status(404).json({ error: "Datasheet PDF not registered or uploaded for this product." });
    }

    let buffer: Buffer;
    if (datasheetPath.startsWith("http://") || datasheetPath.startsWith("https://")) {
      if (!isTrustedRemoteAssetUrl(datasheetPath)) {
        return res.status(400).json({ error: "Remote datasheet URL origin is not trusted." });
      }
      const response = await fetch(datasheetPath, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        return res.status(404).json({ error: "Failed to download datasheet from cloud URL." });
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (datasheetPath.startsWith("data:")) {
      const parsed = parseDataUrl(datasheetPath);
      if (!parsed || parsed.mimeType !== "application/pdf") {
        return res.status(400).json({ error: "Invalid PDF datasheet format." });
      }
      buffer = parsed.buffer;
    } else if (s3Client) {
      try {
        const getCmd = new GetObjectCommand({
          Bucket: r2BucketName,
          Key: datasheetPath,
        });
        const r2Data = await s3Client.send(getCmd);
        const bytes = await r2Data.Body?.transformToByteArray();
        if (!bytes) throw new Error("Empty R2 stream");
        buffer = Buffer.from(bytes);
      } catch (err) {
        return res.status(404).json({ error: "Datasheet file not found in R2 cloud storage." });
      }
    } else {
      return res.status(404).json({ error: "Datasheet file inaccessible." });
    }

    const clientFilename = product.datasheet_name ? String(product.datasheet_name) : `${String(product.name).replace(/[^a-zA-Z0-9]/g, "_")}_datasheet.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(clientFilename)}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error("Error handling datasheet download:", err);
    res.status(500).json({ error: "Internal server error during datasheet download." });
  }
});

// 6. Upload and AI Extract Specs from PDF Datasheet (RBAC: Admin Only)
app.post(["/api/datasheets/upload-and-extract", "/datasheets/upload-and-extract"], checkAdminAuth, async (req, res) => {
  try {
    const { datasheetFile, filename } = req.body;
    if (!datasheetFile) {
      return res.status(400).json({ error: "datasheetFile is required." });
    }

    let validatedPdfRef: string | null = null;
    try {
      validatedPdfRef = validateAndCleanPdfReference(datasheetFile);
    } catch (valErr: any) {
      return res.status(400).json({ error: valErr.message || "Invalid PDF datasheet payload." });
    }

    if (!validatedPdfRef) {
      return res.status(400).json({ error: "Invalid PDF datasheet reference." });
    }

    const originalName = filename ? String(filename).replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 255) : "datasheet.pdf";
    let cleanBase64 = "";

    if (validatedPdfRef.startsWith("http://") || validatedPdfRef.startsWith("https://")) {
      if (!isTrustedRemoteAssetUrl(validatedPdfRef)) {
        return res.status(400).json({ error: "Remote PDF URL is not from a trusted R2 origin." });
      }
      const response = await fetch(validatedPdfRef, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        return res.status(404).json({ error: "Failed to fetch PDF from trusted R2 URL." });
      }
      const contentType = response.headers.get("content-type") || "";
      if (contentType && !contentType.includes("pdf") && !contentType.includes("octet-stream")) {
        return res.status(400).json({ error: "Remote response content-type is not a valid PDF." });
      }
      const contentLengthStr = response.headers.get("content-length");
      if (contentLengthStr && parseInt(contentLengthStr, 10) > MAX_ASSET_SIZE_BYTES) {
        return res.status(413).json({ error: "PDF datasheet exceeds maximum allowed size limit of 8 MB." });
      }
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_ASSET_SIZE_BYTES) {
        return res.status(413).json({ error: "PDF datasheet exceeds maximum allowed size limit of 8 MB." });
      }
      cleanBase64 = Buffer.from(arrayBuffer).toString("base64");
    } else if (validatedPdfRef.startsWith("data:")) {
      const parsed = parseDataUrl(validatedPdfRef);
      if (!parsed || parsed.mimeType !== "application/pdf") {
        return res.status(400).json({ error: "Invalid PDF data URL or unsupported MIME type." });
      }
      if (parsed.buffer.length > MAX_ASSET_SIZE_BYTES) {
        return res.status(413).json({ error: "PDF datasheet exceeds maximum allowed size limit of 8 MB." });
      }
      cleanBase64 = parsed.buffer.toString("base64");
    } else {
      cleanBase64 = validatedPdfRef;
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (keyErr: any) {
      console.error("Gemini client initialization failed for upload-and-extract:", keyErr);
      return res.status(500).json({ error: "Failed to initialize Gemini client." });
    }

    const pdfPart = {
      inlineData: {
        data: cleanBase64,
        mimeType: "application/pdf"
      }
    };

    const promptPart = {
      text: `Analyze the attached PDF datasheet for a manufacturing/rubber product and extract its technical specifications. Output a clean JSON object containing exactly the following properties:
1. name: The official brand or model name of the product in English.
2. nameAr: The official brand or model name of the product in Arabic. If the name is only in English in the PDF, translate it accurately to Arabic (e.g. "Extra-Tough EPDM Mechanical Gasket" -> "جوان ميكانيكي EPDM شديد التحمل").
3. category: The specific category classifying this rubber product. This MUST be exactly one of the following 8 allowed values:
   - "Reclaimed and Crumb Rubber"
   - "Rubber Tile Flooring"
   - "Rubber Mat Flooring"
   - "Industrial Rubber Flooring"
   - "Rubber Automotive Spare Parts"
   - "Rubber Car Mats"
   - "Constructive Rubber Industries"
   - "Reverse Engineering"
4. code: A unique catalog or model code (often found on datasheets, e.g. MC-101RC).
5. sizeDims: The dimensions, sizes, thickness, width, or length of the rubber product.
6. weight: The weight or weight limits per unit.
7. features: Major features, advantages, or certifications of the product.
8. physicalSpecs: Any technical and physical specifications (such as shore hardness, temperature limits, tensile strength, elasticity).
9. material: The material compounds or types of rubber used (e.g. SBR, NBR, EPDM, Natural Rubber).
10. color: Colors available for this product (e.g., Black, Grey).
11. application: Intended uses or applications of the product.

Keep values highly accurate but extremely concise (maximum 12 words per property) to optimize pipeline speed. Output MUST strictly match the defined JSON schema.`
    };

    const response = await generateContentWithFallback(ai, [pdfPart, promptPart], {
      responseMimeType: "application/json",
      temperature: 0.1,
      responseSchema: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Official product or model name in English" },
          nameAr: { type: "STRING", description: "Official product or model name in Arabic" },
          category: { type: "STRING", description: "Exactly one of the 8 allowed categories" },
          code: { type: "STRING", description: "Product or model code" },
          sizeDims: { type: "STRING", description: "Product dimensions and sizes" },
          weight: { type: "STRING", description: "Product weight or density" },
          features: { type: "STRING", description: "Key features or product certifications" },
          physicalSpecs: { type: "STRING", description: "Shore hardness, temperature limit, tensile strength, etc." },
          material: { type: "STRING", description: "Rubber type or material ingredients" },
          color: { type: "STRING", description: "Product color or options" },
          application: { type: "STRING", description: "Product applications or usages" }
        },
        required: ["name", "nameAr", "category", "code", "sizeDims", "weight", "features", "physicalSpecs", "material", "color", "application"]
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text was generated by Gemini.");
    }

    const parsedSpecs = JSON.parse(text);

    const datasheetKnowledgeSummary = `Technical Datasheet Information for ${parsedSpecs.name} (${parsedSpecs.nameAr || ''}):
- Category: ${parsedSpecs.category}
- Model Code: ${parsedSpecs.code}
- Dimensions & Sizes: ${parsedSpecs.sizeDims}
- Weight & Load: ${parsedSpecs.weight}
- Key Features: ${parsedSpecs.features}
- Technical & Physical Specs: ${parsedSpecs.physicalSpecs}
- Material Compounds: ${parsedSpecs.material}
- Color Options: ${parsedSpecs.color}
- Applications & Uses: ${parsedSpecs.application}`;

    res.json({
      specs: parsedSpecs,
      datasheetFile: validatedPdfRef,
      datasheetName: originalName,
      datasheetKnowledge: datasheetKnowledgeSummary
    });

  } catch (err: any) {
    console.error("Failed to upload and extract PDF datasheet:", err);
    res.status(500).json({ error: "Failed to process PDF datasheet." });
  }
});

// Rate limiting tracking for AI chat
interface ChatRateLimitEntry {
  timestamps: number[];
}
const chatRateLimits = new Map<string, ChatRateLimitEntry>();

function isChatRateLimited(ip: string, isAuth: boolean): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const maxRequests = isAuth ? 100 : 20;

  let entry = chatRateLimits.get(ip);
  if (!entry) {
    entry = { timestamps: [] };
    chatRateLimits.set(ip, entry);
  }

  entry.timestamps = entry.timestamps.filter(ts => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    return true;
  }

  entry.timestamps.push(now);
  return false;
}

// Chat assistant using Gemini
app.post(["/api/chat", "/chat"], async (req, res) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const { valid } = verifyUserTokenRole(token);

    if (isChatRateLimited(clientIp, valid)) {
      logAuditEvent({
        action: "AI_CHAT",
        identity: valid ? "authenticated" : "anonymous",
        ip: clientIp,
        result: "DENIED",
        details: "Chat rate limit exceeded"
      });
      return res.status(429).json({
        error: "Rate limit exceeded. Maximum chat requests reached for this window."
      });
    }

    const { message, history } = req.body;
    
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Message is required and must be a non-empty string." });
    }

    if (message.length > 2000) {
      return res.status(400).json({ error: "Message length exceeds maximum allowed limit of 2,000 characters." });
    }

    let sanitizedHistory: any[] = [];
    if (history !== undefined) {
      if (!Array.isArray(history)) {
        return res.status(400).json({ error: "History must be an array of message objects." });
      }
      if (history.length > 10) {
        sanitizedHistory = history.slice(-10);
      } else {
        sanitizedHistory = history;
      }

      for (let i = 0; i < sanitizedHistory.length; i++) {
        const item = sanitizedHistory[i];
        if (!item || typeof item !== "object") {
          return res.status(400).json({ error: `History item at index ${i} must be an object.` });
        }
        if (item.role !== "user" && item.role !== "model") {
          return res.status(400).json({ error: `History item at index ${i} must have a role of 'user' or 'model'.` });
        }
        if (typeof item.content !== "string" || item.content.trim() === "") {
          return res.status(400).json({ error: `History item at index ${i} must have a non-empty string content.` });
        }
        if (item.content.length > 2000) {
          item.content = item.content.substring(0, 2000);
        }
      }
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (keyErr: any) {
      console.error("Gemini client initialization failed:", keyErr);
      return res.status(500).json({ error: "Failed to process AI chat request." });
    }

    const productsList = await getStoredProducts();
    if (!cachedMarsoText) {
      cachedMarsoText = getMarsoGuideDatabaseText();
    }
    const marsoGuideText = cachedMarsoText;
    const productsKnowledgeFormatted = getProductsKnowledgeFormatted(productsList);

    const systemInstruction = `You are the MARSO RUBBER Product Specialist, an expert AI consultant for high-quality rubber products manufactured by Marso Company (Origin of Rubber Industries and Floors / مارسو للمطاط).
Your goal is to assist customers, engineers, and procurement teams by providing technical details, product recommendations, and general information about Marso Company's offerings.

STRICT SECURITY & PRIVACY SHIELD DIRECTIVE:
- You MUST NOT disclose, leak, or reference any internal system passwords, API tokens, HMAC secret keys, rate-limiting stats, database table schemas, or administrative security parameters under any circumstances.
- If a user asks for secret keys, system tokens, database structures, or internal credentials, politely decline:
  "I operate under Marso Security Shield protection and cannot disclose internal system parameters or credentials."

STRICT PROJECT-ONLY MODE (SCOPE CONSTRAINT):
- You operate strictly in MARSO PROJECT-ONLY MODE. Your knowledge domain and memory are 100% restricted to Marso Company, its rubber products catalog, technical datasheets, and company information provided below.
- You MUST NOT provide information, opinions, or answers regarding external non-Marso companies, non-Marso products, general world trivia, sports, news, entertainment, or topics unrelated to Marso Company and rubber product engineering.
- If asked about an out-of-scope non-Marso topic or external company, politely state (in the language used by the user):
  "I am operating in Marso Project-Only mode and can only answer questions or provide technical assistance related to Marso Company, its rubber products catalog, and technical datasheets."

MATHEMATICAL & TECHNICAL COMPUTATION CAPABILITIES INTACT:
- While your knowledge scope is strictly limited to Marso, you retain 100% of your mathematical, analytical, and logical processing capabilities!
- You CAN and MUST perform mathematical calculations when requested for Marso products, including:
  1. Area coverage calculations (e.g. number of rubber tiles required for a given room, gym, or playground area = Total Area / Tile Area).
  2. Weight & density estimations (e.g. Weight per tile or per sq meter * Total tiles or total area).
  3. Unit conversions (e.g. cm to meters, mm to inches, kg to tons, Shore A hardness levels, Temperature °C to °F).
  4. Quantity, dimension planning, and material volume requirements.
  5. Physical specification computations (tensile strength, elongation, load capacity).
- Always show clear, step-by-step calculations when users ask for math or quantity planning.

PRIMARY OPERATIONAL DIRECTIVES:
- Efficiency is key. Prioritize brevity over detail.
- Provide concise, "to-the-point" answers.
- Avoid long-winded explanations or providing unsolicited background information.
- Stay on task: only answer the specific question asked.

OPERATIONAL CONSTRAINTS & GUARDRAILS:
- No Guesswork: If custom product details or exact pricing is unavailable, direct user to contact MARSO sales department at Sylvia@marso-egy.com or Samuel@marso-egy.com.
- Competitors: Never disparage competitors. Focus on durability and material integrity of MARSO RUBBER products.
- Confidentiality: Do not disclose chemical formulas or internal manufacturing processes.
- No File Mentioning: Strictly prohibited from referencing raw file names or PDF attachments. Present facts as your own expert technical knowledge.
- Always offer/inject a concise CALL TO ACTION (CTA) to reach out to the sales or engineering teams for formal quotes or technical drawings, when appropriate.

GENERAL MARSO CORPORATE KNOWLEDGE BASE (from marsoGuide Database.txt):
${marsoGuideText || "Marso Company (Origin of Rubber Industries and Floors) - 10th of Ramadan City, Egypt. ISO 9001/14001/45001 certified manufacturer."}

STRICT 8 PRODUCT CLASSIFICATIONS TO MAP:
1. Reclaimed and Crumb Rubber (Reclem Rubber / Generato, rubber granules, rubber powder)
2. Rubber Tile Flooring (Sound-absorbing gym, tartan track granules, accessibility floor, bulletproof walls, pool supplies, nurseries)
3. Rubber Mat Flooring (Cow farm flooring, horse stables, anti-bacterial mats)
4. Industrial Rubber Flooring (Fire-retardant, electrical-insulating switchboards, anti-vibration machine dampers, garage)
5. Rubber Automotive Spare Parts (Engine mounts, gaskets, seals, bumpers, ship/port fenders)
6. Rubber Car Mats (All-weather floor liners, custom car mats)
7. Constructive Rubber Industries (Bridge joints, structural bearing pads, EPDM facade rollers, expansions, generator bases, neoprene construction grades)
8. Reverse Engineering (Always point out that MARSO can custom manufacture any rubber profile, shape, or parts not listed through physical sample copying or drawing-based reverse engineering)

REGISTERED MARSO PRODUCTS & TECHNICAL DATASHEETS KNOWLEDGE BASE:
${productsKnowledgeFormatted}`;

    let response;
    try {
      response = await sendChatMessageWithFallback(ai, message, sanitizedHistory, systemInstruction);
    } catch (apiErr: any) {
      console.error("Gemini API call failed:", apiErr);
      return res.status(502).json({ error: "AI service temporarily unavailable. Please try again." });
    }

    const reply = response.text || "No reply was generated.";
    res.json({ reply });
  } catch (error: any) {
    console.error("Gemini API Error in backend:", error);
    res.status(500).json({ error: "Unable to process AI chat request." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MARSO Server listening on port ${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
