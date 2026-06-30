const fs = require('fs');
const path = require('path');

const distPath = path.join(process.cwd(), 'dist');
const files = fs.readdirSync(distPath).filter(f => f.endsWith('.html'));

const tagsToInject = `
<title>Gemerlap TPS</title>
<link rel="apple-touch-icon" href="/icon.png" />
<meta name="apple-mobile-web-app-title" content="Gemerlap">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
`;

for (const file of files) {
  const filePath = path.join(distPath, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('apple-mobile-web-app-capable')) {
    content = content.replace('</head>', tagsToInject + '</head>');
    fs.writeFileSync(filePath, content);
  }
}
