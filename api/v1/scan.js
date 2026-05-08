import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { scanId } = req.query;
  if (!scanId) return res.status(400).json({ error: 'Missing scanId' });
  const { data } = await supabase.from('scans').select('score, grade, status').eq('id', scanId).single();
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
} 