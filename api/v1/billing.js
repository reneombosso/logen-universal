import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { apiKey, email } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Missing apiKey' });
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', product_data: { name: 'LOGEN API Credits' }, unit_amount: 1000 }, quantity: 1 }], // 10 $ pour 1000 crédits (0,01 $/appel)
    mode: 'payment',
    success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}&apiKey=${apiKey}`,
    cancel_url: req.headers.origin,
    metadata: { apiKey, amount: 1000 }
  });
  res.json({ url: session.url });
} 