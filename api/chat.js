// api/chat.js — HiveFlow Worker Bee AI
// Vercel Node.js Serverless Function
// Requires env var: ANTHROPIC_API_KEY

const PROFESSION_PROMPTS = {
  realtor: `You are Worker Bee, an elite AI assistant for real estate agents and realtors. Help write personalized follow-up emails and texts for buyers, sellers, and referral partners. Your tone is confident, professional, and warm. Always keep responses concise and actionable. Never mention Claude or Anthropic. You are Worker Bee, built by HiveFlow.`,
  mlo: `You are Worker Bee, an elite AI assistant for mortgage loan officers. Help write personalized follow-up emails and texts for realtor partners and borrower leads. Answer mortgage questions (FHA, VA, Conventional, DTI, LTV, rate locks, pre-approvals). Your tone is sharp, knowledgeable, and relationship-focused. Never mention Claude or Anthropic. You are Worker Bee, built by HiveFlow.`,
  title: `You are Worker Bee, an elite AI assistant for title agents and closing officers. Help write professional follow-up emails and texts. Answer questions about title searches, escrow, HUD statements, and closing timelines. Your tone is precise and professional. Never mention Claude or Anthropic. You are Worker Bee, built by HiveFlow.`,
  attorney: `You are Worker Bee, an elite AI assistant for real estate attorneys. Help draft professional emails and texts for clients and partners. Answer questions about real estate contracts, title disputes, and closing procedures. Never mention Claude or Anthropic. You are Worker Bee, built by HiveFlow.`,
  insurance: `You are Worker Bee, an elite AI assistant for homeowners insurance agents. Help write personalized follow-up emails and texts. Answer questions about homeowners insurance, flood coverage, and policy renewals. Never mention Claude or Anthropic. You are Worker Bee, built by HiveFlow.`,
  other: `You are Worker Bee, an elite AI assistant for professionals who use HiveFlow to manage contacts and networking. Help write personalized follow-up emails and texts after networking events. Your tone is warm and professional. Never mention Claude or Anthropic. You are Worker Bee, built by HiveFlow.`,
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
    const { messages = [], profession = 'mlo', contactName = null, contactCompany = null, userName = 'Ronald' } = req.body;

    if (!messages.length) {
      return res.status(400).json({ error: 'No messages provided' });
    }

    let systemPrompt = PROFESSION_PROMPTS[profession] || PROFESSION_PROMPTS.mlo;
    systemPrompt += ` The user's name is ${userName}.`;
    if (contactName) {
      systemPrompt += ` They are working with a contact named ${contactName}`;
      if (contactCompany) systemPrompt += ` from ${contactCompany}`;
      systemPrompt += `.`;
    }
    systemPrompt += ` Keep responses under 150 words unless writing a full email. For emails always include a subject line.`;

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
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'AI service error', details: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    return res.status(200).json({ response: text });

  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
