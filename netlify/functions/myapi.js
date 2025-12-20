// Netlify Function: myapi
// Purpose: Proxy AI requests to OpenRouter with flexible payload support.
// Note: Uses the global fetch provided by Netlify's Node runtime.

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        // Allow common headers used by the frontend
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Title, HTTP-Referer, X-Requested-With",
      },
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const key = process.env.OPENROUTER_API_KEY;

    if (!key) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing API key" }),
      };
    }

    // Normalize payload: accept either full OpenRouter payload or a simple prompt
    let payload;
    if (body && (body.messages || body.model)) {
      // Use body as-is for advanced requests (includes images, system prompts, etc.)
      payload = body;
    } else {
      // Construct a simple chat payload from a prompt
      payload = {
        model: body.model || "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: String(body.prompt || "Hello") }],
        max_tokens: body.max_tokens || 300,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.2,
      };
      if (body.image_url) payload.image_url = body.image_url;
      if (body.image_base64) payload.image_base64 = body.image_base64;
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Content-Length, Content-Type",
        "Content-Type": "application/json",
        // Encourage HTTP/1.1 behavior in some edge cases
        "Connection": "close",
      },
      body: text,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Connection": "close" },
      body: JSON.stringify({ error: String(error) }),
    };
  }
};
