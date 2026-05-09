const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const dns = require('dns').promises;

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialisation Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Vérification SSL
async function checkSSL(domain) {
  return new Promise((resolve) => {
    const req = https.request(`https://${domain}`, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Vérification SPF
async function checkSPF(domain) {
  try {
    const txt = await dns.resolveTxt(domain);
    const records = txt.flat();
    return records.some(r => r.includes('v=spf1'));
  } catch {
    return false;
  }
}

// Calcul du score
async function computeScore(target) {
  const [sslOk, spfOk] = await Promise.all([checkSSL(target), checkSPF(target)]);
  let score = 50;
  if (sslOk) score += 25;
  if (spfOk) score += 15;
  return Math.min(100, Math.max(0, score));
}

// Endpoint principal
app.get('/api/v1/trust', async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'Missing target' });

  // Vérifier le cache (moins de 24h)
  const { data: cached } = await supabase
    .from('scans')
    .select('score', 'grade')
    .eq('target', target)
    .gt('created_at', new Date(Date.now() - 24*3600*1000).toISOString())
    .single();

  if (cached) {
    return res.json({ target, score: cached.score, grade: cached.grade, cached: true });
  }

  const score = await computeScore(target);
  const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';

  // Stocker le résultat
  await supabase.from('scans').insert({ target, score, grade, status: 'completed' });

  res.json({ target, score, grade, cached: false });
});

app.listen(port, () => console.log(`LOGEN API ready on port ${port}`)); 
