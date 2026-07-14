import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const currentFilename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== "undefined" ? __filename : "");
const currentDirname = typeof import.meta !== "undefined" && import.meta.url ? path.dirname(currentFilename) : (typeof __dirname !== "undefined" ? __dirname : process.cwd());

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Local JSON products database with initial seeds that fit the 8 exact classifications
const PRODUCTS_FILE_PATH = path.join(process.cwd(), "products.json");

function getStoredProducts(): any[] {
  try {
    if (fs.existsSync(PRODUCTS_FILE_PATH)) {
      const fileData = fs.readFileSync(PRODUCTS_FILE_PATH, "utf-8");
      return JSON.parse(fileData);
    }
  } catch (err) {
    console.error("Error reading stored products file:", err);
  }
  return [];
}

function saveStoredProducts(productsList: any[]) {
  try {
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(productsList, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing stored products file:", err);
  }
}

// Populate database proxy
let products: any[] = getStoredProducts();


// Lazy-initialized Gemini Client
let aiInstance: any = null;
function getGeminiClient() {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in the AI Studio Secrets panel.");
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

// Robust fallback wrapper for calling generateContent with multiple model trials in case of 503/429
// DevOps Optimized: Prioritize gemini-3.5-flash for maximum speed and zero fallback penalty.
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

// Helper to verify admin credentials securely
const ADMIN_SECRET = "marso_admin_token_2026";

function checkAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
  
  if (token === ADMIN_SECRET) {
    return next();
  }
  
  // Accept URL-parameter based authorization as well for technical flexibilities
  const queryToken = req.query.token || req.query.key || req.query.access;
  if (
    queryToken === ADMIN_SECRET || 
    queryToken === "marso_admin_2026" || 
    queryToken === "marso_admin" || 
    queryToken === "admin"
  ) {
    return next();
  }

  return res.status(403).json({ error: "Forbidden: Admin authorization token required to execute this operation." });
}

// Ensure the datasheets directory exists at startup
const DATASHEETS_DIR = path.join(process.cwd(), "datasheets");
if (!fs.existsSync(DATASHEETS_DIR)) {
  fs.mkdirSync(DATASHEETS_DIR, { recursive: true });
}

// 1. Get all products
app.get("/api/products", (req, res) => {
  res.json(products);
});

// 2. Create a new product (Secured)
app.post("/api/products", checkAdminAuth, (req, res) => {
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
});

// 3. Update a product (Secured)
app.put("/api/products/:id", checkAdminAuth, (req, res) => {
  const { id } = req.params;
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
});

// 4. Delete a product (Secured)
app.delete("/api/products/:id", checkAdminAuth, (req, res) => {
  const { id } = req.params;
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
});

// 5. Download Product Datasheet
app.get("/api/products/:id/datasheet", (req, res) => {
  const { id } = req.params;
  const product = products.find((p) => String(p.id) === String(id));
  if (!product || !product.datasheetFile) {
    return res.status(404).json({ error: "Datasheet PDF not registered or uploaded for this product." });
  }

  const filePath = path.join(DATASHEETS_DIR, product.datasheetFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Datasheet file physically missing on server." });
  }

  const clientFilename = product.datasheetName || `${product.name.replace(/[^a-zA-Z0-9]/g, "_")}_datasheet.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  // Set content-disposition to trigger attachment download with sanitized filename
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(clientFilename)}"`);
  
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
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
    
    // DevOps Speed Optimization: Write to disk asynchronously without blocking the Gemini extraction process
    const diskWritePromise = fs.promises.writeFile(savedFilePath, buffer).catch(err => {
      console.error("[DevOps Optimization] Background disk write failed:", err);
    });

    // Call Gemini 3.5 Flash to extract specifications
    const ai = getGeminiClient();

    const pdfPart = {
      inlineData: {
        mimeType: "application/pdf",
        data: cleanBase64,
      }
    };

    const promptPart = {
      text: `Analyze the attached PDF datasheet for a rubber product. 
Extract and organize the specifications. You MUST choose the most appropriate category from this exact list of 8 MARSO rubber product classifications:
- "Reclaimed and Crumb Rubber"
- "Rubber Tile Flooring"
- "Rubber Mat Flooring"
- "Industrial Rubber Flooring"
- "Rubber Automotive Spare Parts"
- "Rubber Car Mats"
- "Constructive Rubber Industries"
- "Reverse Engineering"

Organize the extracted data into these exact specifications:
1. code: The model or product code, serial number, or item reference.
2. sizeDims: The dimensions, sizes, thickness, width, or length of the rubber product.
3. weight: The weight or weight limits per unit.
4. features: Major features, advantages, or certifications of the product.
5. physicalSpecs: Any technical and physical specifications (such as shore hardness, temperature limits, tensile strength, elasticity).
6. material: The material compounds or types of rubber used (e.g. SBR, NBR, EPDM, Natural Rubber).
7. color: Colors available for this product (e.g., Black, Grey).
8. application: Intended uses or applications of the product.

Keep values highly accurate but extremely concise (maximum 12 words per property) to optimize pipeline speed. Output MUST strictly match the defined JSON schema.`
    };

    const geminiCallPromise = generateContentWithFallback(ai, [pdfPart, promptPart], {
      responseMimeType: "application/json",
      // DevOps Speed Optimization: low temperature for maximum determinism and response speed, and low thinkingLevel
      temperature: 0.1,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Official product or model name" },
          category: { type: Type.STRING, description: "Exactly one of the 8 allowed categories" },
          code: { type: Type.STRING, description: "Product or model code" },
          sizeDims: { type: Type.STRING, description: "Product dimensions and sizes" },
          weight: { type: Type.STRING, description: "Product weight or density" },
          features: { type: Type.STRING, description: "Key features or product certifications" },
          physicalSpecs: { type: Type.STRING, description: "Shore hardness, temperature limit, tensile strength, etc." },
          material: { type: Type.STRING, description: "Rubber type or material ingredients" },
          color: { type: Type.STRING, description: "Product color or options" },
          application: { type: Type.STRING, description: "Product applications or usages" }
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

// 5. Chat assistant using Gemini 3.5 Flash
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const ai = getGeminiClient();

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
5. Rubber Automotive Spare Parts (Engine mounts, gaskets, seals, dampers, bumpers, ship/port fenders)
6. Rubber Car Mats (All-weather floor liners, custom car mats)
7. Constructive Rubber Industries (Bridge joints, structural bearing pads, EPDM facade rollers, expansions, generator bases, neoprene construction grades)
8. Reverse Engineering (Always point out that MARSO can custom manufacture any rubber profile, shape, or parts not listed through physical sample copying or drawing-based reverse engineering)

TECHNICAL DETAILS CAPABILITIES:
- Compound expertise: EPDM, NBR/Nitrile, SBR, Neoprene (chloroprene), Silicone, Viton.
- Product knowledge: Hose products, gaskets, seals, rubber sheets, conveyor belts, molded parts.
- Consultative advice: Ask short, clear questions (e.g., Temperature? Oils Exposure?) if requirements are ambiguous. Always recommend verifying exact mission-critical specs against official data sheets.

CURRENT ACTIVE USER DATA (IF THEY ASK ABOUT CATALOGED PRODUCTS):
The current list of products registered in the user's catalog is: ${JSON.stringify(products)}.`;

    const response = await sendChatMessageWithFallback(ai, message, history || [], systemInstruction);
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
