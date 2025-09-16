// netlify/edge-functions/myapi.js
export default async (request) => {
  // CORS preflight
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

  function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Only POST
  if (request.method !== "POST") return jsonResponse({ error: "Only POST allowed" }, 405);

  // Check key presence (don't print the key)
  const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY");
  console.log("OPENROUTER_KEY present?", !!OPENROUTER_KEY);
  if (!OPENROUTER_KEY) return jsonResponse({ error: "Server misconfigured: OPENROUTER_API_KEY missing" }, 500);

  // Parse JSON safely
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("Invalid JSON in request body:", err);
    return jsonResponse({ error: "Invalid JSON in request body" }, 400);
  }

  // Validate payload
  if (!body.messages && !body.prompt) {
    return jsonResponse({ error: "Missing 'messages' or 'prompt' in body" }, 400);
  }

  const model = body.model || "openai/gpt-4.1-mini";
  const payload = body.messages ? { ...body, model } : { model, messages: [{ role: "user", content: String(body.prompt) }] };

  const OPENROUTER_URL = "https://api.openrouter.ai/v1/chat/completions";
  const TIMEOUT_MS = 20000; // 20s per attempt
  const RETRIES = 2;

  async function fetchWithTimeout(url, opts = {}, timeout = TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  // Try / retry loop
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      console.log(`Calling OpenRouter (attempt ${attempt+1}) model=${model}`);
      const res = await fetchWithTimeout(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_KEY}`
        },
        body: JSON.stringify(payload),
      }, TIMEOUT_MS);

      const text = await res.text().catch(() => "");
      // Always log response status and length (not the full body)
      console.log("OpenRouter status:", res.status, "responseLength:", text ? text.length : 0);

      // If empty body, handle gracefully
      if (!text) {
        if (res.ok) {
          // Unexpected: OK with no body — return a friendly message
          return jsonResponse({ ok: true, data: null, note: "Empty response from OpenRouter" }, 200);
        } else {
          // non-OK with empty body -> return status and message
          return jsonResponse({ error: `Upstream returned ${res.status} with empty body` }, res.status || 502);
        }
      }

      // parse JSON if possible
      let json;
      try { json = JSON.parse(text); } catch (e) {
        // Upstream returned non-json — return raw text in a safe wrapper
        console.warn("OpenRouter returned non-JSON response");
        return jsonResponse({ error: "Upstream returned non-JSON response", raw: text }, res.status || 502);
      }

      // Successful upstream
      if (res.ok) {
        return jsonResponse({ ok: true, data: json }, 200);
      }

      // Retry on transient
      if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < RETRIES) {
        const backoff = 300 * (attempt + 1);
        console.warn(`Transient upstream ${res.status}, retrying after ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      // Non-retryable error — forward parsed json if any
      return jsonResponse({ error: json || `Upstream returned ${res.status}` }, res.status || 502);
    } catch (err) {
      console.error("Fetch error:", err && err.message ? err.message : String(err));
      if (err.name === "AbortError") {
        if (attempt < RETRIES) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        return jsonResponse({ error: "Upstream request timed out" }, 504);
      }
      if (attempt < RETRIES) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      return jsonResponse({ error: `Network/fetch error: ${err.message || String(err)}` }, 502);
    }
  }

  return jsonResponse({ error: "Exhausted retries" }, 502);
};
