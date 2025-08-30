import { createProxyMiddleware } from "http-proxy-middleware";

const proxy = createProxyMiddleware({
  target: "https://px1.tuyaeu.com",
  changeOrigin: true,
  secure: false,
  timeout: 60000,
  pathRewrite: {
    "^/api/homeassistant": "/homeassistant",
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(
      `[Proxy] Proxying to: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`
    );

    // Simulate a valid domain by setting proper headers
    proxyReq.setHeader('Referer', 'https://px1.tuyaeu.com/');
    proxyReq.setHeader('Origin', 'https://px1.tuyaeu.com');
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Remove any localhost headers that might cause issues
    proxyReq.removeHeader('host');
    proxyReq.removeHeader('x-forwarded-host');
    proxyReq.removeHeader('x-forwarded-proto');

    // Log request body if available
    if (req.body) {
      console.log(`[Proxy] Request Body: ${JSON.stringify(req.body)}`);
    }
    
    console.log(`[Proxy] Request Headers:`, proxyReq.getHeaders());
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy] Response Status: ${proxyRes.statusCode}`);

    // Log response headers
    console.log(`[Proxy] Response Headers:`, proxyRes.headers);
    
    // Log response body for debugging
    let body = [];
    proxyRes.on('data', (chunk) => {
      body.push(chunk);
    });
    proxyRes.on('end', () => {
      try {
        const responseBody = Buffer.concat(body).toString();
        console.log(`[Proxy] Response Body: ${responseBody}`);
      } catch (error) {
        console.error(`[Proxy] Error parsing response body: ${error.message}`);
      }
    });
  },
  onError: (err, req, res) => {
    console.error(`[Proxy] Error: ${err.message}`);
    console.error(`[Proxy] Error Code: ${err.code}`);
    console.error(`[Proxy] Error Stack: ${err.stack}`);

    if (!res.headersSent) {
      res.status(500).json({
        error: "Proxy Error",
        message: err.message,
        code: err.code,
        timestamp: new Date().toISOString(),
      });
    }
  },
});

export default function handler(req, res) {
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

  // Use the proxy middleware
  return proxy(req, res);
}
