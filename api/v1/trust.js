import { createClient } from '@supabase/supabase-js';
import dns from 'dns/promises';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Connecteurs
async function checkSSL(domain) {
  try { await fetch(`https://${domain}`, { method: 'HEAD' }); return true; } catch { return false; }
}
async function checkSPF(domain) {
  try { const txt = await dns.resolveTxt(domain); return txt.flat().some(r => r.includes('v=spf1')); } catch { return false; }
}
async function computeScore(target) {
  const [sslOk, spfOk] = await Promise.all([checkSSL(target), checkSPF(target)]);
  let score = 50;
  if (sslOk) score += 25;
  if (spfOk) score += 15;
  return Math.min(100, Math.max(0, score));
}

export default async function handler(req, res) {
  // GET public (gratuit, limité par IP via Vercel – on ne gère pas ici)
  if (req.method === 'GET') {
    const { target } = req.query;
    if (!target) return res.status(400).json({ error: 'Missing target' });
    const { data: cached } = await supabase.from('scans').select('score, grade, created_at').eq('target', target).gt('created_at', new Date(Date.now() - 24*3600*1000).toISOString()).single();
    if (cached) return res.json({ target, score: cached.score, grade: cached.grade, cached: true });
    const score = await computeScore(target);
    const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';
    await supabase.from('scans').insert({ target, score, grade, status: 'completed' });
    return res.json({ target, score, grade, cached: false });
  }

  // POST payant (nécessite clé API)
  if (req.method === 'POST') {
    const { target, apiKey } = req.body;
    if (!target || !apiKey) return res.status(400).json({ error: 'Missing target or apiKey' });
    const { data: keyData } = await supabase.from('api_keys').select('credits').eq('key', apiKey).single();
    if (!keyData || keyData.credits < 1) return res.status(402).json({ error: 'Insufficient credits. Purchase at /api/v1/billing.' });
    await supabase.from('api_keys').update({ credits: keyData.credits - 1 }).eq('key', apiKey);
    const score = await computeScore(target);
    const grade = score >= 80 ? 'A' : score >= 50 ? 'B' : 'C';
    const { data: scan } = await supabase.from('scans').insert({ target, score, grade, status: 'completed' }).select().single();
    return res.json({ scanId: scan.id, score, grade, creditsRemaining: keyData.credits - 1 });
  }
  res.status(405).json({ error: 'Method not allowed' });
} 
