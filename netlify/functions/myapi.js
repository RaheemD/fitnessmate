export async function handler(event, context) {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    
    // Handle both simple prompt and complex payload formats
    let requestBody;
    if (body.prompt) {
      // Simple format from other components
      requestBody = {
        contents: [{ parts: [{ text: body.prompt }] }]
      };
    } else if (body.contents) {
      // Complex format from Coach component
      requestBody = body;
    } else {
      requestBody = {
        contents: [{ parts: [{ text: "Hello Gemini" }] }]
      };
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=" + API_KEY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Remove the Authorization header - Gemini uses query parameter
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}

