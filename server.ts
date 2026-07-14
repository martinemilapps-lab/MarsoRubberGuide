import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const currentFilename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== "undefined" ? __filename : "");
const currentDirname = typeof import.meta !== "undefined" && import.meta.url ? path.dirname(currentFilename) : (typeof __dirname !== "undefined" ? __dirname : process.cwd());

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const PRODUCTS_FILE_PATH = path.join(process.cwd(), "products.json");

function getStoredProducts(): any[] {
  if (!fs.existsSync(PRODUCTS_FILE_PATH)) {
    throw new Error("Products database file does not exist.");
  }
  const fileData = fs.readFileSync(PRODUCTS_FILE_PATH, "utf-8");
  return JSON.parse(fileData);
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

const DATASHEETS_DIR = path.join(process.cwd(), "datasheets");
if (!fs.existsSync(DATASHEETS_DIR)) {
  fs.mkdirSync(DATASHEETS_DIR, { recursive: true });
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

// 2. Download Product Datasheet
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
