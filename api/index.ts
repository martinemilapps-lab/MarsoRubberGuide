import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { createClient as createTursoClient } from "@libsql/client";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { extractText } from "unpdf";
import productsData from "../products.json" with { type: "json" };
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

const config = getServerConfig();
const app = express();
app.set("trust proxy", true);
const PORT = config.port;

// Trusted Client IP Extraction Helper
export function getClientIp(req: express.Request): string {
  const xRealIp = req.headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.trim()) {
    return xRealIp.trim();
  }
  const xForwardedFor = req.headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
    const ips = xForwardedFor.split(",").map(ip => ip.trim()).filter(Boolean);
    if (ips.length > 0) return ips[0];
  }
  return req.ip || req.socket.remoteAddress || "127.0.0.1";
}

// Security Headers Middleware with Content-Security-Policy
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https:; frame-ancestors 'none';"
  );
  next();
});

// Strict CORS Middleware with Allowlist
function isOriginAllowed(origin: string): boolean {
  if (!origin) return true; // Same-origin or non-browser requests
  const cleanOrigin = origin.trim().replace(/\/$/, "");

  // Non-production local development fallback
  if (!config.isProduction && !config.isVercel) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
      return true;
    }
  }

  // Exact allowlist check in production / Vercel
  if (config.allowedOrigins.length > 0) {
    return config.allowedOrigins.includes(cleanOrigin);
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

// Restricted payload limits (Default 64 KB for standard requests, 15MB for products/uploads/datasheets)
app.use((req, res, next) => {
  if (
    req.path.includes("/upload") ||
    req.path.includes("/datasheets") ||
    req.path.includes("/products") ||
    req.path.includes("/categories")
  ) {
    return express.json({ limit: "15mb" })(req, res, next);
  }
  return express.json({ limit: "1mb" })(req, res, next);
});
app.use(express.urlencoded({ limit: "15mb", extended: true }));

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

const PRODUCTS_FILE_PATH = config.isVercel 
  ? path.join("/tmp", "products.json") 
  : path.join(process.cwd(), "products.json");

const CATEGORIES_FILE_PATH = config.isVercel 
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
const tursoDb = (config.tursoUrl && config.tursoAuthToken) ? createTursoClient({
  url: config.tursoUrl,
  authToken: config.tursoAuthToken,
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

    await tursoDb.execute(`
      CREATE TABLE IF NOT EXISTS access_codes (
        id TEXT PRIMARY KEY,
        code_hash TEXT UNIQUE NOT NULL,
        product_id TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        used_at DATETIME
      );
    `);

    await tursoDb.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token_hash TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME
      );
    `);

    await tursoDb.execute(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        attempts INTEGER DEFAULT 1,
        blocked_until DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await tursoDb.execute(`CREATE INDEX IF NOT EXISTS idx_access_codes_hash ON access_codes(code_hash);`);
    await tursoDb.execute(`CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);`);
    await tursoDb.execute(`CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);`);

    isTablesInitialized = true;
  } catch (err) {
    console.error("[Turso DB Init Error]", err);
  }
}

// Cloudflare R2 Object Storage setup
const s3Client = (config.r2AccountId && config.r2AccessKeyId && config.r2SecretAccessKey) ? new S3Client({
  region: "auto",
  endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  },
}) : null;

// Remote Asset URL Validation Helper (Prevent SSRF)
function isTrustedRemoteAssetUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string" || !config.r2PublicUrl) return false;
  try {
    const targetUrl = new URL(urlStr);
    const publicUrl = new URL(config.r2PublicUrl);

    if (targetUrl.protocol !== "https:") return false;

    const host = targetUrl.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "169.254.169.254" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.") ||
      host.endsWith(".internal") ||
      host.endsWith(".local")
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

// Unified Asset Magic Byte & Validation Helpers
const MAX_ASSET_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB limit

function parseDataUrl(value: string): { mimeType: string; buffer: Buffer } | null {
  if (!value || typeof value !== "string") return null;
  if (value.startsWith("data:")) {
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
  // If pure base64
  try {
    const buffer = Buffer.from(value, "base64");
    if (validatePdfMagicBytes(buffer)) {
      return { mimeType: "application/pdf", buffer };
    }
    if (validateImageMagicBytes(buffer)) {
      return { mimeType: "image/webp", buffer };
    }
  } catch (e) {}
  return null;
}

function isSafeKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  if (key.includes("..") || key.startsWith("/") || key.startsWith("\\")) return false;
  return /^[a-zA-Z0-9_.-]+(\/[a-zA-Z0-9_.-]+)*$/.test(key);
}

function validateImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 8) return false;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // WebP: RIFF ... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;
  return false;
}

function validatePdfMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 5) return false;
  // PDF header: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2D
  );
}

function validateAndCleanImageReference(value: any): string | null {
  if (!value) return null;
  if (typeof value !== "string") throw new Error("Image reference must be a string.");
  const str = value.trim();
  if (!str) return null;

  if (str.startsWith("data:") || str.length > 500) {
    const parsed = parseDataUrl(str);
    if (!parsed) throw new Error("Invalid image data URL format.");
    const allowedMimes = ["image/webp", "image/png", "image/jpeg", "image/jpg"];
    if (!allowedMimes.includes(parsed.mimeType)) {
      throw new Error(`Unsupported image MIME type: ${parsed.mimeType}. Allowed: webp, png, jpeg.`);
    }
    if (parsed.buffer.length > MAX_ASSET_SIZE_BYTES) {
      throw new Error("Image size exceeds maximum allowed limit of 15 MB.");
    }
    if (!validateImageMagicBytes(parsed.buffer)) {
      throw new Error("Image magic byte validation failed. Invalid image payload.");
    }
    return str.startsWith("data:") ? str : `data:${parsed.mimeType};base64,${parsed.buffer.toString("base64")}`;
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

  if (str.startsWith("data:") || str.length > 500) {
    const parsed = parseDataUrl(str);
    if (!parsed) throw new Error("Invalid PDF data format.");
    if (parsed.mimeType !== "application/pdf") {
      throw new Error(`Invalid datasheet MIME type: ${parsed.mimeType}. Only application/pdf is allowed.`);
    }
    if (parsed.buffer.length > MAX_ASSET_SIZE_BYTES) {
      throw new Error("PDF datasheet size exceeds maximum allowed limit of 15 MB.");
    }
    if (!validatePdfMagicBytes(parsed.buffer)) {
      throw new Error("PDF magic byte validation failed. File is not a valid PDF.");
    }
    return str.startsWith("data:") ? str : `data:application/pdf;base64,${parsed.buffer.toString("base64")}`;
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
    Bucket: config.r2BucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  if (config.r2PublicUrl) {
    return `${config.r2PublicUrl}/${key}`;
  }
  return key;
}

async function deleteFromR2(keyOrUrl: string) {
  if (!s3Client || !keyOrUrl) return;
  try {
    let key = keyOrUrl;
    if (config.r2PublicUrl && keyOrUrl.startsWith(config.r2PublicUrl)) {
      key = keyOrUrl.replace(`${config.r2PublicUrl}/`, "");
    }
    await s3Client.send(new DeleteObjectCommand({
      Bucket: config.r2BucketName,
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
    if (tursoDb) {
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
    }
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
    if (tursoDb) {
      await tursoDb.execute({
        sql: "INSERT OR REPLACE INTO categories_meta (id, categories_list) VALUES ('main', ?)",
        args: [JSON.stringify(categories)]
      });
    }
  } catch (err) {
    console.error("[Turso Categories] Error saving categories:", err);
  }

  try {
    fs.writeFileSync(CATEGORIES_FILE_PATH, JSON.stringify(categories, null, 2), "utf-8");
  } catch (e) {}

  return categories;
}

if (config.isVercel && !fs.existsSync(PRODUCTS_FILE_PATH)) {
  try {
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(productsData, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write initial seeds to /tmp/products.json:", err);
  }
}

if (!fs.existsSync(CATEGORIES_FILE_PATH)) {
  saveStoredCategories(DEFAULT_CATEGORIES);
}

let cachedProducts: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5000;
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
      } else if (Array.isArray(productsData)) {
        cachedProducts = productsData;
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
    if (!cachedProducts && Array.isArray(productsData)) {
      cachedProducts = productsData;
    }
  } finally {
    isRevalidatingProducts = false;
  }
}

async function getStoredProducts(forceRefresh = false): Promise<any[]> {
  const now = Date.now();
  if (cachedProducts && cachedProducts.length > 0 && !forceRefresh && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedProducts;
  }

  await revalidateProductsInBackground();
  return cachedProducts || productsData;
}

// Public Product Data Sanitizer (Strips private R2 storage keys/URLs and extracted PDF knowledge)
export function sanitizePublicProduct(product: any): any {
  if (!product) return null;
  const { datasheetFile, datasheetKnowledge, ...publicData } = product;

  let sanitizedSpecs = publicData.specs;
  if (sanitizedSpecs && typeof sanitizedSpecs === "object") {
    const { datasheetKnowledge: _, ...cleanSpecs } = sanitizedSpecs;
    sanitizedSpecs = cleanSpecs;
  }

  return {
    ...publicData,
    specs: sanitizedSpecs,
    hasDatasheet: Boolean(datasheetFile),
    datasheetName: product.datasheetName || null
  };
}

// Centralized DB / Memory Rate Limiting System
interface LocalRateLimitEntry {
  attempts: number;
  blockedUntil: number;
}
const localRateLimits = new Map<string, LocalRateLimitEntry>();

async function checkAndRecordRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  lockoutMs: number
): Promise<{ limited: boolean; remainingAttempts: number }> {
  const now = Date.now();

  try {
    await initTursoTables();
    if (tursoDb) {
      const res = await tursoDb.execute({
        sql: "SELECT attempts, blocked_until FROM rate_limits WHERE key = ?",
        args: [key]
      });

      if (res.rows.length > 0) {
        const row = res.rows[0];
        const attempts = Number(row.attempts || 0);
        const blockedUntil = Number(row.blocked_until || 0);

        if (blockedUntil > now) {
          return { limited: true, remainingAttempts: 0 };
        }

        if (attempts >= maxAttempts) {
          const newBlockedUntil = now + lockoutMs;
          await tursoDb.execute({
            sql: "UPDATE rate_limits SET attempts = attempts + 1, blocked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
            args: [newBlockedUntil, key]
          });
          return { limited: true, remainingAttempts: 0 };
        }

        await tursoDb.execute({
          sql: "UPDATE rate_limits SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
          args: [key]
        });
        const remaining = Math.max(0, maxAttempts - (attempts + 1));
        return { limited: false, remainingAttempts: remaining };
      } else {
        await tursoDb.execute({
          sql: "INSERT INTO rate_limits (key, attempts, blocked_until) VALUES (?, 1, 0)",
          args: [key]
        });
        return { limited: false, remainingAttempts: maxAttempts - 1 };
      }
    }
  } catch (err) {
    console.error("[Rate Limit DB Error]", err);
  }

  // Fallback in-memory rate limiting
  let entry = localRateLimits.get(key);
  if (!entry || now > entry.blockedUntil) {
    entry = { attempts: 1, blockedUntil: 0 };
  } else {
    entry.attempts += 1;
  }

  if (entry.attempts > maxAttempts) {
    entry.blockedUntil = now + lockoutMs;
    localRateLimits.set(key, entry);
    return { limited: true, remainingAttempts: 0 };
  }

  localRateLimits.set(key, entry);
  return { limited: false, remainingAttempts: Math.max(0, maxAttempts - entry.attempts) };
}

async function resetRateLimit(key: string) {
  try {
    await initTursoTables();
    if (tursoDb) {
      await tursoDb.execute({
        sql: "DELETE FROM rate_limits WHERE key = ?",
        args: [key]
      });
    }
  } catch (e) {}
  localRateLimits.delete(key);
}

// Authentication & Session System with Database-backed Session Revocation & In-memory fallback
const localRevokedTokenHashes = new Set<string>();

function generateSessionTokenPayload(role: string = "admin"): { token: string; expiresAt: number; role: string; sessionId: string } {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const sessionId = crypto.randomBytes(16).toString("hex");
  const payload = `${role}:${expiresAt}:${sessionId}`;
  const hmac = crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("hex");
  const token = `${payload}:${hmac}`;
  return { token, expiresAt, role, sessionId };
}

async function recordIssuedSession(sessionId: string, token: string, role: string, expiresAt: number) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  try {
    await initTursoTables();
    if (tursoDb) {
      await tursoDb.execute({
        sql: "INSERT OR REPLACE INTO sessions (id, token_hash, role, expires_at) VALUES (?, ?, ?, ?)",
        args: [sessionId, tokenHash, role, expiresAt]
      });
    }
  } catch (e) {
    console.error("[Session Save Error]", e);
  }
}

async function verifyUserTokenRole(token: string | null): Promise<{ valid: boolean; role: string | null; sessionId?: string }> {
  if (!token) return { valid: false, role: null };
  const parts = token.split(":");
  if (parts.length !== 4) return { valid: false, role: null };
  const [role, expiresAtStr, sessionId, hmac] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return { valid: false, role: null };

  const payload = `${role}:${expiresAtStr}:${sessionId}`;
  const expectedHmac = crypto.createHmac("sha256", config.sessionSecret).update(payload).digest("hex");

  try {
    const isHmacValid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
    if (!isHmacValid) return { valid: false, role: null };

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    if (localRevokedTokenHashes.has(tokenHash)) {
      return { valid: false, role: null };
    }

    // Check server-side revocation in DB if Turso is available
    await initTursoTables();
    if (tursoDb) {
      const sessionRes = await tursoDb.execute({
        sql: "SELECT revoked_at, expires_at FROM sessions WHERE token_hash = ?",
        args: [tokenHash]
      });
      if (sessionRes.rows.length > 0) {
        const row = sessionRes.rows[0];
        if (row.revoked_at || Number(row.expires_at) < Date.now()) {
          return { valid: false, role: null };
        }
      }
    }

    return { valid: true, role, sessionId };
  } catch (e) {
    return { valid: false, role: null };
  }
}

function checkRoleAuth(allowedRoles: string[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIp = getClientIp(req);
    const authHeader = req.headers.authorization;
    const cookieToken = req.headers.cookie?.match(/marso_session=([^;]+)/)?.[1] || null;
    const token = (authHeader && authHeader.startsWith("Bearer ")) ? authHeader.substring(7).trim() : (cookieToken || null);

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

    const { valid, role } = await verifyUserTokenRole(token);
    if (!valid || !role) {
      logAuditEvent({
        action: "AUTH_CHECK",
        identity: "unauthenticated",
        ip: clientIp,
        resource: req.originalUrl,
        result: "DENIED",
        details: "Invalid, expired, or revoked token"
      });
      return res.status(401).json({ error: "Unauthorized: Invalid or revoked session." });
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

// Server-Side High-Entropy Access Codes System (8-character alphanumeric)
export function generateSecureAccessCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 30 non-ambiguous uppercase characters
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

async function saveAccessCodeToDb(code: string, createdBy: string, productId: string | null = null): Promise<number> {
  const codeHash = crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 Minutes validity

  try {
    await initTursoTables();
    if (tursoDb) {
      await tursoDb.execute({
        sql: "INSERT INTO access_codes (id, code_hash, product_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?)",
        args: [id, codeHash, productId, createdBy, expiresAt]
      });
    }
  } catch (e) {
    console.error("[Access Code Save Error]", e);
  }

  return expiresAt;
}

async function verifyAndConsumeAccessCode(code: string, productId?: string): Promise<boolean> {
  if (!code || typeof code !== "string") return false;
  const cleanCode = code.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (cleanCode.length !== 8) return false;

  const codeHash = crypto.createHash("sha256").update(cleanCode).digest("hex");
  const now = Date.now();

  try {
    await initTursoTables();
    if (tursoDb) {
      const res = await tursoDb.execute({
        sql: "SELECT id, expires_at, used_at, product_id FROM access_codes WHERE code_hash = ?",
        args: [codeHash]
      });

      if (res.rows.length === 0) return false;
      const row = res.rows[0];

      if (row.used_at) return false; // Single-use check
      if (Number(row.expires_at) <= now) return false; // Expiration check
      if (productId && row.product_id && String(row.product_id) !== String(productId)) return false; // Product scope check

      // Mark single-use
      await tursoDb.execute({
        sql: "UPDATE access_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [String(row.id)]
      });

      return true;
    }
  } catch (e) {
    console.error("[Access Code Verify Error]", e);
  }

  return false;
}

export function generateDatasheetPassToken(productId?: string): { passToken: string; expiresAt: number } {
  const expiresAt = Date.now() + 5 * 60 * 1000;
  const randomId = crypto.randomBytes(16).toString("hex");
  const payload = `pass:${productId || "all"}:${expiresAt}:${randomId}`;
  const hmac = crypto.createHmac("sha256", config.accessCodeSecret).update(payload).digest("hex");
  const passToken = `${payload}:${hmac}`;
  return { passToken, expiresAt };
}

export function verifyDatasheetPassToken(passToken: string | null, targetProductId?: string): boolean {
  if (!passToken || typeof passToken !== "string") return false;
  const parts = passToken.split(":");
  if (parts.length !== 5) return false;
  const [prefix, scopedProductId, expiresAtStr, randomId, hmac] = parts;
  if (prefix !== "pass") return false;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
  if (targetProductId && scopedProductId !== "all" && scopedProductId !== targetProductId) return false;

  const payload = `${prefix}:${scopedProductId}:${expiresAtStr}:${randomId}`;
  const expectedHmac = crypto.createHmac("sha256", config.accessCodeSecret).update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch (e) {
    return false;
  }
}

// Access Code Generation & Verification Endpoints
app.post(["/api/access-code/generate", "/access-code/generate"], checkEditorOrAdminAuth, async (req, res) => {
  const clientIp = getClientIp(req);
  const code = generateSecureAccessCode();
  const createdBy = (req as any).userRole || "admin";
  const productId = req.body?.productId ? String(req.body.productId) : null;

  const expiresAt = await saveAccessCodeToDb(code, createdBy, productId);
  const createdAt = Date.now();

  logAuditEvent({
    action: "ACCESS_CODE_GENERATE",
    identity: createdBy,
    role: createdBy,
    ip: clientIp,
    result: "SUCCESS"
  });

  res.json({ code, createdAt, expiresAt });
});

app.post(["/api/access-code/verify", "/access-code/verify"], async (req, res) => {
  const clientIp = getClientIp(req);
  const rateLimitKey = `access_code_verify:${clientIp}`;

  const { limited } = await checkAndRecordRateLimit(rateLimitKey, 10, 10 * 60 * 1000, 10 * 60 * 1000);
  if (limited) {
    logAuditEvent({
      action: "ACCESS_CODE_VERIFY",
      identity: "anonymous",
      ip: clientIp,
      result: "DENIED",
      details: "Rate limited for access code verification"
    });
    return res.status(429).json({ error: "Too many failed attempts. Please wait 10 minutes before trying again." });
  }

  const { code, productId } = req.body;
  if (!code || typeof code !== "string") {
    return res.status(400).json({ valid: false, error: "Access code must be an 8-character string." });
  }

  const isValid = await verifyAndConsumeAccessCode(code, productId);

  if (isValid) {
    await resetRateLimit(rateLimitKey);
    const { passToken } = generateDatasheetPassToken(productId);

    res.cookie("marso_datasheet_pass", passToken, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      maxAge: 5 * 60 * 1000
    });

    logAuditEvent({
      action: "ACCESS_CODE_VERIFY",
      identity: "customer",
      ip: clientIp,
      result: "SUCCESS"
    });
    return res.json({ valid: true, passToken });
  } else {
    logAuditEvent({
      action: "ACCESS_CODE_VERIFY",
      identity: "customer",
      ip: clientIp,
      result: "FAILURE",
      details: "Invalid, expired, or already used access code"
    });
    return res.json({ valid: false, error: "Invalid, expired, or previously used access code (codes expire after 5 minutes and are single-use)." });
  }
});

let aiInstance: any = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = config.geminiApiKey;
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
        return response;
      } catch (err: any) {
        lastError = err;
        if (attempt < 2 && (err.status === 503 || err.status === 429 || (err.message && (err.message.includes("503") || err.message.includes("high demand"))))) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
  }
  throw lastError || new Error("All chat fallback models failed.");
}

async function generateContentWithFallback(ai: any, contents: any[], configObj: any) {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: configObj
        });
        return response;
      } catch (err: any) {
        lastError = err;
        if (attempt < 2 && (err.status === 503 || err.status === 429 || (err.message && (err.message.includes("503") || err.message.includes("high demand"))))) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
  }
  throw lastError || new Error("All fallback models failed.");
}

const DATASHEETS_DIR = config.isVercel 
  ? path.join("/tmp", "datasheets") 
  : path.join(process.cwd(), "datasheets");

if (!fs.existsSync(DATASHEETS_DIR)) {
  try {
    fs.mkdirSync(DATASHEETS_DIR, { recursive: true });
  } catch (err) {
    console.error("Failed to create datasheets directory:", err);
  }
}

// Upload Endpoint (RBAC: Admin or Editor with Magic Byte Validation)
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

app.post(["/api/admin/login", "/admin/login"], async (req, res) => {
  const clientIp = getClientIp(req);
  const rateLimitKey = `admin_login:${clientIp}`;

  const { limited, remainingAttempts } = await checkAndRecordRateLimit(rateLimitKey, 5, 15 * 60 * 1000, 15 * 60 * 1000);
  if (limited) {
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
    logAuditEvent({
      action: "ADMIN_LOGIN",
      identity: email || "unknown",
      ip: clientIp,
      result: "FAILURE",
      details: "Missing password"
    });
    return res.status(400).json({ error: "Password is required." });
  }

  const passwordBuffer = Buffer.from(password);
  const expectedPasswordBuffer = Buffer.from(config.adminPassword);
  let isPasswordValid = false;

  try {
    if (passwordBuffer.length === expectedPasswordBuffer.length) {
      isPasswordValid = crypto.timingSafeEqual(passwordBuffer, expectedPasswordBuffer);
    }
  } catch (e) {}

  if (isPasswordValid) {
    await resetRateLimit(rateLimitKey);
    const { token, expiresAt, role, sessionId } = generateSessionTokenPayload("admin");
    await recordIssuedSession(sessionId, token, role, expiresAt);

    // Set secure HTTP-only session cookie
    res.cookie("marso_session", token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000
    });

    logAuditEvent({
      action: "ADMIN_LOGIN",
      identity: email || "admin@marso-egy.com",
      role: role,
      ip: clientIp,
      result: "SUCCESS"
    });
    return res.json({ success: true, token, expiresAt, role });
  } else {
    logAuditEvent({
      action: "ADMIN_LOGIN",
      identity: email || "unknown",
      ip: clientIp,
      result: "FAILURE",
      details: `Incorrect password. ${remainingAttempts} attempts remaining.`
    });
    return res.status(401).json({
      error: `Incorrect admin password. ${remainingAttempts} attempts remaining before lockout.`,
      remainingAttempts
    });
  }
});

app.post(["/api/admin/logout", "/admin/logout"], async (req, res) => {
  const clientIp = getClientIp(req);
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers.cookie?.match(/marso_session=([^;]+)/)?.[1] || null);

  if (token) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    localRevokedTokenHashes.add(tokenHash);
    try {
      await initTursoTables();
      if (tursoDb) {
        await tursoDb.execute({
          sql: "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?",
          args: [tokenHash]
        });
      }
    } catch (e) {}
  }

  res.clearCookie("marso_session");

  logAuditEvent({
    action: "ADMIN_LOGOUT",
    identity: "user",
    ip: clientIp,
    result: "SUCCESS"
  });

  return res.json({ success: true, message: "Logged out successfully." });
});

app.get(["/api/admin/verify", "/admin/verify"], async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers.cookie?.match(/marso_session=([^;]+)/)?.[1] || null);
  if (!token) return res.json({ authenticated: false, role: null });

  const { valid, role } = await verifyUserTokenRole(token);
  return res.json({ authenticated: valid, role: valid ? role : null });
});

// Combined Bootstrap API (Sanitized Public Response)
app.get(["/api/bootstrap", "/bootstrap"], async (req, res) => {
  try {
    const [rawProducts, categories] = await Promise.all([
      getStoredProducts(),
      getStoredCategories()
    ]);

    const sanitizedProducts = rawProducts.map(sanitizePublicProduct);
    const etagPayload = `${sanitizedProducts.length}-${sanitizedProducts[0]?.id || ''}-${categories.length}`;
    const etag = crypto.createHash("md5").update(etagPayload).digest("hex");

    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=59");
    res.setHeader("ETag", `"${etag}"`);

    if (req.headers["if-none-match"] === `"${etag}"`) {
      return res.status(304).end();
    }

    res.json({ products: sanitizedProducts, categories });
  } catch (err: any) {
    console.error("Error generating bootstrap data:", err);
    res.status(500).json({ error: "Failed to retrieve bootstrap data." });
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
    res.status(500).json({ error: "Failed to retrieve categories." });
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
    res.status(500).json({ error: "Failed to add category." });
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

    if (tursoDb) {
      await tursoDb.execute({
        sql: "UPDATE products SET category = ? WHERE category = ?",
        args: [cleanNew, cleanOld]
      });
    }

    cachedProducts = null;
    res.json({ categories, message: "Category updated successfully." });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update category." });
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
    res.status(500).json({ error: "Failed to delete category." });
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
    res.status(500).json({ error: "Failed to clear unused categories." });
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

// 1. Get all products (Public Sanitized Output)
app.get(["/api/products", "/products"], async (req, res) => {
  try {
    const rawProducts = await getStoredProducts();
    const sanitizedProducts = rawProducts.map(sanitizePublicProduct);
    const etagPayload = `${sanitizedProducts.length}-${sanitizedProducts[0]?.id || ''}`;
    const etag = crypto.createHash("md5").update(etagPayload).digest("hex");

    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=59");
    res.setHeader("ETag", `"${etag}"`);

    if (req.headers["if-none-match"] === `"${etag}"`) {
      return res.status(304).end();
    }

    res.json(sanitizedProducts);
  } catch (err: any) {
    console.error("Error reading stored products file:", err);
    res.status(500).json({ error: "Failed to retrieve products catalog." });
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

    if (tursoDb) {
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
    }

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
    if (!tursoDb) {
      return res.status(500).json({ error: "Database unavailable." });
    }

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
    if (!tursoDb) {
      return res.status(500).json({ error: "Database unavailable." });
    }

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
    res.status(500).json({ error: "Failed to delete product." });
  }
});

// 5. Download Product Datasheet (Protected by Admin Auth OR Server Access Code)
app.get(["/api/products/:id/datasheet", "/products/:id/datasheet"], async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const { id } = req.params;

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Product ID is required." });
    }

    let isAuthorized = false;

    // Authorization check 1: Admin/Editor bearer token or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers.cookie?.match(/marso_session=([^;]+)/)?.[1] || null);
    const { valid: tokenValid } = await verifyUserTokenRole(token);
    if (tokenValid) {
      isAuthorized = true;
    }

    // Authorization check 2: Short-lived server-issued pass token or cookie
    if (!isAuthorized) {
      const passTokenParam = (req.headers["x-access-pass"] as string) || (req.query.passToken as string) || (req.headers.cookie?.match(/marso_datasheet_pass=([^;]+)/)?.[1] || null);
      if (passTokenParam && verifyDatasheetPassToken(passTokenParam, id)) {
        isAuthorized = true;
      }
    }

    // Authorization check 3: Direct single-use 8-character access code (header or query)
    if (!isAuthorized) {
      const codeParam = (req.headers["x-access-code"] as string) || (req.query.accessCode as string);
      if (codeParam && typeof codeParam === "string") {
        isAuthorized = await verifyAndConsumeAccessCode(codeParam, id);
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
    let product: any = null;

    if (tursoDb) {
      const prodRes = await tursoDb.execute({
        sql: "SELECT * FROM products WHERE id = ?",
        args: [id]
      });
      if (prodRes.rows.length > 0) {
        product = prodRes.rows[0];
      }
    }

    if (!product && cachedProducts) {
      product = cachedProducts.find((p: any) => String(p.id) === String(id));
    }

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const datasheetPath = product.datasheet_file ? String(product.datasheet_file) : (product.datasheetFile || null);

    if (!datasheetPath) {
      return res.status(404).json({ error: "Datasheet PDF not registered or uploaded for this product." });
    }

    let buffer: Buffer | null = null;
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
    } else if (fs.existsSync(path.join(DATASHEETS_DIR, datasheetPath))) {
      buffer = fs.readFileSync(path.join(DATASHEETS_DIR, datasheetPath));
    } else if (s3Client) {
      try {
        const getCmd = new GetObjectCommand({
          Bucket: config.r2BucketName,
          Key: datasheetPath,
        });
        const r2Data = await s3Client.send(getCmd);
        const bytes = await r2Data.Body?.transformToByteArray();
        if (bytes) {
          buffer = Buffer.from(bytes);
        }
      } catch (err) {
        console.warn("[R2 GetObject Error]", err);
      }
    }

    if (!buffer) {
      return res.status(404).json({ error: "Datasheet file inaccessible or not found." });
    }

    if (!validatePdfMagicBytes(buffer)) {
      return res.status(400).json({ error: "Invalid PDF datasheet structure." });
    }

    const clientFilename = (product.datasheet_name || product.datasheetName) ? String(product.datasheet_name || product.datasheetName) : `${String(product.name).replace(/[^a-zA-Z0-9]/g, "_")}_datasheet.pdf`;
    
    logAuditEvent({
      action: "DATASHEET_DOWNLOAD",
      identity: "authorized_user",
      ip: clientIp,
      resource: id,
      result: "SUCCESS"
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(clientFilename)}"`);
    res.send(buffer);
  } catch (err: any) {
    console.error("Error handling datasheet download:", err);
    res.status(500).json({ error: "Internal server error during datasheet download." });
  }
});

// 6. Upload and AI Extract Specs from PDF Datasheet (RBAC: Admin or Editor)
app.post(["/api/datasheets/upload-and-extract", "/datasheets/upload-and-extract"], checkEditorOrAdminAuth, async (req, res) => {
  try {
    const { datasheetFile, filename, pdfText } = req.body;
    if (!datasheetFile && !pdfText) {
      return res.status(400).json({ error: "datasheetFile or pdfText is required." });
    }

    const originalName = filename ? String(filename).replace(/[^a-zA-Z0-9.-]/g, "_").substring(0, 255) : `datasheet_${Date.now()}.pdf`;
    let validatedPdfRef: string | null = null;
    let cleanBase64 = "";
    let pdfBuffer: Buffer | null = null;
    let extractedRawText: string = typeof pdfText === "string" ? pdfText.trim() : "";

    if (datasheetFile) {
      try {
        validatedPdfRef = validateAndCleanPdfReference(datasheetFile);
      } catch (valErr: any) {
        return res.status(400).json({ error: valErr.message || "Invalid PDF datasheet payload." });
      }

      if (validatedPdfRef) {
        if (validatedPdfRef.startsWith("http://") || validatedPdfRef.startsWith("https://")) {
          if (!isTrustedRemoteAssetUrl(validatedPdfRef)) {
            return res.status(400).json({ error: "Remote PDF URL is not from a trusted R2 origin." });
          }
          const response = await fetch(validatedPdfRef, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) {
            return res.status(404).json({ error: "Failed to fetch PDF from trusted R2 URL." });
          }
          const arrayBuffer = await response.arrayBuffer();
          pdfBuffer = Buffer.from(arrayBuffer);
          cleanBase64 = pdfBuffer.toString("base64");
        } else if (validatedPdfRef.startsWith("data:")) {
          const parsed = parseDataUrl(validatedPdfRef);
          if (!parsed || parsed.mimeType !== "application/pdf") {
            return res.status(400).json({ error: "Invalid PDF data URL or unsupported MIME type." });
          }
          pdfBuffer = parsed.buffer;
          cleanBase64 = parsed.buffer.toString("base64");
        } else {
          pdfBuffer = Buffer.from(validatedPdfRef, "base64");
          cleanBase64 = validatedPdfRef;
        }

        if (pdfBuffer && !validatePdfMagicBytes(pdfBuffer)) {
          return res.status(400).json({ error: "Invalid PDF file structure or corrupt data." });
        }

        // Try ultra-fast server-side text extraction if pdfText wasn't supplied by client
        if (!extractedRawText && pdfBuffer) {
          try {
            const pdfData = await extractText(new Uint8Array(pdfBuffer));
            if (pdfData && pdfData.text) {
              extractedRawText = Array.isArray(pdfData.text) ? pdfData.text.join("\n") : String(pdfData.text);
              extractedRawText = extractedRawText.trim();
            }
          } catch (unpdfErr) {
            console.warn("[unpdf Extraction Warning]", unpdfErr);
          }
        }
      }
    }

    // Persist storage (R2 and/or local disk) if datasheetFile is present
    let finalDatasheetFile = validatedPdfRef || "";
    if (pdfBuffer) {
      if (s3Client && config.r2AccountId && !config.r2AccountId.includes("your_")) {
        try {
          const r2Url = await uploadToR2(originalName, pdfBuffer, "application/pdf");
          if (r2Url) {
            finalDatasheetFile = r2Url;
          }
        } catch (r2Err) {
          console.warn("[R2 Storage Warning] Failed uploading PDF to R2:", r2Err);
        }
      }

      // Save copy to local DATASHEETS_DIR
      try {
        const diskFilename = `upload-${Date.now()}-${originalName}`;
        fs.writeFileSync(path.join(DATASHEETS_DIR, diskFilename), pdfBuffer);
        if (!finalDatasheetFile.startsWith("http") && !finalDatasheetFile.startsWith("data:")) {
          finalDatasheetFile = diskFilename;
        }
      } catch (diskErr) {
        console.warn("[Datasheet Disk Save Warning]", diskErr);
      }
    }

    // AI Extraction with Gemini 2.5 Flash
    let parsedSpecs: any = null;
    let datasheetKnowledgeSummary: string | null = null;
    let aiWarning: string | null = null;

    try {
      const ai = getGeminiClient();
      let contents: any[] = [];

      const promptInstruction = `Analyze the provided industrial rubber product datasheet and accurately extract all technical specifications into a clean JSON object for our catalog.
Fields to extract:
1. name: Official brand/model name of the rubber product in English (e.g., "Agricultural & Farm Rubber Mats MC-001RM").
2. nameAr: Accurate commercial Arabic title (e.g., "حصير مطاطي زراعي وللمزارع والاسطبلات").
3. category: The best matching catalog category: "Rubber Mat Flooring", "Rubber Tile Flooring", "Industrial Rubber Flooring", "Rubber Automotive Spare Parts", "Rubber Car Mats", "Constructive Rubber Industries", "Reclaimed and Crumb Rubber", or "Reverse Engineering".
4. code: Catalog/Model product code (e.g., "MC-001RM").
5. sizeDims: Available sizes, rolls, tiles, and thickness measurements (e.g., "1.2m x 10m x 10mm" or "1000mm x 1000mm").
6. weight: Weight per square meter, unit weight, or density.
7. features: Key distinguishing properties, hidden technical benefits, anti-fatigue, anti-slip, weather-proof, chemical resistance, and quality certifications.
8. physicalSpecs: Shore A hardness, tensile strength, elongation at break, temperature range, and compression set.
9. material: Rubber compound formulation (e.g., "Natural Rubber & SBR Blend", "EPDM Vulcanized Rubber").
10. color: Colors available (e.g., "Black / Dark Grey").
11. application: Recommended applications and installation environments (e.g., "Dairy barns, equestrian stables, animal transport, walkways").
12. price: Numeric price if mentioned in document, else empty string.
13. priceCurrency: "EGP" or "USD".

Ensure values are complete, clean, professional, and directly useful for the product card.`;

      if (extractedRawText && extractedRawText.length > 20) {
        contents = [{
          text: `${promptInstruction}\n\n=== DATASHEET TEXT CONTENT ===\n${extractedRawText.substring(0, 50000)}`
        }];
      } else if (cleanBase64) {
        contents = [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: "application/pdf"
            }
          },
          { text: promptInstruction }
        ];
      } else {
        throw new Error("No PDF content or readable text provided for extraction.");
      }

      const response = await generateContentWithFallback(ai, contents, {
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            nameAr: { type: "STRING" },
            category: { type: "STRING" },
            code: { type: "STRING" },
            sizeDims: { type: "STRING" },
            weight: { type: "STRING" },
            features: { type: "STRING" },
            physicalSpecs: { type: "STRING" },
            material: { type: "STRING" },
            color: { type: "STRING" },
            application: { type: "STRING" },
            price: { type: "STRING" },
            priceCurrency: { type: "STRING" }
          },
          required: ["name", "nameAr", "category", "code", "sizeDims", "weight", "features", "physicalSpecs", "material", "color", "application"]
        }
      });

      const text = response.text;
      if (text) {
        parsedSpecs = JSON.parse(text);
        datasheetKnowledgeSummary = `Technical Datasheet Information for ${parsedSpecs.name} (${parsedSpecs.nameAr || ''}):
- Category: ${parsedSpecs.category}
- Model Code: ${parsedSpecs.code}
- Dimensions & Sizes: ${parsedSpecs.sizeDims}
- Weight & Load: ${parsedSpecs.weight}
- Key Features: ${parsedSpecs.features}
- Technical & Physical Specs: ${parsedSpecs.physicalSpecs}
- Material Compounds: ${parsedSpecs.material}
- Color Options: ${parsedSpecs.color}
- Applications & Uses: ${parsedSpecs.application}
${parsedSpecs.price ? `- Rate / Price: ${parsedSpecs.price} ${parsedSpecs.priceCurrency || 'EGP'}` : ''}`;
      }
    } catch (aiErr: any) {
      console.warn("[Gemini Datasheet Extraction Notice] AI extraction notice:", aiErr.message || aiErr);
      aiWarning = "Datasheet attached successfully. Automated extraction encountered an issue; specs can be entered manually.";
    }

    return res.json({
      success: true,
      specs: parsedSpecs,
      datasheetFile: finalDatasheetFile || datasheetFile,
      datasheetName: originalName,
      datasheetKnowledge: datasheetKnowledgeSummary,
      warning: aiWarning
    });

  } catch (err: any) {
    console.error("Failed to upload and extract PDF datasheet:", err);
    return res.status(500).json({ error: err.message || "Failed to process PDF datasheet." });
  }
});

// Chat assistant using Gemini with Hardened Rate Limiting & Input Validation
app.post(["/api/chat", "/chat"], async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers.cookie?.match(/marso_session=([^;]+)/)?.[1] || null);
    const { valid } = await verifyUserTokenRole(token);

    const rateLimitKey = `ai_chat:${clientIp}`;
    const maxReqs = valid ? 100 : 20;
    const { limited } = await checkAndRecordRateLimit(rateLimitKey, maxReqs, 60 * 60 * 1000, 60 * 60 * 1000);

    if (limited) {
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

    const rawProductsList = await getStoredProducts();
    const sanitizedProductsList = rawProductsList.map(sanitizePublicProduct);
    
    if (!cachedMarsoText) {
      cachedMarsoText = getMarsoGuideDatabaseText();
    }
    const marsoGuideText = cachedMarsoText;
    const productsKnowledgeFormatted = getProductsKnowledgeFormatted(sanitizedProductsList);

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

GENERAL MARSO CORPORATE KNOWLEDGE BASE:
${marsoGuideText || "Marso Company (Origin of Rubber Industries and Floors) - 10th of Ramadan City, Egypt. ISO 9001/14001/45001 certified manufacturer."}

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
  if (!config.isProduction) {
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

function isMainModule(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  const script = process.argv[1];
  if (!script) return false;
  const base = path.basename(script);
  return base === "index.ts" || base === "index.js" || base === "server.cjs" || base === "server.js";
}

if (!config.isVercel && isMainModule()) {
  startServer();
}

export default app;
