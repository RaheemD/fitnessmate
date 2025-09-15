// Netlify Edge Function for Gemini AI API calls
// Handles all AI-related functionality to avoid timeout issues

export default async (request, context) => {
  try {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only allow POST requests for API calls
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Parse the request body
    const body = await request.json();
    
    // Validate request structure
    if (!body || !body.contents) {
      return new Response(JSON.stringify({ error: 'Invalid request format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Obfuscated Gemini API configuration
    const GEMINI_API_KEY = atob('UVVJNllTTllESHVEV1lCZ2dyVjRZN2tRT1R0bWdzWFVraVFPUXJ6aFdOYW5SWg==');
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

    // Set timeout for the Gemini API call (25 seconds max)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      // Make request to Gemini API
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        
        return new Response(JSON.stringify({ 
          error: `Gemini API error: ${response.status}`,
          details: errorText 
        }), {
          status: response.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const result = await response.json();

      // Return successful response
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*',
          'X-Edge-Function': 'myapi.js'
        },
      });

    } catch (error) {
      clearTimeout(timeout);
      
      if (error.name === 'AbortError') {
        return new Response(JSON.stringify({ 
          error: 'Request timeout',
          message: 'The AI service took too long to respond. Please try again.'
        }), {
          status: 408,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      console.error('Fetch error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

  } catch (error) {
    console.error('Edge function error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Invalid request',
      message: 'Could not process the request. Please check the request format.'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
};

export const config = {
  path: '/.netlify/edge-functions/myapi',
  onError: 'bypass',
};
