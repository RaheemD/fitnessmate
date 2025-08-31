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
    
    // Only handle Menu Decoder requests with image data
    if (!body.contents || !body.contents[0] || !body.contents[0].parts) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid menu decoder request' })
      };
    }

    // Set longer timeout and optimize for image processing
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=" + API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify(data)
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Menu analysis failed', 
        message: error.message 
      })
    };
  }
}