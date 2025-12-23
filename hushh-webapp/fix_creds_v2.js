
const fs = require('fs');
const dotenv = require('dotenv');

try {
  // Read .env.local
  const buf = fs.readFileSync('.env.local');
  const config = dotenv.parse(buf);
  
  const jsonStr = config.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON not found in .env.local");
    process.exit(1);
  }

  // Parse JSON inner string
  const obj = JSON.parse(jsonStr);
  
  // Write to ROOT service-account.json
  fs.writeFileSync('../service-account.json', JSON.stringify(obj, null, 2));
  console.log("Success: wrote ../service-account.json");
  
} catch (e) {
  console.error("Error:", e);
  process.exit(1);
}
