export default async function handler(request, context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { GEMINI_API_KEY } = context.env ?? {};
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await request.json();

    // Build Gemini endpoint
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);

    // Enforce a 24s timeout to avoid Netlify limits
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 24000);

    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(id);

    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    const status = err.name === 'AbortError' ? 504 : 500;
    return new Response(JSON.stringify({ error: err.message || 'Edge error' }), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

export const config = {
  path: '/api/myapi',
};
