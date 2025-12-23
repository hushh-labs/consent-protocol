
const fs = require('fs');
try {
  const env = fs.readFileSync('.env.local', 'utf8');
  const match = env.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.+)/);
  if (match) {
    const jsonStr = match[1];
    const obj = JSON.parse(jsonStr); 
    fs.writeFileSync('service-account.json', JSON.stringify(obj, null, 2));
    console.log("Service Account JSON fixed and written.");
  } else {
    console.error("Could not find FIREBASE_SERVICE_ACCOUNT_JSON in .env.local");
  }
} catch (e) {
  console.error("Error processing service account:", e);
}
