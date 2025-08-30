import axios from 'axios';

export default async function handler(req, res) {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.status(200).end();
    return;
  }

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    // Extract the path from the request
    const path = req.query['[...path]'] || req.url.replace('/api/homeassistant', '');
    const region = req.query.region || 'eu';
    
    // Build the target URL
    const targetUrl = `https://px1.tuya${region}.com/homeassistant${path}`;
    
    console.log(`[API] Request to: ${targetUrl}`);
    console.log(`[API] Method: ${req.method}`);
    console.log(`[API] Headers:`, req.headers);
    
    if (req.body) {
      console.log(`[API] Request Body:`, req.body);
    }

    // Prepare headers for the Tuya API
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': `https://px1.tuya${region}.com/`,
      'Origin': `https://px1.tuya${region}.com`,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    // Make the request to Tuya API
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: req.body,
      timeout: 30000,
      validateStatus: () => true // Don't throw on any status code
    });

    console.log(`[API] Response Status: ${response.status}`);
    console.log(`[API] Response Headers:`, response.headers);
    console.log(`[API] Response Data:`, response.data);

    // Forward the response
    res.status(response.status);
    
    // Copy relevant headers
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    
    // Send the response
    res.json(response.data);

  } catch (error) {
    console.error(`[API] Error:`, error.message);
    console.error(`[API] Error Stack:`, error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({
        error: "API Error",
        message: error.message,
        timestamp: new Date().toISOString(),
        details: {
          code: error.code,
          response: error.response?.data
        }
      });
    }
  }
}
