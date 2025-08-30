import { createProxyMiddleware } from 'http-proxy-middleware'

const proxy = createProxyMiddleware({
  target: 'https://px1.tuyaeu.com',
  changeOrigin: true,
  secure: false,
  timeout: 30000,
  pathRewrite: {
    '^/api/homeassistant': '/homeassistant'
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] Proxying to: ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`)
    
    // Log request body if available
    if (req.body) {
      console.log(`[Proxy] Request Body: ${JSON.stringify(req.body)}`)
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy] Response Status: ${proxyRes.statusCode}`)
  },
  onError: (err, req, res) => {
    console.error(`[Proxy] Error: ${err.message}`)
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Proxy Error',
        message: err.message,
        timestamp: new Date().toISOString()
      })
    }
  }
})

export default function handler(req, res) {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.status(200).end()
    return
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Use the proxy middleware
  return proxy(req, res)
}


