// netlify/edge-functions/myapi.js
// Netlify Edge (Deno) — OpenRouter proxy example
export default async (request) => {
  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (request.method !== "POST") {
    return jsonError("Only POST allowed", 405);
  }

  // Use Deno.env for Edge functions
  const OR_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (!OR_KEY) return jsonError("Server misconfigured: OPENROUTER_API_KEY missing", 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonError("Invalid JSON body", 400);
  }

  // Basic check: ensure the frontend isn't trying to send credentials
  // Build OpenRouter request (you can pass model from frontend: body.model)
  const model = body.model || "deepseek/deepseek-chat-v3.1:free";
  const payload = {
    model,
    messages: body.messages || [{ role: "user", content: body.prompt || "Hello" }]
  };

  try {
    const res = await fetch("https://api.openrouter.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OR_KEY}`
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch(e){ json = { raw: text }; }

    if (res.status === 401) {
      // Helpful message so you can debug
      return jsonError("OpenRouter 401 Unauthorized — check OPENROUTER_API_KEY in Netlify env", 401);
    }

    if (!res.ok) {
      const msg = json?.error?.message || json?.error || json?.message || text || `Upstream ${res.status}`;
      return jsonError(`Upstream error: ${msg}`, res.status);
    }

    return new Response(JSON.stringify({ ok: true, data: json }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return jsonError("Fetch error: " + (err.message || String(err)), 502);
  }

  function jsonError(message, status = 500) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
};
