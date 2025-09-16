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

  // Get API key from Netlify environment (make sure variable is set)
  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  if (!apiKey) return jsonError("Server misconfigured: GEMINI_API_KEY missing", 500);

  // Parse request body safely
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonError("Unable to parse JSON body", 400);
  }

  // Basic payload safeguard (adjust as your frontend sends)
  // Allow either 'prompt' or 'contents' payloads - adapt if needed
  const payload = body || {};
  if (!payload.prompt && !payload.contents) {
    return jsonError("Missing 'prompt' or 'contents' in request body", 400);
  }

  // Build Google Gemini endpoint (stable 2.5 flash)
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Build request body for Gemini (normalize simple prompt to required format)
  let requestBody;
  if (payload.contents) {
    // assume frontend provided a full Gemini-style payload
    requestBody = payload;
  } else {
    requestBody = {
      contents: [{ parts: [{ text: String(payload.prompt) }] }],
      // Add other fields if you need (temperature, safety settings, etc.)
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
    const resp = await fetchWithTimeout(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
