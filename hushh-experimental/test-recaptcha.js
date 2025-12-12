// Test reCAPTCHA verification with dummy keys
const RecaptchaVerifier = require("./lib/recaptcha.ts");

async function testRecaptcha() {
  console.log("Testing reCAPTCHA with dummy keys...");

  // Test with dummy token (will fail)
  const result = await RecaptchaVerifier.verifyToken("dummy-token-123");
  console.log("Result:", result); // Should be false

  console.log("Test complete. Dummy keys will always fail verification.");
}

testRecaptcha();
