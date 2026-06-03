// api/create-checkout.js — HiveFlow Stripe Checkout
// Vercel serverless function
// Deploy to: cepedation1/hiveflo/api/create-checkout.js
// Requires env vars: STRIPE_SECRET_KEY in Vercel dashboard

export const config = { runtime: 'edge' };

const PRICE_IDS = {
  starter:  'price_1TdhqnAMXqL36TKMVhMa6vv7',  // $7/mo Starter
  hivemind: 'price_1TdhtuAMXqL36TKMktHMRFS2',  // $15/mo Pro
  extra_seat: 'price_1TdhwnAMXqL36TKM0Y0tOwRO', // $5/mo Extra Seat
};

export default async function handler(req) {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { plan = 'starter', email, userId, ref = null } = await req.json();

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'Invalid plan' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const origin = req.headers.get('origin') || 'https://hiveflo.app';

    // Create Stripe checkout session server-side
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${origin}/dashboard.html?signup=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${origin}/signup.html?canceled=true`);
    if (email) params.append('customer_email', email);
    // Store userId in metadata so webhook can link Stripe to Supabase
    if (userId) params.append('subscription_data[metadata][supabase_user_id]', userId);
    params.append('subscription_data[metadata][plan]', plan);
    // 30-day free trial for referred signups
    if (ref) {
      params.append('subscription_data[trial_period_days]', '30');
      params.append('subscription_data[metadata][referred_by]', ref);
    }

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
      return new Response(JSON.stringify({ error: err.error?.message || 'Stripe error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const session = await response.json();

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
