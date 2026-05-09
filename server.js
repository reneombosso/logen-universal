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

// ---------- Connecteurs ----------
async function checkSSL(domain) {
  return new Promise((resolve) => {
    const req = https.request(`https://${domain}`, { method: 'HEAD', timeout: 5000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function checkSPF(domain) {
  try {
    const txt = await dns.resolveTxt(domain);
    const records = txt.flat();
    return records.some(r => r.includes('v=spf1'));
  } catch {
    return false;
  }
}

async function computeScore(target) {
  const [sslOk, spfOk] = await Promise.all([checkSSL(target), checkSPF(target)]);
  let score = 50;
  if (sslOk) score += 25;
  if (spfOk) score += 15;
  return Math.min(100, Math.max(0, score));
}

// ---------- Routes ----------

// GET public (gratuit, avec cache)
app.get('/api/v1/trust', async (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).json({ error: 'Missing target' });

  // Cache 24h
  const { data: cached } = await supabase
    .from('scans')
    .select('score, grade')
    .eq('target', target)
    .gt('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .single();

  if (cached) {
    return res.json({ target, score: cached.score, grade: cached.grade, cached: true });
  }

  const score = await computeScore(target);
  const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';
  await supabase.from('scans').insert({ target, score, grade, status: 'completed' });
  res.json({ target, score, grade, cached: false });
});

// POST payant (nécessite clé API)
app.post('/api/v1/trust', async (req, res) => {
  const { target, apiKey } = req.body;
  if (!target || !apiKey) return res.status(400).json({ error: 'Missing target or apiKey' });

  // Vérifier la clé et les crédits
  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('credits')
    .eq('key', apiKey)
    .single();

  if (error || !keyData || keyData.credits < 1) {
    return res.status(402).json({ error: 'Insufficient credits. Please purchase more.' });
  }

  // Consommer 1 crédit
  await supabase
    .from('api_keys')
    .update({ credits: keyData.credits - 1 })
    .eq('key', apiKey);

  const score = await computeScore(target);
  const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';
  const { data: scan } = await supabase
    .from('scans')
    .insert({ target, score, grade, status: 'completed' })
    .select()
    .single();

  res.json({
    scanId: scan.id,
    score,
    grade,
    creditsRemaining: keyData.credits - 1
  });
});

// Endpoint pour le badge (statique)
app.use('/badge.js', express.static('public/badge.js'));
app.get('/verify/:target', (req, res) => res.sendFile('public/verify.html', { root: '.' }));
app.get('/',        (req, res) => res.sendFile('public/landing.html', { root: '.' }));

app.listen(port, () => console.log(`LOGEN API ready on port ${port}`)); 
 
