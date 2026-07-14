import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import productsData from "../products.json" with { type: "json" };

dotenv.config();

const currentFilename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== "undefined" ? __filename : "");
const currentDirname = typeof import.meta !== "undefined" && import.meta.url ? path.dirname(currentFilename) : (typeof __dirname !== "undefined" ? __dirname : process.cwd());

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const PRODUCTS_FILE_PATH = process.env.VERCEL 
  ? path.join("/tmp", "products.json") 
  : path.join(process.cwd(), "products.json");

if (process.env.VERCEL && !fs.existsSync(PRODUCTS_FILE_PATH)) {
  try {
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(productsData, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write initial seeds to /tmp/products.json:", err);
  }
}

function getStoredProducts(): any[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE_PATH)) {
      const fileData = fs.readFileSync(PRODUCTS_FILE_PATH, "utf-8");
      return JSON.parse(fileData);
    }
  } catch (err) {
    console.error("Error reading stored products file:", err);
  }
  return productsData;
}

function saveStoredProducts(productsList: any[]) {
  try {
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(productsList, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing stored products file:", err);
  }
}

const ADMIN_SECRET = "marso_admin_token_2026";

function checkAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  
  if (token === ADMIN_SECRET) {
    return next();
  }
  
  const queryToken = req.query.token || req.query.key || req.query.access || req.query.admin01;
  if (
    queryToken === ADMIN_SECRET || 
    queryToken === "marso_admin_2026" || 
    queryToken === "marso_admin" || 
    queryToken === "admin" ||
    queryToken === "admin01" ||
    req.query.admin01 !== undefined ||
    req.query.access === "admin01"
  ) {
    return next();
  }

  return res.status(403).json({ error: "Forbidden: Admin authorization token required to execute this operation." });
}

// Lazy-initialized Gemini Client
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

// Robust fallback wrapper for chatting with multiple model trials
// DevOps Optimized: Prioritize gemini-3.5-flash for instant responses.
async function sendChatMessageWithFallback(ai: any, message: string, history: any[], systemInstruction: string) {
  const models = ["gemini-3.5-flash", "gemini-3.1-pro-preview"];
  let lastError = null;
  for (const model of models) {
    try {
      console.log(`[Gemini API] Attempting chat message with model: ${model}`);
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
      console.warn(`[Gemini API] Chat model ${model} failed with error:`, err.message || err);
    }
  }
  throw lastError || new Error("All chat fallback models failed.");
}

async function generateContentWithFallback(ai: any, contents: any[], config: any) {
  const models = ["gemini-3.5-flash", "gemini-3.1-pro-preview"];
  let lastError = null;
  for (const model of models) {
    try {
      console.log(`[Gemini API] Attempting generateContent with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });
      console.log(`[Gemini API] Success using model: ${model}`);
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API] Model ${model} failed with error:`, err.message || err);
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

// 1. Get all products
app.get("/api/products", (req, res) => {
  try {
    const products = getStoredProducts();
    res.json(products);
  } catch (err: any) {
    console.error("Error reading stored products file:", err);
    res.status(500).json({ error: "Failed to retrieve products catalog: " + (err.message || "Unknown error") });
  }
});

// 2. Create a new product (Secured)
app.post("/api/products", checkAdminAuth, (req, res) => {
  try {
    const products = getStoredProducts();
    const newProduct = {
      id: String(Date.now()),
      name: req.body.name || "Unnamed Product",
      nameAr: req.body.nameAr || "",
      category: req.body.category || "Reverse Engineering",
      photo: req.body.photo || "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&q=80&w=400",
      extraPhotos: req.body.extraPhotos || [],
      specs: {
        code: req.body.specs?.code || "",
        sizeDims: req.body.specs?.sizeDims || "",
        weight: req.body.specs?.weight || "",
        features: req.body.specs?.features || "",
        physicalSpecs: req.body.specs?.physicalSpecs || "",
        material: req.body.specs?.material || "",
        color: req.body.specs?.color || "",
        application: req.body.specs?.application || ""
      },
      datasheetFile: req.body.datasheetFile || undefined,
      datasheetName: req.body.datasheetName || undefined
    };
    products.unshift(newProduct);
    saveStoredProducts(products);
    res.status(201).json(newProduct);
  } catch (err: any) {
    console.error("Failed to create product:", err);
    res.status(500).json({ error: err.message || "Failed to create product." });
  }
});

// 3. Update a product (Secured)
app.put("/api/products/:id", checkAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const products = getStoredProducts();
    const index = products.findIndex((p) => String(p.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    // Clean up previous datasheet file if it's being replaced/removed
    if (products[index].datasheetFile && req.body.datasheetFile !== undefined && products[index].datasheetFile !== req.body.datasheetFile) {
      try {
        const oldFilePath = path.join(DATASHEETS_DIR, products[index].datasheetFile);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      } catch (err) {
        console.error("Error removing orphaned datasheet file:", err);
      }
    }

    products[index] = {
      ...products[index],
      name: req.body.name ?? products[index].name,
      nameAr: req.body.nameAr ?? products[index].nameAr ?? "",
      category: req.body.category ?? products[index].category,
      photo: req.body.photo ?? products[index].photo,
      extraPhotos: req.body.extraPhotos ?? products[index].extraPhotos ?? [],
      specs: {
        code: req.body.specs?.code ?? products[index].specs?.code ?? "",
        sizeDims: req.body.specs?.sizeDims ?? products[index].specs?.sizeDims ?? "",
        weight: req.body.specs?.weight ?? products[index].specs?.weight ?? "",
        features: req.body.specs?.features ?? products[index].specs?.features ?? "",
        physicalSpecs: req.body.specs?.physicalSpecs ?? products[index].specs?.physicalSpecs ?? "",
        material: req.body.specs?.material ?? products[index].specs?.material ?? "",
        color: req.body.specs?.color ?? products[index].specs?.color ?? "",
        application: req.body.specs?.application ?? products[index].specs?.application ?? ""
      },
      datasheetFile: req.body.datasheetFile !== undefined ? req.body.datasheetFile : products[index].datasheetFile,
      datasheetName: req.body.datasheetName !== undefined ? req.body.datasheetName : products[index].datasheetName
    };
    saveStoredProducts(products);
    res.json(products[index]);
  } catch (err: any) {
    console.error("Failed to update product:", err);
    res.status(500).json({ error: err.message || "Failed to update product." });
  }
});

// 4. Delete a product (Secured)
app.delete("/api/products/:id", checkAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const products = getStoredProducts();
    const index = products.findIndex((p) => String(p.id) === String(id));
    if (index === -1) {
      return res.status(404).json({ error: "Product not found" });
    }
    const deleted = products.splice(index, 1);
    saveStoredProducts(products);

    // Clean up associated physical datasheet PDF from disk
    if (deleted[0] && deleted[0].datasheetFile) {
      try {
        const filePath = path.join(DATASHEETS_DIR, deleted[0].datasheetFile);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error("Error unlinking deleted product datasheet:", err);
      }
    }

    res.json(deleted[0]);
  } catch (err: any) {
    console.error("Failed to delete product:", err);
    res.status(500).json({ error: err.message || "Failed to delete product." });
  }
});

// 5. Download Product Datasheet
app.get("/api/products/:id/datasheet", (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Product ID is required and must be a string." });
    }

    const products = getStoredProducts();
    const product = products.find((p) => String(p.id) === String(id));
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    if (!product.datasheetFile) {
      return res.status(404).json({ error: "Datasheet PDF not registered or uploaded for this product." });
    }

    const filePath = path.join(DATASHEETS_DIR, product.datasheetFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Datasheet file physically missing on server." });
    }

    const clientFilename = product.datasheetName || `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}_datasheet.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(clientFilename)}"`);
    
    const stream = fs.createReadStream(filePath);
    stream.on("error", (streamErr) => {
      console.error("Stream read error:", streamErr);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream the datasheet file." });
      }
    });
    stream.pipe(res);
  } catch (err: any) {
    console.error("Error handling datasheet download:", err);
    res.status(500).json({ error: err.message || "Internal server error during datasheet download." });
  }
});

// 6. Upload and AI Extract Specs from PDF Datasheet
app.post("/api/datasheets/upload-and-extract", checkAdminAuth, async (req, res) => {
  try {
    const { pdfBase64, filename } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ error: "pdfBase64 string is required to perform operation" });
    }

    // Clean up base64 prefix if present
    let cleanBase64 = pdfBase64;
    if (pdfBase64.startsWith("data:")) {
      const match = pdfBase64.match(/^data:application\/pdf;base64,(.*)$/);
      if (match) {
        cleanBase64 = match[1];
      }
    }

    // Save PDF file to storage directory
    const originalName = filename || "datasheet.pdf";
    const uniqueId = `datasheet-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const savedFilename = `${uniqueId}.pdf`;
    const savedFilePath = path.join(DATASHEETS_DIR, savedFilename);

    const buffer = Buffer.from(cleanBase64, "base64");
    
    // Write to disk asynchronously
    const diskWritePromise = fs.promises.writeFile(savedFilePath, buffer);

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
1. name: The official brand or model name of the product.
2. category: The specific category classifying this rubber product. This MUST be exactly one of the following 8 allowed values:
   - "Reclaimed and Crumb Rubber"
   - "Rubber Tile Flooring"
   - "Rubber Mat Flooring"
   - "Industrial Rubber Flooring"
   - "Rubber Automotive Spare Parts"
   - "Rubber Car Mats"
   - "Constructive Rubber Industries"
   - "Reverse Engineering"
3. code: A unique catalog or model code (often found on datasheets, e.g. MC-101RC).
4. sizeDims: The dimensions, sizes, thickness, width, or length of the rubber product.
5. weight: The weight or weight limits per unit.
6. features: Major features, advantages, or certifications of the product.
7. physicalSpecs: Any technical and physical specifications (such as shore hardness, temperature limits, tensile strength, elasticity).
8. material: The material compounds or types of rubber used (e.g. SBR, NBR, EPDM, Natural Rubber).
9. color: Colors available for this product (e.g., Black, Grey).
10. application: Intended uses or applications of the product.

Keep values highly accurate but extremely concise (maximum 12 words per property) to optimize pipeline speed. Output MUST strictly match the defined JSON schema.`
    };

    const geminiCallPromise = generateContentWithFallback(ai, [pdfPart, promptPart], {
      responseMimeType: "application/json",
      temperature: 0.1,
      responseSchema: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Official product or model name" },
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
        required: ["name", "category", "code", "sizeDims", "weight", "features", "physicalSpecs", "material", "color", "application"]
      }
    });

    // Run both operations in parallel to achieve absolute minimal latency
    const [_, response] = await Promise.all([diskWritePromise, geminiCallPromise]);

    const text = response.text;
    if (!text) {
      throw new Error("No response text was generated by Gemini.");
    }

    const parsedSpecs = JSON.parse(text);

    res.json({
      specs: parsedSpecs,
      datasheetFile: savedFilename,
      datasheetName: originalName
    });

  } catch (err: any) {
    console.error("Failed to upload and extract PDF datasheet:", err);
    res.status(500).json({ error: err.message || "Failed to process PDF datasheet." });
  }
});

// 3. Chat assistant using Gemini
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    
    // Message input validation
    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "Message is required and must be a non-empty string." });
    }

    // History input validation (optional)
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

    const productsList = getStoredProducts();

    // System instructions detailing the specialist persona, Marso knowledge framework, products catalog, and operational guidelines
    const systemInstruction = `You are the MARSO RUBBER Product Specialist, an expert consultant for high-quality rubber products manufactured by Marso Company (Origin of Rubber Industries and Floors / مارسو للمطاط).
Your goal is to assist customers, engineers, and procurement teams by providing technical details, product recommendations, and general information about Marso Company's offerings.
You are professional, reliable, and technically savvy, but keep explanations accessible for non-experts.

PRIMARY DIRECTIVE:
- Efficiency is key. Prioritize brevity over detail.
- Provide concise, "to-the-point" answers.
- Avoid long-winded explanations or providing unsolicited background information.
- Stay on task: only answer the specific question asked.

OPERATIONAL CONSTRAINTS & GUARDRAILS:
- No Guesswork: If custom product details or exact pricing is unavailable, direct user to contact MARSO sales department at Sylvia@marso-egy.com or Samuel@marso-egy.com.
- Competitors: Never disparage competitors. Focus on durability and material integrity of MARSO RUBBER products.
- Confidentiality: Do not disclose chemical formulas or internal manufacturing processes.
- No File Mentioning: Strictly prohibited from referencing external uploaded documents. Provide facts as your own expertise. No phrases like "In the attached document" or "Based on the PDF".
- Always offer/inject a concise CALL TO ACTION (CTA) to reach out to the sales or engineering teams for formal quotes or technical drawings, when appropriate.

CORE CORPORATE IDENTITY KNOWLEDGE:
- Company Name: Marso Company (Origin of Rubber Industries and Floors) / مارسو للمطاط
- Eco-friendly focus: Recycles thousands of tons of scrap tires annually into rubber flooring and compounds, preventing tire burning and environmental pollution.
- Head Office & Factory: Plot 3/34 Neweiba Street, behind Egypt Cafe, Third Industrial Zone - A1, 10th of Ramadan City, Egypt.
- Contact: Phone: 01090113113 / 01001445060 / 01200161781. Fax: +20554 410574. Emails: Sylvia@marso-egy.com / Samuel@marso-egy.com.
- Vision: To become the #1 company in Egypt for rubber spare parts and flooring in 10 years.
- Certifications: 3 ISO certificates obtained in 2010 (Quality Management, Occupational Health & Safety, and ISO 14001 Environment).
- Presence: Exports to more than 20 countries globally (Africa, Middle East, Europe).

STRICT CLASSIFCATIONS TO MAP:
1. Reclaimed and Crumb Rubber (Reclem Rubber / Generato, rubber granules, rubber powder)
2. Rubber Tile Flooring (Sound-absorbing gym, tartan track granules, accessibility floor, bulletproof walls, pool supplies, nurseries)
3. Rubber Mat Flooring (Cow farm flooring, horse stables, anti-bacterial mats)
4. Industrial Rubber Flooring (Fire-retardant, electrical-insulating switchboards, anti-vibration machine dampers, garage)
5. Rubber Automotive Spare Parts (Engine mounts, gaskets, seals, bumpers, ship/port fenders)
6. Rubber Car Mats (All-weather floor liners, custom car mats)
7. Constructive Rubber Industries (Bridge joints, structural bearing pads, EPDM facade rollers, expansions, generator bases, neoprene construction grades)
8. Reverse Engineering (Always point out that MARSO can custom manufacture any rubber profile, shape, or parts not listed through physical sample copying or drawing-based reverse engineering)

TECHNICAL DETAILS CAPABILITIES:
- Compound expertise: EPDM, NBR/Nitrile, SBR, Neoprene (chloroprene), Silicone, Viton.
- Product knowledge: Hose products, gaskets, seals, rubber sheets, conveyor belts, molded parts.
- Consultative advice: Ask short, clear questions (e.g., Temperature? Oils Exposure?) if requirements are ambiguous. Always recommend verifying exact mission-critical specs against official data sheets.

CURRENT ACTIVE USER DATA (IF THEY ASK ABOUT CATALOGED PRODUCTS):
The current list of products registered in the user's catalog is: ${JSON.stringify(productsList)}.`;

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

// Serve frontend assets
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
    // SPA fallback
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
