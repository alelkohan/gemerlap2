const fs = require('fs');
let appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'));

appJson.expo.android.googleServicesFile = "./google-services.json";

fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2));
console.log("Added googleServicesFile to app.json");
