// netlify/functions/myapi.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Only POST allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: OPENROUTER_API_KEY missing' }) };
  }

  const model = body.model || 'openai/gpt-4.1-mini';
  const messages = body.messages || [{ role: 'user', content: body.prompt || 'Hello' }];

  const payload = { model, messages };

  const TIMEOUT_MS = 30000; // 30s per attempt
  const RETRIES = 2;

  const fetchWithTimeout = (url, opts = {}) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    return fetch(url, { ...opts, signal: controller.signal })
      .finally(() => clearTimeout(id));
  };

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout('https://api.openrouter.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let json;
      try { json = text ? JSON.parse(text) : null; } catch (e) { json = { raw: text } }

      if (res.ok) {
        return { statusCode: 200, body: JSON.stringify(json), headers: { 'Access-Control-Allow-Origin': '*' } };
      }

      // retry transient
      if ((res.status === 429 || res.status === 503 || res.status === 504) && attempt < RETRIES) {
        await new Promise(r => setTimeout(r, 300 * (attempt+1)));
        continue;
      }

      // non-retryable error -> forward details
      return { statusCode: res.status || 502, body: JSON.stringify({ error: json || text }) };
    } catch (err) {
      if (err.name === 'AbortError') {
        if (attempt < RETRIES) {
          await new Promise(r => setTimeout(r, 300 * (attempt+1)));
          continue;
        }
        return { statusCode: 504, body: JSON.stringify({ error: 'Upstream timeout' }) };
      }
      if (attempt < RETRIES) {
        await new Promise(r => setTimeout(r, 300 * (attempt+1)));
        continue;
      }
      return { statusCode: 502, body: JSON.stringify({ error: String(err) }) };
    }
  }

  return { statusCode: 502, body: JSON.stringify({ error: 'Exhausted retries' }) };
};
