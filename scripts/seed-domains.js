import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const domains = ['google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'github.com']; // ajoutez des milliers
const outDir = path.join(__dirname, '../public/truth');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const domain of domains) {
  const html = `<!DOCTYPE html><html><head><title>LOGEN Trust Score for ${domain}</title></head>
  <body><h1>Trust Score for ${domain}</h1>
  <p>Score: <span id="score">loading...</span>/100</p>
  <script>fetch('/api/v1/trust?target=${domain}').then(r=>r.json()).then(d=>document.getElementById('score').innerText=d.score);</script>
  </body></html>`;
  fs.writeFileSync(path.join(outDir, `${domain}.html`), html);
}
console.log(`✅ ${domains.length} pages SEO générées`); 