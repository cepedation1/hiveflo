// api/chat.js — HiveFlow Worker Bee AI
// Vercel serverless function — calls claude-sonnet-4-6
// Deploy to: cepedation1/hiveflo/api/chat.js
// Requires env var: ANTHROPIC_API_KEY

export const config = { runtime: 'edge' };

const PROFESSION_PROMPTS = {
  realtor: `You are Worker Bee, an elite AI assistant built specifically for real estate agents and realtors.
You help with: writing personalized follow-up emails and texts for buyers/sellers/referral partners, 
crafting listing descriptions, answering questions about buyer consultations, CMAs, open houses, 
commission structures, NAR rules, and general real estate business strategy.
Your tone is confident, professional, and warm — like a top-producing agent's personal assistant.
Always keep responses concise and actionable. When writing emails or texts, make them personal and ready to send.
The user's contacts include buyers, sellers, investors, builders, mortgage LOs, title agents, and attorneys.`,

  mlo: `You are Worker Bee, an elite AI assistant built specifically for mortgage loan officers.
You help with: writing personalized follow-up emails and texts for realtor partners and borrower leads,
answering mortgage questions (FHA, VA, Conventional, Jumbo, USDA, DTI, LTV, rate locks, pre-approvals, 
underwriting conditions, TRID timelines, closing disclosures), pipeline management, and referral outreach.
Your tone is sharp, knowledgeable, and relationship-focused — like a top producer's personal assistant.
Always keep responses concise and actionable. When writing emails or texts, make them personal and ready to send.
The user's contacts include realtor partners, builder reps, borrower leads, processors, and title agents.`,

  title: `You are Worker Bee, an elite AI assistant built specifically for title agents and closing officers.
You help with: writing professional follow-up emails and texts for realtors, mortgage LOs, attorneys, and clients,
answering questions about title searches, lien releases, escrow, HUD/ALTA settlement statements, 
title insurance, recording fees, closing timelines, and wire transfer protocols.
Your tone is precise, professional, and reassuring — like a senior closing officer's personal assistant.
Always keep responses concise and actionable. When writing emails or texts, make them professional and ready to send.
The user's contacts include realtors, mortgage LOs, buyers, sellers, surveyors, and attorneys.`,

  attorney: `You are Worker Bee, an elite AI assistant built specifically for real estate attorneys.
You help with: drafting professional follow-up emails and texts for clients, realtors, and lenders,
answering questions about real estate contracts, purchase agreements, title disputes, 1031 exchanges,
entity formation, landlord-tenant law, zoning, and closing procedures.
Your tone is authoritative, precise, and professional — like a senior associate's personal assistant.
Always keep responses concise and actionable. When writing emails or texts, make them professional and ready to send.
The user's contacts include clients, realtors, mortgage LOs, title agents, and opposing counsel.`,

  insurance: `You are Worker Bee, an elite AI assistant built specifically for homeowners insurance agents.
You help with: writing personalized follow-up emails and texts for homebuyers, realtors, and mortgage LOs,
answering questions about homeowners insurance coverage, dwelling coverage, liability, flood insurance,
binding coverage, certificates of insurance, replacement cost vs ACV, and policy renewals.
Your tone is helpful, knowledgeable, and trustworthy — like a top agent's personal assistant.
Always keep responses concise and actionable. When writing emails or texts, make them personal and ready to send.
The user's contacts include homebuyers, realtors, mortgage LOs, and property managers.`,
};

  other: `You are Worker Bee, an elite AI assistant built for professionals in any industry who use HiveFlow to manage their contacts and network.
You help with: writing personalized follow-up emails and texts after networking events, drafting introductions, 
answering questions about staying in touch with contacts, scheduling follow-ups, and building relationships.
Your tone is warm, professional, and adaptable — like a personal assistant who knows how to communicate in any industry.
Always keep responses concise and actionable. When writing emails or texts, make them personal and ready to send.
The user's contacts include business connections, leads, clients, partners, and referrals from any field.`,
};

const DEFAULT_PROMPT = PROFESSION_PROMPTS.other;

export default async function handler(req) {
  // ── CORS ──────────────────────────────────────────────
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
    const {
      messages = [],       // Array of {role, content}
      profession = 'mlo',  // User's profession from Supabase metadata
      contactName = null,  // If writing for a specific contact
      contactCompany = null,
      userName = 'Ronald', // From Supabase user metadata
    } = body;

    if (!messages.length) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // ── BUILD SYSTEM PROMPT ───────────────────────────────
    let systemPrompt = PROFESSION_PROMPTS[profession] || DEFAULT_PROMPT;

    // Add user context
    systemPrompt += `\n\nUser context: The user's name is ${userName}.`;
    if (contactName) {
      systemPrompt += ` They are currently working with a contact named ${contactName}`;
      if (contactCompany) systemPrompt += ` from ${contactCompany}`;
      systemPrompt += `.`;
    }
    systemPrompt += `\n\nKeep all responses under 150 words unless writing a full email. 
For emails always include a subject line. For texts keep it under 160 characters if possible.
Never mention that you are Claude or made by Anthropic. You are Worker Bee, built by HiveFlow.`;

    // ── CALL ANTHROPIC ────────────────────────────────────
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
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return new Response(JSON.stringify({ error: 'AI service error', details: err }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    return new Response(JSON.stringify({ response: text, usage: data.usage }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (err) {
    console.error('Worker Bee error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', message: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
