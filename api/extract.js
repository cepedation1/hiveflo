// api/extract.js — HiveFlow Card Extraction AI
// Vercel serverless function — calls claude-sonnet-4-6 vision
// Deploy to: cepedation1/hiveflo/api/extract.js
// Requires env var: ANTHROPIC_API_KEY

export const config = { runtime: 'edge' };

export default async function handler(req) {
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
    const body = await req.json();
    const { image, mediaType = 'image/jpeg' } = body;

    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image },
            },
            {
              type: 'text',
              text: `Extract all contact info from this business card or document image.
Return ONLY a valid JSON object with these exact fields (empty string if not found):
{
  "first_name": "",
  "last_name": "",
  "full_name": "",
  "title": "",
  "company": "",
  "phone": "",
  "phone2": "",
  "email": "",
  "website": "",
  "address": "",
  "city": "",
  "state": "",
  "zip": "",
  "linkedin": "",
  "instagram": "",
  "notes": ""
}
For notes, include taglines, specialties, or credentials on the card.
Return ONLY the JSON object, no other text.`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(JSON.stringify({ error: 'AI extraction error', details: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '{}';

    let contactData = {};
    try {
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      contactData = JSON.parse(cleaned);
    } catch (e) {
      contactData = { notes: rawText };
    }

    return new Response(JSON.stringify({ contact: contactData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
