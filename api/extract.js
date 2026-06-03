// api/extract.js — HiveFlow Card Extraction AI
// Vercel Node.js Serverless Function
// Requires env var: ANTHROPIC_API_KEY

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
    const { image, mediaType = 'image/jpeg' } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No image provided' });
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
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            {
              type: 'text',
              text: `Extract all contact info from this business card image. Return ONLY a valid JSON object with these exact fields (empty string if not found): {"first_name":"","last_name":"","full_name":"","title":"","company":"","phone":"","phone2":"","email":"","website":"","address":"","city":"","state":"","zip":"","linkedin":"","instagram":"","notes":""}. For notes include taglines or credentials. Return ONLY the JSON object, no other text.`
            }
          ]
        }]
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'AI extraction error', details: err });
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

    return res.status(200).json({ contact: contactData });

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
