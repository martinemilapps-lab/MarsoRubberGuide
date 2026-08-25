import {
  getServerConfig,
  resetConfigCache,
  getClientIp,
  sanitizePublicProduct,
  generateSecureAccessCode,
  generateDatasheetPassToken,
  verifyDatasheetPassToken
} from "./index.ts";

function runSecurityTests() {
  console.log("==================================================");
  console.log("RUNNING AUTOMATED SECURITY HARDENING TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Config Fail-Closed Validation
  try {
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.SESSION_SECRET;
    
    // Simulate production with missing secret
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    resetConfigCache();

    let threw = false;
    try {
      const testConfig = getServerConfig();
    } catch (e: any) {
      threw = e.message.includes("SESSION_SECRET");
    }

    process.env.NODE_ENV = origEnv;
    if (origSecret) process.env.SESSION_SECRET = origSecret;
    resetConfigCache();

    assert(threw, "Production fails closed when required security secrets are missing");
  } catch (e: any) {
    assert(false, `Config Fail-Closed test threw error: ${e.message}`);
  }

  // Test 2: Public Product Catalog Sanitization (R2 URL & PDF Knowledge Shield)
  try {
    const rawProduct = {
      id: "prod-101",
      name: "EPDM Rubber Tile",
      category: "Rubber Tile Flooring",
      photo: "https://pub-r2.dev/photo.jpg",
      datasheetFile: "https://pub-r2.dev/private/secret-datasheet.pdf",
      datasheetName: "EPDM_Tile_Spec.pdf",
      datasheetKnowledge: "CONFIDENTIAL_PDF_EXTRACTED_SPECS",
      specs: {
        code: "EPDM-01",
        datasheetKnowledge: "INTERNAL_SPECS_SUMMARY"
      }
    };

    const sanitized = sanitizePublicProduct(rawProduct);

    assert(
      sanitized.datasheetFile === undefined &&
      sanitized.datasheetKnowledge === undefined &&
      sanitized.specs.datasheetKnowledge === undefined &&
      sanitized.hasDatasheet === true &&
      sanitized.datasheetName === "EPDM_Tile_Spec.pdf" &&
      sanitized.photo === "https://pub-r2.dev/photo.jpg",
      "Public catalog API response strips private R2 object keys/URLs and extracted PDF knowledge"
    );
  } catch (e: any) {
    assert(false, `Sanitization test failed: ${e.message}`);
  }

  // Test 3: High Entropy Access Code Generation
  try {
    const code1 = generateSecureAccessCode();
    const code2 = generateSecureAccessCode();

    assert(
      typeof code1 === "string" &&
      code1.length === 8 &&
      code1 !== code2 &&
      /^[A-Z0-9]{8}$/.test(code1),
      "Access codes generate high-entropy 8-character cryptographic strings"
    );
  } catch (e: any) {
    assert(false, `Access code generation test failed: ${e.message}`);
  }

  // Test 4: Trusted Client IP Extraction Helper
  try {
    const mockReq1 = {
      headers: { "x-real-ip": "203.0.113.195" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" }
    } as any;

    const mockReq2 = {
      headers: { "x-forwarded-for": "198.51.100.44, 10.0.0.1" },
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" }
    } as any;

    const ip1 = getClientIp(mockReq1);
    const ip2 = getClientIp(mockReq2);

    assert(
      ip1 === "203.0.113.195" && ip2 === "198.51.100.44",
      "getClientIp helper accurately extracts proxy IP headers without spoofing"
    );
  } catch (e: any) {
    assert(false, `Client IP test failed: ${e.message}`);
  }

  // Test 5: Server-issued Pass Token HMAC Verification
  try {
    const { passToken } = generateDatasheetPassToken("prod-101");
    const isValidForProd = verifyDatasheetPassToken(passToken, "prod-101");
    const isInvalidForOtherProd = verifyDatasheetPassToken(passToken, "prod-999");
    const isTamperedInvalid = verifyDatasheetPassToken(passToken + "tampered", "prod-101");

    assert(
      isValidForProd && !isInvalidForOtherProd && !isTamperedInvalid,
      "HMAC-signed short-lived pass tokens verify correctly and reject tampered or cross-product tokens"
    );
  } catch (e: any) {
    assert(false, `Pass token verification test failed: ${e.message}`);
  }

  console.log("\n==================================================");
  console.log(`SECURITY SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests();
