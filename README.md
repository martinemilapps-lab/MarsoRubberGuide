# MARSO Rubber Product Specialist — Security Hardened Production Platform

MARSO Rubber Product Specialist is a production-grade web application featuring a public customer-facing product catalog, an AI-powered Technical Rubber Consultant, and a secure dedicated Admin Portal (`/admin`).

---

## 🔒 Security Architecture Overview

### 1. Server-Side Authentication & Authorization
- **HMAC Signed Session Tokens**: Login attempts are verified against `ADMIN_PASSWORD` server-side, returning time-bound HMAC SHA-256 tokens (`role:expiresAt:hmac`).
- **Role-Based Access Control (RBAC)**: All product creation, modification, deletion, category management, and PDF spec extraction endpoints require valid `admin` or `editor` roles.

### 2. Server-Side Access Code System
- **Server Generation Only**: 4-digit access codes for datasheet downloads are generated exclusively on the server (`POST /api/access-code/generate`) by authorized staff.
- **Server Verification**: Access codes are validated server-side (`POST /api/access-code/verify`) with timing-safe comparison (`crypto.timingSafeEqual`) and 5-minute automatic expiration.
- **Rate Limiting**: Failed access code verification attempts are rate-limited per IP (10 failed attempts per 10 minutes lock out verification attempts for 10 minutes).
- **Datasheet Download Protection**: Downloading a technical datasheet (`GET /api/products/:id/datasheet`) requires either an authenticated admin bearer token or a valid server-verified 4-digit access code passed in `X-Access-Code` or `accessCode` query parameter.

### 3. Unified Asset & Input Validation
- **Image Validation**: Images are strictly validated for allowed MIME types (`image/webp`, `image/png`, `image/jpeg`), max size (8 MB), and trusted origin URLs (Cloudflare R2 or Unsplash seed assets).
- **PDF Datasheet Validation**: PDFs are validated for `application/pdf` MIME type, max size (8 MB), and trusted Cloudflare R2 origin URLs.
- **Payload Caps**: Product creation/update endpoints enforce strict string length caps on model codes, specifications, categories, and datasheet knowledge.
- **Trusted Remote R2 Sandbox**: Fetching remote assets is restricted strictly to HTTPS URLs matching the configured `R2_PUBLIC_URL` origin.

### 4. Strict CORS Allowlist
- Cross-Origin Resource Sharing (CORS) enforces strict origin allowlisting.
- Arbitrary reflected origins are rejected in production.
- Production requests require `ALLOWED_ORIGINS` to be explicitly configured.

---

## 🛠️ Environment Variables Reference

Copy `.env.example` to `.env` or set these environment variables in your Vercel deployment settings:

| Variable | Description | Required in Production |
| :--- | :--- | :---: |
| `SESSION_SECRET` | Secret key for signing & verifying admin session HMAC tokens | **Yes** |
| `ADMIN_PASSWORD` | Strong password required for login to `/admin` portal | **Yes** |
| `ACCESS_CODE_SECRET` | Secret key for signing & validating 4-digit datasheet access codes | **Yes** |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins (e.g. `https://marso-rubber-guide.vercel.app,https://www.marso-egy.com`) | **Yes** |
| `GEMINI_API_KEY` | Gemini API Key for AI Consultant and PDF datasheet spec extraction | **Yes** |
| `TURSO_DATABASE_URL` | Turso SQLite Database URL (`libsql://...`) | Optional |
| `TURSO_AUTH_TOKEN` | Turso SQLite Database Auth Token | Optional |
| `R2_ACCOUNT_ID` | Cloudflare R2 Account ID | Optional |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key ID | Optional |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key | Optional |
| `R2_BUCKET_NAME` | Cloudflare R2 Bucket Name (default: `marso-photos`) | Optional |
| `R2_PUBLIC_URL` | Cloudflare R2 Public CDN URL (e.g. `https://pub-xxx.r2.dev`) | Optional |

> **Warning**: In production or Vercel environments, missing required environment variables will trigger security warnings and block unauthorized cross-origin requests.

---

## 🚀 Local Development & Production Deployment

### Prerequisites
- Node.js (v18+)
- npm

### Local Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure local environment
cp .env.example .env.local

# 3. Start local development server
npm run dev
```

### Production Build & Type Check
```bash
# Verify TypeScript type checking
npx tsc --noEmit

# Run production build
npm run build
```

### Deploying to Vercel
All backend API routes, serverless handlers, and frontend static assets must be deployed directly to Vercel:

```bash
npx vercel --prod
```
