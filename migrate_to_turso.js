import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("TURSO_DATABASE_URL environment variable is required.");
  process.exit(1);
}

const db = createClient({
  url,
  authToken: authToken || undefined,
});

async function main() {
  console.log("Connecting to Turso database...");

  // Create products table
  await db.execute(`
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

  // Create categories_meta table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories_meta (
      id TEXT PRIMARY KEY,
      categories_list TEXT NOT NULL
    );
  `);

  console.log("Tables verified/created successfully.");

  // Read products.json
  const productsPath = path.join(process.cwd(), "products.json");
  if (fs.existsSync(productsPath)) {
    const raw = fs.readFileSync(productsPath, "utf-8");
    const products = JSON.parse(raw);

    console.log(`Found ${products.length} products in products.json. Seeding Turso...`);

    for (const p of products) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO products (id, name, name_ar, category, photo, extra_photos, specs, datasheet_file, datasheet_name)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(p.id),
          p.name || "Unnamed Product",
          p.nameAr || "",
          p.category || "Reverse Engineering",
          p.photo || "",
          JSON.stringify(p.extraPhotos || []),
          JSON.stringify(p.specs || {}),
          p.datasheetFile || null,
          p.datasheetName || null
        ]
      });
    }
    console.log("Successfully seeded products into Turso database!");
  } else {
    console.log("No products.json file found to seed.");
  }
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
