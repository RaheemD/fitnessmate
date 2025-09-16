// netlify/edge-functions/myapi.js
// Netlify Edge Function (Deno runtime). Paste exactly and deploy.

export default async (request) => {
  // Handle preflight CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // Only POST allowed
  if (request.method !== "POST") {
    return jsonError("Method not allowed. Use POST.", 405);
  }

  // Get OpenRouter API key from Netlify environment (make sure variable is set)
  const apiKey = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (!apiKey) return jsonError("Server misconfigured: OPENROUTER_API_KEY missing", 500);

  // Parse request body safely
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonError("Unable to parse JSON body", 400);
  }

  // Basic payload safeguard for OpenRouter format
  const payload = body || {};
  if (!payload.messages && !payload.prompt) {
    return jsonError("Missing 'messages' or 'prompt' in request body", 400);
  }

  // Build OpenRouter endpoint
  const openRouterUrl = "https://openrouter.ai/api/v1/chat/completions";

  // Build request body for OpenRouter (normalize simple prompt to required format)
  let requestBody;
  if (payload.messages) {
    // assume frontend provided a full OpenRouter-style payload
    requestBody = payload;
  } else {
    requestBody = {
      model: payload.model || "openai/gpt-4o-mini",
      messages: [{ role: "user", content: String(payload.prompt) }],
      // Add other fields if needed (temperature, max_tokens, etc.)
    };
  }

  // helper: fetch with timeout (AbortController)
  async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  try {
    const resp = await fetchWithTimeout(openRouterUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-Title": "Fitmate",
        "HTTP-Referer": "https://fitnessmate.netlify.app"
      },
      body: JSON.stringify(requestBody),
    }, 10000); // 10s timeout - adjust if needed

    const text = await resp.text().catch(() => "");
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }

    if (!resp.ok) {
      // Return provider status and message to frontend for debugging
      const msg = json?.error?.message || json?.error || json?.message || text || `Provider returned ${resp.status}`;
      return jsonError(msg, resp.status);
    }

    // Success — return normalized JSON + CORS headers
    return new Response(JSON.stringify({ ok: true, data: json }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    // Distinguish abort/timeouts
    if (err.name === "AbortError") {
      return jsonError("Provider request timed out", 504);
    }
    // Network or other errors
    return jsonError(`Internal fetch error: ${err.message || String(err)}`, 502);
  }

  // helper to return consistent JSON error responses with CORS
  function jsonError(message, status = 500) {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
