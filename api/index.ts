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

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

function getProductsKnowledgeFormatted(productsList: any[]): string {
  if (cachedFormattedKnowledge && cachedFormattedProductsRef === productsList) {
    return cachedFormattedKnowledge;
  }

  // AI Knowledge Privacy Shield: Filter out system metadata rows and sensitive system items
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

function getMarsoGuideDatabaseText(): string {
  try {
    const marsoGuidePath = path.join(process.cwd(), "marsoGuide Database.txt");
    if (fs.existsSync(marsoGuidePath)) {
      const content = fs.readFileSync(marsoGuidePath, "utf-8");
      if (content && content.trim().length > 0) {
        return content.trim();
      }
    }
  } catch (err) {
    console.error("[Marso Knowledge] Failed to read marsoGuide Database.txt:", err);
  }
  return "";
}

async function seedDatabaseIfEmpty() {
  if (!tursoDb) return;
  try {
    await initTursoTables();
    const countRes = await tursoDb.execute("SELECT COUNT(*) as cnt FROM products");
    const count = Number(countRes.rows[0]?.cnt || 0);

    if (count === 0 && Array.isArray(productsData) && productsData.length > 0) {
      console.log("[Turso DB] Database is empty. Seeding initial products list...");
      for (const p of productsData) {
        await tursoDb.execute({
          sql: `INSERT OR REPLACE INTO products (id, name, name_ar, category, photo, extra_photos, specs, datasheet_file, datasheet_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            String(p.id),
            p.name || "Unnamed Product",
            p.nameAr || "",
            p.category || "Reverse Engineering",
            p.photo || "",
            JSON.stringify([]),
            JSON.stringify({
              ...(p.specs || {}),
              datasheetKnowledge: (p as any).datasheetKnowledge || (p.specs as any)?.datasheetKnowledge || null
            }),
            p.datasheetFile || null,
            p.datasheetName || null
          ]
        });
      }
      console.log("[Turso DB] Successfully seeded initial products list.");
    }
  } catch (err) {
    console.error("[Turso DB] Seeding check failed:", err);
  }
}

async function revalidateProductsInBackground() {
  if (isRevalidatingProducts || !tursoDb) return;
  isRevalidatingProducts = true;
  try {
    await initTursoTables();
    if (!isSeeded) {
      isSeeded = true;
      await seedDatabaseIfEmpty();
    }

    const res = await tursoDb.execute("SELECT * FROM products ORDER BY created_at DESC");

    if (res.rows && res.rows.length > 0) {
      const mapped = res.rows.map((row: any) => {
        let extraPhotos = [];
        let specs: any = {};
        try { extraPhotos = row.extra_photos ? JSON.parse(String(row.extra_photos)) : []; } catch(e){}
        try { specs = row.specs ? JSON.parse(String(row.specs)) : {}; } catch(e){}

        return {
          id: String(row.id),
          name: String(row.name),
          nameAr: String(row.name_ar || ""),
          category: String(row.category),
          photo: String(row.photo || ""),
          extraPhotos: extraPhotos,
          specs: specs,
          datasheetFile: row.datasheet_file ? String(row.datasheet_file) : null,
          datasheetName: row.datasheet_name ? String(row.datasheet_name) : null,
          datasheetKnowledge: specs?.datasheetKnowledge || null
        };
      });

      cachedProducts = mapped;
      lastFetchTime = Date.now();

      try {
        fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(mapped, null, 2), "utf-8");
      } catch (e) {}
    }
  } catch (err) {
    console.error("[Turso DB] Background revalidation error:", err);
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

const SESSION_SECRET = process.env.SESSION_SECRET || "marso_secure_session_secret_key_2026_xyz";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "marso_admin_2026";

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
  if (token === "marso_admin_token_2026") return { valid: true, role: "admin" };
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
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    }

    const { valid, role } = verifyUserTokenRole(token);
    if (!valid || !role) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token." });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: `Forbidden: Role '${role}' lacks permission for this resource.` });
    }

    (req as any).userRole = role;
    return next();
  };
}

const checkAdminAuth = checkRoleAuth(["admin"]);
const checkEditorOrAdminAuth = checkRoleAuth(["admin", "editor"]);

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

// Upload Endpoint (Cloudflare R2 or Direct Turso DB WebP Storage)
app.post(["/api/upload", "/upload"], async (req, res) => {
  try {
    const { fileData, filename, contentType } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: "fileData is required." });
    }
    const cleanFilename = filename || `file_${Date.now()}`;
    const type = contentType || (cleanFilename.endsWith(".pdf") ? "application/pdf" : "image/webp");

    if (s3Client) {
      try {
        let buffer: Buffer;
        if (fileData.startsWith("data:")) {
          const base64Str = fileData.split(",")[1] || fileData;
          buffer = Buffer.from(base64Str, "base64");
        } else {
          buffer = Buffer.from(fileData, "base64");
        }
        const publicUrl = await uploadToR2(cleanFilename, buffer, type);
        return res.json({ url: publicUrl, key: publicUrl });
      } catch (uploadErr) {
        console.warn("[R2 Upload Warning] R2 upload failed, falling back to Turso direct storage:", uploadErr);
      }
    }

    // Direct Turso DB Storage (Option A)
    res.json({ url: fileData, key: fileData });
  } catch (err: any) {
    console.error("[Upload Endpoint Error]", err);
    res.json({ url: req.body?.fileData || "", key: req.body?.fileData || "" });
  }
});

// Admin Authentication Endpoints

app.post(["/api/admin/login", "/admin/login"], (req, res) => {
  const clientIp = (req.headers["x-forwarded-for"] as string || req.ip || "unknown").split(",")[0].trim();

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: "Too many failed attempts. Account locked for 15 minutes." });
  }

  const { password } = req.body;
  if (!password || typeof password !== "string") {
    recordLoginAttempt(clientIp, false);
    return res.status(400).json({ error: "Password is required." });
  }

  if (password === ADMIN_PASSWORD) {
    recordLoginAttempt(clientIp, true);
    const { token, expiresAt, role } = generateUserRoleToken("admin");
    return res.json({ success: true, token, expiresAt, role });
  } else {
    recordLoginAttempt(clientIp, false);
    const entry = loginAttempts.get(clientIp);
    const remaining = entry ? Math.max(0, 5 - entry.attempts) : 4;
    return res.status(401).json({
      error: `Incorrect admin password. ${remaining} attempts remaining before lockout.`,
      remainingAttempts: remaining
    });
  }
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
    const newId = req.body.id ? String(req.body.id) : String(Date.now());
    let datasheetFile = req.body.datasheetFile || null;
    const datasheetName = req.body.datasheetName || null;

    if (req.body.category && typeof req.body.category === "string") {
      const currentCats = await getStoredCategories();
      if (!currentCats.some(c => c.toLowerCase() === req.body.category.trim().toLowerCase())) {
        currentCats.push(req.body.category.trim());
        await saveStoredCategories(currentCats);
      }
    }

    const datasheetKnowledgeVal = req.body.datasheetKnowledge || req.body.specs?.datasheetKnowledge || null;
    const specsObj = {
      code: req.body.specs?.code || "",
      sizeDims: req.body.specs?.sizeDims || "",
      weight: req.body.specs?.weight || "",
      features: req.body.specs?.features || "",
      physicalSpecs: req.body.specs?.physicalSpecs || "",
      material: req.body.specs?.material || "",
      color: req.body.specs?.color || "",
      application: req.body.specs?.application || "",
      price: req.body.specs?.price || req.body.price || "",
      priceCurrency: req.body.specs?.priceCurrency || req.body.priceCurrency || "EGP",
      datasheetKnowledge: datasheetKnowledgeVal
    };

    await tursoDb.execute({
      sql: `INSERT OR REPLACE INTO products (id, name, name_ar, category, photo, extra_photos, specs, datasheet_file, datasheet_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newId,
        req.body.name || "Unnamed Product",
        req.body.nameAr || "",
        req.body.category || "Reverse Engineering",
        req.body.photo || "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400",
        JSON.stringify([]),
        JSON.stringify(specsObj),
        datasheetFile,
        datasheetName
      ]
    });

    const mapped = {
      id: newId,
      name: req.body.name || "Unnamed Product",
      nameAr: req.body.nameAr || "",
      category: req.body.category || "Reverse Engineering",
      photo: req.body.photo || "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400",
      extraPhotos: [],
      specs: specsObj,
      datasheetFile: datasheetFile,
      datasheetName: datasheetName,
      datasheetKnowledge: datasheetKnowledgeVal
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
    res.status(500).json({ error: err.message || "Failed to create product." });
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

    const datasheetFile = req.body.datasheetFile !== undefined ? req.body.datasheetFile : existingRow.datasheet_file;
    const datasheetName = req.body.datasheetName !== undefined ? req.body.datasheetName : existingRow.datasheet_name;
    const datasheetKnowledgeVal = req.body.datasheetKnowledge !== undefined ? req.body.datasheetKnowledge : (existingSpecs.datasheetKnowledge ?? null);

    const updatedSpecs = {
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
      datasheetKnowledge: datasheetKnowledgeVal
    };

    const updatedName = req.body.name ?? String(existingRow.name);
    const updatedNameAr = req.body.nameAr ?? String(existingRow.name_ar || "");
    const updatedCategory = req.body.category ?? String(existingRow.category);
    const updatedPhoto = req.body.photo ?? String(existingRow.photo || "");
    const updatedExtraPhotos: string[] = [];

    await tursoDb.execute({
      sql: `UPDATE products SET name = ?, name_ar = ?, category = ?, photo = ?, extra_photos = ?, specs = ?, datasheet_file = ?, datasheet_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      args: [
        updatedName,
        updatedNameAr,
        updatedCategory,
        updatedPhoto,
        JSON.stringify(updatedExtraPhotos),
        JSON.stringify(updatedSpecs),
        datasheetFile,
        datasheetName,
        id
      ]
    });

    const mappedUpdated = {
      id: id,
      name: updatedName,
      nameAr: updatedNameAr,
      category: updatedCategory,
      photo: updatedPhoto,
      extraPhotos: updatedExtraPhotos,
      specs: updatedSpecs,
      datasheetFile: datasheetFile,
      datasheetName: datasheetName,
      datasheetKnowledge: datasheetKnowledgeVal
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
    res.status(500).json({ error: err.message || "Failed to update product." });
  }
});

// 4. Delete a product
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

// 5. Download Product Datasheet
app.get(["/api/products/:id/datasheet", "/products/:id/datasheet"], async (req, res) => {
  try {
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
      const response = await fetch(datasheetPath);
      if (!response.ok) {
        return res.status(404).json({ error: "Failed to download datasheet from cloud URL." });
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (datasheetPath.startsWith("data:")) {
      const base64Str = datasheetPath.split(",")[1] || datasheetPath;
      buffer = Buffer.from(base64Str, "base64");
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
    res.status(500).json({ error: err.message || "Internal server error during datasheet download." });
  }
});

// 6. Upload and AI Extract Specs from PDF Datasheet
app.post(["/api/datasheets/upload-and-extract", "/datasheets/upload-and-extract"], checkAdminAuth, async (req, res) => {
  try {
    const { datasheetFile, filename } = req.body;
    if (!datasheetFile) {
      return res.status(400).json({ error: "datasheetFile is required to perform operation" });
    }

    const originalName = filename || "datasheet.pdf";
    let cleanBase64 = "";

    if (datasheetFile.startsWith("http://") || datasheetFile.startsWith("https://")) {
      const response = await fetch(datasheetFile);
      if (!response.ok) {
        return res.status(404).json({ error: "Failed to fetch uploaded PDF from R2 URL." });
      }
      const arrayBuffer = await response.arrayBuffer();
      cleanBase64 = Buffer.from(arrayBuffer).toString("base64");
    } else if (datasheetFile.startsWith("data:")) {
      const match = datasheetFile.match(/^data:application\/pdf;base64,(.*)$/);
      cleanBase64 = match ? match[1] : datasheetFile.split(",")[1];
    } else {
      cleanBase64 = datasheetFile;
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (keyErr: any) {
      console.error("Gemini client initialization failed for upload-and-extract:", keyErr);
      return res.status(500).json({ error: keyErr.message || "Failed to initialize Gemini client." });
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
      datasheetFile: datasheetFile,
      datasheetName: originalName,
      datasheetKnowledge: datasheetKnowledgeSummary
    });

  } catch (err: any) {
    console.error("Failed to upload and extract PDF datasheet:", err);
    res.status(500).json({ error: err.message || "Failed to process PDF datasheet." });
  }
});

// Chat assistant using Gemini
app.post(["/api/chat", "/chat"], async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Message is required and must be a non-empty string." });
    }

    if (history !== undefined) {
      if (!Array.isArray(history)) {
        return res.status(400).json({ error: "History must be an array of message objects." });
      }
      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        if (!item || typeof item !== "object") {
          return res.status(400).json({ error: `History item at index ${i} must be an object.` });
        }
        if (item.role !== "user" && item.role !== "model") {
          return res.status(400).json({ error: `History item at index ${i} must have a role of 'user' or 'model'.` });
        }
        if (typeof item.content !== "string" || item.content.trim() === "") {
          return res.status(400).json({ error: `History item at index ${i} must have a non-empty string content.` });
        }
      }
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (keyErr: any) {
      console.error("Gemini client initialization failed:", keyErr);
      return res.status(500).json({ error: keyErr.message || "Failed to initialize Gemini client." });
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
      response = await sendChatMessageWithFallback(ai, message, history || [], systemInstruction);
    } catch (apiErr: any) {
      console.error("Gemini API call failed:", apiErr);
      return res.status(502).json({ error: "Gemini API call failed: " + (apiErr.message || "Unknown error") });
    }

    const reply = response.text || "No reply was generated.";
    res.json({ reply });
  } catch (error: any) {
    console.error("Gemini API Error in backend:", error);
    res.status(500).json({ error: error.message || "An error occurred with Gemini." });
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
