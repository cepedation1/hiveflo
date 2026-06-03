// api/create-checkout.js — HiveFlow Stripe Checkout
// Vercel Node.js Serverless Function
// Requires env var: STRIPE_SECRET_KEY

const PRICE_IDS = {
  starter:    'price_1TdhqnAMXqL36TKMVhMa6vv7',
  hivemind:   'price_1TdhtuAMXqL36TKMktHMRFS2',
  extra_seat: 'price_1TdhwnAMXqL36TKM0Y0tOwRO',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { plan = 'starter', email, userId, trial = false } = req.body;

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const origin = req.headers.origin || 'https://hiveflo.app';

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${origin}/dashboard.html?signup=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/signup.html?canceled=true`);
    if (email) params.append('customer_email', email);
    if (userId) params.append('subscription_data[metadata][supabase_user_id]', userId);
    params.append('subscription_data[metadata][plan]', plan);
    // 30-day free trial for referred signups
    if (trial) params.append('subscription_data[trial_period_days]', '30');

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(500).json({ error: err.error?.message || 'Stripe error' });
    }

    const session = await response.json();
    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
